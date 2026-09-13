import { createClient } from 'supabase'

const BUCKET = 'encargos-imagenes'
const DIAS_RETENCION = 30
const TAMANO_LOTE = 200
const MAXIMO_PEDIDOS_POR_EJECUCION = 1000

type PedidoElegible = {
  id: string
  imagen_referencia: string | null
}

type ImagenFila = {
  id: string
  encargo_id: string
  ruta_storage: string
}

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

  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

  try {
    const secretoEsperado = Deno.env.get('LIMPIEZA_CRON_SECRET')
    const secretoRecibido = req.headers.get('x-cron-secret')

    if (!secretoEsperado || secretoRecibido !== secretoEsperado) {
      return json({ error: 'No autorizado.' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const secretKey = obtenerSecretKey()

    if (!supabaseUrl || !secretKey) {
      throw new Error('Faltan las credenciales internas de Supabase.')
    }

    const admin = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const body = await req.json().catch(() => ({})) as { dryRun?: boolean }
    const dryRun = body.dryRun === true
    const corte = fechaCorteISO()

    // Seleccionamos pedidos por fecha/estado, aunque imagen_referencia legacy sea NULL.
    // La tabla encargo_imagenes es la fuente principal desde esta versión.
    const { data: datosPedidos, error: errorElegibles } = await admin
      .from('encargos')
      .select('id,imagen_referencia')
      .lte('fecha_entrega', corte)
      .in('estado_pedido', ['Entregado', 'Cancelado'])
      .limit(MAXIMO_PEDIDOS_POR_EJECUCION)

    if (errorElegibles) throw errorElegibles

    const pedidos = (datosPedidos ?? []) as PedidoElegible[]
    const ids = pedidos.map((pedido) => pedido.id)

    let filasImagenes: ImagenFila[] = []

    if (ids.length) {
      const { data, error } = await admin
        .from('encargo_imagenes')
        .select('id,encargo_id,ruta_storage')
        .in('encargo_id', ids)

      if (error) throw error
      filasImagenes = (data ?? []) as ImagenFila[]
    }

    const rutasTabla = filasImagenes
      .map((imagen) => String(imagen.ruta_storage ?? '').trim())
      .filter((ruta) => ruta && !ruta.startsWith('http'))

    const rutasLegacy = pedidos
      .map((pedido) => String(pedido.imagen_referencia ?? '').trim())
      .filter((ruta) => ruta && !ruta.startsWith('http'))

    const rutasUnicas = Array.from(new Set([...rutasTabla, ...rutasLegacy]))

    if (dryRun) {
      return json({
        ok: true,
        dryRun: true,
        fecha_corte: corte,
        dias_retencion: DIAS_RETENCION,
        pedidos_elegibles: pedidos.length,
        imagenes_elegibles: rutasUnicas.length,
      })
    }

    let pedidosActualizados = 0
    let imagenesEliminadas = 0
    const errores: string[] = []

    for (let inicio = 0; inicio < pedidos.length; inicio += TAMANO_LOTE) {
      const lote = pedidos.slice(inicio, inicio + TAMANO_LOTE)
      const idsLote = lote.map((pedido) => pedido.id)
      const idsLoteSet = new Set(idsLote)
      const filasLote = filasImagenes.filter((imagen) => idsLoteSet.has(imagen.encargo_id))

      const rutasLote = Array.from(new Set([
        ...filasLote
          .map((imagen) => String(imagen.ruta_storage ?? '').trim())
          .filter((ruta) => ruta && !ruta.startsWith('http')),
        ...lote
          .map((pedido) => String(pedido.imagen_referencia ?? '').trim())
          .filter((ruta) => ruta && !ruta.startsWith('http')),
      ]))

      if (rutasLote.length) {
        const { error: errorStorage } = await admin.storage.from(BUCKET).remove(rutasLote)

        if (errorStorage) {
          errores.push(`Storage: ${errorStorage.message}`)
          continue
        }

        imagenesEliminadas += rutasLote.length
      }

      const { error: errorFilas } = await admin
        .from('encargo_imagenes')
        .delete()
        .in('encargo_id', idsLote)

      if (errorFilas) {
        errores.push(`encargo_imagenes: ${errorFilas.message}`)
        continue
      }

      const { error: errorPedidos } = await admin
        .from('encargos')
        .update({ imagen_referencia: null })
        .in('id', idsLote)

      if (errorPedidos) {
        errores.push(`encargos: ${errorPedidos.message}`)
        continue
      }

      pedidosActualizados += idsLote.length
    }

    return json({
      ok: errores.length === 0,
      dryRun: false,
      fecha_corte: corte,
      dias_retencion: DIAS_RETENCION,
      imagenes_eliminadas: imagenesEliminadas,
      pedidos_actualizados: pedidosActualizados,
      errores,
    }, errores.length ? 500 : 200)
  } catch (error) {
    console.error(error)
    return json({
      error: error instanceof Error ? error.message : 'No se pudo ejecutar la limpieza.',
    }, 500)
  }
})
