import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { CalendarDays, Clock3, ImagePlus, Phone, UploadCloud, User, X } from 'lucide-react'

import { supabase } from '../lib/supabase'
import { sincronizarPedidoGoogleCalendar } from '../lib/googleCalendar'
import { eliminarImagenReferencia, subirImagenReferencia, validarImagen } from '../lib/imagenes'
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
  const [imagenReferencia, setImagenReferencia] = useState<File | null>(null)
  const [dedicatoria, setDedicatoria] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [precioCotizado, setPrecioCotizado] = useState('')
  const [abono, setAbono] = useState('')
  const [estadoPedido, setEstadoPedido] = useState('Pendiente')
  const [mensaje, setMensaje] = useState('')
  const [guardando, setGuardando] = useState(false)

  const hoy = fechaLocalAISO(new Date())
  const precio = Number(precioCotizado || 0)
  const abonoNumero = Number(abono || 0)
  const saldo = Math.max(precio - abonoNumero, 0)
  const preview = useMemo(() => imagenReferencia ? URL.createObjectURL(imagenReferencia) : '', [imagenReferencia])

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const limpiar = () => {
    setNombreCliente(''); setTelefono(''); setFechaEntrega(''); setHoraEntrega('')
    setSaborTorta(''); setSaborRelleno(''); setChantilly(''); setImagenReferencia(null)
    setDedicatoria(''); setObservaciones(''); setPrecioCotizado(''); setAbono(''); setEstadoPedido('Pendiente')
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
    if (imagenReferencia) return validarImagen(imagenReferencia)
    return ''
  }

  const guardarEncargo = async () => {
    const errorValidacion = validar()
    if (errorValidacion) { setMensaje(errorValidacion); return }

    setGuardando(true)
    setMensaje('')
    let rutaImagen: string | null = null

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Tu sesión terminó. Inicia sesión nuevamente.')

      if (imagenReferencia) rutaImagen = await subirImagenReferencia(imagenReferencia, user.id)

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
          imagen_referencia: rutaImagen,
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

      let mensajeGoogle = ''

      if (data?.id !== undefined) {
        try {
          const resultadoGoogle = await sincronizarPedidoGoogleCalendar(data.id)
          if (resultadoGoogle.synced) {
            mensajeGoogle = ' También se sincronizó con Google Calendar.'
          } else if (resultadoGoogle.reason === 'not_connected') {
            mensajeGoogle = ' Google Calendar todavía no está conectado.'
          }
        } catch (errorGoogle) {
          console.error('El pedido se guardó, pero Google Calendar no pudo sincronizarlo:', errorGoogle)
          mensajeGoogle = ' El pedido quedó guardado, pero Google Calendar necesita reintentar la sincronización.'
        }
      }

      limpiar()
      setMensaje(`✓ Encargo guardado correctamente.${mensajeGoogle}`)
      if (data?.id !== undefined) onGuardado?.(data.id)
    } catch (error) {
      if (rutaImagen) await eliminarImagenReferencia(rutaImagen)
      console.error(error)
      setMensaje(error instanceof Error ? error.message : 'No se pudo guardar el encargo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <main className="p-5 md:ml-64 md:p-8 lg:p-10">
      <header className="mb-8">
        <p className="text-sm text-[#756870]">Pedidos</p>
        <h2 className="mt-1 text-3xl font-bold text-[#5C3A4D]">Nuevo encargo</h2>
        <p className="mt-2 text-sm text-[#756870]">Registra el pedido completo, incluida una imagen de referencia si el cliente la envió.</p>
      </header>

      <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
        <section className="rounded-2xl border border-[#EEDDE3] bg-white p-5 sm:p-6">
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

        <section className="rounded-2xl border border-[#EEDDE3] bg-white p-5 sm:p-6">
          <h3 className="text-lg font-semibold text-[#5C3A4D]">Torta</h3>
          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <Selector etiqueta="Sabor de torta" value={saborTorta} onChange={setSaborTorta} opciones={['Vainilla','Marmoleado','Medianoche','Chocolate']} />
            <Selector etiqueta="Sabor de relleno" value={saborRelleno} onChange={setSaborRelleno} opciones={['Crema de almendras','Crema de marshmallow','Crema de coco','Crema de fresa','Crema de Nutella','Crema de café y chispas de chocolate','Crema de vainilla y chispas de chocolate','Crema pastelera','Caramelo']} />
            <Selector etiqueta="Chantilly" value={chantilly} onChange={setChantilly} opciones={['Blanco','Chocolate','Caramelo','Fresa']} />
          </div>
        </section>

        <section className="rounded-2xl border border-[#EEDDE3] bg-white p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#F6E6EB] p-2 text-[#EC3D7F]"><ImagePlus size={20} /></div>
            <div><h3 className="text-lg font-semibold text-[#5C3A4D]">Detalles e imagen</h3><p className="text-sm text-[#756870]">JPG, PNG o WEBP. Máximo 6 MB.</p></div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <label className="flex min-h-52 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-[#DFC9D2] bg-[#FFFDFC] p-4 text-center hover:bg-[#FFF7FA]">
                {preview ? (
                  <img src={preview} alt="Vista previa" className="max-h-64 w-full rounded-xl object-contain" />
                ) : (
                  <><UploadCloud size={34} className="text-[#C98AA4]" /><p className="mt-3 font-semibold text-[#5C3A4D]">Seleccionar imagen de referencia</p><p className="mt-1 text-xs text-[#9A8B93]">También puedes tomar una foto desde el teléfono.</p></>
                )}
                <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={(e) => {
                  const archivo = e.target.files?.[0] ?? null
                  if (archivo) {
                    const errorArchivo = validarImagen(archivo)
                    if (errorArchivo) { setMensaje(errorArchivo); e.currentTarget.value = ''; return }
                  }
                  setImagenReferencia(archivo)
                }} />
              </label>
              {imagenReferencia && <button type="button" onClick={() => setImagenReferencia(null)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#D93470]"><X size={14}/> Quitar imagen</button>}
            </div>

            <div className="space-y-4">
              <label className="block"><span className="mb-2 block text-sm font-medium text-[#5C3A4D]">Dedicatoria <span className="font-normal text-[#9A8B93]">(opcional)</span></span><input value={dedicatoria} onChange={(e) => setDedicatoria(e.target.value)} placeholder="Ej. Feliz cumpleaños Mario" className="input-sc pl-4" /></label>
              <label className="block"><span className="mb-2 block text-sm font-medium text-[#5C3A4D]">Observaciones <span className="font-normal text-[#9A8B93]">(opcional)</span></span><textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={5} placeholder="Decoración, colores, topper, indicaciones especiales..." className="input-sc resize-none pl-4" /></label>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#EEDDE3] bg-white p-5 sm:p-6">
          <h3 className="text-lg font-semibold text-[#5C3A4D]">Pago y estado</h3>
          <div className="mt-5 grid gap-5 md:grid-cols-4">
            <label><span className="mb-2 block text-sm font-medium">Precio cotizado</span><input type="number" min="0" step="0.01" value={precioCotizado} onChange={(e) => setPrecioCotizado(e.target.value)} className="input-sc pl-4" placeholder="0.00" /></label>
            <label><span className="mb-2 block text-sm font-medium">Abono</span><input type="number" min="0" max={precio || undefined} step="0.01" value={abono} onChange={(e) => setAbono(e.target.value)} className="input-sc pl-4" placeholder="0.00" /></label>
            <div><span className="mb-2 block text-sm font-medium">Saldo pendiente</span><div className="rounded-xl border border-[#DCE4D8] bg-[#F8FAF6] px-4 py-3 font-bold text-[#64745D]">${saldo.toFixed(2)}</div></div>
            <Selector etiqueta="Estado" value={estadoPedido} onChange={setEstadoPedido} opciones={['Pendiente','Listo','Entregado','Cancelado']} />
          </div>
        </section>

        {mensaje && <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${mensaje.startsWith('✓') ? 'bg-[#EEF3EB] text-[#557260]' : 'bg-[#FFF0F5] text-[#D93470]'}`}>{mensaje}</div>}

        <div className="flex justify-end pb-6">
          <button type="button" onClick={guardarEncargo} disabled={guardando} className="rounded-xl bg-[#EC3D7F] px-7 py-3.5 font-semibold text-white shadow-sm hover:bg-[#D93470] disabled:opacity-60">
            {guardando ? 'Guardando pedido e imagen...' : 'Guardar encargo'}
          </button>
        </div>
      </form>

      <style>{`.input-sc{width:100%;border:1px solid #E5D7DE;background:#FFFDFC;border-radius:.75rem;padding:.75rem 1rem .75rem 2.5rem;color:#5C3A4D;outline:none;transition:.15s}.input-sc:focus{border-color:#EC3D7F;box-shadow:0 0 0 3px rgba(236,61,127,.08)}`}</style>
    </main>
  )
}

function CampoIcono({ icono, etiqueta, children }: { icono: ReactNode; etiqueta: string; children: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-medium text-[#5C3A4D]">{etiqueta}</span><div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9A8B93]">{icono}</span>{children}</div></label>
}

function Selector({ etiqueta, value, onChange, opciones }: { etiqueta: string; value: string; onChange: (valor: string) => void; opciones: string[] }) {
  return <label className="block"><span className="mb-2 block text-sm font-medium text-[#5C3A4D]">{etiqueta}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-[#E5D7DE] bg-[#FFFDFC] px-4 py-3 text-[#5C3A4D] outline-none focus:border-[#EC3D7F]"><option value="">Seleccionar</option>{opciones.map((opcion) => <option key={opcion} value={opcion}>{opcion}</option>)}</select></label>
}

export default NuevoEncargo
