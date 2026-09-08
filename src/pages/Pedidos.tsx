import { useEffect, useMemo, useState } from 'react'
import {
  CalendarCheck2,
  CakeSlice,
  ChevronRight,
  ClipboardList,
  RefreshCw,
  Search,
  WalletCards,
} from 'lucide-react'

import { sincronizarPedidoGoogleCalendar } from '../lib/googleCalendar'
import { supabase } from '../lib/supabase'
import type { Encargo } from '../types/encargo'
import { fechaISOADate, formatearHora, obtenerPago } from '../types/encargo'

type PedidosProps = { onVerDetalle: (id: string | number) => void }

function Pedidos({ onVerDetalle }: PedidosProps) {
  const [pedidos, setPedidos] = useState<Encargo[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState('Todos')
  const [sincronizandoId, setSincronizandoId] = useState<string | null>(null)

  useEffect(() => {
    let activo = true

    const cargar = async () => {
      setCargando(true)
      setError('')

      const { data, error: errorSupabase } = await supabase
        .from('encargos')
        .select('id,nombre_cliente,telefono,fecha_entrega,hora_entrega,sabor_torta,sabor_relleno,chantilly,imagen_referencia,dedicatoria,observaciones,precio_cotizado,abono,estado_pedido,created_at,google_event_id,google_event_url,google_calendar_synced_at,google_calendar_sync_error')
        .order('fecha_entrega', { ascending: false })
        .order('hora_entrega', { ascending: false })

      if (!activo) return

      if (errorSupabase) {
        console.error(errorSupabase)
        setError('No se pudo cargar el historial.')
        setPedidos([])
      } else {
        setPedidos((data ?? []) as Encargo[])
      }

      setCargando(false)
    }

    cargar()
    return () => { activo = false }
  }, [])

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()

    return pedidos.filter((pedido) => {
      const coincideEstado = estado === 'Todos' || pedido.estado_pedido === estado
      const coincideTexto = !texto || [pedido.nombre_cliente, pedido.telefono ?? '', pedido.sabor_torta, pedido.sabor_relleno]
        .some((valor) => valor.toLowerCase().includes(texto))
      return coincideEstado && coincideTexto
    })
  }, [pedidos, busqueda, estado])

  const kpi = useMemo(() => {
    const activos = pedidos.filter((pedido) => pedido.estado_pedido !== 'Cancelado')

    return {
      total: pedidos.length,
      ventas: activos.reduce((suma, pedido) => suma + Number(pedido.precio_cotizado ?? 0), 0),
      pendientes: activos.filter((pedido) => pedido.estado_pedido === 'Pendiente').length,
      porCobrar: activos.reduce((suma, pedido) => suma + obtenerPago(pedido).saldo, 0),
    }
  }, [pedidos])

  const reintentarGoogle = async (pedido: Encargo) => {
    setSincronizandoId(String(pedido.id))
    setError('')

    try {
      const resultado = await sincronizarPedidoGoogleCalendar(pedido.id)

      if (!resultado.synced && resultado.reason === 'not_connected') {
        setError('Google Calendar todavía no está conectado. El Propietario puede conectarlo desde Calendario.')
        return
      }

      setPedidos((actuales) => actuales.map((actual) => actual.id === pedido.id ? {
        ...actual,
        google_event_id: resultado.eventId ?? null,
        google_event_url: resultado.eventUrl ?? null,
        google_calendar_synced_at: resultado.syncedAt ?? new Date().toISOString(),
        google_calendar_sync_error: null,
      } : actual))
    } catch (errorGoogle) {
      console.error(errorGoogle)
      setError(errorGoogle instanceof Error ? errorGoogle.message : 'No se pudo sincronizar Google Calendar.')
    } finally {
      setSincronizandoId(null)
    }
  }

  return (
    <main className="p-5 md:ml-64 md:p-8 lg:p-10">
      <header className="mb-8">
        <p className="text-sm text-[#756870]">Historial</p>
        <h2 className="mt-1 text-3xl font-bold text-[#5C3A4D]">Todos los pedidos</h2>
        <p className="mt-2 text-sm text-[#756870]">Consulta encargos anteriores y futuros en una sola pantalla.</p>
      </header>

      <section className="mb-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi etiqueta="Pedidos registrados" valor={cargando ? '...' : kpi.total} />
        <Kpi etiqueta="Ventas registradas" valor={cargando ? '...' : `$${kpi.ventas.toFixed(2)}`} />
        <Kpi etiqueta="Por preparar" valor={cargando ? '...' : kpi.pendientes} />
        <Kpi etiqueta="Saldo por cobrar" valor={cargando ? '...' : `$${kpi.porCobrar.toFixed(2)}`} />
      </section>

      <section className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#EEDDE3] bg-white p-4 sm:flex-row">
        <label className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A8B93]"/>
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar cliente, teléfono, torta o relleno..." className="w-full rounded-xl border border-[#E5D7DE] bg-[#FFFDFC] py-3 pl-10 pr-4 outline-none focus:border-[#EC3D7F]"/>
        </label>
        <select value={estado} onChange={(e) => setEstado(e.target.value)} className="rounded-xl border border-[#E5D7DE] bg-[#FFFDFC] px-4 py-3 outline-none focus:border-[#EC3D7F]"><option>Todos</option><option>Pendiente</option><option>Listo</option><option>Entregado</option><option>Cancelado</option></select>
      </section>

      {error && <div className="mb-5 rounded-xl bg-[#FFF0F5] px-4 py-3 text-sm font-semibold text-[#D93470]">{error}</div>}
      {!cargando && filtrados.length === 0 && <div className="rounded-2xl border border-dashed border-[#DFC9D2] bg-white p-12 text-center"><ClipboardList size={32} className="mx-auto text-[#CDA9B8]"/><p className="mt-3 font-semibold">No encontramos pedidos con esos filtros.</p></div>}

      <section className="space-y-3">
        {filtrados.map((pedido) => {
          const pago = obtenerPago(pedido)
          const fecha = fechaISOADate(pedido.fecha_entrega).toLocaleDateString('es-SV', { day: 'numeric', month: 'short', year: 'numeric' })
          const sincronizando = sincronizandoId === String(pedido.id)

          return (
            <article key={pedido.id} className="rounded-2xl border border-[#EEDDE3] bg-white p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <button type="button" onClick={() => onVerDetalle(pedido.id)} className="flex flex-1 items-start gap-4 text-left">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F6E6EB] text-[#EC3D7F]"><CakeSlice size={20}/></div>
                  <div>
                    <p className="font-bold text-[#5C3A4D]">{pedido.nombre_cliente}</p>
                    <p className="mt-1 text-sm text-[#756870]">{fecha} · {formatearHora(pedido.hora_entrega)}</p>
                    <p className="mt-1 text-xs text-[#9A8B93]">{pedido.sabor_torta} · {pedido.sabor_relleno} · Chantilly {pedido.chantilly}</p>
                    <p className={`mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold ${pedido.google_event_id ? 'text-[#4285F4]' : pedido.google_calendar_sync_error ? 'text-[#D93470]' : 'text-[#9A8B93]'}`}>
                      <CalendarCheck2 size={13}/>
                      {pedido.google_event_id ? 'Sincronizado con Google Calendar' : pedido.google_calendar_sync_error ? 'Error de sincronización' : 'Pendiente de sincronización con Google'}
                    </p>
                  </div>
                </button>

                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${pedido.estado_pedido === 'Pendiente' ? 'bg-[#FCE5ED] text-[#D93470]' : pedido.estado_pedido === 'Listo' ? 'bg-[#F3EAF0] text-[#6F4C69]' : pedido.estado_pedido === 'Entregado' ? 'bg-[#EEF3EB] text-[#64745D]' : 'bg-[#F2F2F2] text-[#777]'}`}>{pedido.estado_pedido}</span>
                  <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${pago.pagado ? 'bg-[#EDF7F1] text-[#557260]' : 'bg-[#FFF2F6] text-[#D93470]'}`}>{pago.pagado ? 'Pagado' : `$${pago.saldo.toFixed(2)} por cobrar`}</span>
                  {!pedido.google_event_id && pedido.estado_pedido !== 'Cancelado' && (
                    <button type="button" disabled={sincronizando} onClick={() => reintentarGoogle(pedido)} className="rounded-xl border border-[#DCE6F7] p-2.5 text-[#4285F4] hover:bg-[#F5F8FE] disabled:opacity-50" title="Reintentar sincronización"><RefreshCw size={17} className={sincronizando ? 'animate-spin' : ''}/></button>
                  )}
                  <button type="button" onClick={() => onVerDetalle(pedido.id)} className="rounded-xl bg-[#5C3A4D] p-2.5 text-white"><ChevronRight size={17}/></button>
                </div>
              </div>
            </article>
          )
        })}
      </section>
    </main>
  )
}

function Kpi({ etiqueta, valor }: { etiqueta: string; valor: string | number }) { return <div className="rounded-2xl border border-[#EEDDE3] bg-white p-4"><div className="flex items-center gap-2 text-sm font-medium text-[#756870]"><WalletCards size={17}/>{etiqueta}</div><p className="mt-2 text-2xl font-bold text-[#5C3A4D]">{valor}</p></div> }

export default Pedidos
