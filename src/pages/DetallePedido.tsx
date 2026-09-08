import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowLeft,
  CalendarCheck2,
  CakeSlice,
  CheckCircle2,
  Clock3,
  ExternalLink,
  ImageIcon,
  Phone,
  RefreshCw,
  WalletCards,
} from 'lucide-react'

import { sincronizarPedidoGoogleCalendar } from '../lib/googleCalendar'
import { obtenerUrlImagen } from '../lib/imagenes'
import { supabase } from '../lib/supabase'
import type { Encargo, EstadoPedido } from '../types/encargo'
import { fechaISOADate, formatearHora, obtenerPago } from '../types/encargo'

type DetallePedidoProps = {
  idPedido: string | number
  onVolver: () => void
}

function DetallePedido({ idPedido, onVolver }: DetallePedidoProps) {
  const [pedido, setPedido] = useState<Encargo | null>(null)
  const [urlImagen, setUrlImagen] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardandoEstado, setGuardandoEstado] = useState(false)
  const [sincronizandoGoogle, setSincronizandoGoogle] = useState(false)
  const [error, setError] = useState('')
  const [mensajeGoogle, setMensajeGoogle] = useState('')

  useEffect(() => {
    let activo = true

    const cargar = async () => {
      setCargando(true)
      setError('')

      const { data, error: errorSupabase } = await supabase
        .from('encargos')
        .select('id,nombre_cliente,telefono,fecha_entrega,hora_entrega,sabor_torta,sabor_relleno,chantilly,imagen_referencia,dedicatoria,observaciones,precio_cotizado,abono,estado_pedido,creado_por,created_at,google_event_id,google_event_url,google_calendar_synced_at,google_calendar_sync_error')
        .eq('id', idPedido)
        .single()

      if (!activo) return

      if (errorSupabase) {
        console.error(errorSupabase)
        setError('No se pudo cargar el detalle del pedido.')
        setPedido(null)
        setCargando(false)
        return
      }

      const encargo = data as Encargo
      setPedido(encargo)
      setCargando(false)

      if (encargo.imagen_referencia) {
        const url = await obtenerUrlImagen(encargo.imagen_referencia)
        if (activo) setUrlImagen(url)
      } else {
        setUrlImagen(null)
      }
    }

    cargar()
    return () => { activo = false }
  }, [idPedido])

  const sincronizarGoogle = async (pedidoActual: Encargo) => {
    setSincronizandoGoogle(true)
    setMensajeGoogle('')

    try {
      const resultado = await sincronizarPedidoGoogleCalendar(pedidoActual.id)

      if (!resultado.synced && resultado.reason === 'not_connected') {
        setMensajeGoogle('Google Calendar todavía no está conectado. El Propietario puede conectarlo desde Calendario.')
        return
      }

      const actualizado: Encargo = {
        ...pedidoActual,
        google_event_id: resultado.eventId ?? null,
        google_event_url: resultado.eventUrl ?? null,
        google_calendar_synced_at: resultado.syncedAt ?? new Date().toISOString(),
        google_calendar_sync_error: null,
      }

      setPedido(actualizado)
      setMensajeGoogle(resultado.deleted ? '✓ El evento cancelado se retiró de Google Calendar.' : '✓ Google Calendar está actualizado.')
    } catch (errorGoogle) {
      console.error(errorGoogle)
      setMensajeGoogle(errorGoogle instanceof Error ? errorGoogle.message : 'No se pudo sincronizar Google Calendar.')
    } finally {
      setSincronizandoGoogle(false)
    }
  }

  const cambiarEstado = async (nuevoEstado: EstadoPedido) => {
    if (!pedido || pedido.estado_pedido === nuevoEstado) return

    setGuardandoEstado(true)
    setError('')

    const { error: errorSupabase } = await supabase
      .from('encargos')
      .update({ estado_pedido: nuevoEstado })
      .eq('id', pedido.id)

    setGuardandoEstado(false)

    if (errorSupabase) {
      console.error(errorSupabase)
      setError('No se pudo actualizar el estado.')
      return
    }

    const pedidoActualizado = { ...pedido, estado_pedido: nuevoEstado }
    setPedido(pedidoActualizado)
    await sincronizarGoogle(pedidoActualizado)
  }

  if (cargando) {
    return <main className="p-5 md:ml-64 md:p-8 lg:p-10"><p className="text-[#756870]">Cargando pedido...</p></main>
  }

  if (!pedido) {
    return (
      <main className="p-5 md:ml-64 md:p-8 lg:p-10">
        <button onClick={onVolver} className="mb-5 inline-flex items-center gap-2"><ArrowLeft size={17}/> Volver</button>
        <div className="rounded-xl bg-[#FFF0F5] p-4 text-[#D93470]">{error || 'Pedido no encontrado.'}</div>
      </main>
    )
  }

  const pago = obtenerPago(pedido)
  const fecha = fechaISOADate(pedido.fecha_entrega).toLocaleDateString('es-SV', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <main className="p-5 md:ml-64 md:p-8 lg:p-10">
      <header className="mb-7">
        <button type="button" onClick={onVolver} className="mb-5 inline-flex items-center gap-2 rounded-xl border border-[#E5D7DE] bg-white px-4 py-2.5 text-sm font-semibold text-[#5C3A4D] hover:bg-[#FBF1F4]"><ArrowLeft size={17}/> Volver</button>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-[#756870]">Detalle del pedido</p>
            <h2 className="mt-1 text-3xl font-bold text-[#5C3A4D]">{pedido.nombre_cliente}</h2>
            <p className="mt-2 capitalize text-sm text-[#756870]">{fecha} · {formatearHora(pedido.hora_entrega)}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {pedido.google_event_url && (
              <a href={pedido.google_event_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-[#D7E3FA] bg-white px-4 py-3 text-sm font-semibold text-[#3569B8] hover:bg-[#F5F8FE]"><ExternalLink size={16}/> Abrir en Google</a>
            )}
            <button type="button" disabled={sincronizandoGoogle} onClick={() => sincronizarGoogle(pedido)} className="inline-flex items-center gap-2 rounded-xl bg-[#4285F4] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
              <RefreshCw size={17} className={sincronizandoGoogle ? 'animate-spin' : ''}/>
              {sincronizandoGoogle ? 'Sincronizando...' : pedido.google_event_id ? 'Actualizar Calendar' : 'Sincronizar Calendar'}
            </button>
          </div>
        </div>
      </header>

      {error && <div className="mb-5 rounded-xl bg-[#FFF0F5] px-4 py-3 text-sm font-semibold text-[#D93470]">{error}</div>}
      {mensajeGoogle && <div className="mb-5 rounded-xl border border-[#DCE6F7] bg-[#F6F9FE] px-4 py-3 text-sm font-semibold text-[#3569B8]">{mensajeGoogle}</div>}

      <section className="mb-6 rounded-2xl border border-[#EEDDE3] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${pedido.google_event_id ? 'bg-[#EEF5FF] text-[#4285F4]' : 'bg-[#F5F1F3] text-[#9A8B93]'}`}><CalendarCheck2 size={20}/></div>
            <div>
              <p className="font-semibold text-[#5C3A4D]">Google Calendar</p>
              <p className="text-xs text-[#756870]">{pedido.google_event_id ? 'Este pedido está sincronizado automáticamente.' : 'Este pedido todavía no tiene evento de Google Calendar.'}</p>
            </div>
          </div>
          <div className="text-xs text-[#9A8B93]">
            {pedido.google_calendar_sync_error
              ? <span className="font-semibold text-[#D93470]">Error: {pedido.google_calendar_sync_error}</span>
              : pedido.google_calendar_synced_at
                ? `Última sincronización: ${new Date(pedido.google_calendar_synced_at).toLocaleString('es-SV')}`
                : 'Sin sincronización registrada'}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-[#EEDDE3] bg-white p-5 sm:p-6">
            <h3 className="text-lg font-semibold text-[#5C3A4D]">Información general</h3>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Dato icono={<Clock3 size={17}/>} etiqueta="Entrega" valor={`${fecha}\n${formatearHora(pedido.hora_entrega)}`} />
              <Dato icono={<Phone size={17}/>} etiqueta="Teléfono" valor={pedido.telefono || 'No registrado'} />
              <Dato icono={<CakeSlice size={17}/>} etiqueta="Torta" valor={pedido.sabor_torta} />
              <Dato etiqueta="Relleno" valor={pedido.sabor_relleno} />
              <Dato etiqueta="Chantilly" valor={pedido.chantilly} />
              <Dato etiqueta="Estado" valor={pedido.estado_pedido} />
            </div>
          </section>

          <section className="rounded-2xl border border-[#EEDDE3] bg-white p-5 sm:p-6">
            <div className="flex items-center gap-2"><ImageIcon size={19} className="text-[#EC3D7F]"/><h3 className="text-lg font-semibold text-[#5C3A4D]">Imagen de referencia</h3></div>
            {urlImagen ? <a href={urlImagen} target="_blank" rel="noreferrer" className="mt-4 block overflow-hidden rounded-2xl border border-[#EEDDE3] bg-[#FFF9F7]"><img src={urlImagen} alt="Referencia del pedido" className="max-h-[520px] w-full object-contain"/></a> : <div className="mt-4 flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-[#DFC9D2] bg-[#FFFDFC] text-sm text-[#9A8B93]">Este pedido no tiene imagen de referencia.</div>}
          </section>

          <section className="rounded-2xl border border-[#EEDDE3] bg-white p-5 sm:p-6">
            <h3 className="text-lg font-semibold text-[#5C3A4D]">Indicaciones</h3>
            <div className="mt-4 space-y-4"><Texto etiqueta="Dedicatoria" valor={pedido.dedicatoria}/><Texto etiqueta="Observaciones" valor={pedido.observaciones}/></div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-[#EEDDE3] bg-white p-5 sm:p-6">
            <div className="flex items-center gap-2"><WalletCards size={19} className="text-[#EC3D7F]"/><h3 className="text-lg font-semibold text-[#5C3A4D]">Pago</h3></div>
            <div className={`mt-4 rounded-2xl p-4 ${pago.pagado ? 'bg-[#F1F8F3] text-[#557260]' : 'bg-[#FFF2F6] text-[#D93470]'}`}><p className="font-bold">{pago.estado}</p><p className="mt-1 text-sm">{pago.pagado ? 'No hay saldo pendiente.' : `Falta cobrar $${pago.saldo.toFixed(2)}`}</p></div>
            <dl className="mt-4 space-y-3 text-sm"><FilaPago etiqueta="Precio total" valor={pago.total}/><FilaPago etiqueta="Abono" valor={pago.abono}/><FilaPago etiqueta="Saldo" valor={pago.saldo} fuerte/></dl>
          </section>

          <section className="rounded-2xl border border-[#EEDDE3] bg-white p-5 sm:p-6">
            <h3 className="text-lg font-semibold text-[#5C3A4D]">Estado de preparación</h3>
            <p className="mt-1 text-sm text-[#756870]">El cambio también actualiza Google Calendar automáticamente.</p>
            <div className="mt-4 grid gap-2">
              {(['Pendiente','Listo','Entregado','Cancelado'] as EstadoPedido[]).map((estado) => <button key={estado} type="button" disabled={guardandoEstado || sincronizandoGoogle} onClick={() => cambiarEstado(estado)} className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${pedido.estado_pedido === estado ? estado === 'Pendiente' ? 'border-[#EC3D7F] bg-[#FCE5ED] text-[#D93470]' : estado === 'Listo' ? 'border-[#BFA7B9] bg-[#F3EAF0] text-[#6F4C69]' : estado === 'Entregado' ? 'border-[#C8D7C2] bg-[#EEF3EB] text-[#64745D]' : 'border-[#D8D8D8] bg-[#F3F3F3] text-[#666]' : 'border-[#E5D7DE] bg-white text-[#756870] hover:bg-[#FBF1F4]'}`}>{pedido.estado_pedido === estado && <CheckCircle2 size={16} className="mr-2 inline"/>}{estado}</button>)}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

function Dato({ icono, etiqueta, valor }: { icono?: ReactNode; etiqueta: string; valor: string }) { return <div className="rounded-xl bg-[#FFF9F7] p-4"><p className="flex items-center gap-1.5 text-xs font-medium text-[#9A8B93]">{icono}{etiqueta}</p><p className="mt-1 whitespace-pre-line text-sm font-semibold text-[#5C3A4D]">{valor}</p></div> }
function Texto({ etiqueta, valor }: { etiqueta: string; valor: string | null }) { return <div><p className="text-xs font-bold uppercase tracking-wide text-[#A18C96]">{etiqueta}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#5C3A4D]">{valor || 'Sin información.'}</p></div> }
function FilaPago({ etiqueta, valor, fuerte = false }: { etiqueta: string; valor: number; fuerte?: boolean }) { return <div className={`flex items-center justify-between border-b border-[#F0E4E8] pb-3 ${fuerte ? 'font-bold text-[#5C3A4D]' : 'text-[#756870]'}`}><dt>{etiqueta}</dt><dd>${valor.toFixed(2)}</dd></div> }

export default DetallePedido
