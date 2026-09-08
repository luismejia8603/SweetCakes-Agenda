import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const redirect = (url: string) =>
  new Response(null, {
    status: 302,
    headers: { Location: url },
  })

const getSecretKey = () => {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy

  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (secretKeys) {
    const parsed = JSON.parse(secretKeys)
    if (parsed.default) return parsed.default
  }

  throw new Error('No se encontró una clave secreta de Supabase para la Edge Function.')
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const GOOGLE_REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-calendar/callback`
const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/calendar'
const TIMEZONE = 'America/El_Salvador'

const validarConfiguracionGoogle = () => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET en los Secrets de la Edge Function.')
  }
}

const admin = createClient(SUPABASE_URL, getSecretKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
})

type Perfil = {
  id: string
  nombre: string
  rol: string
  activo: boolean
}

type Conexion = {
  user_id: string
  access_token: string
  refresh_token: string | null
  expires_at: string
  calendar_id: string
  created_at?: string
  updated_at?: string
}

type Encargo = {
  id: string | number
  nombre_cliente: string
  telefono: string | null
  fecha_entrega: string
  hora_entrega: string
  sabor_torta: string
  sabor_relleno: string
  chantilly: string
  dedicatoria: string | null
  observaciones: string | null
  precio_cotizado: number | string
  abono: number | string
  estado_pedido: string
  google_event_id: string | null
  google_event_url: string | null
}

const limpiarMensaje = (valor: unknown) => {
  if (typeof valor !== 'string') return ''
  return valor.slice(0, 500)
}

const obtenerUsuarioAutenticado = async (req: Request) => {
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  if (!token) {
    throw new Error('AUTH_REQUIRED')
  }

  const { data: usuarioData, error: usuarioError } = await admin.auth.getUser(token)

  if (usuarioError || !usuarioData.user) {
    throw new Error('AUTH_REQUIRED')
  }

  const { data: perfil, error: perfilError } = await admin
    .from('perfiles')
    .select('id,nombre,rol,activo')
    .eq('id', usuarioData.user.id)
    .single()

  if (perfilError || !perfil || !perfil.activo) {
    throw new Error('PROFILE_INACTIVE')
  }

  return perfil as Perfil
}

const obtenerPropietarioConectado = async () => {
  const { data: propietarios, error: errorPropietarios } = await admin
    .from('perfiles')
    .select('id,nombre,rol,activo')
    .eq('rol', 'Propietario')
    .eq('activo', true)
    .order('created_at', { ascending: true })

  if (errorPropietarios) throw errorPropietarios

  for (const propietario of propietarios ?? []) {
    const { data: conexion } = await admin
      .from('google_calendar_conexiones')
      .select('user_id,access_token,refresh_token,expires_at,calendar_id,created_at,updated_at')
      .eq('user_id', propietario.id)
      .maybeSingle()

    if (conexion) {
      return {
        propietario: propietario as Perfil,
        conexion: conexion as Conexion,
      }
    }
  }

  return null
}

const refrescarToken = async (conexion: Conexion) => {
  if (!conexion.refresh_token) {
    throw new Error('La conexión de Google Calendar no tiene refresh token. Vuelve a conectar Google Calendar.')
  }

  const respuesta = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: conexion.refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  const datos = await respuesta.json()

  if (!respuesta.ok || !datos.access_token) {
    throw new Error(datos.error_description || datos.error || 'No se pudo renovar el acceso a Google Calendar.')
  }

  const expiresAt = new Date(Date.now() + Number(datos.expires_in ?? 3600) * 1000).toISOString()

  const { error } = await admin
    .from('google_calendar_conexiones')
    .update({
      access_token: datos.access_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', conexion.user_id)

  if (error) throw error

  return {
    ...conexion,
    access_token: datos.access_token as string,
    expires_at: expiresAt,
  }
}

const obtenerConexionVigente = async (conexion: Conexion) => {
  const expiraEn = new Date(conexion.expires_at).getTime()

  if (Number.isFinite(expiraEn) && expiraEn > Date.now() + 2 * 60 * 1000) {
    return conexion
  }

  return refrescarToken(conexion)
}

const obtenerPago = (pedido: Encargo) => {
  const total = Number(pedido.precio_cotizado ?? 0)
  const abono = Number(pedido.abono ?? 0)
  const saldo = Math.max(total - abono, 0)

  return {
    total,
    abono,
    saldo,
    estado: saldo <= 0.005 ? 'Pagado' : abono > 0 ? 'Pago parcial' : 'Pendiente de pago',
  }
}

const inicioISO = (pedido: Encargo) =>
  new Date(`${pedido.fecha_entrega}T${pedido.hora_entrega.slice(0, 5)}:00-06:00`)

const construirEvento = (pedido: Encargo) => {
  const inicio = inicioISO(pedido)
  const fin = new Date(inicio.getTime() + 60 * 60 * 1000)
  const pago = obtenerPago(pedido)

  const descripcion = [
    `Pedido Sweet Cakes #${pedido.id}`,
    `Cliente: ${pedido.nombre_cliente}`,
    pedido.telefono ? `Teléfono: ${pedido.telefono}` : '',
    `Torta: ${pedido.sabor_torta}`,
    `Relleno: ${pedido.sabor_relleno}`,
    `Chantilly: ${pedido.chantilly}`,
    pedido.dedicatoria ? `Dedicatoria: ${pedido.dedicatoria}` : '',
    pedido.observaciones ? `Observaciones: ${pedido.observaciones}` : '',
    `Estado: ${pedido.estado_pedido}`,
    `Precio: $${pago.total.toFixed(2)}`,
    `Abono: $${pago.abono.toFixed(2)}`,
    `Saldo: $${pago.saldo.toFixed(2)}`,
    `Pago: ${pago.estado}`,
  ]
    .filter(Boolean)
    .join('\n')

  return {
    summary: `🎂 Sweet Cakes · ${pedido.nombre_cliente}`,
    description: descripcion,
    start: {
      dateTime: inicio.toISOString(),
      timeZone: TIMEZONE,
    },
    end: {
      dateTime: fin.toISOString(),
      timeZone: TIMEZONE,
    },
    reminders: { useDefault: true },
    extendedProperties: {
      private: {
        sweetcakesPedidoId: String(pedido.id),
      },
    },
  }
}

