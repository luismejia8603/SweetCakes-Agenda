import { supabase } from './supabase'

const BUCKET = 'encargos-imagenes'
const MAX_ORIGINAL_MB = 20
const MAX_DIMENSION_INICIAL = 1600
const OBJETIVO_BYTES = 1.1 * 1024 * 1024
const LIMITE_FINAL_BYTES = 1.8 * 1024 * 1024

const limpiarNombre = (nombre: string) =>
  nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'imagen'

export const validarImagen = (archivo: File) => {
  const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp']

  if (!tiposPermitidos.includes(archivo.type)) {
    return 'La imagen debe ser JPG, PNG o WEBP.'
  }

  if (archivo.size > MAX_ORIGINAL_MB * 1024 * 1024) {
    return `La imagen original no puede pesar más de ${MAX_ORIGINAL_MB} MB.`
  }

  return ''
}

const cargarImagen = (archivo: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(archivo)
    const imagen = new Image()

    imagen.onload = () => {
      URL.revokeObjectURL(url)
      resolve(imagen)
    }

    imagen.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo leer la imagen seleccionada.'))
    }

    imagen.src = url
  })

const calcularDimensiones = (
  anchoOriginal: number,
  altoOriginal: number,
  maximo: number,
) => {
  if (anchoOriginal <= maximo && altoOriginal <= maximo) {
    return { ancho: anchoOriginal, alto: altoOriginal }
  }

  const escala = Math.min(maximo / anchoOriginal, maximo / altoOriginal)

  return {
    ancho: Math.max(1, Math.round(anchoOriginal * escala)),
    alto: Math.max(1, Math.round(altoOriginal * escala)),
  }
}

const canvasABlob = (
  canvas: HTMLCanvasElement,
  tipo: 'image/webp' | 'image/jpeg',
  calidad: number,
) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('No se pudo comprimir la imagen.'))
          return
        }

        resolve(blob)
      },
      tipo,
      calidad,
    )
  })

const exportarOptimizada = async (canvas: HTMLCanvasElement, calidad: number) => {
  const webp = await canvasABlob(canvas, 'image/webp', calidad)

  if (webp.type === 'image/webp') {
    return webp
  }

  return canvasABlob(canvas, 'image/jpeg', calidad)
}

export const comprimirImagenReferencia = async (archivo: File) => {
  const errorValidacion = validarImagen(archivo)

  if (errorValidacion) {
    throw new Error(errorValidacion)
  }

  const imagen = await cargarImagen(archivo)
  const canvas = document.createElement('canvas')
  const contexto = canvas.getContext('2d')

  if (!contexto) {
    throw new Error('Tu navegador no pudo preparar la imagen para subirla.')
  }

  contexto.imageSmoothingEnabled = true
  contexto.imageSmoothingQuality = 'high'

  const dimensiones = [MAX_DIMENSION_INICIAL, 1400, 1200, 1000]
  const calidades = [0.78, 0.7, 0.62]
  let ultimoBlob: Blob | null = null

  for (const maximo of dimensiones) {
    const { ancho, alto } = calcularDimensiones(
      imagen.naturalWidth,
      imagen.naturalHeight,
      maximo,
    )

    canvas.width = ancho
    canvas.height = alto
    contexto.clearRect(0, 0, ancho, alto)
    contexto.drawImage(imagen, 0, 0, ancho, alto)

    for (const calidad of calidades) {
      const blob = await exportarOptimizada(canvas, calidad)
      ultimoBlob = blob

      if (blob.size <= OBJETIVO_BYTES) {
        const extension = blob.type === 'image/webp' ? 'webp' : 'jpg'

        return new File([blob], `${limpiarNombre(archivo.name)}.${extension}`, {
          type: blob.type,
          lastModified: Date.now(),
        })
      }
    }
  }

  if (!ultimoBlob || ultimoBlob.size > LIMITE_FINAL_BYTES) {
    throw new Error(
      'No se pudo reducir la imagen lo suficiente. Intenta con otra foto o una imagen más pequeña.',
    )
  }

  const extension = ultimoBlob.type === 'image/webp' ? 'webp' : 'jpg'

  return new File([ultimoBlob], `${limpiarNombre(archivo.name)}.${extension}`, {
    type: ultimoBlob.type,
    lastModified: Date.now(),
  })
}

export const subirImagenReferencia = async (archivo: File, usuarioId: string) => {
  const archivoOptimizado = await comprimirImagenReferencia(archivo)
  const ruta = `${usuarioId}/${Date.now()}-${archivoOptimizado.name}`

  const { error } = await supabase.storage.from(BUCKET).upload(ruta, archivoOptimizado, {
    cacheControl: '3600',
    contentType: archivoOptimizado.type,
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

  const { error } = await supabase.storage.from(BUCKET).remove([ruta])

  if (error) {
    console.error('No se pudo eliminar la imagen de referencia:', error)
  }
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
