import { createClient } from 'npm:@supabase/supabase-js@2'

const BUCKET = 'encargos-imagenes'
const DIAS_RETENCION = 30
const TAMANO_LOTE = 200
const MAXIMO_POR_EJECUCION = 1000

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })

const fechaCorteISO = () => {
  const fecha = new Date()
  fecha.setUTCDate(fecha.getUTCDate() - DIAS_RETENCION)
  return fecha.toISOString().slice(0, 10)
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

  // Compatibilidad con proyectos que todavía usan las llaves legacy.
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido.' }, 405)
  }

  try {
    const secretoEsperado = Deno.env.get('LIMPIEZA_CRON_SECRET')
    const secretoRecibido = req.headers.get('x-cron-secret')

    if (!secretoEsperado || secretoRecibido !== secretoEsperado) {
      return json({ error: 'No autorizado.' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const secretKey = obtenerSecretKey()

    if (!supabaseUrl || !secretKey) {
      throw new Error(
        'Faltan las credenciales internas de Supabase (SUPABASE_SECRET_KEYS o SUPABASE_SERVICE_ROLE_KEY).',
      )
    }

    const admin = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const body = await req.json().catch(() => ({}))
    const dryRun = body?.dryRun === true
    const corte = fechaCorteISO()

    if (dryRun) {
      const { count, error } = await admin
        .from('encargos')
        .select('id', { count: 'exact', head: true })
        .lte('fecha_entrega', corte)
        .in('estado_pedido', ['Entregado', 'Cancelado'])
        .not('imagen_referencia', 'is', null)
        .not('imagen_referencia', 'like', 'http%')

      if (error) throw error

      return json({
        ok: true,
        dryRun: true,
        fecha_corte: corte,
        dias_retencion: DIAS_RETENCION,
        imagenes_elegibles: count ?? 0,
      })
    }

    let eliminadas = 0
    let actualizadas = 0
    const errores: string[] = []

    while (eliminadas < MAXIMO_POR_EJECUCION) {
      const limite = Math.min(TAMANO_LOTE, MAXIMO_POR_EJECUCION - eliminadas)

      const { data: encargos, error: errorConsulta } = await admin
        .from('encargos')
        .select('id, imagen_referencia')
        .lte('fecha_entrega', corte)
        .in('estado_pedido', ['Entregado', 'Cancelado'])
        .not('imagen_referencia', 'is', null)
        .not('imagen_referencia', 'like', 'http%')
        .limit(limite)

      if (errorConsulta) throw errorConsulta
      if (!encargos?.length) break

      const rutas = encargos
        .map((encargo) => String(encargo.imagen_referencia ?? '').trim())
        .filter(Boolean)

      if (!rutas.length) break

      // Borrado físico mediante Storage API, nunca manipulando storage.objects.
      const { error: errorStorage } = await admin.storage.from(BUCKET).remove(rutas)

      if (errorStorage) {
        errores.push(`Storage: ${errorStorage.message}`)
        break
      }

      eliminadas += rutas.length

      const ids = encargos.map((encargo) => encargo.id)
      const { error: errorActualizacion } = await admin
        .from('encargos')
        .update({ imagen_referencia: null })
        .in('id', ids)

      if (errorActualizacion) {
        errores.push(`Base de datos: ${errorActualizacion.message}`)
        break
      }

      actualizadas += ids.length

      if (encargos.length < limite) break
    }

    return json(
      {
        ok: errores.length === 0,
        dryRun: false,
        fecha_corte: corte,
        dias_retencion: DIAS_RETENCION,
        imagenes_eliminadas: eliminadas,
        pedidos_actualizados: actualizadas,
        errores,
      },
      errores.length ? 500 : 200,
    )
  } catch (error) {
    console.error(error)
    return json(
      {
        error: error instanceof Error ? error.message : 'No se pudo ejecutar la limpieza.',
      },
      500,
    )
  }
})