const googleFetch = async (
  conexionInicial: Conexion,
  url: string,
  init: RequestInit,
) => {
  let conexion = await obtenerConexionVigente(conexionInicial)

  const ejecutar = () =>
    fetch(url, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${conexion.access_token}`,
      },
    })

  let respuesta = await ejecutar()

  if (respuesta.status === 401) {
    conexion = await refrescarToken(conexion)
    respuesta = await ejecutar()
  }

  return { respuesta, conexion }
}

const guardarErrorPedido = async (pedidoId: string | number, mensaje: string) => {
  await admin
    .from('encargos')
    .update({
      google_calendar_sync_error: limpiarMensaje(mensaje),
      google_calendar_synced_at: new Date().toISOString(),
    })
    .eq('id', pedidoId)
}

const sincronizarPedido = async (pedido: Encargo, conexionInicial: Conexion) => {
  let conexion = await obtenerConexionVigente(conexionInicial)
  const calendarId = encodeURIComponent(conexion.calendar_id || 'primary')
  const base = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`

  try {
    if (pedido.estado_pedido === 'Cancelado') {
      if (pedido.google_event_id) {
        const resultadoGoogle = await googleFetch(
          conexion,
          `${base}/${encodeURIComponent(pedido.google_event_id)}`,
          { method: 'DELETE' },
        )

        conexion = resultadoGoogle.conexion
        const respuesta = resultadoGoogle.respuesta

        if (!respuesta.ok && respuesta.status !== 404 && respuesta.status !== 410) {
          const texto = await respuesta.text()
          throw new Error(`Google Calendar no pudo eliminar el evento (${respuesta.status}): ${texto}`)
        }
      }

      await admin
        .from('encargos')
        .update({
          google_event_id: null,
          google_event_url: null,
          google_calendar_synced_at: new Date().toISOString(),
          google_calendar_sync_error: null,
        })
        .eq('id', pedido.id)

      return { synced: true, deleted: true, eventId: null, eventUrl: null }
    }

    const evento = construirEvento(pedido)
    let eventId = pedido.google_event_id
    let eventUrl = pedido.google_event_url

    if (eventId) {
      const resultadoGoogle = await googleFetch(
        conexion,
        `${base}/${encodeURIComponent(eventId)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(evento),
        },
      )
      conexion = resultadoGoogle.conexion
      const respuesta = resultadoGoogle.respuesta

      if (respuesta.status === 404 || respuesta.status === 410) {
        eventId = null
        eventUrl = null
      } else if (!respuesta.ok) {
        const texto = await respuesta.text()
        throw new Error(`Google Calendar no pudo actualizar el evento (${respuesta.status}): ${texto}`)
      } else {
        const actualizado = await respuesta.json()
        eventId = actualizado.id
        eventUrl = actualizado.htmlLink ?? eventUrl
      }
    }

    if (!eventId) {
      const resultadoGoogle = await googleFetch(conexion, base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(evento),
      })
      conexion = resultadoGoogle.conexion
      const respuesta = resultadoGoogle.respuesta

      const creado = await respuesta.json()

      if (!respuesta.ok || !creado.id) {
        throw new Error(creado.error?.message || `Google Calendar no pudo crear el evento (${respuesta.status}).`)
      }

      eventId = creado.id
      eventUrl = creado.htmlLink ?? null
    }

    const syncedAt = new Date().toISOString()

    const { error } = await admin
      .from('encargos')
      .update({
        google_event_id: eventId,
        google_event_url: eventUrl,
        google_calendar_synced_at: syncedAt,
        google_calendar_sync_error: null,
      })
      .eq('id', pedido.id)

    if (error) throw error

    return {
      synced: true,
      eventId,
      eventUrl,
      syncedAt,
    }
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error desconocido al sincronizar con Google Calendar.'
    await guardarErrorPedido(pedido.id, mensaje)
    throw error
  }
}

const cargarPedido = async (id: string | number) => {
  const { data, error } = await admin
    .from('encargos')
    .select('id,nombre_cliente,telefono,fecha_entrega,hora_entrega,sabor_torta,sabor_relleno,chantilly,dedicatoria,observaciones,precio_cotizado,abono,estado_pedido,google_event_id,google_event_url')
    .eq('id', id)
    .single()

  if (error || !data) {
    throw new Error('No se encontró el pedido que se quiere sincronizar.')
  }

  return data as Encargo
}

const sincronizarTodos = async (conexion: Conexion) => {
  let desde = 0
  const tamano = 500
  let total = 0
  let correctos = 0
  let errores = 0
  let continuar = true

  while (continuar) {
    const { data, error } = await admin
      .from('encargos')
      .select('id,nombre_cliente,telefono,fecha_entrega,hora_entrega,sabor_torta,sabor_relleno,chantilly,dedicatoria,observaciones,precio_cotizado,abono,estado_pedido,google_event_id,google_event_url')
      .order('fecha_entrega', { ascending: true })
      .range(desde, desde + tamano - 1)

    if (error) throw error

    const pedidos = (data ?? []) as Encargo[]
    total += pedidos.length

    for (const pedido of pedidos) {
      try {
        await sincronizarPedido(pedido, conexion)
        correctos += 1
      } catch (error) {
        console.error('Error sincronizando pedido', pedido.id, error)
        errores += 1
      }
    }

    continuar = pedidos.length === tamano
    desde += tamano
  }

  return { total, correctos, errores }
}

const procesarCallback = async (req: Request) => {
  validarConfiguracionGoogle()
  const url = new URL(req.url)
  const state = url.searchParams.get('state') ?? ''
  const code = url.searchParams.get('code') ?? ''
  const errorGoogle = url.searchParams.get('error') ?? ''

  if (!state) {
    return json({ error: 'Falta el parámetro state de OAuth.' }, 400)
  }

  const { data: oauthState, error: stateError } = await admin
    .from('google_calendar_oauth_states')
    .select('state,user_id,return_url,expires_at')
    .eq('state', state)
    .maybeSingle()

  if (stateError || !oauthState) {
    return json({ error: 'El enlace de conexión ya expiró o no es válido.' }, 400)
  }

  const volver = new URL(oauthState.return_url)

  if (new Date(oauthState.expires_at).getTime() < Date.now()) {
    await admin.from('google_calendar_oauth_states').delete().eq('state', state)
    volver.searchParams.set('google_calendar', 'error')
    volver.searchParams.set('google_message', 'La autorización expiró. Intenta conectar nuevamente.')
    return redirect(volver.toString())
  }

  if (errorGoogle || !code) {
    await admin.from('google_calendar_oauth_states').delete().eq('state', state)
    volver.searchParams.set('google_calendar', 'error')
    volver.searchParams.set('google_message', errorGoogle || 'Google no devolvió un código de autorización.')
    return redirect(volver.toString())
  }

  const respuestaToken = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  })

  const tokens = await respuestaToken.json()

  if (!respuestaToken.ok || !tokens.access_token) {
    volver.searchParams.set('google_calendar', 'error')
    volver.searchParams.set('google_message', tokens.error_description || tokens.error || 'No se pudieron obtener tokens de Google.')
    return redirect(volver.toString())
  }

  const { data: conexionAnterior } = await admin
    .from('google_calendar_conexiones')
    .select('refresh_token')
    .eq('user_id', oauthState.user_id)
    .maybeSingle()

  const refreshToken = tokens.refresh_token ?? conexionAnterior?.refresh_token ?? null

  if (!refreshToken) {
    volver.searchParams.set('google_calendar', 'error')
    volver.searchParams.set('google_message', 'Google no entregó un refresh token. Revoca el acceso de Sweet Cakes en tu cuenta de Google e intenta conectar nuevamente.')
    return redirect(volver.toString())
  }

  const expiresAt = new Date(Date.now() + Number(tokens.expires_in ?? 3600) * 1000).toISOString()

  const { error: guardarError } = await admin
    .from('google_calendar_conexiones')
    .upsert({
      user_id: oauthState.user_id,
      access_token: tokens.access_token,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      calendar_id: 'primary',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (guardarError) {
    volver.searchParams.set('google_calendar', 'error')
    volver.searchParams.set('google_message', 'No se pudo guardar la conexión con Google Calendar.')
    return redirect(volver.toString())
  }

  await admin.from('google_calendar_oauth_states').delete().eq('state', state)

  const { data: conexion } = await admin
    .from('google_calendar_conexiones')
    .select('user_id,access_token,refresh_token,expires_at,calendar_id,created_at,updated_at')
    .eq('user_id', oauthState.user_id)
    .single()

  let resumen = { total: 0, correctos: 0, errores: 0 }

  try {
    resumen = await sincronizarTodos(conexion as Conexion)
  } catch (error) {
    console.error('No se pudieron sincronizar todos los pedidos después de OAuth:', error)
  }

  volver.searchParams.set('google_calendar', 'connected')
  volver.searchParams.set('google_synced', String(resumen.correctos))
  volver.searchParams.set('google_errors', String(resumen.errores))
  return redirect(volver.toString())
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const pathname = new URL(req.url).pathname

    if (req.method === 'GET' && pathname.endsWith('/callback')) {
      return await procesarCallback(req)
    }

    if (req.method !== 'POST') {
      return json({ error: 'Método no permitido.' }, 405)
    }

    const perfil = await obtenerUsuarioAutenticado(req)
    const body = await req.json().catch(() => ({}))
    const action = String(body.action ?? '')

    if (action === 'status') {
      const conectado = await obtenerPropietarioConectado()

      return json({
        connected: Boolean(conectado),
        canManage: perfil.rol === 'Propietario',
        ownerName: conectado?.propietario.nombre ?? null,
        connectedAt: conectado?.conexion.updated_at ?? conectado?.conexion.created_at ?? null,
      })
    }

    if (action === 'connect') {
      validarConfiguracionGoogle()
      if (perfil.rol !== 'Propietario') {
        return json({ error: 'Solo el Propietario puede conectar Google Calendar.' }, 403)
      }

      const returnUrlRaw = typeof body.returnUrl === 'string' ? body.returnUrl : req.headers.get('Origin')
      const returnUrl = returnUrlRaw || 'http://localhost:5173/'
      const returnUrlValidada = new URL(returnUrl)

      if (!['http:', 'https:'].includes(returnUrlValidada.protocol)) {
        return json({ error: 'La URL de regreso no es válida.' }, 400)
      }

      const estado = crypto.randomUUID()

      await admin.from('google_calendar_oauth_states').delete().lt('expires_at', new Date().toISOString())

      const { error } = await admin.from('google_calendar_oauth_states').insert({
        state: estado,
        user_id: perfil.id,
        return_url: returnUrlValidada.toString(),
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      })

      if (error) throw error

      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID)
      authUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI)
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('access_type', 'offline')
      authUrl.searchParams.set('prompt', 'consent')
      authUrl.searchParams.set('include_granted_scopes', 'true')
      authUrl.searchParams.set('scope', GOOGLE_SCOPE)
      authUrl.searchParams.set('state', estado)

      return json({ url: authUrl.toString(), redirectUri: GOOGLE_REDIRECT_URI })
    }

    if (action === 'disconnect') {
      if (perfil.rol !== 'Propietario') {
        return json({ error: 'Solo el Propietario puede desconectar Google Calendar.' }, 403)
      }

      const { error } = await admin
        .from('google_calendar_conexiones')
        .delete()
        .eq('user_id', perfil.id)

      if (error) throw error

      return json({ disconnected: true })
    }

    if (action === 'sync-order') {
      const conectado = await obtenerPropietarioConectado()

      if (!conectado) {
        return json({ synced: false, reason: 'not_connected' })
      }

      const pedidoId = body.pedidoId

      if (pedidoId === undefined || pedidoId === null || pedidoId === '') {
        return json({ error: 'Falta pedidoId.' }, 400)
      }

      const pedido = await cargarPedido(pedidoId)
      const resultado = await sincronizarPedido(pedido, conectado.conexion)
      return json(resultado)
    }

    if (action === 'sync-all') {
      if (perfil.rol !== 'Propietario') {
        return json({ error: 'Solo el Propietario puede sincronizar todos los pedidos.' }, 403)
      }

      const conectado = await obtenerPropietarioConectado()

      if (!conectado) {
        return json({ synced: false, reason: 'not_connected' })
      }

      const resumen = await sincronizarTodos(conectado.conexion)
      return json({ synced: true, ...resumen })
    }

    return json({ error: 'Acción no reconocida.' }, 400)
  } catch (error) {
    console.error(error)

    if (error instanceof Error && error.message === 'AUTH_REQUIRED') {
      return json({ error: 'Sesión no válida. Inicia sesión nuevamente.' }, 401)
    }

    if (error instanceof Error && error.message === 'PROFILE_INACTIVE') {
      return json({ error: 'Tu usuario no está activo.' }, 403)
    }

    return json({
      error: error instanceof Error ? error.message : 'Error interno de Google Calendar.',
    }, 500)
  }
})
