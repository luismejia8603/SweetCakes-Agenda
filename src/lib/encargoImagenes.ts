import { supabase } from './supabase'

export type ImagenEncargo = {
  id: string
  encargo_id: string | number
  ruta_storage: string
  orden: number
  creado_por?: string | null
  created_at?: string | null
}

export const MAX_IMAGENES_POR_ENCARGO = 5

export const cargarImagenesEncargo = async (
  encargoId: string | number,
  rutaLegacy?: string | null,
) => {
  const { data, error } = await supabase
    .from('encargo_imagenes')
    .select('id,encargo_id,ruta_storage,orden,creado_por,created_at')
    .eq('encargo_id', encargoId)
    .order('orden', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('No se pudieron cargar las imágenes del encargo:', error)
    if (rutaLegacy) {
      return [{ id: `legacy-${String(encargoId)}`, encargo_id: encargoId, ruta_storage: rutaLegacy, orden: 0 }] as ImagenEncargo[]
    }
    return []
  }

  if ((!data || data.length === 0) && rutaLegacy) {
    return [{ id: `legacy-${String(encargoId)}`, encargo_id: encargoId, ruta_storage: rutaLegacy, orden: 0 }] as ImagenEncargo[]
  }

  return (data ?? []) as ImagenEncargo[]
}

export const insertarImagenesEncargo = async (
  encargoId: string | number,
  rutas: string[],
  usuarioId: string,
  ordenInicial = 0,
) => {
  if (!rutas.length) return [] as ImagenEncargo[]

  const registros = rutas.map((ruta, indice) => ({
    encargo_id: encargoId,
    ruta_storage: ruta,
    orden: ordenInicial + indice,
    creado_por: usuarioId,
  }))

  const { data, error } = await supabase
    .from('encargo_imagenes')
    .insert(registros)
    .select('id,encargo_id,ruta_storage,orden,creado_por,created_at')

  if (error) throw error
  return (data ?? []) as ImagenEncargo[]
}

export const eliminarRegistrosImagenes = async (ids: string[]) => {
  const idsReales = ids.filter((id) => !id.startsWith('legacy-'))
  if (!idsReales.length) return

  const { error } = await supabase.from('encargo_imagenes').delete().in('id', idsReales)
  if (error) throw error
}

export const actualizarImagenLegacy = async (encargoId: string | number) => {
  const { data, error } = await supabase
    .from('encargo_imagenes')
    .select('ruta_storage')
    .eq('encargo_id', encargoId)
    .order('orden', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1)

  if (error) throw error

  const { error: errorActualizar } = await supabase
    .from('encargos')
    .update({ imagen_referencia: data?.[0]?.ruta_storage ?? null })
    .eq('id', encargoId)

  if (errorActualizar) throw errorActualizar
}
