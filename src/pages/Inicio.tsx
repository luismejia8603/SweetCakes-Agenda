import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CakeSlice, Clock3, PackageCheck } from 'lucide-react'

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
}

const resumenVacio: ResumenDia = { total: 0, pendientes: 0, listos: 0, entregados: 0, pagados: 0 }

function Inicio({ onSeleccionarDia, onVerPedidos, onVerDetalle }: InicioProps) {
  const [fechaActual, setFechaActual] = useState(new Date())
  const [pedidos, setPedidos] = useState<Encargo[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const diasProximos = useMemo(() =>
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
    }), [fechaActual])

  const hoyISO = fechaLocalAISO(fechaActual)
  const inicioISO = diasProximos[0].fechaISO
  const finISO = diasProximos[6].fechaISO

  useEffect(() => {
    const intervalo = window.setInterval(() => {
      const ahora = new Date()
      setFechaActual((anterior) => fechaLocalAISO(anterior) === fechaLocalAISO(ahora) ? anterior : ahora)
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
        .select('id,nombre_cliente,telefono,fecha_entrega,hora_entrega,sabor_torta,sabor_relleno,chantilly,imagen_referencia,dedicatoria,observaciones,precio_cotizado,abono,estado_pedido,created_at')
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
    return () => { activo = false }
  }, [inicioISO, finISO])

  const resumenPorFecha = useMemo(() => {
    const mapa: Record<string, ResumenDia> = {}
    for (const pedido of pedidos) {
      const resumen = mapa[pedido.fecha_entrega] ?? { ...resumenVacio }
      resumen.total += 1
      if (pedido.estado_pedido === 'Pendiente') resumen.pendientes += 1
      if (pedido.estado_pedido === 'Listo') resumen.listos += 1
      if (pedido.estado_pedido === 'Entregado') resumen.entregados += 1
      if (obtenerPago(pedido).pagado) resumen.pagados += 1
      mapa[pedido.fecha_entrega] = resumen
    }
    return mapa
  }, [pedidos])

  const pedidosHoy = pedidos.filter((pedido) => pedido.fecha_entrega === hoyISO)
  const resumenHoy = resumenPorFecha[hoyISO] ?? resumenVacio
  const textoRango = `${diasProximos[0].fecha.toLocaleDateString('es-SV', { day: 'numeric', month: 'long' })} - ${diasProximos[6].fecha.toLocaleDateString('es-SV', { day: 'numeric', month: 'long', year: 'numeric' })}`

  return (
    <main className="p-5 md:ml-64 md:p-8 lg:p-10">
      <header className="mb-9">
        <p className="text-sm text-[#756870]">Agenda de encargos</p>
        <h2 className="mt-1 text-3xl font-bold text-[#5C3A4D]">Sweet Cakes</h2>
        <p className="mt-2 text-sm text-[#756870]">Todo lo importante de los próximos días, sin perder pedidos entre mensajes y papelitos.</p>
      </header>

      <section>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-[#5C3A4D]">Pedidos próximos</h3>
            <p className="mt-1 text-sm text-[#756870]">{textoRango}</p>
            <p className="mt-1 text-xs text-[#9A8B93]">Toca un día para abrir su lista de encargos.</p>
          </div>
          <button type="button" onClick={onVerPedidos} className="inline-flex items-center gap-2 text-sm font-semibold text-[#EC3D7F] hover:underline">
            Historial de pedidos <ArrowRight size={16} />
          </button>
        </div>

        {error && <p className="mb-4 rounded-xl bg-[#FFF0F5] px-4 py-3 text-sm font-medium text-[#D93470]">{error}</p>}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
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

      <section className="mt-10">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-[#5C3A4D]">Entregas de hoy</h3>
            <p className="mt-1 text-sm text-[#756870]">Ordenadas por hora para saber qué sale primero del horno.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-[#FFF0F5] px-3 py-1.5 text-[#D93470]">{resumenHoy.pendientes} por preparar</span>
            <span className="rounded-full bg-[#F4EEF3] px-3 py-1.5 text-[#6F4C69]">{resumenHoy.listos} listos</span>
            <span className="rounded-full bg-[#F1F8F3] px-3 py-1.5 text-[#557260]">{resumenHoy.pagados} pagados</span>
          </div>
        </div>

        {!cargando && pedidosHoy.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#DFC9D2] bg-white px-6 py-10 text-center">
            <CakeSlice className="mx-auto text-[#CDA9B8]" size={32} />
            <p className="mt-3 font-semibold text-[#5C3A4D]">No hay entregas registradas para hoy.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#EEDDE3] bg-white">
            {pedidosHoy.map((pedido, index) => {
              const pago = obtenerPago(pedido)
              return (
                <button
                  type="button"
                  key={pedido.id}
                  onClick={() => onVerDetalle(pedido.id)}
                  className={`flex w-full flex-col gap-4 p-5 text-left transition hover:bg-[#FFFBFA] sm:flex-row sm:items-center sm:justify-between ${index !== pedidosHoy.length - 1 ? 'border-b border-[#F0E4E8]' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F6E6EB] text-[#EC3D7F]"><CakeSlice size={21} /></div>
                    <div>
                      <p className="font-semibold text-[#5C3A4D]">{pedido.nombre_cliente}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-[#756870]">
                        <span className="flex items-center gap-1"><Clock3 size={15} />{formatearHora(pedido.hora_entrega)}</span>
                        <span>{pedido.sabor_torta}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${pedido.estado_pedido === 'Pendiente' ? 'bg-[#FCE5ED] text-[#D93470]' : pedido.estado_pedido === 'Listo' ? 'bg-[#F3EAF0] text-[#6F4C69]' : 'bg-[#EEF3EB] text-[#64745D]'}`}>
                      {pedido.estado_pedido}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${pago.pagado ? 'bg-[#EDF7F1] text-[#557260]' : 'bg-[#FFF3F7] text-[#D93470]'}`}>
                      {pago.pagado ? 'Pagado' : `Saldo $${pago.saldo.toFixed(2)}`}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        <button type="button" onClick={() => onSeleccionarDia(hoyISO)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#EC3D7F] px-5 py-3 text-sm font-semibold text-white hover:bg-[#D93470]">
          <PackageCheck size={17} /> Gestionar pedidos de hoy
        </button>
      </section>
    </main>
  )
}

export default Inicio
