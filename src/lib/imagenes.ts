import { supabase } from './supabase'

const BUCKET = 'encargos-imagenes'
const MAX_MB = 6

const limpiarNombre = (nombre: string) =>
  nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()

export const validarImagen = (archivo: File) => {
  const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp']

  if (!tiposPermitidos.includes(archivo.type)) {
    return 'La imagen debe ser JPG, PNG o WEBP.'
  }

  if (archivo.size > MAX_MB * 1024 * 1024) {
    return `La imagen no puede pesar más de ${MAX_MB} MB.`
  }

  return ''
}

export const subirImagenReferencia = async (archivo: File, usuarioId: string) => {
  const errorValidacion = validarImagen(archivo)

  if (errorValidacion) {
    throw new Error(errorValidacion)
  }

  const ruta = `${usuarioId}/${Date.now()}-${limpiarNombre(archivo.name)}`

  const { error } = await supabase.storage.from(BUCKET).upload(ruta, archivo, {
    cacheControl: '3600',
    contentType: archivo.type,
    upsert: false,
  })

  if (error) {
    throw error
  }

  return ruta
}

export const eliminarImagenReferencia = async (ruta: string) => {
  if (!ruta || ruta.startsWith('http')) {
    return
  }

  await supabase.storage.from(BUCKET).remove([ruta])
}

export const obtenerUrlImagen = async (ruta: string | null) => {
  if (!ruta) {
    return null
  }

  if (ruta.startsWith('http://') || ruta.startsWith('https://')) {
    return ruta
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(ruta, 60 * 60)

  if (error) {
    console.error('No se pudo crear la URL de la imagen:', error)
    return null
  }

  return data.signedUrl
}
