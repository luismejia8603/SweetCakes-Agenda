import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const obtenerSecretKey = () => {
  const nuevas = Deno.env.get('SUPABASE_SECRET_KEYS')

  if (nuevas) {
    try {
      const mapa = JSON.parse(nuevas) as Record<string, string>
      if (mapa.default) return mapa.default

      const primera = Object.values(mapa).find(Boolean)
      if (primera) return primera
    } catch (error) {
      console.warn('No se pudo leer SUPABASE_SECRET_KEYS:', error)
    }
  }

  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const secretKey = obtenerSecretKey()
    const authHeader = req.headers.get('Authorization')

    if (!supabaseUrl || !secretKey) {
      return Response.json(
        { error: 'Faltan las credenciales internas de Supabase.' },
        { status: 500, headers: corsHeaders },
      )
    }

    if (!authHeader) {
      return Response.json({ error: 'Sesion no valida.' }, { status: 401, headers: corsHeaders })
    }

    const admin = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const jwt = authHeader.replace(/^Bearer\s+/i, '')
    const { data: { user }, error: errorUsuario } = await admin.auth.getUser(jwt)
    if (errorUsuario || !user) {
      return Response.json({ error: 'No se pudo verificar tu sesion.' }, { status: 401, headers: corsHeaders })
    }

    const { data: perfil, error: errorPerfil } = await admin
      .from('perfiles')
      .select('rol, activo')
      .eq('id', user.id)
      .single()

    if (errorPerfil || perfil?.rol !== 'Propietario' || perfil?.activo !== true) {
      return Response.json({ error: 'Solo el Propietario puede crear usuarios.' }, { status: 403, headers: corsHeaders })
    }

    const body = await req.json()
    const nombre = String(body.nombre ?? '').trim()
    const usuario = String(body.usuario ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    const rol = String(body.rol ?? '')

    if (!nombre) throw new Error('El nombre es obligatorio.')
    if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) throw new Error('El usuario no tiene un formato valido.')
    if (password.length < 8) throw new Error('La contrasena debe tener al menos 8 caracteres.')
    if (!['Empleado', 'Encargado'].includes(rol)) throw new Error('El rol solicitado no es valido.')

    const email = `${usuario}@sweetcakes.test`
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre, usuario, rol },
    })

    if (error) {
      const mensaje = error.message.toLowerCase().includes('already')
        ? 'Ese nombre de usuario ya existe.'
        : error.message
      return Response.json({ error: mensaje }, { status: 400, headers: corsHeaders })
    }

    return Response.json({ ok: true, userId: data.user.id, usuario, rol }, { status: 200, headers: corsHeaders })
  } catch (error) {
    console.error(error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'No se pudo crear el usuario.' },
      { status: 400, headers: corsHeaders },
    )
  }
})
