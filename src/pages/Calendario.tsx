import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

import { supabase } from '../lib/supabase'
import type { Encargo } from '../types/encargo'
import { fechaLocalAISO, formatearHora } from '../types/encargo'

type CalendarioProps = {
  onSeleccionarDia: (fechaISO: string) => void
  onVerDetalle: (id: string | number) => void
}

const nombresDias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function inicioSemanaLunes(fecha: Date) {
  const copia = new Date(fecha)
  const dia = (copia.getDay() + 6) % 7
  copia.setDate(copia.getDate() - dia)
  copia.setHours(0, 0, 0, 0)
  return copia
}

function finSemanaDomingo(fecha: Date) {
  const inicio = inicioSemanaLunes(fecha)
  const fin = new Date(inicio)
  fin.setDate(fin.getDate() + 6)
  return fin
}

function Calendario({ onSeleccionarDia, onVerDetalle }: CalendarioProps) {
  const [mesVisible, setMesVisible] = useState(() => {
    const hoy = new Date()
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  })
  const [pedidos, setPedidos] = useState<Encargo[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const rango = useMemo(() => {
    const primerDiaMes = new Date(mesVisible.getFullYear(), mesVisible.getMonth(), 1)
    const ultimoDiaMes = new Date(mesVisible.getFullYear(), mesVisible.getMonth() + 1, 0)
    const inicio = inicioSemanaLunes(primerDiaMes)
    const fin = finSemanaDomingo(ultimoDiaMes)
    const dias: Date[] = []
    const cursor = new Date(inicio)

    while (cursor <= fin) {
      dias.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }

    return { inicio, fin, dias }
  }, [mesVisible])

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
        .gte('fecha_entrega', fechaLocalAISO(rango.inicio))
        .lte('fecha_entrega', fechaLocalAISO(rango.fin))
        .neq('estado_pedido', 'Cancelado')
        .order('fecha_entrega', { ascending: true })
        .order('hora_entrega', { ascending: true })

      if (!activo) return

      if (errorSupabase) {
        console.error(errorSupabase)
        setError('No se pudo cargar el calendario.')
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
  }, [rango.inicio, rango.fin])

  const porFecha = useMemo(() => {
    const mapa: Record<string, Encargo[]> = {}
    pedidos.forEach((pedido) => {
      ;(mapa[pedido.fecha_entrega] ??= []).push(pedido)
    })
    return mapa
  }, [pedidos])

  const hoyISO = fechaLocalAISO(new Date())
  const tituloMes = mesVisible.toLocaleDateString('es-SV', {
    month: 'long',
    year: 'numeric',
  })

  const moverMes = (cantidad: number) =>
    setMesVisible(
      (actual) => new Date(actual.getFullYear(), actual.getMonth() + cantidad, 1)
    )

  const irAHoy = () => {
    const hoy = new Date()
    setMesVisible(new Date(hoy.getFullYear(), hoy.getMonth(), 1))
  }

  return (
    <main className="px-3 py-5 pb-28 sm:px-5 md:ml-20 md:p-6 lg:ml-64 lg:p-8 xl:p-10">
      <header className="mb-5 sm:mb-7">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#B07A91] sm:text-sm sm:normal-case sm:tracking-normal sm:text-[#756870]">
              Agenda mensual
            </p>
            <h2 className="mt-1 truncate text-2xl font-bold capitalize text-[#5C3A4D] sm:text-3xl">
              {tituloMes}
            </h2>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={irAHoy}
              className="hidden min-h-11 rounded-xl border border-[#E5D7DE] bg-white px-4 text-sm font-semibold text-[#5C3A4D] hover:bg-[#FBF1F4] sm:inline-flex sm:items-center"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => moverMes(-1)}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E5D7DE] bg-white text-[#5C3A4D] active:scale-95"
              aria-label="Mes anterior"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => moverMes(1)}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E5D7DE] bg-white text-[#5C3A4D] active:scale-95"
              aria-label="Mes siguiente"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between sm:hidden">
          <p className="text-xs text-[#756870]">Toca un día para abrir sus pedidos.</p>
          <button type="button" onClick={irAHoy} className="text-xs font-bold text-[#EC3D7F]">
            Ir a hoy
          </button>
        </div>
        <p className="mt-2 hidden text-sm text-[#756870] sm:block">
          Visualiza el mes completo. En teléfono mostramos lo esencial; en tablet y PC aparecen más detalles.
        </p>
      </header>

      {error && (
        <div className="mb-5 rounded-xl bg-[#FFF0F5] px-4 py-3 text-sm font-semibold text-[#D93470]">{error}</div>
      )}

      <section className="overflow-hidden rounded-2xl border border-[#EEDDE3] bg-white shadow-sm">
        <div className="grid grid-cols-7 border-b border-[#EEDDE3] bg-[#FFF9F7]">
          {nombresDias.map((dia) => (
            <div key={dia} className="px-0.5 py-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-[#8E7883] sm:py-3 sm:text-sm">
              {dia}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {rango.dias.map((dia, index) => {
            const fechaISO = fechaLocalAISO(dia)
            const pedidosDia = porFecha[fechaISO] ?? []
            const esMesActual = dia.getMonth() === mesVisible.getMonth()
            const esHoy = fechaISO === hoyISO
            const pendientes = pedidosDia.filter((pedido) => pedido.estado_pedido === 'Pendiente').length
            const listos = pedidosDia.filter((pedido) => pedido.estado_pedido === 'Listo').length
            const entregados = pedidosDia.filter((pedido) => pedido.estado_pedido === 'Entregado').length

            return (
              <div
                key={fechaISO}
                className={`min-h-[72px] border-[#F0E4E8] p-1 sm:min-h-32 sm:p-2 lg:min-h-44 ${
                  index % 7 !== 6 ? 'border-r' : ''
                } ${index < rango.dias.length - 7 ? 'border-b' : ''} ${
                  esMesActual ? 'bg-white' : 'bg-[#FCFAFB]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSeleccionarDia(fechaISO)}
                  className="flex h-full w-full flex-col rounded-xl text-left transition active:bg-[#FFF4F8] sm:h-auto sm:active:bg-transparent sm:hover:bg-[#FFF8FA]"
                >
                  <div className="flex w-full items-center justify-between px-0.5 py-0.5 sm:px-1 sm:py-1">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold sm:text-sm ${
                        esHoy
                          ? 'bg-[#EC3D7F] text-white'
                          : esMesActual
                            ? 'text-[#5C3A4D]'
                            : 'text-[#B8AAB1]'
                      }`}
                    >
                      {dia.getDate()}
                    </span>
                    {pedidosDia.length > 0 && (
                      <span className="rounded-full bg-[#F6E6EB] px-1.5 py-0.5 text-[9px] font-black text-[#D93470] sm:px-2 sm:text-[10px]">
                        {pedidosDia.length}
                      </span>
                    )}
                  </div>

                  <div className="mt-auto w-full px-1 pb-1 sm:hidden">
                    {pedidosDia.length > 0 && (
                      <div className="flex flex-wrap gap-0.5">
                        {pendientes > 0 && <span className="h-2 w-2 rounded-full bg-[#EC7EA5]" />}
                        {listos > 0 && <span className="h-2 w-2 rounded-full bg-[#9E7E98]" />}
                        {entregados > 0 && <span className="h-2 w-2 rounded-full bg-[#91A489]" />}
                      </div>
                    )}
                  </div>
                </button>

                <div className="mt-1 hidden space-y-1 sm:block">
                  {pedidosDia.slice(0, 3).map((pedido) => (
                    <button
                      key={pedido.id}
                      type="button"
                      onClick={() => onVerDetalle(pedido.id)}
                      className={`block w-full truncate rounded-md px-1.5 py-1 text-left text-[9px] font-semibold lg:text-xs ${
                        pedido.estado_pedido === 'Pendiente'
                          ? 'bg-[#FFF0F5] text-[#C93268]'
                          : pedido.estado_pedido === 'Listo'
                            ? 'bg-[#F4EEF3] text-[#6F4C69]'
                            : 'bg-[#EEF3EB] text-[#64745D]'
                      }`}
                      title={`${formatearHora(pedido.hora_entrega)} - ${pedido.nombre_cliente}`}
                    >
                      <span className="hidden lg:inline">{formatearHora(pedido.hora_entrega)} · </span>
                      {pedido.nombre_cliente}
                    </button>
                  ))}
                  {pedidosDia.length > 3 && (
                    <button
                      type="button"
                      onClick={() => onSeleccionarDia(fechaISO)}
                      className="w-full text-left text-[10px] font-bold text-[#EC3D7F]"
                    >
                      +{pedidosDia.length - 3} más
                    </button>
                  )}
                </div>

                {(pendientes > 0 || listos > 0) && (
                  <div className="mt-2 hidden gap-1 lg:flex">
                    <span className="rounded-full bg-[#FFF0F5] px-2 py-0.5 text-[9px] font-semibold text-[#D93470]">{pendientes} pend.</span>
                    <span className="rounded-full bg-[#F4EEF3] px-2 py-0.5 text-[9px] font-semibold text-[#6F4C69]">{listos} listos</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-[11px] text-[#756870] sm:text-xs">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#EC7EA5]" /> Pendiente</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#9E7E98]" /> Listo</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#91A489]" /> Entregado</span>
        {cargando && <span className="ml-auto flex items-center gap-1"><CalendarDays size={14} /> Cargando...</span>}
      </div>
    </main>
  )
}

export default Calendario
