import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  CakeSlice,
  CheckCircle2,
  Clock3,
  PackageCheck,
  WalletCards,
} from 'lucide-react'

import { supabase } from '../lib/supabase'
import type { Encargo } from '../types/encargo'
import { fechaLocalAISO, formatearHora, obtenerPago } from '../types/encargo'

type InicioProps = {
  onSeleccionarDia: (fechaISO: string) => void
  onVerPedidos: () => void
  onVerDetalle: (id: string | number) => void
}

type ResumenDia = {
  total: number
  pendientes: number
  listos: number
  entregados: number
  pagados: number
  saldo: number
}

const resumenVacio: ResumenDia = {
  total: 0,
  pendientes: 0,
  listos: 0,
  entregados: 0,
  pagados: 0,
  saldo: 0,
}

function Inicio({ onSeleccionarDia, onVerPedidos, onVerDetalle }: InicioProps) {
  const [fechaActual, setFechaActual] = useState(new Date())
  const [pedidos, setPedidos] = useState<Encargo[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const diasProximos = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const fecha = new Date(fechaActual)
        fecha.setHours(0, 0, 0, 0)
        fecha.setDate(fecha.getDate() + index)
        const nombre = fecha.toLocaleDateString('es-SV', { weekday: 'short' }).replace('.', '')

        return {
          fecha,
          fechaISO: fechaLocalAISO(fecha),
          nombre: nombre.charAt(0).toUpperCase() + nombre.slice(1),
        }
      }),
    [fechaActual]
  )

  const hoyISO = fechaLocalAISO(fechaActual)
  const inicioISO = diasProximos[0].fechaISO
  const finISO = diasProximos[6].fechaISO

  useEffect(() => {
    const intervalo = window.setInterval(() => {
      const ahora = new Date()
      setFechaActual((anterior) =>
        fechaLocalAISO(anterior) === fechaLocalAISO(ahora) ? anterior : ahora
      )
    }, 60_000)

    return () => window.clearInterval(intervalo)
  }, [])

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
        .gte('fecha_entrega', inicioISO)
        .lte('fecha_entrega', finISO)
        .neq('estado_pedido', 'Cancelado')
        .order('fecha_entrega', { ascending: true })
        .order('hora_entrega', { ascending: true })

      if (!activo) return

      if (errorSupabase) {
        console.error(errorSupabase)
        setError('No se pudieron cargar los próximos pedidos.')
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
  }, [inicioISO, finISO])

  const resumenPorFecha = useMemo(() => {
    const mapa: Record<string, ResumenDia> = {}

    for (const pedido of pedidos) {
      const resumen = mapa[pedido.fecha_entrega] ?? { ...resumenVacio }
      const pago = obtenerPago(pedido)

      resumen.total += 1
      if (pedido.estado_pedido === 'Pendiente') resumen.pendientes += 1
      if (pedido.estado_pedido === 'Listo') resumen.listos += 1
      if (pedido.estado_pedido === 'Entregado') resumen.entregados += 1
      if (pago.pagado) resumen.pagados += 1
      resumen.saldo += pago.saldo
      mapa[pedido.fecha_entrega] = resumen
    }

    return mapa
  }, [pedidos])

  const pedidosHoy = pedidos.filter((pedido) => pedido.fecha_entrega === hoyISO)
  const resumenHoy = resumenPorFecha[hoyISO] ?? resumenVacio
  const textoRango = `${diasProximos[0].fecha.toLocaleDateString('es-SV', {
    day: 'numeric',
    month: 'long',
  })} - ${diasProximos[6].fecha.toLocaleDateString('es-SV', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })}`

  const fechaHoyTexto = fechaActual.toLocaleDateString('es-SV', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <main className="px-4 py-5 pb-28 sm:px-5 md:ml-20 md:p-6 lg:ml-64 lg:p-8 xl:p-10">
      <header className="mb-6 sm:mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#B07A91] sm:text-sm sm:normal-case sm:tracking-normal sm:text-[#756870]">
          Agenda de encargos
        </p>
        <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[#5C3A4D] sm:text-3xl">Sweet Cakes</h2>
            <p className="mt-1 capitalize text-sm text-[#756870]">{fechaHoyTexto}</p>
          </div>
          <button
            type="button"
            onClick={onVerPedidos}
            className="mt-2 hidden items-center gap-2 text-sm font-semibold text-[#EC3D7F] hover:underline sm:inline-flex"
          >
            Ver historial <ArrowRight size={16} />
          </button>
        </div>
      </header>

      <section className="mb-8">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#5C3A4D] sm:text-xl">Resumen de hoy</h3>
            <p className="mt-0.5 text-xs text-[#9A8B93] sm:text-sm">Lo esencial para trabajar sin perder el ritmo.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <ResumenRapido icono={<CakeSlice size={18} />} etiqueta="Pedidos" valor={cargando ? '...' : resumenHoy.total} tono="normal" />
          <ResumenRapido icono={<PackageCheck size={18} />} etiqueta="Por preparar" valor={cargando ? '...' : resumenHoy.pendientes} tono="rosa" />
          <ResumenRapido icono={<CheckCircle2 size={18} />} etiqueta="Listos" valor={cargando ? '...' : resumenHoy.listos} tono="morado" />
          <ResumenRapido icono={<WalletCards size={18} />} etiqueta="Por cobrar" valor={cargando ? '...' : `$${resumenHoy.saldo.toFixed(2)}`} tono="verde" />
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-[#5C3A4D] sm:text-xl">Pedidos próximos</h3>
            <p className="mt-1 text-xs text-[#756870] sm:text-sm">{textoRango}</p>
          </div>
          <button type="button" onClick={onVerPedidos} className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[#EC3D7F] sm:hidden">
            Historial <ArrowRight size={14} />
          </button>
        </div>

        {error && (
          <p className="mb-4 rounded-xl bg-[#FFF0F5] px-4 py-3 text-sm font-medium text-[#D93470]">{error}</p>
        )}

        <div className="space-y-2 sm:hidden">
          {diasProximos.map((dia) => {
            const resumen = resumenPorFecha[dia.fechaISO] ?? resumenVacio
            const esHoy = dia.fechaISO === hoyISO

            return (
              <button
                type="button"
                key={dia.fechaISO}
                onClick={() => onSeleccionarDia(dia.fechaISO)}
                className={`flex w-full items-center gap-3 rounded-2xl border bg-white p-3.5 text-left shadow-sm transition active:scale-[0.99] ${esHoy ? 'border-[#EC3D7F] ring-2 ring-[#EC3D7F]/5' : 'border-[#EEDDE3]'}`}
              >
                <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl ${esHoy ? 'bg-[#EC3D7F] text-white' : 'bg-[#FFF4F8] text-[#5C3A4D]'}`}>
                  <span className="text-[10px] font-bold uppercase">{dia.nombre}</span>
                  <span className="text-xl font-black leading-5">{dia.fecha.getDate()}</span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-[#5C3A4D]">
                      {cargando ? 'Cargando...' : `${resumen.total} ${resumen.total === 1 ? 'pedido' : 'pedidos'}`}
                    </p>
                    <ArrowRight size={17} className="shrink-0 text-[#C59CAD]" />
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold">
                    <span className="text-[#D93470]">{resumen.pendientes} pendientes</span>
                    <span className="text-[#6F4C69]">{resumen.listos} listos</span>
                    <span className="text-[#557260]">{resumen.pagados} pagados</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <div className="hidden grid-cols-2 gap-3 sm:grid md:grid-cols-4 xl:grid-cols-7">
          {diasProximos.map((dia) => {
            const resumen = resumenPorFecha[dia.fechaISO] ?? resumenVacio
            const esHoy = dia.fechaISO === hoyISO

            return (
              <button
                type="button"
                key={dia.fechaISO}
                onClick={() => onSeleccionarDia(dia.fechaISO)}
                className={`group rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-1 hover:shadow-md ${esHoy ? 'border-[#EC3D7F]' : 'border-[#EEDDE3]'}`}
              >
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <p className="text-sm font-bold text-[#5C3A4D]">{dia.nombre}</p>
                    {esHoy && <span className="rounded-full bg-[#FCE5ED] px-2 py-0.5 text-[9px] font-bold uppercase text-[#D93470]">Hoy</span>}
                  </div>
                  <p className="mt-1 text-xs text-[#9A8B93]">{dia.fecha.toLocaleDateString('es-SV', { day: 'numeric', month: 'short' })}</p>
                  <p className="mt-3 text-3xl font-bold text-[#EC3D7F]">{cargando ? '...' : resumen.total}</p>
                  <p className="text-[11px] text-[#9A8B93]">{resumen.total === 1 ? 'encargo' : 'encargos'}</p>
                </div>
                <div className="mt-4 space-y-2 border-t border-[#F0E4E8] pt-3 text-xs">
                  <div className="flex justify-between"><span className="text-[#756870]">Por preparar</span><b className="text-[#D93470]">{resumen.pendientes}</b></div>
                  <div className="flex justify-between"><span className="text-[#756870]">Listos</span><b className="text-[#6F4C69]">{resumen.listos}</b></div>
                  <div className="flex justify-between"><span className="text-[#756870]">Pagados</span><b className="text-[#557260]">{resumen.pagados}</b></div>
                </div>
                <div className="mt-3 flex items-center justify-center gap-1 border-t border-[#F0E4E8] pt-3 text-[11px] font-semibold text-[#EC3D7F]">
                  Ver día <ArrowRight size={13} className="transition group-hover:translate-x-1" />
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <section className="mt-8 sm:mt-10">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-[#5C3A4D] sm:text-xl">Entregas de hoy</h3>
            <p className="mt-1 text-xs text-[#756870] sm:text-sm">Ordenadas por hora.</p>
          </div>
          <div className="hidden flex-wrap gap-2 text-xs font-semibold sm:flex">
            <span className="rounded-full bg-[#FFF0F5] px-3 py-1.5 text-[#D93470]">{resumenHoy.pendientes} por preparar</span>
            <span className="rounded-full bg-[#F4EEF3] px-3 py-1.5 text-[#6F4C69]">{resumenHoy.listos} listos</span>
            <span className="rounded-full bg-[#F1F8F3] px-3 py-1.5 text-[#557260]">{resumenHoy.pagados} pagados</span>
          </div>
        </div>

        {!cargando && pedidosHoy.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#DFC9D2] bg-white px-6 py-9 text-center">
            <CakeSlice className="mx-auto text-[#CDA9B8]" size={30} />
            <p className="mt-3 font-semibold text-[#5C3A4D]">No hay entregas registradas para hoy.</p>
          </div>
        ) : (
          <div className="space-y-2 sm:overflow-hidden sm:rounded-2xl sm:border sm:border-[#EEDDE3] sm:bg-white sm:space-y-0">
            {pedidosHoy.map((pedido, index) => {
              const pago = obtenerPago(pedido)

              return (
                <button
                  type="button"
                  key={pedido.id}
                  onClick={() => onVerDetalle(pedido.id)}
                  className={`w-full rounded-2xl border border-[#EEDDE3] bg-white p-4 text-left transition active:scale-[0.995] sm:rounded-none sm:border-0 sm:p-5 sm:hover:bg-[#FFFBFA] ${index !== pedidosHoy.length - 1 ? 'sm:border-b sm:border-[#F0E4E8]' : ''}`}
                >
                  <div className="flex items-start gap-3 sm:items-center sm:gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F6E6EB] text-[#EC3D7F]"><CakeSlice size={21} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#5C3A4D]">{pedido.nombre_cliente}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#756870] sm:text-sm">
                            <span className="flex items-center gap-1 font-semibold"><Clock3 size={14} />{formatearHora(pedido.hora_entrega)}</span>
                            <span>{pedido.sabor_torta}</span>
                          </div>
                        </div>
                        <ArrowRight size={16} className="mt-1 shrink-0 text-[#C59CAD] sm:hidden" />
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 sm:justify-end">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold sm:text-xs ${pedido.estado_pedido === 'Pendiente' ? 'bg-[#FCE5ED] text-[#D93470]' : pedido.estado_pedido === 'Listo' ? 'bg-[#F3EAF0] text-[#6F4C69]' : 'bg-[#EEF3EB] text-[#64745D]'}`}>{pedido.estado_pedido}</span>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold sm:text-xs ${pago.pagado ? 'bg-[#EDF7F1] text-[#557260]' : 'bg-[#FFF2F6] text-[#D93470]'}`}>{pago.pagado ? 'Pagado' : `Falta $${pago.saldo.toFixed(2)}`}</span>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}

function ResumenRapido({
  icono,
  etiqueta,
  valor,
  tono,
}: {
  icono: React.ReactNode
  etiqueta: string
  valor: string | number
  tono: 'rosa' | 'morado' | 'verde' | 'normal'
}) {
  const clases =
    tono === 'rosa'
      ? 'bg-[#FFF4F8] text-[#D93470]'
      : tono === 'morado'
        ? 'bg-[#F7F2F6] text-[#6F4C69]'
        : tono === 'verde'
          ? 'bg-[#F3F8F4] text-[#557260]'
          : 'bg-white text-[#5C3A4D]'

  return (
    <div className={`rounded-2xl border border-[#EEDDE3] p-3.5 sm:p-4 ${clases}`}>
      <div className="flex items-center gap-2 text-xs font-semibold sm:text-sm">
        {icono}
        <span>{etiqueta}</span>
      </div>
      <p className="mt-2 text-xl font-black sm:text-2xl">{valor}</p>
    </div>
  )
}

export default Inicio
