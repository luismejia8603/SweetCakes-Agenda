import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  ImagePlus,
  Phone,
  Save,
  Trash2,
  User,
} from 'lucide-react'

import SelectorImagenes from '../components/SelectorImagenes'
import {
  MAX_IMAGENES_POR_ENCARGO,
  actualizarImagenLegacy,
  cargarImagenesEncargo,
  eliminarRegistrosImagenes,
  insertarImagenesEncargo,
  type ImagenEncargo,
} from '../lib/encargoImagenes'
import {
  eliminarImagenesReferencia,
  obtenerUrlsImagenes,
  subirImagenesReferencia,
} from '../lib/imagenes'
import { supabase } from '../lib/supabase'
import type { Encargo } from '../types/encargo'

type EditarPedidoProps = {
  idPedido: string | number
  onVolver: () => void
  onGuardado: () => void
}

type ImagenExistente = ImagenEncargo & {
  url: string | null
  eliminar: boolean
}

function EditarPedido({ idPedido, onVolver, onGuardado }: EditarPedidoProps) {
  const [pedido, setPedido] = useState<Encargo | null>(null)
  const [imagenesExistentes, setImagenesExistentes] = useState<ImagenExistente[]>([])
  const [imagenesNuevas, setImagenesNuevas] = useState<File[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  const [nombreCliente, setNombreCliente] = useState('')
  const [telefono, setTelefono] = useState('')
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [horaEntrega, setHoraEntrega] = useState('')
  const [saborTorta, setSaborTorta] = useState('')
  const [saborRelleno, setSaborRelleno] = useState('')
  const [chantilly, setChantilly] = useState('')
  const [dedicatoria, setDedicatoria] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [precioCotizado, setPrecioCotizado] = useState('')
  const [abono, setAbono] = useState('')

  const precio = Number(precioCotizado || 0)
  const abonoNumero = Number(abono || 0)
  const saldo = Math.max(precio - abonoNumero, 0)
  const existentesActivas = useMemo(
    () => imagenesExistentes.filter((imagen) => !imagen.eliminar),
    [imagenesExistentes],
  )
  const espaciosDisponibles = Math.max(0, MAX_IMAGENES_POR_ENCARGO - existentesActivas.length)

  useEffect(() => {
    let activo = true

    const cargar = async () => {
      setCargando(true)
      setMensaje('')

      const { data, error } = await supabase
        .from('encargos')
        .select('id,nombre_cliente,telefono,fecha_entrega,hora_entrega,sabor_torta,sabor_relleno,chantilly,imagen_referencia,dedicatoria,observaciones,precio_cotizado,abono,estado_pedido,creado_por,created_at')
        .eq('id', idPedido)
        .single()

      if (!activo) return

      if (error) {
        console.error(error)
        setMensaje('No se pudo cargar el pedido para editarlo.')
        setCargando(false)
        return
      }

      const encargo = data as Encargo
      setPedido(encargo)
      setNombreCliente(encargo.nombre_cliente)
      setTelefono(encargo.telefono ?? '')
      setFechaEntrega(encargo.fecha_entrega)
      setHoraEntrega(encargo.hora_entrega)
      setSaborTorta(encargo.sabor_torta)
      setSaborRelleno(encargo.sabor_relleno)
      setChantilly(encargo.chantilly)
      setDedicatoria(encargo.dedicatoria ?? '')
      setObservaciones(encargo.observaciones ?? '')
      setPrecioCotizado(String(encargo.precio_cotizado ?? ''))
      setAbono(String(encargo.abono ?? ''))

      const registros = await cargarImagenesEncargo(encargo.id, encargo.imagen_referencia)
      const urls = await obtenerUrlsImagenes(registros.map((imagen) => imagen.ruta_storage))
      const mapaUrls = new Map(urls.map((item) => [item.ruta, item.url]))

      if (activo) {
        setImagenesExistentes(
          registros.map((imagen) => ({ ...imagen, url: mapaUrls.get(imagen.ruta_storage) ?? null, eliminar: false })),
        )
        setCargando(false)
      }
    }

    cargar()
    return () => { activo = false }
  }, [idPedido])

  const alternarEliminar = (id: string) => {
    setImagenesExistentes((actuales) =>
      actuales.map((imagen) => imagen.id === id ? { ...imagen, eliminar: !imagen.eliminar } : imagen),
    )
  }

  const validar = () => {
    if (!nombreCliente.trim()) return 'Ingresa el nombre del cliente.'
    if (!fechaEntrega) return 'Selecciona la fecha de entrega.'
    if (!horaEntrega) return 'Selecciona la hora de entrega.'
    if (!saborTorta) return 'Selecciona el sabor de la torta.'
    if (!saborRelleno) return 'Selecciona el sabor del relleno.'
    if (!chantilly) return 'Selecciona el chantilly.'
    if (precio <= 0) return 'El precio cotizado debe ser mayor que $0.'
    if (abonoNumero < 0) return 'El abono no puede ser negativo.'
    if (abonoNumero > precio) return 'El abono no puede ser mayor que el precio cotizado.'
    if (existentesActivas.length + imagenesNuevas.length > MAX_IMAGENES_POR_ENCARGO) {
      return `Puedes conservar como máximo ${MAX_IMAGENES_POR_ENCARGO} imágenes por pedido.`
    }
    return ''
  }

  const guardarCambios = async () => {
    if (!pedido) return

    const errorValidacion = validar()
    if (errorValidacion) {
      setMensaje(errorValidacion)
      return
    }

    setGuardando(true)
    setMensaje('')
    let rutasNuevas: string[] = []

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Tu sesión terminó. Inicia sesión nuevamente.')

      const { error: errorPedido } = await supabase
        .from('encargos')
        .update({
          nombre_cliente: nombreCliente.trim(),
          telefono: telefono.trim() || null,
          fecha_entrega: fechaEntrega,
          hora_entrega: horaEntrega,
          sabor_torta: saborTorta,
          sabor_relleno: saborRelleno,
          chantilly,
          dedicatoria: dedicatoria.trim() || null,
          observaciones: observaciones.trim() || null,
          precio_cotizado: precio,
          abono: abonoNumero,
        })
        .eq('id', pedido.id)

      if (errorPedido) throw errorPedido

      const aEliminar = imagenesExistentes.filter((imagen) => imagen.eliminar)

      if (aEliminar.length) {
        await eliminarImagenesReferencia(aEliminar.map((imagen) => imagen.ruta_storage))
        await eliminarRegistrosImagenes(aEliminar.map((imagen) => imagen.id))
      }

      if (imagenesNuevas.length) {
        rutasNuevas = await subirImagenesReferencia(imagenesNuevas, user.id)
        const ordenInicial = existentesActivas.reduce((maximo, imagen) => Math.max(maximo, imagen.orden), -1) + 1
        await insertarImagenesEncargo(pedido.id, rutasNuevas, user.id, ordenInicial)
      }

      await actualizarImagenLegacy(pedido.id)
      setMensaje('✓ Cambios guardados correctamente.')
      onGuardado()
    } catch (error) {
      if (rutasNuevas.length) {
        await eliminarImagenesReferencia(rutasNuevas).catch(() => undefined)
      }
      console.error(error)
      setMensaje(error instanceof Error ? error.message : 'No se pudieron guardar los cambios.')
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) {
    return <main className="px-4 py-5 pb-28 sm:px-5 md:ml-20 md:p-6 lg:ml-64 lg:p-8 xl:p-10"><p className="text-[#756870]">Cargando pedido...</p></main>
  }

  if (!pedido) {
    return (
      <main className="px-4 py-5 pb-28 sm:px-5 md:ml-20 md:p-6 lg:ml-64 lg:p-8 xl:p-10">
        <button onClick={onVolver} className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E5D7DE] bg-white px-4 text-sm font-semibold text-[#5C3A4D]"><ArrowLeft size={17}/> Volver</button>
        <div className="rounded-xl bg-[#FFF0F5] p-4 text-[#D93470]">{mensaje || 'Pedido no encontrado.'}</div>
      </main>
    )
  }

  return (
    <main className="px-4 py-5 pb-28 sm:px-5 md:ml-20 md:p-6 lg:ml-64 lg:p-8 xl:p-10">
      <header className="mb-6 sm:mb-8">
        <button type="button" onClick={onVolver} className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E5D7DE] bg-white px-4 text-sm font-semibold text-[#5C3A4D] hover:bg-[#FBF1F4]"><ArrowLeft size={17}/> Volver sin guardar</button>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#B07A91] sm:text-sm sm:normal-case sm:tracking-normal sm:text-[#756870]">Edición</p>
        <h2 className="mt-1 text-2xl font-bold text-[#5C3A4D] sm:text-3xl">Editar pedido</h2>
        <p className="mt-2 text-sm text-[#756870]">Corrige información y agrega o elimina imágenes de referencia.</p>
      </header>

      <form onSubmit={(evento) => evento.preventDefault()} className="space-y-6">
        <section className="rounded-2xl border border-[#EEDDE3] bg-white p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-[#5C3A4D]">Cliente y entrega</h3>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <CampoIcono icono={<User size={18}/>} etiqueta="Nombre del cliente"><input value={nombreCliente} onChange={(e) => setNombreCliente(e.target.value)} className="input-sc" /></CampoIcono>
            <CampoIcono icono={<Phone size={18}/>} etiqueta="Teléfono"><input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} className="input-sc" /></CampoIcono>
            <CampoIcono icono={<CalendarDays size={18}/>} etiqueta="Fecha de entrega"><input type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} className="input-sc" /></CampoIcono>
            <CampoIcono icono={<Clock3 size={18}/>} etiqueta="Hora de entrega"><input type="time" value={horaEntrega} onChange={(e) => setHoraEntrega(e.target.value)} className="input-sc" /></CampoIcono>
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
            <div className="rounded-xl bg-[#F6E6EB] p-2 text-[#EC3D7F]"><ImagePlus size={20}/></div>
            <div><h3 className="text-lg font-semibold text-[#5C3A4D]">Imágenes de referencia</h3><p className="text-sm text-[#756870]">Conserva, elimina o agrega referencias. Máximo 5 por pedido.</p></div>
          </div>

          {imagenesExistentes.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold text-[#5C3A4D]">Imágenes guardadas</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {imagenesExistentes.map((imagen, indice) => (
                  <div key={imagen.id} className={`relative overflow-hidden rounded-2xl border bg-[#FFF9F7] ${imagen.eliminar ? 'border-[#E6A8BC] opacity-60' : 'border-[#EEDDE3]'}`}>
                    <div className="aspect-square">
                      {imagen.url ? <img src={imagen.url} alt={`Referencia ${indice + 1}`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center p-3 text-center text-xs text-[#9A8B93]">No se pudo cargar la vista previa.</div>}
                    </div>
                    <button type="button" onClick={() => alternarEliminar(imagen.id)} className={`flex min-h-10 w-full items-center justify-center gap-1.5 border-t px-2 text-xs font-bold ${imagen.eliminar ? 'border-[#E6A8BC] bg-[#FFF1F5] text-[#557260]' : 'border-[#EEDDE3] bg-white text-[#D93470]'}`}>
                      <Trash2 size={14}/>{imagen.eliminar ? 'Conservar' : 'Eliminar'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 border-t border-[#F0E4E8] pt-5">
            <p className="mb-3 text-sm font-semibold text-[#5C3A4D]">Agregar imágenes nuevas</p>
            <SelectorImagenes archivos={imagenesNuevas} onChange={setImagenesNuevas} maximo={espaciosDisponibles} deshabilitado={guardando || espaciosDisponibles === 0} onError={setMensaje} />
            <p className="mt-2 text-center text-xs text-[#9A8B93]">Al guardar quedarán {existentesActivas.length + imagenesNuevas.length} de {MAX_IMAGENES_POR_ENCARGO} referencias.</p>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <label className="block"><span className="mb-2 block text-sm font-medium text-[#5C3A4D]">Dedicatoria</span><input value={dedicatoria} onChange={(e) => setDedicatoria(e.target.value)} className="input-sc pl-4" /></label>
            <label className="block"><span className="mb-2 block text-sm font-medium text-[#5C3A4D]">Observaciones</span><textarea rows={4} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className="input-sc resize-none pl-4" /></label>
          </div>
        </section>

        <section className="rounded-2xl border border-[#EEDDE3] bg-white p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-[#5C3A4D]">Precio y abono actual</h3>
          <p className="mt-1 text-xs text-[#9A8B93]">El historial detallado de pagos será el siguiente módulo. Por ahora puedes corregir el valor acumulado actual.</p>
          <div className="mt-5 grid gap-5 sm:grid-cols-3">
            <label><span className="mb-2 block text-sm font-medium">Precio cotizado</span><input type="number" min="0" step="0.01" value={precioCotizado} onChange={(e) => setPrecioCotizado(e.target.value)} className="input-sc pl-4" /></label>
            <label><span className="mb-2 block text-sm font-medium">Abono registrado</span><input type="number" min="0" max={precio || undefined} step="0.01" value={abono} onChange={(e) => setAbono(e.target.value)} className="input-sc pl-4" /></label>
            <div><span className="mb-2 block text-sm font-medium">Saldo</span><div className="min-h-12 rounded-xl border border-[#DCE4D8] bg-[#F8FAF6] px-4 py-3 font-bold text-[#64745D]">${saldo.toFixed(2)}</div></div>
          </div>
        </section>

        {mensaje && <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${mensaje.startsWith('✓') ? 'bg-[#EEF3EB] text-[#557260]' : 'bg-[#FFF0F5] text-[#D93470]'}`}>{mensaje}</div>}

        <div className="sticky bottom-[84px] z-30 -mx-4 flex justify-end border-t border-[#EEDDE3] bg-[#FFF9F7]/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0 md:pb-6">
          <button type="button" onClick={guardarCambios} disabled={guardando} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#EC3D7F] px-7 py-3.5 font-semibold text-white shadow-[0_10px_24px_rgba(236,61,127,0.2)] hover:bg-[#D93470] disabled:opacity-60 md:w-auto"><Save size={18}/>{guardando ? 'Guardando cambios...' : 'Guardar cambios'}</button>
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

export default EditarPedido
