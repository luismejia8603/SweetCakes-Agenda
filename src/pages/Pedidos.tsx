import { useEffect, useMemo, useState } from 'react'
import {
  CakeSlice,
  ChevronRight,
  ClipboardList,
  Search,
  WalletCards,
} from 'lucide-react'

import { supabase } from '../lib/supabase'
import type { Encargo } from '../types/encargo'
import { fechaISOADate, formatearHora, obtenerPago } from '../types/encargo'

type PedidosProps = { onVerDetalle: (id: string | number) => void }

const estados = ['Todos', 'Pendiente', 'Listo', 'Entregado', 'Cancelado']

function Pedidos({ onVerDetalle }: PedidosProps) {
  const [pedidos, setPedidos] = useState<Encargo[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState('Todos')

  useEffect(() => {
    let activo = true

    const cargar = async () => {
      setCargando(true)
      setError('')

      const { data, error: errorSupabase } = await supabase
        .from('encargos')
        .select(
          'id,nombre_cliente,telefono,fecha_entrega,hora_entrega,sabor_torta,sabor_relleno,chantilly,imagen_referencia,dedicatoria,observaciones,precio_cotizado,abono,estado_pedido,created_at'
        )
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
    return () => {
      activo = false
    }
  }, [])

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()

    return pedidos.filter((pedido) => {
      const coincideEstado = estado === 'Todos' || pedido.estado_pedido === estado
      const coincideTexto =
        !texto ||
        [pedido.nombre_cliente, pedido.telefono ?? '', pedido.sabor_torta, pedido.sabor_relleno]
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

  return (
    <main className="px-4 py-5 pb-28 sm:px-5 md:ml-20 md:p-6 lg:ml-64 lg:p-8 xl:p-10">
      <header className="mb-6 sm:mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#B07A91] sm:text-sm sm:normal-case sm:tracking-normal sm:text-[#756870]">Historial</p>
        <h2 className="mt-1 text-2xl font-bold text-[#5C3A4D] sm:text-3xl">Todos los pedidos</h2>
        <p className="mt-1.5 text-sm text-[#756870]">Consulta pedidos anteriores y futuros desde una sola pantalla.</p>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi etiqueta="Pedidos" valor={cargando ? '...' : kpi.total} />
        <Kpi etiqueta="Ventas" valor={cargando ? '...' : `$${kpi.ventas.toFixed(2)}`} />
        <Kpi etiqueta="Por preparar" valor={cargando ? '...' : kpi.pendientes} />
        <Kpi etiqueta="Por cobrar" valor={cargando ? '...' : `$${kpi.porCobrar.toFixed(2)}`} />
      </section>

      <section className="mb-5 rounded-2xl border border-[#EEDDE3] bg-white p-3 sm:p-4">
        <label className="relative block">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A8B93]" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar cliente, teléfono o sabor..."
            className="min-h-12 w-full rounded-xl border border-[#E5D7DE] bg-[#FFFDFC] py-3 pl-10 pr-4 text-base outline-none focus:border-[#EC3D7F] sm:text-sm"
          />
        </label>

        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {estados.map((opcion) => (
            <button
              key={opcion}
              type="button"
              onClick={() => setEstado(opcion)}
              className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold transition ${
                estado === opcion
                  ? 'bg-[#5C3A4D] text-white'
                  : 'border border-[#E5D7DE] bg-white text-[#756870]'
              }`}
            >
              {opcion}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div className="mb-5 rounded-xl bg-[#FFF0F5] px-4 py-3 text-sm font-semibold text-[#D93470]">{error}</div>
      )}

      {!cargando && filtrados.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#DFC9D2] bg-white p-10 text-center sm:p-12">
          <ClipboardList size={32} className="mx-auto text-[#CDA9B8]" />
          <p className="mt-3 font-semibold text-[#5C3A4D]">No encontramos pedidos con esos filtros.</p>
        </div>
      )}

      <section className="space-y-2.5 sm:space-y-3">
        {filtrados.map((pedido) => {
          const pago = obtenerPago(pedido)
          const fecha = fechaISOADate(pedido.fecha_entrega).toLocaleDateString('es-SV', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })

          return (
            <button
              type="button"
              key={pedido.id}
              onClick={() => onVerDetalle(pedido.id)}
              className="w-full rounded-2xl border border-[#EEDDE3] bg-white p-4 text-left shadow-sm transition active:scale-[0.995] sm:p-5 sm:hover:border-[#DFC9D2] sm:hover:shadow-md"
            >
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F6E6EB] text-[#EC3D7F]">
                  <CakeSlice size={20} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-[#5C3A4D]">{pedido.nombre_cliente}</p>
                      <p className="mt-1 text-xs font-medium text-[#756870] sm:text-sm">{fecha} · {formatearHora(pedido.hora_entrega)}</p>
                    </div>
                    <ChevronRight size={18} className="mt-0.5 shrink-0 text-[#C59CAD]" />
                  </div>

                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#9A8B93] sm:text-sm">
                    {pedido.sabor_torta} · {pedido.sabor_relleno} · Chantilly {pedido.chantilly}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold sm:text-xs ${
                      pedido.estado_pedido === 'Pendiente'
                        ? 'bg-[#FCE5ED] text-[#D93470]'
                        : pedido.estado_pedido === 'Listo'
                          ? 'bg-[#F3EAF0] text-[#6F4C69]'
                          : pedido.estado_pedido === 'Entregado'
                            ? 'bg-[#EEF3EB] text-[#64745D]'
                            : 'bg-[#F2F2F2] text-[#777]'
                    }`}>{pedido.estado_pedido}</span>

                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold sm:text-xs ${
                      pago.pagado ? 'bg-[#EDF7F1] text-[#557260]' : 'bg-[#FFF2F6] text-[#D93470]'
                    }`}>
                      {pago.pagado ? 'Pagado' : `Falta $${pago.saldo.toFixed(2)}`}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </section>
    </main>
  )
}

function Kpi({ etiqueta, valor }: { etiqueta: string; valor: string | number }) {
  return (
    <div className="rounded-2xl border border-[#EEDDE3] bg-white p-3.5 sm:p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-[#756870] sm:text-sm">
        <WalletCards size={16} />
        {etiqueta}
      </div>
      <p className="mt-2 text-xl font-black text-[#5C3A4D] sm:text-2xl">{valor}</p>
    </div>
  )
}

export default Pedidos
