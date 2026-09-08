import { useEffect, useMemo, useState } from 'react'
import {
  CalendarCheck2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Link2,
  RefreshCw,
  Unplug,
} from 'lucide-react'

import {
  conectarGoogleCalendar,
  desconectarGoogleCalendar,
  leerResultadoOAuthGoogleCalendar,
  obtenerEstadoGoogleCalendar,
  sincronizarTodosGoogleCalendar,
  type EstadoGoogleCalendar,
} from '../lib/googleCalendar'
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
  const [estadoGoogle, setEstadoGoogle] = useState<EstadoGoogleCalendar | null>(null)
  const [cargandoGoogle, setCargandoGoogle] = useState(true)
  const [accionGoogle, setAccionGoogle] = useState(false)
  const [mensajeGoogle, setMensajeGoogle] = useState('')

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

  const cargarEstadoGoogle = async () => {
    setCargandoGoogle(true)

    try {
      const estado = await obtenerEstadoGoogleCalendar()
      setEstadoGoogle(estado)
    } catch (errorGoogle) {
      console.error(errorGoogle)
      setMensajeGoogle(errorGoogle instanceof Error ? errorGoogle.message : 'No se pudo revisar Google Calendar.')
    } finally {
      setCargandoGoogle(false)
    }
  }

  useEffect(() => {
    const resultado = leerResultadoOAuthGoogleCalendar()

    if (resultado?.estado === 'connected') {
      const detalle = resultado.errores > 0
        ? `Google Calendar quedó conectado. ${resultado.sincronizados} pedidos sincronizados y ${resultado.errores} con error.`
        : `✓ Google Calendar conectado. ${resultado.sincronizados} pedidos sincronizados automáticamente.`
      setMensajeGoogle(detalle)
    } else if (resultado?.estado === 'error') {
      setMensajeGoogle(resultado.mensaje || 'No se pudo conectar Google Calendar.')
    }

    cargarEstadoGoogle()
  }, [])

  useEffect(() => {
    let activo = true

    const cargar = async () => {
      setCargando(true)
      setError('')

      const { data, error: errorSupabase } = await supabase
        .from('encargos')
        .select('id,nombre_cliente,telefono,fecha_entrega,hora_entrega,sabor_torta,sabor_relleno,chantilly,imagen_referencia,dedicatoria,observaciones,precio_cotizado,abono,estado_pedido,created_at,google_event_id,google_event_url,google_calendar_synced_at,google_calendar_sync_error')
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
    return () => { activo = false }
  }, [rango.inicio, rango.fin])

  const porFecha = useMemo(() => {
    const mapa: Record<string, Encargo[]> = {}
    pedidos.forEach((pedido) => { (mapa[pedido.fecha_entrega] ??= []).push(pedido) })
    return mapa
  }, [pedidos])

  const hoyISO = fechaLocalAISO(new Date())
  const tituloMes = mesVisible.toLocaleDateString('es-SV', { month: 'long', year: 'numeric' })
  const moverMes = (cantidad: number) => setMesVisible((actual) => new Date(actual.getFullYear(), actual.getMonth() + cantidad, 1))

  const conectar = async () => {
    setAccionGoogle(true)
    setMensajeGoogle('')

    try {
      await conectarGoogleCalendar()
    } catch (errorGoogle) {
      setAccionGoogle(false)
      setMensajeGoogle(errorGoogle instanceof Error ? errorGoogle.message : 'No se pudo iniciar la conexión con Google.')
    }
  }

  const sincronizarTodo = async () => {
    setAccionGoogle(true)
    setMensajeGoogle('')

    try {
      const resultado = await sincronizarTodosGoogleCalendar()
      if (!resultado.synced && resultado.reason === 'not_connected') {
        setMensajeGoogle('Primero conecta Google Calendar.')
      } else {
        setMensajeGoogle(`✓ Sincronización terminada: ${resultado.correctos ?? 0} correctos${(resultado.errores ?? 0) > 0 ? `, ${resultado.errores} con error` : ''}.`)
      }
      await cargarEstadoGoogle()
    } catch (errorGoogle) {
      setMensajeGoogle(errorGoogle instanceof Error ? errorGoogle.message : 'No se pudo sincronizar Google Calendar.')
    } finally {
      setAccionGoogle(false)
    }
  }

  const desconectar = async () => {
    setAccionGoogle(true)
    setMensajeGoogle('')

    try {
      await desconectarGoogleCalendar()
      setMensajeGoogle('Google Calendar fue desconectado. Los eventos ya creados permanecen en Google hasta que los elimines allí.')
      await cargarEstadoGoogle()
    } catch (errorGoogle) {
      setMensajeGoogle(errorGoogle instanceof Error ? errorGoogle.message : 'No se pudo desconectar Google Calendar.')
    } finally {
      setAccionGoogle(false)
    }
  }

  return (
    <main className="p-4 md:ml-64 md:p-8 lg:p-10">
      <header className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-[#756870]">Agenda mensual</p>
          <h2 className="mt-1 text-3xl font-bold capitalize text-[#5C3A4D]">{tituloMes}</h2>
          <p className="mt-2 text-sm text-[#756870]">Vista completa del mes con clientes, horas y estado de cada encargo.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="https://calendar.google.com/calendar/u/0/r/month" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-[#E5D7DE] bg-white px-4 py-2.5 text-sm font-semibold text-[#5C3A4D] hover:bg-[#FBF1F4]"><ExternalLink size={16}/> Abrir Google Calendar</a>
          <button type="button" onClick={() => setMesVisible(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} className="rounded-xl border border-[#E5D7DE] bg-white px-4 py-2.5 text-sm font-semibold text-[#5C3A4D]">Hoy</button>
          <button type="button" onClick={() => moverMes(-1)} className="rounded-xl border border-[#E5D7DE] bg-white p-2.5"><ChevronLeft size={18}/></button>
          <button type="button" onClick={() => moverMes(1)} className="rounded-xl border border-[#E5D7DE] bg-white p-2.5"><ChevronRight size={18}/></button>
        </div>
      </header>

      <section className="mb-6 overflow-hidden rounded-2xl border border-[#DCE6F7] bg-white shadow-sm">
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${estadoGoogle?.connected ? 'bg-[#EEF5FF] text-[#4285F4]' : 'bg-[#F5F1F3] text-[#9A8B93]'}`}>
              {estadoGoogle?.connected ? <CalendarCheck2 size={24}/> : <Link2 size={24}/>} 
            </div>
            <div>
              <p className="font-bold text-[#5C3A4D]">Sincronización con Google Calendar</p>
              <p className="mt-1 text-sm text-[#756870]">
                {cargandoGoogle
                  ? 'Revisando conexión...'
                  : estadoGoogle?.connected
                    ? `Conectado${estadoGoogle.ownerName ? ` por ${estadoGoogle.ownerName}` : ''}. Los pedidos nuevos se crean automáticamente en el calendario.`
                    : 'Todavía no hay una cuenta de Google conectada al negocio.'}
              </p>
              {estadoGoogle?.connectedAt && <p className="mt-1 text-xs text-[#9A8B93]">Conexión actualizada: {new Date(estadoGoogle.connectedAt).toLocaleString('es-SV')}</p>}
            </div>
          </div>

          {estadoGoogle?.canManage && (
            <div className="flex flex-wrap gap-2">
              {!estadoGoogle.connected ? (
                <button type="button" disabled={accionGoogle} onClick={conectar} className="inline-flex items-center gap-2 rounded-xl bg-[#4285F4] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Link2 size={17}/> Conectar Google</button>
              ) : (
                <>
                  <button type="button" disabled={accionGoogle} onClick={sincronizarTodo} className="inline-flex items-center gap-2 rounded-xl bg-[#4285F4] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><RefreshCw size={17} className={accionGoogle ? 'animate-spin' : ''}/> Sincronizar todo</button>
                  <button type="button" disabled={accionGoogle} onClick={desconectar} className="inline-flex items-center gap-2 rounded-xl border border-[#E5D7DE] bg-white px-4 py-2.5 text-sm font-semibold text-[#756870] disabled:opacity-60"><Unplug size={17}/> Desconectar</button>
                </>
              )}
            </div>
          )}
        </div>

        {mensajeGoogle && <div className="border-t border-[#E8EEF9] bg-[#F7FAFF] px-5 py-3 text-sm font-medium text-[#3569B8]">{mensajeGoogle}</div>}
      </section>

      {error && <div className="mb-5 rounded-xl bg-[#FFF0F5] px-4 py-3 text-sm font-semibold text-[#D93470]">{error}</div>}

      <section className="overflow-hidden rounded-2xl border border-[#EEDDE3] bg-white shadow-sm">
        <div className="grid grid-cols-7 border-b border-[#EEDDE3] bg-[#FFF9F7]">
          {nombresDias.map((dia) => <div key={dia} className="px-1 py-3 text-center text-xs font-bold uppercase tracking-wide text-[#8E7883] sm:text-sm">{dia}</div>)}
        </div>

        <div className="grid grid-cols-7">
          {rango.dias.map((dia, index) => {
            const fechaISO = fechaLocalAISO(dia)
            const pedidosDia = porFecha[fechaISO] ?? []
            const esMesActual = dia.getMonth() === mesVisible.getMonth()
            const esHoy = fechaISO === hoyISO
            const pendientes = pedidosDia.filter((p) => p.estado_pedido === 'Pendiente').length
            const listos = pedidosDia.filter((p) => p.estado_pedido === 'Listo').length

            return (
              <div
                key={fechaISO}
                className={`min-h-28 border-[#F0E4E8] p-1.5 sm:min-h-36 sm:p-2 lg:min-h-44 ${index % 7 !== 6 ? 'border-r' : ''} ${index < rango.dias.length - 7 ? 'border-b' : ''} ${esMesActual ? 'bg-white' : 'bg-[#FCFAFB]'}`}
              >
                <button type="button" onClick={() => onSeleccionarDia(fechaISO)} className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-left hover:bg-[#FFF4F8]">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold sm:text-sm ${esHoy ? 'bg-[#EC3D7F] text-white' : esMesActual ? 'text-[#5C3A4D]' : 'text-[#B8AAB1]'}`}>{dia.getDate()}</span>
                  {pedidosDia.length > 0 && <span className="rounded-full bg-[#F6E6EB] px-2 py-0.5 text-[9px] font-bold text-[#D93470] sm:text-[10px]">{pedidosDia.length}</span>}
                </button>

                <div className="mt-1 space-y-1">
                  {pedidosDia.slice(0, 3).map((pedido) => (
                    <button key={pedido.id} type="button" onClick={() => onVerDetalle(pedido.id)} className={`block w-full truncate rounded-md px-1.5 py-1 text-left text-[9px] font-semibold sm:text-[10px] lg:text-xs ${pedido.estado_pedido === 'Pendiente' ? 'bg-[#FFF0F5] text-[#C93268]' : pedido.estado_pedido === 'Listo' ? 'bg-[#F4EEF3] text-[#6F4C69]' : 'bg-[#EEF3EB] text-[#64745D]'}`} title={`${formatearHora(pedido.hora_entrega)} - ${pedido.nombre_cliente}`}>
                      <span className="hidden lg:inline">{formatearHora(pedido.hora_entrega)} · </span>{pedido.nombre_cliente}
                      {pedido.google_event_id && <span className="ml-1 text-[#4285F4]">●</span>}
                    </button>
                  ))}
                  {pedidosDia.length > 3 && <button type="button" onClick={() => onSeleccionarDia(fechaISO)} className="w-full text-left text-[9px] font-bold text-[#EC3D7F] sm:text-[10px]">+{pedidosDia.length - 3} más</button>}
                </div>

                {(pendientes > 0 || listos > 0) && <div className="mt-2 hidden gap-1 lg:flex"><span className="rounded-full bg-[#FFF0F5] px-2 py-0.5 text-[9px] font-semibold text-[#D93470]">{pendientes} pend.</span><span className="rounded-full bg-[#F4EEF3] px-2 py-0.5 text-[9px] font-semibold text-[#6F4C69]">{listos} listos</span></div>}
              </div>
            )
          })}
        </div>
      </section>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-[#756870]"><span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#F6B4CC]"/> Pendiente</span><span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#CBB5C6]"/> Listo</span><span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#C9D6C4]"/> Entregado</span><span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#4285F4]"/> Sincronizado con Google</span>{cargando && <span className="ml-auto flex items-center gap-1"><CalendarDays size={14}/> Cargando...</span>}</div>
    </main>
  )
}

export default Calendario
