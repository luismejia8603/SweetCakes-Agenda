import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowLeft,
  CakeSlice,
  CheckCircle2,
  Clock3,
  Eye,
  PackageCheck,
  WalletCards,
} from 'lucide-react'

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
  const [actualizando, setActualizando] = useState<string | null>(null)

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

  const cambiarEstado = async (pedido: Encargo, estado: 'Pendiente' | 'Listo') => {
    if (pedido.estado_pedido === estado) return

    setActualizando(String(pedido.id))
    setError('')

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

    setPedidos((actuales) =>
      actuales.map((p) => (p.id === pedido.id ? { ...p, estado_pedido: estado } : p))
    )
  }

  const fechaBonita = fechaISOADate(fechaISO).toLocaleDateString('es-SV', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <main className="px-4 py-5 pb-28 sm:px-5 md:ml-20 md:p-6 lg:ml-64 lg:p-8 xl:p-10">
      <header className="mb-6 sm:mb-8">
        <button
          type="button"
          onClick={onVolver}
          className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E5D7DE] bg-white px-4 text-sm font-semibold text-[#5C3A4D] hover:bg-[#FBF1F4]"
        >
          <ArrowLeft size={17} /> Volver
        </button>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#B07A91] sm:text-sm sm:normal-case sm:tracking-normal sm:text-[#756870]">Control diario</p>
        <h2 className="mt-1 text-2xl font-bold capitalize text-[#5C3A4D] sm:text-3xl">{fechaBonita}</h2>
        <p className="mt-1.5 text-sm text-[#756870]">Marca lo que ya está listo y revisa los saldos antes de cada entrega.</p>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icono={<PackageCheck size={17} />} etiqueta="Por preparar" valor={cargando ? '...' : resumen.pendientes} tono="rosa" />
        <Kpi icono={<CheckCircle2 size={17} />} etiqueta="Listos" valor={cargando ? '...' : resumen.listos} tono="morado" />
        <Kpi icono={<WalletCards size={17} />} etiqueta="Pagados" valor={cargando ? '...' : resumen.pagados} tono="verde" />
        <Kpi icono={<WalletCards size={17} />} etiqueta="Por cobrar" valor={cargando ? '...' : `$${resumen.saldo.toFixed(2)}`} tono="normal" />
      </section>

      {error && (
        <div className="mb-5 rounded-xl bg-[#FFF0F5] px-4 py-3 text-sm font-semibold text-[#D93470]">{error}</div>
      )}

      {!cargando && pedidos.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#DFC9D2] bg-white p-10 text-center sm:p-12">
          <CakeSlice size={32} className="mx-auto text-[#CDA9B8]" />
          <p className="mt-3 font-semibold text-[#5C3A4D]">No hay pedidos para este día.</p>
        </div>
      )}

      <section className="space-y-3 sm:space-y-4">
        {pedidos.map((pedido) => {
          const pago = obtenerPago(pedido)
          const guardando = actualizando === String(pedido.id)
          const bloqueado = ['Entregado', 'Cancelado'].includes(pedido.estado_pedido)

          return (
            <article key={pedido.id} className="rounded-2xl border border-[#EEDDE3] bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F6E6EB] text-[#EC3D7F] sm:h-12 sm:w-12">
                  <CakeSlice size={21} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-bold text-[#5C3A4D] sm:text-lg">{pedido.nombre_cliente}</h3>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[#756870] sm:text-sm">
                        <span className="inline-flex items-center gap-1"><Clock3 size={14} />{formatearHora(pedido.hora_entrega)}</span>
                        {pedido.telefono && <span>· {pedido.telefono}</span>}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onVerDetalle(pedido.id)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#5C3A4D] text-white sm:hidden"
                      aria-label="Ver detalle"
                    >
                      <Eye size={17} />
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold sm:text-xs ${
                      pedido.estado_pedido === 'Pendiente'
                        ? 'bg-[#FCE5ED] text-[#D93470]'
                        : pedido.estado_pedido === 'Listo'
                          ? 'bg-[#F3EAF0] text-[#6F4C69]'
                          : 'bg-[#EEF3EB] text-[#64745D]'
                    }`}>{pedido.estado_pedido}</span>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold sm:text-xs ${
                      pago.pagado ? 'bg-[#EDF7F1] text-[#557260]' : 'bg-[#FFF2F6] text-[#D93470]'
                    }`}>{pago.pagado ? 'Pagado' : `Falta $${pago.saldo.toFixed(2)}`}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
                <Dato etiqueta="Torta" valor={pedido.sabor_torta} />
                <Dato etiqueta="Relleno" valor={pedido.sabor_relleno} />
                <Dato etiqueta="Chantilly" valor={pedido.chantilly} />
              </div>

              <div className="mt-4 border-t border-[#F0E4E8] pt-4">
                {!bloqueado ? (
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
                    <div className="contents sm:flex sm:gap-2">
                      <button
                        type="button"
                        disabled={guardando}
                        onClick={() => cambiarEstado(pedido, 'Pendiente')}
                        className={`min-h-11 rounded-xl border px-3 text-sm font-semibold disabled:opacity-50 sm:px-4 ${
                          pedido.estado_pedido === 'Pendiente'
                            ? 'border-[#EC3D7F] bg-[#FCE5ED] text-[#D93470]'
                            : 'border-[#E5D7DE] text-[#756870]'
                        }`}
                      >
                        Pendiente
                      </button>
                      <button
                        type="button"
                        disabled={guardando}
                        onClick={() => cambiarEstado(pedido, 'Listo')}
                        className={`min-h-11 rounded-xl border px-3 text-sm font-semibold disabled:opacity-50 sm:px-4 ${
                          pedido.estado_pedido === 'Listo'
                            ? 'border-[#BFA7B9] bg-[#F3EAF0] text-[#6F4C69]'
                            : 'border-[#E5D7DE] text-[#756870]'
                        }`}
                      >
                        {guardando ? 'Guardando...' : 'Listo'}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onVerDetalle(pedido.id)}
                      className="col-span-2 mt-1 hidden min-h-11 items-center justify-center gap-2 rounded-xl bg-[#5C3A4D] px-4 text-sm font-semibold text-white sm:inline-flex sm:mt-0"
                    >
                      <Eye size={16} /> Ver detalle
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onVerDetalle(pedido.id)}
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#5C3A4D] px-4 text-sm font-semibold text-white sm:w-auto"
                  >
                    <Eye size={16} /> Ver detalle
                  </button>
                )}
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
    <div className="min-w-0 rounded-xl bg-[#FFF9F7] p-2.5 sm:p-3">
      <p className="text-[10px] font-medium text-[#9A8B93] sm:text-xs">{etiqueta}</p>
      <p className="mt-1 line-clamp-2 text-xs font-semibold leading-4 text-[#5C3A4D] sm:text-sm">{valor}</p>
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
    <div className={`rounded-2xl border border-[#EEDDE3] p-3.5 sm:p-4 ${clases}`}>
      <div className="flex items-center gap-2 text-xs font-semibold sm:text-sm">{icono}{etiqueta}</div>
      <p className="mt-2 text-xl font-black sm:text-2xl">{valor}</p>
    </div>
  )
}

export default PedidosDia
