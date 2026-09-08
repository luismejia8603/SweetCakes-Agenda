import { supabase } from './supabase'

export type EstadoGoogleCalendar = {
  connected: boolean
  canManage: boolean
  ownerName: string | null
  connectedAt: string | null
}

export type ResultadoSincronizacion = {
  synced: boolean
  reason?: 'not_connected' | string
  deleted?: boolean
  eventId?: string | null
  eventUrl?: string | null
  syncedAt?: string | null
  total?: number
  correctos?: number
  errores?: number
}

const invocarGoogleCalendar = async <T>(body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke('google-calendar', {
    body,
  })

  if (error) {
    throw error
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  return data as T
}

export const obtenerEstadoGoogleCalendar = () =>
  invocarGoogleCalendar<EstadoGoogleCalendar>({ action: 'status' })

export const conectarGoogleCalendar = async () => {
  const returnUrl = `${window.location.origin}${window.location.pathname}`
  const data = await invocarGoogleCalendar<{ url: string; redirectUri: string }>({
    action: 'connect',
    returnUrl,
  })

  window.location.assign(data.url)
}

export const desconectarGoogleCalendar = () =>
  invocarGoogleCalendar<{ disconnected: boolean }>({ action: 'disconnect' })

export const sincronizarPedidoGoogleCalendar = (pedidoId: string | number) =>
  invocarGoogleCalendar<ResultadoSincronizacion>({
    action: 'sync-order',
    pedidoId,
  })

export const sincronizarTodosGoogleCalendar = () =>
  invocarGoogleCalendar<ResultadoSincronizacion>({ action: 'sync-all' })

export const leerResultadoOAuthGoogleCalendar = () => {
  const url = new URL(window.location.href)
  const estado = url.searchParams.get('google_calendar')

  if (!estado) {
    return null
  }

  const resultado = {
    estado,
    mensaje: url.searchParams.get('google_message'),
    sincronizados: Number(url.searchParams.get('google_synced') ?? 0),
    errores: Number(url.searchParams.get('google_errors') ?? 0),
  }

  url.searchParams.delete('google_calendar')
  url.searchParams.delete('google_message')
  url.searchParams.delete('google_synced')
  url.searchParams.delete('google_errors')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)

  return resultado
}
