import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowLeft,
  Ban,
  CakeSlice,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  History,
  ImageIcon,
  PackageCheck,
  Pencil,
  Phone,
  Plus,
  WalletCards,
  X,
} from 'lucide-react'

import { cargarImagenesEncargo } from '../lib/encargoImagenes'
import { obtenerUrlsImagenes } from '../lib/imagenes'
import {
  anularPagoEncargo,
  cargarPagosEncargo,
  registrarPagoEncargo,
  type MetodoPago,
  type PagoEncargo,
} from '../lib/pagos'
import { supabase } from '../lib/supabase'
import type { Encargo, EstadoPedido } from '../types/encargo'
import { fechaISOADate, fechaLocalAISO, formatearHora, obtenerPago } from '../types/encargo'

type DetallePedidoProps = {
  idPedido: string | number
  onVolver: () => void
  onEditar: () => void
}

type ImagenVista = { id: string; ruta: string; url: string }

const METODOS_PAGO: MetodoPago[] = ['Efectivo', 'Transferencia']

function DetallePedido({ idPedido, onVolver, onEditar }: DetallePedidoProps) {
  const [pedido, setPedido] = useState<Encargo | null>(null)
  const [imagenes, setImagenes] = useState<ImagenVista[]>([])
  const [pagos, setPagos] = useState<PagoEncargo[]>([])
  const [indiceImagen, setIndiceImagen] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [guardandoEstado, setGuardandoEstado] = useState(false)
  const [guardandoPago, setGuardandoPago] = useState(false)
  const [anulandoPagoId, setAnulandoPagoId] = useState<string | null>(null)
  const [mostrarFormularioPago, setMostrarFormularioPago] = useState(false)
  const [montoPago, setMontoPago] = useState('')
  const [fechaPago, setFechaPago] = useState(fechaLocalAISO(new Date()))
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('Efectivo')
  const [metodoCobroRapido, setMetodoCobroRapido] = useState<'Efectivo' | 'Transferencia'>('Efectivo')
  const [mostrarAjustePrecio, setMostrarAjustePrecio] = useState(false)
  const [nuevoPrecio, setNuevoPrecio] = useState('')
  const [guardandoPrecio, setGuardandoPrecio] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    let activo = true

    const cargar = async () => {
      setCargando(true)
      setError('')
      setAviso('')

      const { data, error: errorSupabase } = await supabase
        .from('encargos')
        .select('id,nombre_cliente,telefono,fecha_entrega,hora_entrega,sabor_torta,sabor_relleno,chantilly,imagen_referencia,dedicatoria,observaciones,precio_cotizado,abono,estado_pedido,creado_por,created_at')
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

      try {
        const [registros, historialPagos] = await Promise.all([
          cargarImagenesEncargo(encargo.id, encargo.imagen_referencia),
          cargarPagosEncargo(encargo.id),
        ])
        const urls = await obtenerUrlsImagenes(registros.map((imagen) => imagen.ruta_storage))
        const mapaUrls = new Map(urls.map((item) => [item.ruta, item.url]))
        const vistas = registros
          .map((imagen) => ({ id: imagen.id, ruta: imagen.ruta_storage, url: mapaUrls.get(imagen.ruta_storage) ?? '' }))
          .filter((imagen) => Boolean(imagen.url))

        if (activo) {
          setImagenes(vistas)
          setPagos(historialPagos)
          setIndiceImagen(0)
        }
      } catch (errorCarga) {
        console.error(errorCarga)
        if (activo) setError('El pedido cargó, pero no se pudo leer toda la información asociada.')
      } finally {
        if (activo) setCargando(false)
      }
    }

    cargar()
    return () => { activo = false }
  }, [idPedido])

  const refrescarFinanzas = async () => {
    const [historialPagos, respuestaPedido] = await Promise.all([
      cargarPagosEncargo(idPedido),
      supabase
        .from('encargos')
        .select('abono,precio_cotizado')
        .eq('id', idPedido)
        .single(),
    ])

    if (respuestaPedido.error) throw respuestaPedido.error

    setPagos(historialPagos)
    setPedido((actual) => actual ? {
      ...actual,
      abono: respuestaPedido.data.abono,
      precio_cotizado: respuestaPedido.data.precio_cotizado,
    } : actual)
  }

  const cambiarEstado = async (nuevoEstado: EstadoPedido) => {
    if (!pedido || pedido.estado_pedido === nuevoEstado) return

    setGuardandoEstado(true)
    setError('')
    setAviso('')

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

    setPedido({ ...pedido, estado_pedido: nuevoEstado })
  }

  const abrirFormularioPago = (montoSugerido?: number) => {
    setError('')
    setAviso('')
    setMontoPago(montoSugerido && montoSugerido > 0 ? montoSugerido.toFixed(2) : '')
    setFechaPago(fechaLocalAISO(new Date()))
    setMetodoPago('Efectivo')
    setMostrarFormularioPago(true)
    window.setTimeout(() => document.getElementById('registrar-pago')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
  }

  const guardarPago = async () => {
    if (!pedido) return

    const monto = Number(montoPago.replace(',', '.'))
    const pagoActual = obtenerPago(pedido)

    if (!Number.isFinite(monto) || monto <= 0) {
      setError('Ingresa un monto de pago mayor que $0.')
      return
    }
    if (monto > pagoActual.saldo + 0.005) {
      setError(`El pago no puede superar el saldo pendiente de $${pagoActual.saldo.toFixed(2)}.`)
      return
    }
    if (!fechaPago) {
      setError('Selecciona la fecha del pago.')
      return
    }

    setGuardandoPago(true)
    setError('')
    setAviso('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Tu sesión terminó. Inicia sesión nuevamente.')

      await registrarPagoEncargo({
        encargoId: pedido.id,
        monto,
        fechaPago,
        metodoPago,
        creadoPor: user.id,
      })

      await refrescarFinanzas()
      setMostrarFormularioPago(false)
      setMontoPago('')
      setAviso(`✓ Pago de $${monto.toFixed(2)} registrado correctamente.`)
    } catch (errorPago) {
      console.error(errorPago)
      setError(errorPago instanceof Error ? errorPago.message : 'No se pudo registrar el pago.')
    } finally {
      setGuardandoPago(false)
    }
  }

  const cobrarSaldoPendiente = async () => {
    if (!pedido) return

    const pagoActual = obtenerPago(pedido)
    if (pagoActual.saldo <= 0.005) return

    setGuardandoPago(true)
    setError('')
    setAviso('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Tu sesión terminó. Inicia sesión nuevamente.')

      await registrarPagoEncargo({
        encargoId: pedido.id,
        monto: pagoActual.saldo,
        fechaPago: fechaLocalAISO(new Date()),
        metodoPago: metodoCobroRapido,
        creadoPor: user.id,
      })

      await refrescarFinanzas()
      setAviso(`✓ Saldo de $${pagoActual.saldo.toFixed(2)} cobrado por ${metodoCobroRapido}.`)
    } catch (errorPago) {
      console.error(errorPago)
      setError(errorPago instanceof Error ? errorPago.message : 'No se pudo cobrar el saldo pendiente.')
    } finally {
      setGuardandoPago(false)
    }
  }

  const abrirAjustePrecio = () => {
    if (!pedido) return
    setError('')
    setAviso('')
    setNuevoPrecio(Number(pedido.precio_cotizado ?? 0).toFixed(2))
    setMostrarAjustePrecio(true)
  }

  const guardarAjustePrecio = async () => {
    if (!pedido) return

    const precio = Number(nuevoPrecio.replace(',', '.'))
    const totalPagado = obtenerPago(pedido).abono

    if (!Number.isFinite(precio) || precio <= 0) {
      setError('Ingresa un precio mayor que $0.')
      return
    }
    if (precio + 0.005 < totalPagado) {
      setError(`El precio no puede quedar por debajo de los $${totalPagado.toFixed(2)} ya pagados.`)
      return
    }

    setGuardandoPrecio(true)
    setError('')
    setAviso('')

    try {
      const { error: errorPrecio } = await supabase
        .from('encargos')
        .update({ precio_cotizado: precio })
        .eq('id', pedido.id)

      if (errorPrecio) throw errorPrecio

      await refrescarFinanzas()
      setMostrarAjustePrecio(false)
      setAviso(`✓ Precio actualizado a $${precio.toFixed(2)}.`)
    } catch (errorPrecio) {
      console.error(errorPrecio)
      setError(errorPrecio instanceof Error ? errorPrecio.message : 'No se pudo actualizar el precio del pedido.')
    } finally {
      setGuardandoPrecio(false)
    }
  }

  const anularPago = async (pagoMovimiento: PagoEncargo) => {
    if (!pedido || pagoMovimiento.anulado) return

    if (pedido.estado_pedido === 'Entregado') {
      setError('No se puede anular un pago desde aquí porque el pedido ya fue entregado.')
      return
    }

    const motivo = window.prompt('Escribe el motivo de la anulación. El movimiento seguirá visible en el historial:')
    if (motivo === null) return

    setAnulandoPagoId(pagoMovimiento.id)
    setError('')
    setAviso('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Tu sesión terminó. Inicia sesión nuevamente.')

      await anularPagoEncargo(pagoMovimiento.id, motivo, user.id)
      await refrescarFinanzas()
      setAviso('✓ Pago anulado. El historial se conservó y el saldo fue recalculado.')
    } catch (errorAnular) {
      console.error(errorAnular)
      setError(errorAnular instanceof Error ? errorAnular.message : 'No se pudo anular el pago.')
    } finally {
      setAnulandoPagoId(null)
    }
  }

  const marcarComoEntregado = async () => {
    if (!pedido || pedido.estado_pedido === 'Entregado') return
    const pagoActual = obtenerPago(pedido)

    if (pagoActual.saldo > 0.005) {
      setError('Primero debes registrar el pago pendiente antes de entregar el pedido.')
      return
    }

    if (pedido.estado_pedido !== 'Listo') {
      setError('Primero marca el pedido como Listo antes de entregarlo.')
      return
    }

    if (!window.confirm('¿Confirmas que el cliente ya retiró su pedido? Esta acción lo marcará como Entregado.')) return
    await cambiarEstado('Entregado')
  }

  const imagenActual = imagenes[indiceImagen]
  const pago = useMemo(() => pedido ? obtenerPago(pedido) : null, [pedido])

  if (cargando) {
    return <main className="px-4 py-5 pb-28 sm:px-5 md:ml-20 md:p-6 lg:ml-64 lg:p-8 xl:p-10"><p className="text-[#756870]">Cargando pedido...</p></main>
  }

  if (!pedido || !pago) {
    return (
      <main className="px-4 py-5 pb-28 sm:px-5 md:ml-20 md:p-6 lg:ml-64 lg:p-8 xl:p-10">
        <button onClick={onVolver} className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E5D7DE] bg-white px-4 text-sm font-semibold text-[#5C3A4D]"><ArrowLeft size={17}/> Volver</button>
        <div className="rounded-xl bg-[#FFF0F5] p-4 text-[#D93470]">{error || 'Pedido no encontrado.'}</div>
      </main>
    )
  }

  const pagoCompleto = pago.saldo <= 0.005
  const pedidoListo = pedido.estado_pedido === 'Listo'
  const pedidoEntregado = pedido.estado_pedido === 'Entregado'
  const pedidoCancelado = pedido.estado_pedido === 'Cancelado'
  const puedeEntregar = pagoCompleto && pedidoListo && !pedidoCancelado

  const fecha = fechaISOADate(pedido.fecha_entrega).toLocaleDateString('es-SV', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <main className="px-4 py-5 pb-28 sm:px-5 md:ml-20 md:p-6 lg:ml-64 lg:p-8 xl:p-10">
      <header className="mb-6 sm:mb-7">
        <div className="mb-4 flex flex-wrap gap-2">
          <button type="button" onClick={onVolver} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E5D7DE] bg-white px-4 text-sm font-semibold text-[#5C3A4D] hover:bg-[#FBF1F4]"><ArrowLeft size={17}/> Volver</button>
          <button type="button" onClick={onEditar} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#EC3D7F] px-4 text-sm font-semibold text-white hover:bg-[#D93470]"><Pencil size={17}/> Editar pedido</button>
        </div>

        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#B07A91] sm:text-sm sm:normal-case sm:tracking-normal sm:text-[#756870]">Detalle del pedido</p>
        <h2 className="mt-1 text-2xl font-bold text-[#5C3A4D] sm:text-3xl">{pedido.nombre_cliente}</h2>
        <p className="mt-1.5 capitalize text-sm text-[#756870]">{fecha} · {formatearHora(pedido.hora_entrega)}</p>
      </header>

      {error && <div className="mb-5 rounded-xl bg-[#FFF0F5] px-4 py-3 text-sm font-semibold text-[#D93470]">{error}</div>}
      {aviso && <div className="mb-5 rounded-xl bg-[#EEF3EB] px-4 py-3 text-sm font-semibold text-[#557260]">{aviso}</div>}

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr] xl:gap-6">
        <div className="space-y-5 sm:space-y-6">
          <section className="rounded-2xl border border-[#EEDDE3] bg-white p-4 sm:p-6">
            <h3 className="text-base font-bold text-[#5C3A4D] sm:text-lg">Información general</h3>
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:mt-5 sm:gap-3 lg:grid-cols-3">
              <Dato icono={<Clock3 size={16}/>} etiqueta="Entrega" valor={`${fecha}\n${formatearHora(pedido.hora_entrega)}`} />
              <Dato icono={<Phone size={16}/>} etiqueta="Teléfono" valor={pedido.telefono || 'No registrado'} />
              <Dato icono={<CakeSlice size={16}/>} etiqueta="Torta" valor={pedido.sabor_torta} />
              <Dato etiqueta="Relleno" valor={pedido.sabor_relleno} />
              <Dato etiqueta="Chantilly" valor={pedido.chantilly} />
              <Dato etiqueta="Estado" valor={pedido.estado_pedido} />
            </div>
            {pedido.telefono && <a href={`tel:${pedido.telefono}`} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#E5D7DE] bg-[#FFFDFC] text-sm font-semibold text-[#5C3A4D] sm:hidden"><Phone size={17}/> Llamar al cliente</a>}
          </section>

          <section className="rounded-2xl border border-[#EEDDE3] bg-white p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2"><ImageIcon size={19} className="text-[#EC3D7F]"/><h3 className="text-base font-bold text-[#5C3A4D] sm:text-lg">Imágenes de referencia</h3></div>
              {imagenes.length > 0 && <span className="rounded-full bg-[#F6E6EB] px-2.5 py-1 text-xs font-bold text-[#D93470]">{indiceImagen + 1}/{imagenes.length}</span>}
            </div>

            {imagenActual ? (
              <>
                <div className="relative mt-4 overflow-hidden rounded-2xl border border-[#EEDDE3] bg-[#FFF9F7]">
                  <a href={imagenActual.url} target="_blank" rel="noreferrer" className="block"><img src={imagenActual.url} alt={`Referencia ${indiceImagen + 1}`} className="max-h-[520px] w-full object-contain"/></a>
                  {imagenes.length > 1 && (
                    <>
                      <button type="button" onClick={() => setIndiceImagen((indiceImagen - 1 + imagenes.length) % imagenes.length)} className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#5C3A4D] shadow"><ChevronLeft size={22}/></button>
                      <button type="button" onClick={() => setIndiceImagen((indiceImagen + 1) % imagenes.length)} className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#5C3A4D] shadow"><ChevronRight size={22}/></button>
                    </>
                  )}
                </div>
                {imagenes.length > 1 && (
                  <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
                    {imagenes.map((imagen, indice) => (
                      <button key={imagen.id} type="button" onClick={() => setIndiceImagen(indice)} className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 ${indice === indiceImagen ? 'border-[#EC3D7F]' : 'border-transparent'}`}><img src={imagen.url} alt={`Miniatura ${indice + 1}`} className="h-full w-full object-cover"/></button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="mt-4 flex min-h-36 items-center justify-center rounded-2xl border border-dashed border-[#DFC9D2] bg-[#FFFDFC] px-4 text-center text-sm text-[#9A8B93]">Este pedido no tiene imágenes de referencia.</div>
            )}
          </section>

          <section className="rounded-2xl border border-[#EEDDE3] bg-white p-4 sm:p-6">
            <h3 className="text-base font-bold text-[#5C3A4D] sm:text-lg">Indicaciones</h3>
            <div className="mt-4 space-y-4"><Texto etiqueta="Dedicatoria" valor={pedido.dedicatoria}/><Texto etiqueta="Observaciones" valor={pedido.observaciones}/></div>
          </section>

          <section className="rounded-2xl border border-[#EEDDE3] bg-white p-4 sm:p-6">
            <h3 className="text-base font-bold text-[#5C3A4D] sm:text-lg">Estado de preparación</h3>
            <p className="mt-1 text-xs text-[#756870] sm:text-sm">Primero prepara el pedido. La entrega final se registra abajo.</p>
            <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-1">
              {(['Pendiente','Listo','Cancelado'] as EstadoPedido[]).map((estado) => (
                <button key={estado} type="button" disabled={guardandoEstado || pedidoEntregado} onClick={() => cambiarEstado(estado)} className={`min-h-12 rounded-xl border px-3 text-left text-sm font-semibold transition disabled:opacity-50 ${pedido.estado_pedido === estado ? estado === 'Pendiente' ? 'border-[#EC3D7F] bg-[#FCE5ED] text-[#D93470]' : estado === 'Listo' ? 'border-[#BFA7B9] bg-[#F3EAF0] text-[#6F4C69]' : 'border-[#D8D8D8] bg-[#F3F3F3] text-[#666]' : 'border-[#E5D7DE] bg-white text-[#756870] hover:bg-[#FBF1F4]'}`}>{pedido.estado_pedido === estado && <CheckCircle2 size={16} className="mr-2 inline"/>}{estado}</button>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-5 sm:space-y-6">
          <section id="registrar-pago" className="rounded-2xl border border-[#EEDDE3] bg-white p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2"><WalletCards size={19} className="text-[#EC3D7F]"/><h3 className="text-base font-bold text-[#5C3A4D] sm:text-lg">Pagos</h3></div>
              {!pagoCompleto && !pedidoCancelado && !pedidoEntregado && (
                <button type="button" onClick={() => abrirFormularioPago()} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#E9CAD5] bg-[#FFF5F8] px-3 text-xs font-bold text-[#D93470] hover:bg-[#FCE5ED]"><Plus size={15}/> Registrar pago</button>
              )}
            </div>

            <div className={`mt-4 rounded-2xl p-4 ${pagoCompleto ? 'bg-[#F1F8F3] text-[#557260]' : 'bg-[#FFF2F6] text-[#D93470]'}`}><p className="font-bold">{pagoCompleto ? 'Pagado' : pago.estado}</p><p className="mt-1 text-sm">{pagoCompleto ? 'No hay saldo pendiente.' : `Falta cobrar $${pago.saldo.toFixed(2)}`}</p></div>
            <dl className="mt-4 space-y-3 text-sm"><FilaPago etiqueta="Precio actual" valor={pago.total}/><FilaPago etiqueta="Total pagado" valor={pago.abono}/><FilaPago etiqueta="Saldo" valor={pago.saldo} fuerte/></dl>

            {!pedidoEntregado && !pedidoCancelado && (
              <div className="mt-4 border-t border-[#F0E4E8] pt-4">
                {!mostrarAjustePrecio ? (
                  <button type="button" onClick={abrirAjustePrecio} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#E5D7DE] bg-white px-3 text-xs font-bold text-[#5C3A4D] hover:bg-[#FBF1F4]"><Pencil size={14}/> Ajustar precio del pedido</button>
                ) : (
                  <div className="rounded-xl border border-[#EEDDE3] bg-[#FFFDFC] p-3">
                    <p className="text-xs font-semibold text-[#756870]">Precio actualizado</p>
                    <p className="mt-1 text-xs leading-5 text-[#9A8B93]">Úsalo cuando el cliente agregue o quite especificaciones. No puede quedar por debajo de lo ya pagado.</p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <input type="number" min="0.01" step="0.01" value={nuevoPrecio} onChange={(e) => setNuevoPrecio(e.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#E5D7DE] bg-white px-3 text-[#5C3A4D] outline-none focus:border-[#EC3D7F]" />
                      <button type="button" disabled={guardandoPrecio} onClick={guardarAjustePrecio} className="min-h-11 rounded-xl bg-[#6F4C69] px-4 text-sm font-bold text-white disabled:opacity-60">{guardandoPrecio ? 'Guardando...' : 'Actualizar precio'}</button>
                      <button type="button" disabled={guardandoPrecio} onClick={() => setMostrarAjustePrecio(false)} className="min-h-11 rounded-xl border border-[#E5D7DE] bg-white px-4 text-sm font-semibold text-[#756870]">Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {mostrarFormularioPago && !pedidoEntregado && !pedidoCancelado && (
              <div className="mt-5 rounded-2xl border border-[#EEDDE3] bg-[#FFFDFC] p-4">
                <div className="flex items-center justify-between gap-3"><div><p className="font-bold text-[#5C3A4D]">Registrar movimiento</p><p className="mt-0.5 text-xs text-[#9A8B93]">El saldo se recalculará automáticamente.</p></div><button type="button" onClick={() => setMostrarFormularioPago(false)} className="flex h-9 w-9 items-center justify-center rounded-full text-[#9A8B93] hover:bg-[#F6E6EB]"><X size={18}/></button></div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <label><span className="mb-1.5 block text-xs font-semibold text-[#756870]">Monto</span><input type="number" min="0.01" max={pago.saldo} step="0.01" value={montoPago} onChange={(e) => setMontoPago(e.target.value)} className="min-h-11 w-full rounded-xl border border-[#E5D7DE] bg-white px-3 text-[#5C3A4D] outline-none focus:border-[#EC3D7F]" placeholder="0.00" /></label>
                  <label><span className="mb-1.5 block text-xs font-semibold text-[#756870]">Fecha</span><input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} className="min-h-11 w-full rounded-xl border border-[#E5D7DE] bg-white px-3 text-[#5C3A4D] outline-none focus:border-[#EC3D7F]" /></label>
                  <label><span className="mb-1.5 block text-xs font-semibold text-[#756870]">Método</span><select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value as MetodoPago)} className="min-h-11 w-full rounded-xl border border-[#E5D7DE] bg-white px-3 text-[#5C3A4D] outline-none focus:border-[#EC3D7F]">{METODOS_PAGO.map((metodo) => <option key={metodo} value={metodo}>{metodo}</option>)}</select></label>
                </div>
                <button type="button" disabled={guardandoPago} onClick={guardarPago} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#EC3D7F] px-4 text-sm font-bold text-white hover:bg-[#D93470] disabled:opacity-60"><WalletCards size={17}/>{guardandoPago ? 'Guardando pago...' : 'Guardar pago'}</button>
              </div>
            )}

            <div className="mt-5 border-t border-[#F0E4E8] pt-4">
              <div className="flex items-center gap-2"><History size={17} className="text-[#9A7185]"/><p className="text-sm font-bold text-[#5C3A4D]">Historial de pagos</p></div>
              {pagos.length === 0 ? (
                <p className="mt-3 rounded-xl bg-[#FFF9F7] px-3 py-3 text-sm text-[#9A8B93]">Aún no hay movimientos registrados.</p>
              ) : (
                <div className="mt-3 space-y-2.5">
                  {pagos.map((movimiento) => (
                    <MovimientoPago
                      key={movimiento.id}
                      pago={movimiento}
                      anulando={anulandoPagoId === movimiento.id}
                      puedeAnular={!pedidoEntregado}
                      onAnular={() => anularPago(movimiento)}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-[#E3D7DD] bg-gradient-to-b from-white to-[#FFF9FB] p-4 shadow-sm sm:p-6">
            <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FCE5ED] text-[#D93470]"><PackageCheck size={20}/></div><div><h3 className="text-base font-bold text-[#5C3A4D] sm:text-lg">Entrega al cliente</h3><p className="mt-1 text-xs leading-5 text-[#756870] sm:text-sm">Registra el saldo pendiente y después confirma que el cliente retiró el pedido.</p></div></div>
            <div className="mt-5 space-y-3">
              <div className={`rounded-2xl border p-4 ${pagoCompleto ? 'border-[#D6E5D8] bg-[#F4F9F5]' : 'border-[#F3D2DE] bg-[#FFF5F8]'}`}>
                <div className="flex items-start gap-3"><div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${pagoCompleto ? 'bg-[#DCEADF] text-[#557260]' : 'bg-[#FCE5ED] text-[#D93470]'}`}>{pagoCompleto ? <CheckCircle2 size={16}/> : '1'}</div><div className="min-w-0 flex-1"><p className={`font-bold ${pagoCompleto ? 'text-[#557260]' : 'text-[#5C3A4D]'}`}>{pagoCompleto ? 'Pago confirmado' : 'Cobrar saldo pendiente'}</p><p className="mt-1 text-sm text-[#756870]">{pagoCompleto ? 'El pedido no tiene saldo por cobrar.' : `El cliente debe $${pago.saldo.toFixed(2)}.`}</p>{!pagoCompleto && !pedidoCancelado && !pedidoEntregado && <div className="mt-3 grid gap-2 sm:grid-cols-[170px_1fr]"><label><span className="mb-1.5 block text-xs font-semibold text-[#756870]">Método de cobro</span><select value={metodoCobroRapido} onChange={(e) => setMetodoCobroRapido(e.target.value as 'Efectivo' | 'Transferencia')} className="min-h-12 w-full rounded-xl border border-[#E5D7DE] bg-white px-3 text-sm font-semibold text-[#5C3A4D] outline-none focus:border-[#EC3D7F]"><option value="Efectivo">Efectivo</option><option value="Transferencia">Transferencia</option></select></label><button type="button" disabled={guardandoPago} onClick={cobrarSaldoPendiente} className="self-end inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#EC3D7F] px-4 text-sm font-bold text-white hover:bg-[#D93470] disabled:opacity-60"><WalletCards size={17}/>{guardandoPago ? 'Cobrando...' : `Cobrar saldo · $${pago.saldo.toFixed(2)}`}</button><p className="text-xs text-[#9A8B93] sm:col-span-2">Un toque registra el saldo completo como pago final.</p></div>}</div></div>
              </div>
              <div className={`rounded-2xl border p-4 ${pedidoEntregado ? 'border-[#D6E5D8] bg-[#F4F9F5]' : 'border-[#E5D7DE] bg-white'}`}>
                <div className="flex items-start gap-3"><div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${pedidoEntregado ? 'bg-[#DCEADF] text-[#557260]' : 'bg-[#F3EAF0] text-[#6F4C69]'}`}>{pedidoEntregado ? <CheckCircle2 size={16}/> : '2'}</div><div className="min-w-0 flex-1"><p className={`font-bold ${pedidoEntregado ? 'text-[#557260]' : 'text-[#5C3A4D]'}`}>{pedidoEntregado ? 'Pedido entregado' : 'Confirmar retiro'}</p><p className="mt-1 text-sm text-[#756870]">{pedidoEntregado ? 'El cliente ya retiró este pedido.' : !pagoCompleto ? 'Primero registra el saldo pendiente.' : !pedidoListo ? 'Primero marca el pedido como Listo.' : 'El pago está completo. Ya puedes confirmar el retiro.'}</p>{!pedidoEntregado && !pedidoCancelado && <button type="button" disabled={guardandoEstado || !puedeEntregar} onClick={marcarComoEntregado} className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#6F4C69] px-4 text-sm font-bold text-white hover:bg-[#5D3F58] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"><PackageCheck size={17}/>{guardandoEstado ? 'Guardando...' : 'Marcar como entregado'}</button>}</div></div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

function MovimientoPago({ pago, anulando, puedeAnular, onAnular }: { pago: PagoEncargo; anulando: boolean; puedeAnular: boolean; onAnular: () => void }) {
  const fecha = fechaISOADate(pago.fecha_pago).toLocaleDateString('es-SV', { day: '2-digit', month: 'short', year: 'numeric' })
  const monto = Number(pago.monto ?? 0)

  return (
    <div className={`rounded-xl border p-3 ${pago.anulado ? 'border-[#E4E0E2] bg-[#F8F7F7] opacity-75' : 'border-[#EEDDE3] bg-[#FFFDFC]'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><p className={`font-bold ${pago.anulado ? 'text-[#8F858A] line-through' : 'text-[#5C3A4D]'}`}>${monto.toFixed(2)}</p>{pago.anulado && <span className="rounded-full bg-[#ECE8EA] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#756870]">Anulado</span>}</div>
          <p className="mt-1 text-xs text-[#756870]">{fecha} · {pago.metodo_pago || 'No especificado'}</p>
          {pago.nota && <p className="mt-1.5 text-xs leading-5 text-[#8D7A84]">{pago.nota}</p>}
          {pago.anulado && pago.motivo_anulacion && <p className="mt-1 text-xs text-[#9A8B93]">Motivo: {pago.motivo_anulacion}</p>}
        </div>
        {!pago.anulado && puedeAnular && <button type="button" disabled={anulando} onClick={onAnular} className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg border border-[#E4D7DC] px-2.5 text-xs font-semibold text-[#8A6877] hover:bg-[#FFF1F5] disabled:opacity-50"><Ban size={13}/>{anulando ? 'Anulando...' : 'Anular'}</button>}
      </div>
    </div>
  )
}

function Dato({ icono, etiqueta, valor }: { icono?: ReactNode; etiqueta: string; valor: string }) {
  return <div className="rounded-xl bg-[#FFF9F7] p-3"><div className="flex items-center gap-1.5 text-xs font-semibold text-[#9A8B93]">{icono}{etiqueta}</div><p className="mt-1.5 whitespace-pre-line text-sm font-bold text-[#5C3A4D]">{valor}</p></div>
}

function Texto({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return <div><p className="text-xs font-bold uppercase tracking-wide text-[#A18C96]">{etiqueta}</p><p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-[#5C3A4D]">{valor || 'No registrado'}</p></div>
}

function FilaPago({ etiqueta, valor, fuerte = false }: { etiqueta: string; valor: number; fuerte?: boolean }) {
  return <div className={`flex items-center justify-between gap-3 ${fuerte ? 'border-t border-[#F0E4E8] pt-3 font-bold' : ''}`}><dt className="text-[#756870]">{etiqueta}</dt><dd className="text-[#5C3A4D]">${valor.toFixed(2)}</dd></div>
}

export default DetallePedido
