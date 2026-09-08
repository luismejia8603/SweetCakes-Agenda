import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowLeft,
  CalendarCheck2,
  CakeSlice,
  CheckCircle2,
  Clock3,
  Eye,
  PackageCheck,
  RefreshCw,
  WalletCards,
} from 'lucide-react'

import { sincronizarPedidoGoogleCalendar } from '../lib/googleCalendar'
import { supabase } from '../lib/supabase'
import type { Encargo } from '../types/encargo'
import { fechaISOADate, formatearHora, obtenerPago } from '../types/encargo'

type PedidosDiaProps = {
  fechaISO: string
  onVolver: () => void
  onVerDetalle: (id: string | number) => void
}

function PedidosDia({ fechaISO, onVolver, onVerDetalle }: PedidosDiaProps) {
  const [pedidos, setPedidos] = useState<Encargo[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mensajeGoogle, setMensajeGoogle] = useState('')
  const [actualizando, setActualizando] = useState<string | null>(null)
  const [sincronizandoId, setSincronizandoId] = useState<string | null>(null)

  useEffect(() => {
    let activo = true

    const cargar = async () => {
      setCargando(true)
      setError('')
      setMensajeGoogle('')

      const { data, error: errorSupabase } = await supabase
        .from('encargos')
        .select(
          'id,nombre_cliente,telefono,fecha_entrega,hora_entrega,sabor_torta,sabor_relleno,chantilly,imagen_referencia,dedicatoria,observaciones,precio_cotizado,abono,estado_pedido,created_at,google_event_id,google_event_url,google_calendar_synced_at,google_calendar_sync_error'
        )
        .eq('fecha_entrega', fechaISO)
        .neq('estado_pedido', 'Cancelado')
        .order('hora_entrega', { ascending: true })

      if (!activo) return

      if (errorSupabase) {
        console.error(errorSupabase)
        setError('No se pudieron cargar los pedidos de este día.')
        setPedidos([])
      } else {
        setPedidos((data ?? []) as Encargo[])
      }

      setCargando(false)
    }

    cargar()

    return () => {
      activo = false
    }
  }, [fechaISO])

  const resumen = useMemo(
    () => ({
      pendientes: pedidos.filter((p) => p.estado_pedido === 'Pendiente').length,
      listos: pedidos.filter((p) => p.estado_pedido === 'Listo').length,
      pagados: pedidos.filter((p) => obtenerPago(p).pagado).length,
      saldo: pedidos.reduce((suma, p) => suma + obtenerPago(p).saldo, 0),
    }),
    [pedidos]
  )

  const sincronizarGoogle = async (pedido: Encargo, silencioso = false) => {
    setSincronizandoId(String(pedido.id))

    if (!silencioso) {
      setMensajeGoogle('')
      setError('')
    }

    try {
      const resultado = await sincronizarPedidoGoogleCalendar(pedido.id)

      if (!resultado.synced && resultado.reason === 'not_connected') {
        if (!silencioso) {
          setMensajeGoogle(
            'Google Calendar todavía no está conectado. El Propietario puede conectarlo desde Calendario.'
          )
        }
        return
      }

      setPedidos((actuales) =>
        actuales.map((actual) =>
          actual.id === pedido.id
            ? {
                ...actual,
                google_event_id: resultado.eventId ?? actual.google_event_id ?? null,
                google_event_url: resultado.eventUrl ?? actual.google_event_url ?? null,
                google_calendar_synced_at:
                  resultado.syncedAt ?? new Date().toISOString(),
                google_calendar_sync_error: null,
              }
            : actual
        )
      )

      if (!silencioso) {
        setMensajeGoogle('✓ Pedido sincronizado con Google Calendar.')
      }
    } catch (errorGoogle) {
      console.error(errorGoogle)

      if (!silencioso) {
        setMensajeGoogle(
          errorGoogle instanceof Error
            ? errorGoogle.message
            : 'No se pudo sincronizar Google Calendar.'
        )
      }
    } finally {
      setSincronizandoId(null)
    }
  }

  const cambiarEstado = async (
    pedido: Encargo,
    estado: 'Pendiente' | 'Listo'
  ) => {
    if (pedido.estado_pedido === estado) return

    setActualizando(String(pedido.id))
    setError('')
    setMensajeGoogle('')

    const { error: errorSupabase } = await supabase
      .from('encargos')
      .update({ estado_pedido: estado })
      .eq('id', pedido.id)

    setActualizando(null)

    if (errorSupabase) {
      console.error(errorSupabase)
      setError('No se pudo actualizar el estado.')
      return
    }

    const pedidoActualizado: Encargo = {
      ...pedido,
      estado_pedido: estado,
    }

    setPedidos((actuales) =>
      actuales.map((p) => (p.id === pedido.id ? pedidoActualizado : p))
    )

    await sincronizarGoogle(pedidoActualizado, true)
  }

  const fechaBonita = fechaISOADate(fechaISO).toLocaleDateString('es-SV', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <main className="p-5 md:ml-64 md:p-8 lg:p-10">
      <header className="mb-8">
        <button
          type="button"
          onClick={onVolver}
          className="mb-5 inline-flex items-center gap-2 rounded-xl border border-[#E5D7DE] bg-white px-4 py-2.5 text-sm font-semibold text-[#5C3A4D] hover:bg-[#FBF1F4]"
        >
          <ArrowLeft size={17} /> Volver
        </button>
        <p className="text-sm text-[#756870]">Control diario</p>
        <h2 className="mt-1 text-3xl font-bold capitalize text-[#5C3A4D]">
          {fechaBonita}
        </h2>
        <p className="mt-2 text-sm text-[#756870]">
          Cambia rápidamente entre Pendiente y Listo, revisa cuánto falta cobrar y mantén Google Calendar actualizado.
        </p>
      </header>

      <section className="mb-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icono={<PackageCheck size={18} />}
          etiqueta="Faltan preparar"
          valor={cargando ? '...' : resumen.pendientes}
          tono="rosa"
        />
        <Kpi
          icono={<CheckCircle2 size={18} />}
          etiqueta="Listos"
          valor={cargando ? '...' : resumen.listos}
          tono="morado"
        />
        <Kpi
          icono={<WalletCards size={18} />}
          etiqueta="Pagados"
          valor={cargando ? '...' : resumen.pagados}
          tono="verde"
        />
        <Kpi
          icono={<WalletCards size={18} />}
          etiqueta="Saldo por cobrar"
          valor={cargando ? '...' : `$${resumen.saldo.toFixed(2)}`}
          tono="normal"
        />
      </section>

      {error && (
        <div className="mb-5 rounded-xl bg-[#FFF0F5] px-4 py-3 text-sm font-semibold text-[#D93470]">
          {error}
        </div>
      )}

      {mensajeGoogle && (
        <div className="mb-5 rounded-xl border border-[#DCE6F7] bg-[#F5F8FE] px-4 py-3 text-sm font-semibold text-[#356AC3]">
          {mensajeGoogle}
        </div>
      )}

      {!cargando && pedidos.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#DFC9D2] bg-white p-12 text-center">
          <CakeSlice size={32} className="mx-auto text-[#CDA9B8]" />
          <p className="mt-3 font-semibold">No hay pedidos para este día.</p>
        </div>
      )}

      <section className="space-y-4">
        {pedidos.map((pedido) => {
          const pago = obtenerPago(pedido)
          const guardando = actualizando === String(pedido.id)
          const sincronizando = sincronizandoId === String(pedido.id)
          const bloqueado = ['Entregado', 'Cancelado'].includes(
            pedido.estado_pedido
          )

          return (
            <article
              key={pedido.id}
              className="rounded-2xl border border-[#EEDDE3] bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F6E6EB] text-[#EC3D7F]">
                    <CakeSlice size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#5C3A4D]">
                      {pedido.nombre_cliente}
                    </h3>
                    <p className="mt-1 flex items-center gap-1 text-sm font-medium text-[#756870]">
                      <Clock3 size={15} />
                      {formatearHora(pedido.hora_entrega)}{' '}
                      {pedido.telefono ? `· ${pedido.telefono}` : ''}
                    </p>
                    <p
                      className={`mt-2 inline-flex items-center gap-1.5 text-xs font-semibold ${
                        pedido.google_event_id
                          ? 'text-[#4285F4]'
                          : pedido.google_calendar_sync_error
                            ? 'text-[#D93470]'
                            : 'text-[#9A8B93]'
                      }`}
                    >
                      <CalendarCheck2 size={14} />
                      {pedido.google_event_id
                        ? 'Sincronizado con Google Calendar'
                        : pedido.google_calendar_sync_error
                          ? 'Error de sincronización con Google'
                          : 'Pendiente de sincronización con Google'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                      pedido.estado_pedido === 'Pendiente'
                        ? 'bg-[#FCE5ED] text-[#D93470]'
                        : pedido.estado_pedido === 'Listo'
                          ? 'bg-[#F3EAF0] text-[#6F4C69]'
                          : 'bg-[#EEF3EB] text-[#64745D]'
                    }`}
                  >
                    {pedido.estado_pedido}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                      pago.pagado
                        ? 'bg-[#EDF7F1] text-[#557260]'
                        : 'bg-[#FFF2F6] text-[#D93470]'
                    }`}
                  >
                    {pago.pagado
                      ? 'Pagado'
                      : `Falta $${pago.saldo.toFixed(2)}`}
                  </span>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Dato etiqueta="Torta" valor={pedido.sabor_torta} />
                <Dato etiqueta="Relleno" valor={pedido.sabor_relleno} />
                <Dato etiqueta="Chantilly" valor={pedido.chantilly} />
              </div>

              <div className="mt-5 flex flex-col gap-3 border-t border-[#F0E4E8] pt-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap gap-2">
                  {!bloqueado && (
                    <>
                      <button
                        type="button"
                        disabled={guardando || sincronizando}
                        onClick={() => cambiarEstado(pedido, 'Pendiente')}
                        className={`rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                          pedido.estado_pedido === 'Pendiente'
                            ? 'border-[#EC3D7F] bg-[#FCE5ED] text-[#D93470]'
                            : 'border-[#E5D7DE] text-[#756870]'
                        }`}
                      >
                        Pendiente
                      </button>
                      <button
                        type="button"
                        disabled={guardando || sincronizando}
                        onClick={() => cambiarEstado(pedido, 'Listo')}
                        className={`rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                          pedido.estado_pedido === 'Listo'
                            ? 'border-[#BFA7B9] bg-[#F3EAF0] text-[#6F4C69]'
                            : 'border-[#E5D7DE] text-[#756870]'
                        }`}
                      >
                        {guardando ? 'Guardando...' : 'Listo'}
                      </button>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={sincronizando}
                    onClick={() => sincronizarGoogle(pedido)}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#DCE6F7] px-4 py-2 text-sm font-semibold text-[#4285F4] hover:bg-[#F5F8FE] disabled:opacity-50"
                  >
                    <RefreshCw
                      size={16}
                      className={sincronizando ? 'animate-spin' : ''}
                    />
                    {sincronizando ? 'Sincronizando...' : 'Sincronizar Google'}
                  </button>

                  <button
                    type="button"
                    onClick={() => onVerDetalle(pedido.id)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#5C3A4D] px-4 py-2 text-sm font-semibold text-white"
                  >
                    <Eye size={16} /> Ver detalle
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </section>
    </main>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-xl bg-[#FFF9F7] p-3">
      <p className="text-xs text-[#9A8B93]">{etiqueta}</p>
      <p className="mt-1 text-sm font-semibold text-[#5C3A4D]">{valor}</p>
    </div>
  )
}

function Kpi({
  icono,
  etiqueta,
  valor,
  tono,
}: {
  icono: ReactNode
  etiqueta: string
  valor: string | number
  tono: 'rosa' | 'morado' | 'verde' | 'normal'
}) {
  const clases =
    tono === 'rosa'
      ? 'bg-[#FFF7FA] text-[#D93470]'
      : tono === 'morado'
        ? 'bg-[#FAF6F9] text-[#6F4C69]'
        : tono === 'verde'
          ? 'bg-[#F5FAF6] text-[#557260]'
          : 'bg-white text-[#5C3A4D]'

  return (
    <div className={`rounded-2xl border border-[#EEDDE3] p-4 ${clases}`}>
      <div className="flex items-center gap-2 text-sm font-medium">
        {icono}
        {etiqueta}
      </div>
      <p className="mt-2 text-2xl font-bold">{valor}</p>
    </div>
  )
}

export default PedidosDia
