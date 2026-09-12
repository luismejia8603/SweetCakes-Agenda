import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowLeft,
  CakeSlice,
  CheckCircle2,
  Clock3,
  ImageIcon,
  PackageCheck,
  Phone,
  WalletCards,
} from 'lucide-react'

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
  const [guardandoPago, setGuardandoPago] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let activo = true

    const cargar = async () => {
      setCargando(true)
      setError('')

      const { data, error: errorSupabase } = await supabase
        .from('encargos')
        .select(
          'id,nombre_cliente,telefono,fecha_entrega,hora_entrega,sabor_torta,sabor_relleno,chantilly,imagen_referencia,dedicatoria,observaciones,precio_cotizado,abono,estado_pedido,creado_por,created_at'
        )
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
    return () => {
      activo = false
    }
  }, [idPedido])

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

    setPedido({ ...pedido, estado_pedido: nuevoEstado })
  }

  const marcarComoPagado = async () => {
    if (!pedido) return

    const pagoActual = obtenerPago(pedido)

    if (pagoActual.saldo <= 0.005) return

    const confirmado = window.confirm(
      `¿Confirmas que el cliente pagó los $${pagoActual.saldo.toFixed(2)} pendientes?`
    )

    if (!confirmado) return

    setGuardandoPago(true)
    setError('')

    const { error: errorSupabase } = await supabase
      .from('encargos')
      .update({ abono: pagoActual.total })
      .eq('id', pedido.id)

    setGuardandoPago(false)

    if (errorSupabase) {
      console.error(errorSupabase)
      setError('No se pudo registrar el pago final.')
      return
    }

    setPedido({ ...pedido, abono: pagoActual.total })
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

    const confirmado = window.confirm(
      '¿Confirmas que el cliente ya retiró su pedido? Esta acción lo marcará como Entregado.'
    )

    if (!confirmado) return

    await cambiarEstado('Entregado')
  }

  if (cargando) {
    return (
      <main className="px-4 py-5 pb-28 sm:px-5 md:ml-20 md:p-6 lg:ml-64 lg:p-8 xl:p-10">
        <p className="text-[#756870]">Cargando pedido...</p>
      </main>
    )
  }

  if (!pedido) {
    return (
      <main className="px-4 py-5 pb-28 sm:px-5 md:ml-20 md:p-6 lg:ml-64 lg:p-8 xl:p-10">
        <button onClick={onVolver} className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E5D7DE] bg-white px-4 text-sm font-semibold text-[#5C3A4D]">
          <ArrowLeft size={17} /> Volver
        </button>
        <div className="rounded-xl bg-[#FFF0F5] p-4 text-[#D93470]">{error || 'Pedido no encontrado.'}</div>
      </main>
    )
  }

  const pago = obtenerPago(pedido)
  const pagoCompleto = pago.saldo <= 0.005
  const pedidoListo = pedido.estado_pedido === 'Listo'
  const pedidoEntregado = pedido.estado_pedido === 'Entregado'
  const pedidoCancelado = pedido.estado_pedido === 'Cancelado'
  const puedeEntregar = pagoCompleto && pedidoListo && !pedidoCancelado

  const fecha = fechaISOADate(pedido.fecha_entrega).toLocaleDateString('es-SV', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <main className="px-4 py-5 pb-28 sm:px-5 md:ml-20 md:p-6 lg:ml-64 lg:p-8 xl:p-10">
      <header className="mb-6 sm:mb-7">
        <button
          type="button"
          onClick={onVolver}
          className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E5D7DE] bg-white px-4 text-sm font-semibold text-[#5C3A4D] hover:bg-[#FBF1F4]"
        >
          <ArrowLeft size={17} /> Volver
        </button>

        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#B07A91] sm:text-sm sm:normal-case sm:tracking-normal sm:text-[#756870]">Detalle del pedido</p>
        <h2 className="mt-1 text-2xl font-bold text-[#5C3A4D] sm:text-3xl">{pedido.nombre_cliente}</h2>
        <p className="mt-1.5 capitalize text-sm text-[#756870]">{fecha} · {formatearHora(pedido.hora_entrega)}</p>
      </header>

      {error && (
        <div className="mb-5 rounded-xl bg-[#FFF0F5] px-4 py-3 text-sm font-semibold text-[#D93470]">{error}</div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr] xl:gap-6">
        <div className="space-y-5 sm:space-y-6">
          <section className="rounded-2xl border border-[#EEDDE3] bg-white p-4 sm:p-6">
            <h3 className="text-base font-bold text-[#5C3A4D] sm:text-lg">Información general</h3>
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:mt-5 sm:gap-3 lg:grid-cols-3">
              <Dato icono={<Clock3 size={16} />} etiqueta="Entrega" valor={`${fecha}\n${formatearHora(pedido.hora_entrega)}`} />
              <Dato icono={<Phone size={16} />} etiqueta="Teléfono" valor={pedido.telefono || 'No registrado'} />
              <Dato icono={<CakeSlice size={16} />} etiqueta="Torta" valor={pedido.sabor_torta} />
              <Dato etiqueta="Relleno" valor={pedido.sabor_relleno} />
              <Dato etiqueta="Chantilly" valor={pedido.chantilly} />
              <Dato etiqueta="Estado" valor={pedido.estado_pedido} />
            </div>

            {pedido.telefono && (
              <a
                href={`tel:${pedido.telefono}`}
                className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#E5D7DE] bg-[#FFFDFC] text-sm font-semibold text-[#5C3A4D] sm:hidden"
              >
                <Phone size={17} /> Llamar al cliente
              </a>
            )}
          </section>

          <section className="rounded-2xl border border-[#EEDDE3] bg-white p-4 sm:p-6">
            <div className="flex items-center gap-2">
              <ImageIcon size={19} className="text-[#EC3D7F]" />
              <h3 className="text-base font-bold text-[#5C3A4D] sm:text-lg">Imagen de referencia</h3>
            </div>
            {urlImagen ? (
              <a href={urlImagen} target="_blank" rel="noreferrer" className="mt-4 block overflow-hidden rounded-2xl border border-[#EEDDE3] bg-[#FFF9F7]">
                <img src={urlImagen} alt="Referencia del pedido" className="max-h-[520px] w-full object-contain" />
              </a>
            ) : (
              <div className="mt-4 flex min-h-36 items-center justify-center rounded-2xl border border-dashed border-[#DFC9D2] bg-[#FFFDFC] px-4 text-center text-sm text-[#9A8B93] sm:min-h-40">
                Este pedido no tiene imagen de referencia.
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-[#EEDDE3] bg-white p-4 sm:p-6">
            <h3 className="text-base font-bold text-[#5C3A4D] sm:text-lg">Indicaciones</h3>
            <div className="mt-4 space-y-4">
              <Texto etiqueta="Dedicatoria" valor={pedido.dedicatoria} />
              <Texto etiqueta="Observaciones" valor={pedido.observaciones} />
            </div>
          </section>
        </div>

        <div className="space-y-5 sm:space-y-6">
          <section className="rounded-2xl border border-[#EEDDE3] bg-white p-4 sm:p-6">
            <div className="flex items-center gap-2">
              <WalletCards size={19} className="text-[#EC3D7F]" />
              <h3 className="text-base font-bold text-[#5C3A4D] sm:text-lg">Pago</h3>
            </div>
            <div className={`mt-4 rounded-2xl p-4 ${pagoCompleto ? 'bg-[#F1F8F3] text-[#557260]' : 'bg-[#FFF2F6] text-[#D93470]'}`}>
              <p className="font-bold">{pagoCompleto ? 'Pagado' : pago.estado}</p>
              <p className="mt-1 text-sm">{pagoCompleto ? 'No hay saldo pendiente.' : `Falta cobrar $${pago.saldo.toFixed(2)}`}</p>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <FilaPago etiqueta="Precio total" valor={pago.total} />
              <FilaPago etiqueta="Abono" valor={pago.abono} />
              <FilaPago etiqueta="Saldo" valor={pago.saldo} fuerte />
            </dl>
          </section>

          <section className="rounded-2xl border border-[#EEDDE3] bg-white p-4 sm:p-6">
            <h3 className="text-base font-bold text-[#5C3A4D] sm:text-lg">Estado de preparación</h3>
            <p className="mt-1 text-xs text-[#756870] sm:text-sm">Primero prepara el pedido. La entrega final se registra en el apartado de abajo.</p>
            <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-1">
              {(['Pendiente', 'Listo', 'Cancelado'] as EstadoPedido[]).map((estado) => (
                <button
                  key={estado}
                  type="button"
                  disabled={guardandoEstado || pedidoEntregado}
                  onClick={() => cambiarEstado(estado)}
                  className={`min-h-12 rounded-xl border px-3 text-left text-sm font-semibold transition disabled:opacity-50 ${
                    pedido.estado_pedido === estado
                      ? estado === 'Pendiente'
                        ? 'border-[#EC3D7F] bg-[#FCE5ED] text-[#D93470]'
                        : estado === 'Listo'
                          ? 'border-[#BFA7B9] bg-[#F3EAF0] text-[#6F4C69]'
                          : 'border-[#D8D8D8] bg-[#F3F3F3] text-[#666]'
                      : 'border-[#E5D7DE] bg-white text-[#756870] hover:bg-[#FBF1F4]'
                  }`}
                >
                  {pedido.estado_pedido === estado && <CheckCircle2 size={16} className="mr-2 inline" />}
                  {estado}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[#E3D7DD] bg-gradient-to-b from-white to-[#FFF9FB] p-4 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FCE5ED] text-[#D93470]">
                <PackageCheck size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#5C3A4D] sm:text-lg">Entrega al cliente</h3>
                <p className="mt-1 text-xs leading-5 text-[#756870] sm:text-sm">
                  Cuando el cliente llegue, confirma el pago pendiente y después registra que ya retiró el pedido.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className={`rounded-2xl border p-4 ${pagoCompleto ? 'border-[#D6E5D8] bg-[#F4F9F5]' : 'border-[#F3D2DE] bg-[#FFF5F8]'}`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${pagoCompleto ? 'bg-[#DCEADF] text-[#557260]' : 'bg-[#FCE5ED] text-[#D93470]'}`}>
                    {pagoCompleto ? <CheckCircle2 size={16} /> : '1'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`font-bold ${pagoCompleto ? 'text-[#557260]' : 'text-[#5C3A4D]'}`}>
                      {pagoCompleto ? 'Pago confirmado' : 'Cobrar saldo pendiente'}
                    </p>
                    <p className="mt-1 text-sm text-[#756870]">
                      {pagoCompleto ? 'El pedido no tiene saldo por cobrar.' : `El cliente debe $${pago.saldo.toFixed(2)}.`}
                    </p>

                    {!pagoCompleto && !pedidoCancelado && !pedidoEntregado && (
                      <button
                        type="button"
                        disabled={guardandoPago}
                        onClick={marcarComoPagado}
                        className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#EC3D7F] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#D93470] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                      >
                        <WalletCards size={17} />
                        {guardandoPago ? 'Registrando pago...' : `Marcar como pagado · $${pago.saldo.toFixed(2)}`}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className={`rounded-2xl border p-4 ${pedidoEntregado ? 'border-[#D6E5D8] bg-[#F4F9F5]' : 'border-[#E5D7DE] bg-white'}`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${pedidoEntregado ? 'bg-[#DCEADF] text-[#557260]' : 'bg-[#F3EAF0] text-[#6F4C69]'}`}>
                    {pedidoEntregado ? <CheckCircle2 size={16} /> : '2'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`font-bold ${pedidoEntregado ? 'text-[#557260]' : 'text-[#5C3A4D]'}`}>
                      {pedidoEntregado ? 'Pedido entregado' : 'Confirmar retiro'}
                    </p>
                    <p className="mt-1 text-sm text-[#756870]">
                      {pedidoEntregado
                        ? 'El cliente ya retiró este pedido.'
                        : !pagoCompleto
                          ? 'Primero registra el pago pendiente para habilitar la entrega.'
                          : !pedidoListo
                            ? 'Primero marca el pedido como Listo para habilitar la entrega.'
                            : 'Pago completo y pedido listo. Ya puedes registrar la entrega.'}
                    </p>

                    {!pedidoEntregado && !pedidoCancelado && (
                      <button
                        type="button"
                        disabled={!puedeEntregar || guardandoEstado}
                        onClick={marcarComoEntregado}
                        className={`mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition sm:w-auto ${
                          puedeEntregar
                            ? 'bg-[#66795E] text-white shadow-sm hover:bg-[#566A50]'
                            : 'cursor-not-allowed bg-[#EEE9EC] text-[#A3939A]'
                        }`}
                      >
                        <PackageCheck size={17} />
                        {guardandoEstado ? 'Registrando entrega...' : 'Marcar como entregado'}
                      </button>
                    )}

                    {pedidoCancelado && (
                      <p className="mt-3 rounded-xl bg-[#F3F3F3] px-3 py-2 text-xs font-semibold text-[#777]">
                        Este pedido está cancelado y no puede marcarse como entregado.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

function Dato({ icono, etiqueta, valor }: { icono?: ReactNode; etiqueta: string; valor: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-[#FFF9F7] p-3 sm:p-4">
      <p className="flex items-center gap-1.5 text-[10px] font-medium text-[#9A8B93] sm:text-xs">{icono}{etiqueta}</p>
      <p className="mt-1 whitespace-pre-line break-words text-xs font-semibold leading-5 text-[#5C3A4D] sm:text-sm">{valor}</p>
    </div>
  )
}

function Texto({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-[#A18C96]">{etiqueta}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#5C3A4D]">{valor || 'Sin información.'}</p>
    </div>
  )
}

function FilaPago({ etiqueta, valor, fuerte = false }: { etiqueta: string; valor: number; fuerte?: boolean }) {
  return (
    <div className={`flex items-center justify-between border-b border-[#F0E4E8] pb-3 ${fuerte ? 'font-bold text-[#5C3A4D]' : 'text-[#756870]'}`}>
      <dt>{etiqueta}</dt>
      <dd>${valor.toFixed(2)}</dd>
    </div>
  )
}

export default DetallePedido
