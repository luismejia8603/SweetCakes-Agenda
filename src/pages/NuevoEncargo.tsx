import { useState } from 'react'
import type { ReactNode } from 'react'
import { CalendarDays, Clock3, ImagePlus, Phone, User } from 'lucide-react'

import SelectorImagenes from '../components/SelectorImagenes'
import { insertarImagenesEncargo } from '../lib/encargoImagenes'
import { eliminarImagenesReferencia, subirImagenesReferencia, validarImagen } from '../lib/imagenes'
import { supabase } from '../lib/supabase'
import { fechaLocalAISO } from '../types/encargo'

type NuevoEncargoProps = {
  onGuardado?: (id: string | number) => void
}

function NuevoEncargo({ onGuardado }: NuevoEncargoProps) {
  const [nombreCliente, setNombreCliente] = useState('')
  const [telefono, setTelefono] = useState('')
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [horaEntrega, setHoraEntrega] = useState('')
  const [saborTorta, setSaborTorta] = useState('')
  const [saborRelleno, setSaborRelleno] = useState('')
  const [chantilly, setChantilly] = useState('')
  const [imagenesReferencia, setImagenesReferencia] = useState<File[]>([])
  const [dedicatoria, setDedicatoria] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [precioCotizado, setPrecioCotizado] = useState('')
  const [abono, setAbono] = useState('')
  const [metodoAbono, setMetodoAbono] = useState('Efectivo')
  const [estadoPedido, setEstadoPedido] = useState('Pendiente')
  const [mensaje, setMensaje] = useState('')
  const [guardando, setGuardando] = useState(false)

  const hoy = fechaLocalAISO(new Date())
  const precio = Number(precioCotizado || 0)
  const abonoNumero = Number(abono || 0)
  const saldo = Math.max(precio - abonoNumero, 0)

  const limpiar = () => {
    setNombreCliente('')
    setTelefono('')
    setFechaEntrega('')
    setHoraEntrega('')
    setSaborTorta('')
    setSaborRelleno('')
    setChantilly('')
    setImagenesReferencia([])
    setDedicatoria('')
    setObservaciones('')
    setPrecioCotizado('')
    setAbono('')
    setMetodoAbono('Efectivo')
    setEstadoPedido('Pendiente')
  }

  const validar = () => {
    if (!nombreCliente.trim()) return 'Ingresa el nombre del cliente.'
    if (!fechaEntrega) return 'Selecciona la fecha de entrega.'
    if (fechaEntrega < hoy) return 'La fecha de entrega no puede estar en el pasado.'
    if (!horaEntrega) return 'Selecciona la hora de entrega.'
    if (!saborTorta) return 'Selecciona el sabor de la torta.'
    if (!saborRelleno) return 'Selecciona el sabor del relleno.'
    if (!chantilly) return 'Selecciona el chantilly.'
    if (precio <= 0) return 'El precio cotizado debe ser mayor que $0.'
    if (abonoNumero > precio) return 'El abono no puede ser mayor que el precio cotizado.'
    if (imagenesReferencia.length > 5) return 'Puedes agregar como máximo 5 imágenes por pedido.'

    for (const imagen of imagenesReferencia) {
      const errorImagen = validarImagen(imagen)
      if (errorImagen) return `${imagen.name}: ${errorImagen}`
    }

    return ''
  }

  const guardarEncargo = async () => {
    const errorValidacion = validar()
    if (errorValidacion) {
      setMensaje(errorValidacion)
      return
    }

    setGuardando(true)
    setMensaje('')
    let rutasSubidas: string[] = []

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Tu sesión terminó. Inicia sesión nuevamente.')

      if (imagenesReferencia.length) {
        rutasSubidas = await subirImagenesReferencia(imagenesReferencia, user.id)
      }

      const { data, error } = await supabase
        .from('encargos')
        .insert({
          nombre_cliente: nombreCliente.trim(),
          telefono: telefono.trim() || null,
          fecha_entrega: fechaEntrega,
          hora_entrega: horaEntrega,
          sabor_torta: saborTorta,
          sabor_relleno: saborRelleno,
          chantilly,
          imagen_referencia: rutasSubidas[0] ?? null,
          dedicatoria: dedicatoria.trim() || null,
          observaciones: observaciones.trim() || null,
          precio_cotizado: precio,
          abono: abonoNumero,
          estado_pedido: estadoPedido,
          creado_por: user.id,
        })
        .select('id')
        .single()

      if (error) throw error

      if (abonoNumero > 0) {
        const { error: errorMetodoPago } = await supabase
          .from('encargo_pagos')
          .update({ metodo_pago: metodoAbono })
          .eq('encargo_id', data.id)
          .eq('nota', 'Abono inicial')

        if (errorMetodoPago) {
          console.warn('El abono se registró, pero no se pudo guardar su método de pago:', errorMetodoPago)
        }
      }

      if (rutasSubidas.length) {
        try {
          await insertarImagenesEncargo(data.id, rutasSubidas, user.id)
        } catch (errorImagenes) {
          console.error('El pedido se guardó, pero falló el registro de imágenes:', errorImagenes)
          // Conservamos la primera ruta en imagen_referencia para compatibilidad y retiramos
          // las demás para no dejar archivos huérfanos.
          if (rutasSubidas.length > 1) {
            await eliminarImagenesReferencia(rutasSubidas.slice(1)).catch(() => undefined)
          }
          rutasSubidas = rutasSubidas.slice(0, 1)
        }
      }

      limpiar()
      setMensaje('✓ Encargo guardado correctamente.')
      onGuardado?.(data.id)
    } catch (error) {
      if (rutasSubidas.length) {
        await eliminarImagenesReferencia(rutasSubidas).catch(() => undefined)
      }
      console.error(error)
      setMensaje(error instanceof Error ? error.message : 'No se pudo guardar el encargo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <main className="px-4 py-5 pb-28 sm:px-5 md:ml-20 md:p-6 lg:ml-64 lg:p-8 xl:p-10">
      <header className="mb-6 sm:mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#B07A91] sm:text-sm sm:normal-case sm:tracking-normal sm:text-[#756870]">Pedidos</p>
        <h2 className="mt-1 text-2xl font-bold text-[#5C3A4D] sm:text-3xl">Nuevo encargo</h2>
        <p className="mt-2 text-sm text-[#756870]">Registra el pedido y agrega hasta 5 imágenes de referencia.</p>
      </header>

      <form onSubmit={(evento) => evento.preventDefault()} className="space-y-6">
        <section className="rounded-2xl border border-[#EEDDE3] bg-white p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-[#5C3A4D]">Cliente y entrega</h3>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <CampoIcono icono={<User size={18} />} etiqueta="Nombre del cliente">
              <input value={nombreCliente} onChange={(e) => setNombreCliente(e.target.value)} placeholder="Ej. Ana Martínez" className="input-sc" />
            </CampoIcono>
            <CampoIcono icono={<Phone size={18} />} etiqueta="Teléfono">
              <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Ej. 7000-0000" className="input-sc" />
            </CampoIcono>
            <CampoIcono icono={<CalendarDays size={18} />} etiqueta="Fecha de entrega">
              <input type="date" min={hoy} value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} className="input-sc" />
            </CampoIcono>
            <CampoIcono icono={<Clock3 size={18} />} etiqueta="Hora de entrega">
              <input type="time" value={horaEntrega} onChange={(e) => setHoraEntrega(e.target.value)} className="input-sc" />
            </CampoIcono>
          </div>
        </section>

        <section className="rounded-2xl border border-[#EEDDE3] bg-white p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-[#5C3A4D]">Torta</h3>
          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <Selector etiqueta="Sabor de torta" value={saborTorta} onChange={setSaborTorta} opciones={['Vainilla','Marmoleado','Medianoche','Chocolate']} />
            <Selector etiqueta="Sabor de relleno" value={saborRelleno} onChange={setSaborRelleno} opciones={['Crema de almendras','Crema de marshmallow','Crema de coco','Crema de fresa','Crema de Nutella','Crema de café y chispas de chocolate','Crema de vainilla y chispas de chocolate','Crema pastelera','Caramelo']} />
            <Selector etiqueta="Chantilly" value={chantilly} onChange={setChantilly} opciones={['Blanco','Chocolate','Caramelo','Fresa']} />
          </div>
        </section>

        <section className="rounded-2xl border border-[#EEDDE3] bg-white p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#F6E6EB] p-2 text-[#EC3D7F]"><ImagePlus size={20} /></div>
            <div>
              <h3 className="text-lg font-semibold text-[#5C3A4D]">Detalles e imágenes</h3>
              <p className="text-sm text-[#756870]">Puedes guardar hasta 5 referencias. Cada una se optimiza antes de subirla.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <SelectorImagenes
              archivos={imagenesReferencia}
              onChange={setImagenesReferencia}
              maximo={5}
              deshabilitado={guardando}
              onError={setMensaje}
            />

            <div className="space-y-4">
              <label className="block"><span className="mb-2 block text-sm font-medium text-[#5C3A4D]">Dedicatoria <span className="font-normal text-[#9A8B93]">(opcional)</span></span><input value={dedicatoria} onChange={(e) => setDedicatoria(e.target.value)} placeholder="Ej. Feliz cumpleaños Mario" className="input-sc pl-4" /></label>
              <label className="block"><span className="mb-2 block text-sm font-medium text-[#5C3A4D]">Observaciones <span className="font-normal text-[#9A8B93]">(opcional)</span></span><textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={5} placeholder="Decoración, colores, topper, indicaciones especiales..." className="input-sc resize-none pl-4" /></label>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#EEDDE3] bg-white p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-[#5C3A4D]">Pago y estado</h3>
          <p className="mt-1 text-xs text-[#9A8B93]">Si el cliente deja dinero al crear el pedido, se guardará como el primer movimiento del historial de pagos.</p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
            <label><span className="mb-2 block text-sm font-medium">Precio cotizado</span><input type="number" min="0" step="0.01" value={precioCotizado} onChange={(e) => setPrecioCotizado(e.target.value)} className="input-sc pl-4" placeholder="0.00" /></label>
            <label><span className="mb-2 block text-sm font-medium">Abono inicial</span><input type="number" min="0" max={precio || undefined} step="0.01" value={abono} onChange={(e) => setAbono(e.target.value)} className="input-sc pl-4" placeholder="0.00" /></label>
            <Selector etiqueta="Método del abono" value={metodoAbono} onChange={setMetodoAbono} opciones={['Efectivo','Transferencia','Tarjeta','Otro']} />
            <div><span className="mb-2 block text-sm font-medium">Saldo pendiente</span><div className="rounded-xl border border-[#DCE4D8] bg-[#F8FAF6] px-4 py-3 font-bold text-[#64745D]">${saldo.toFixed(2)}</div></div>
            <Selector etiqueta="Estado" value={estadoPedido} onChange={setEstadoPedido} opciones={['Pendiente','Listo','Entregado','Cancelado']} />
          </div>
        </section>

        {mensaje && <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${mensaje.startsWith('✓') ? 'bg-[#EEF3EB] text-[#557260]' : 'bg-[#FFF0F5] text-[#D93470]'}`}>{mensaje}</div>}

        <div className="sticky bottom-[84px] z-30 -mx-4 flex justify-end border-t border-[#EEDDE3] bg-[#FFF9F7]/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0 md:pb-6">
          <button type="button" onClick={guardarEncargo} disabled={guardando} className="min-h-12 w-full rounded-xl bg-[#EC3D7F] px-7 py-3.5 font-semibold text-white shadow-[0_10px_24px_rgba(236,61,127,0.2)] hover:bg-[#D93470] disabled:opacity-60 md:w-auto">
            {guardando ? `Guardando${imagenesReferencia.length ? ' e imágenes' : ''}...` : 'Guardar encargo'}
          </button>
        </div>
      </form>

      <style>{`.input-sc{width:100%;border:1px solid #E5D7DE;background:#FFFDFC;border-radius:.75rem;min-height:48px;padding:.75rem 1rem .75rem 2.5rem;color:#5C3A4D;outline:none;transition:.15s}.input-sc:focus{border-color:#EC3D7F;box-shadow:0 0 0 3px rgba(236,61,127,.08)}`}</style>
    </main>
  )
}

function CampoIcono({ icono, etiqueta, children }: { icono: ReactNode; etiqueta: string; children: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-medium text-[#5C3A4D]">{etiqueta}</span><div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9A8B93]">{icono}</span>{children}</div></label>
}

function Selector({ etiqueta, value, onChange, opciones }: { etiqueta: string; value: string; onChange: (valor: string) => void; opciones: string[] }) {
  return <label className="block"><span className="mb-2 block text-sm font-medium text-[#5C3A4D]">{etiqueta}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="min-h-12 w-full rounded-xl border border-[#E5D7DE] bg-[#FFFDFC] px-4 py-3 text-base text-[#5C3A4D] outline-none focus:border-[#EC3D7F] sm:text-sm"><option value="">Seleccionar</option>{opciones.map((opcion) => <option key={opcion} value={opcion}>{opcion}</option>)}</select></label>
}

export default NuevoEncargo
