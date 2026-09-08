import { useState } from 'react'
import {
  CalendarDays,
  Clock3,
  Phone,
  User,
} from 'lucide-react'

import { supabase } from '../lib/supabase'

function NuevoEncargo() {
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
  const [mensajeFormulario, setMensajeFormulario] = useState('')

  const [listoParaGuardar, setListoParaGuardar] = useState(false)
  const [guardandoEncargo, setGuardandoEncargo] = useState(false)

  const precioNumerico = Number(precioCotizado || 0)
  const abonoNumerico = Number(abono || 0)

    const saldoPendiente = Math.max(
    precioNumerico - abonoNumerico,
    0
    )

    const estadoPago =
    precioNumerico > 0 && saldoPendiente === 0
    ? 'Pagado completamente'
    : abonoNumerico > 0
      ? 'Parcial'
      : 'Pendiente'

        const montoValido = (valor: string) => {
    return /^\d*(\.\d{0,2})?$/.test(valor)
    }

    const ahora = new Date()

    const hoy = `${ahora.getFullYear()}-${String(
    ahora.getMonth() + 1
    ).padStart(2, '0')}-${String(
    ahora.getDate()
    ).padStart(2, '0')}`

    const revisarEncargo = () => {
  setMensajeFormulario('')
  setListoParaGuardar(false)

  

  if (nombreCliente.trim() === '') {
    setMensajeFormulario('Ingresa el nombre del cliente.')
    return
  }

  if (fechaEntrega === '') {
    setMensajeFormulario('Selecciona la fecha de entrega.')
    return
  }

  if (fechaEntrega < hoy) {
    setMensajeFormulario('La fecha de entrega no puede estar en el pasado.')
    return
  }

  if (horaEntrega === '') {
    setMensajeFormulario('Selecciona la hora de entrega.')
    return
  }

  if (fechaEntrega === hoy) {
    const [hora, minutos] = horaEntrega.split(':').map(Number)

    const fechaHoraEntrega = new Date()
    fechaHoraEntrega.setHours(hora, minutos, 0, 0)

    if (fechaHoraEntrega < new Date()) {
      setMensajeFormulario(
        'La hora de entrega no puede estar en el pasado.'
      )
      return
    }
  }

  if (saborTorta === '') {
    setMensajeFormulario('Selecciona el sabor de la torta.')
    return
  }

  if (saborRelleno === '') {
    setMensajeFormulario('Selecciona el sabor del relleno.')
    return
  }

  if (chantilly === '') {
    setMensajeFormulario('Selecciona el tipo de chantilly.')
    return
  }

  if (precioNumerico <= 0) {
    setMensajeFormulario('El precio cotizado debe ser mayor que $0.')
    return
  }

setMensajeFormulario(
  '✓ El encargo está completo y listo para guardar.'
)

setListoParaGuardar(true)
}

const guardarEncargo = async () => {
  setMensajeFormulario('')

  if (nombreCliente.trim() === '') {
    setMensajeFormulario('Ingresa el nombre del cliente.')
    setListoParaGuardar(false)
    return
  }

  if (fechaEntrega === '') {
    setMensajeFormulario('Selecciona la fecha de entrega.')
    setListoParaGuardar(false)
    return
  }

  if (fechaEntrega < hoy) {
    setMensajeFormulario(
      'La fecha de entrega no puede estar en el pasado.'
    )
    setListoParaGuardar(false)
    return
  }

  if (horaEntrega === '') {
    setMensajeFormulario('Selecciona la hora de entrega.')
    setListoParaGuardar(false)
    return
  }

  if (fechaEntrega === hoy) {
    const [hora, minutos] = horaEntrega.split(':').map(Number)

    const fechaHoraEntrega = new Date()
    fechaHoraEntrega.setHours(hora, minutos, 0, 0)

    if (fechaHoraEntrega < new Date()) {
      setMensajeFormulario(
        'La hora de entrega no puede estar en el pasado.'
      )
      setListoParaGuardar(false)
      return
    }
  }

  if (saborTorta === '') {
    setMensajeFormulario('Selecciona el sabor de la torta.')
    setListoParaGuardar(false)
    return
  }

  if (saborRelleno === '') {
    setMensajeFormulario('Selecciona el sabor del relleno.')
    setListoParaGuardar(false)
    return
  }

  if (chantilly === '') {
    setMensajeFormulario('Selecciona el tipo de chantilly.')
    setListoParaGuardar(false)
    return
  }

  if (precioNumerico <= 0) {
    setMensajeFormulario(
      'El precio cotizado debe ser mayor que $0.'
    )
    setListoParaGuardar(false)
    return
  }

  if (imagenReferencia) {
    setMensajeFormulario(
      'La imagen todavía no puede guardarse. Primero configuraremos el almacenamiento de imágenes.'
    )
    return
  }

  setGuardandoEncargo(true)

  const { error } = await supabase
    .from('encargos')
    .insert({
      nombre_cliente: nombreCliente.trim(),
      telefono: telefono.trim() || null,
      fecha_entrega: fechaEntrega,
      hora_entrega: horaEntrega,
      sabor_torta: saborTorta,
      sabor_relleno: saborRelleno,
      chantilly,
      imagen_referencia: null,
      dedicatoria: dedicatoria.trim() || null,
      observaciones: observaciones.trim() || null,
      precio_cotizado: precioNumerico,
      abono: abonoNumerico,
      estado_pedido: estadoPedido,
    })

  setGuardandoEncargo(false)

  if (error) {
    console.error('Error al guardar el encargo:', error)

    setMensajeFormulario(
      'No se pudo guardar el encargo. Intenta nuevamente.'
    )

    return
  }

  setNombreCliente('')
  setTelefono('')
  setFechaEntrega('')
  setHoraEntrega('')

  setSaborTorta('')
  setSaborRelleno('')
  setChantilly('')

  setImagenReferencia(null)
  setDedicatoria('')
  setObservaciones('')

  setPrecioCotizado('')
  setAbono('')
  setEstadoPedido('Pendiente')

  setListoParaGuardar(false)

  setMensajeFormulario(
    '✓ Encargo guardado correctamente.'
  )
}

  return (
    <main className="p-5 md:ml-64 md:p-8 lg:p-10">

      {/* Encabezado */}
      <header className="mb-10">
        <p className="text-sm text-[#756870]">
          Pedidos
        </p>

        <h2 className="mt-1 text-3xl font-bold text-[#5C3A4D]">
          Nuevo encargo
        </h2>

        <p className="mt-2 text-sm text-[#756870]">
          Registra un nuevo pedido de Sweet Cakes.
        </p>
      </header>

      <form
        onSubmit={(evento) => evento.preventDefault()}
        className="space-y-6"
      >

        {/* Información del cliente */}
        <section className="rounded-2xl border border-[#EEDDE3] bg-white p-6">

          <div className="mb-6">
            <h3 className="text-xl font-semibold text-[#5C3A4D]">
              Información del cliente
            </h3>

            <p className="mt-1 text-sm text-[#756870]">
              Datos de contacto de la persona que realiza el pedido.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">

            {/* Nombre */}
            <div>
              <label
                htmlFor="nombreCliente"
                className="mb-2 block text-sm font-medium text-[#5C3A4D]"
              >
                Nombre del cliente
              </label>

              <div className="relative">
                <User
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A8B93]"
                />

                <input
                  id="nombreCliente"
                  type="text"
                  value={nombreCliente}
                  onChange={(evento) =>
                    setNombreCliente(evento.target.value)
                  }
                  placeholder="Ej. Ana Martínez"
                  className="w-full rounded-xl border border-[#E5D7DE] bg-[#FFFDFC] py-3 pl-10 pr-4 text-[#5C3A4D] outline-none transition placeholder:text-[#B7AAB0] focus:border-[#EC3D7F]"
                />
              </div>
            </div>

            {/* Teléfono */}
            <div>
              <label
                htmlFor="telefono"
                className="mb-2 block text-sm font-medium text-[#5C3A4D]"
              >
                Teléfono
              </label>

              <div className="relative">
                <Phone
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A8B93]"
                />

                <input
                  id="telefono"
                  type="tel"
                  value={telefono}
                  onChange={(evento) =>
                    setTelefono(evento.target.value)
                  }
                  placeholder="Ej. 7000-0000"
                  className="w-full rounded-xl border border-[#E5D7DE] bg-[#FFFDFC] py-3 pl-10 pr-4 text-[#5C3A4D] outline-none transition placeholder:text-[#B7AAB0] focus:border-[#EC3D7F]"
                />
              </div>
            </div>

          </div>
        </section>

        {/* Información de entrega */}
        <section className="rounded-2xl border border-[#EEDDE3] bg-white p-6">

          <div className="mb-6">
            <h3 className="text-xl font-semibold text-[#5C3A4D]">
              Entrega
            </h3>

            <p className="mt-1 text-sm text-[#756870]">
              Fecha y hora en que debe entregarse el pedido.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">

            {/* Fecha */}
            <div>
              <label
                htmlFor="fechaEntrega"
                className="mb-2 block text-sm font-medium text-[#5C3A4D]"
              >
                Fecha de entrega
              </label>

              <div className="relative">
                <CalendarDays
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9A8B93]"
                />

                <input
                  id="fechaEntrega"
                  type="date"
                  min={hoy}
                  value={fechaEntrega}
                  onChange={(evento) =>
                    setFechaEntrega(evento.target.value)
                  }
                  className="w-full rounded-xl border border-[#E5D7DE] bg-[#FFFDFC] py-3 pl-10 pr-4 text-[#5C3A4D] outline-none transition focus:border-[#EC3D7F]"
                />
              </div>
            </div>

            {/* Hora */}
            <div>
              <label
                htmlFor="horaEntrega"
                className="mb-2 block text-sm font-medium text-[#5C3A4D]"
              >
                Hora de entrega
              </label>

              <div className="relative">
                <Clock3
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9A8B93]"
                />

                <input
                  id="horaEntrega"
                  type="time"
                  value={horaEntrega}
                  onChange={(evento) =>
                    setHoraEntrega(evento.target.value)
                  }
                  className="w-full rounded-xl border border-[#E5D7DE] bg-[#FFFDFC] py-3 pl-10 pr-4 text-[#5C3A4D] outline-none transition focus:border-[#EC3D7F]"
                />
              </div>
            </div>

          </div>
        </section>

        {/* Información de la torta */}
        <section className="rounded-2xl border border-[#EEDDE3] bg-white p-6">

          <div className="mb-6">
            <h3 className="text-xl font-semibold text-[#5C3A4D]">
              Torta
            </h3>

            <p className="mt-1 text-sm text-[#756870]">
              Selecciona los sabores y el tipo de chantilly del pedido.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">

            {/* Sabor de torta */}
            <div>
              <label
                htmlFor="saborTorta"
                className="mb-2 block text-sm font-medium text-[#5C3A4D]"
              >
                Sabor de torta
              </label>

              <select
                id="saborTorta"
                value={saborTorta}
                onChange={(evento) =>
                  setSaborTorta(evento.target.value)
                }
                className="w-full rounded-xl border border-[#E5D7DE] bg-[#FFFDFC] px-4 py-3 text-[#5C3A4D] outline-none transition focus:border-[#EC3D7F]"
              >
                <option value="">Seleccionar sabor</option>
                <option value="Vainilla">Vainilla</option>
                <option value="Marmoleado">Marmoleado</option>
                <option value="Medianoche">Medianoche</option>
                <option value="Chocolate">Chocolate</option>
              </select>
            </div>

            {/* Sabor de relleno */}
            <div>
              <label
                htmlFor="saborRelleno"
                className="mb-2 block text-sm font-medium text-[#5C3A4D]"
              >
                Sabor de relleno
              </label>

              <select
                id="saborRelleno"
                value={saborRelleno}
                onChange={(evento) =>
                  setSaborRelleno(evento.target.value)
                }
                className="w-full rounded-xl border border-[#E5D7DE] bg-[#FFFDFC] px-4 py-3 text-[#5C3A4D] outline-none transition focus:border-[#EC3D7F]"
              >
                <option value="">Seleccionar relleno</option>
                <option value="Crema de almendras">Crema de almendras</option>
                <option value="Crema de marshmallow">Crema de marshmallow</option>
                <option value="Crema de coco">Crema de coco</option>
                <option value="Crema de fresa">Crema de fresa</option>
                <option value="Crema de Nutella">Crema de Nutella</option>
                <option value="Crema de café y chispas de chocolate">
                  Crema de café y chispas de chocolate
                </option>
                <option value="Crema de vainilla y chispas de chocolate">
                  Crema de vainilla y chispas de chocolate
                </option>
                <option value="Crema pastelera">
                 Crema pastelera
                </option>
                <option value="Caramelo">
                 Caramelo
                </option>
              </select>
            </div>

            {/* Chantilly */}
            <div>
              <label
                htmlFor="chantilly"
                className="mb-2 block text-sm font-medium text-[#5C3A4D]"
              >
                Chantilly
              </label>

              <select
                id="chantilly"
                value={chantilly}
                onChange={(evento) =>
                  setChantilly(evento.target.value)
                }
                className="w-full rounded-xl border border-[#E5D7DE] bg-[#FFFDFC] px-4 py-3 text-[#5C3A4D] outline-none transition focus:border-[#EC3D7F]"
              >
                <option value="">Seleccionar chantilly</option>
                <option value="Blanco">Blanco</option>
                <option value="Chocolate">Chocolate</option>
                <option value="Caramelo">Caramelo</option>
                <option value="Fresa">Fresa</option>
              </select>
            </div>

          </div>
        </section>
                {/* Detalles del pedido */}
<section className="rounded-2xl border border-[#EEDDE3] bg-white p-6">

  <div className="mb-6">
    <h3 className="text-xl font-semibold text-[#5C3A4D]">
      Detalles del pedido
    </h3>

    <p className="mt-1 text-sm text-[#756870]">
      Agrega la referencia, dedicatoria y cualquier indicación especial.
    </p>
  </div>

  <div className="space-y-5">

    {/* Imagen de referencia */}
    <div>
      <label
        htmlFor="imagenReferencia"
        className="mb-2 block text-sm font-medium text-[#5C3A4D]"
      >
        Imagen de referencia
        <span className="ml-1 font-normal text-[#9A8B93]">
          (opcional)
        </span>
      </label>

      <input
        id="imagenReferencia"
        type="file"
        accept="image/*"
        onChange={(evento) => {
          const archivo = evento.target.files?.[0] || null
          setImagenReferencia(archivo)
        }}
        className="w-full rounded-xl border border-[#E5D7DE] bg-[#FFFDFC] px-4 py-3 text-[#756870] file:mr-4 file:rounded-lg file:border-0 file:bg-[#F6E6EB] file:px-4 file:py-2 file:font-medium file:text-[#5C3A4D]"
      />

      {imagenReferencia && (
        <p className="mt-2 text-sm text-[#756870]">
          Archivo seleccionado: {imagenReferencia.name}
        </p>
      )}
    </div>

    {/* Dedicatoria */}
    <div>
      <label
        htmlFor="dedicatoria"
        className="mb-2 block text-sm font-medium text-[#5C3A4D]"
      >
        Dedicatoria
        <span className="ml-1 font-normal text-[#9A8B93]">
          (opcional)
        </span>
      </label>

      <input
        id="dedicatoria"
        type="text"
        value={dedicatoria}
        onChange={(evento) =>
          setDedicatoria(evento.target.value)
        }
        placeholder="Ej. Feliz cumpleaños Mario"
        className="w-full rounded-xl border border-[#E5D7DE] bg-[#FFFDFC] px-4 py-3 text-[#5C3A4D] outline-none transition placeholder:text-[#B7AAB0] focus:border-[#EC3D7F]"
      />
    </div>

    {/* Observaciones */}
    <div>
      <label
        htmlFor="observaciones"
        className="mb-2 block text-sm font-medium text-[#5C3A4D]"
      >
        Observaciones
        <span className="ml-1 font-normal text-[#9A8B93]">
          (opcional)
        </span>
      </label>

      <textarea
        id="observaciones"
        value={observaciones}
        onChange={(evento) =>
          setObservaciones(evento.target.value)
        }
        placeholder="Ej. Decoración en tonos rosados, sin fresas, colocar topper..."
        rows={4}
        className="w-full resize-none rounded-xl border border-[#E5D7DE] bg-[#FFFDFC] px-4 py-3 text-[#5C3A4D] outline-none transition placeholder:text-[#B7AAB0] focus:border-[#EC3D7F]"
      />
    </div>

  </div>

</section>

        {/* Pago */}
<section className="rounded-2xl border border-[#EEDDE3] bg-white p-6">

  <div className="mb-6">
    <h3 className="text-xl font-semibold text-[#5C3A4D]">
      Pago
    </h3>

    <p className="mt-1 text-sm text-[#756870]">
      Registra el precio del pedido y los pagos realizados.
    </p>
  </div>

  <div className="grid gap-5 md:grid-cols-3">

    {/* Precio cotizado */}
    <div>
      <label
        htmlFor="precioCotizado"
        className="mb-2 block text-sm font-medium text-[#5C3A4D]"
      >
        Precio cotizado
      </label>

      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#756870]">
          $
        </span>

        <input
          id="precioCotizado"
          type="number"
          min="0"
          step="0.01"
          value={precioCotizado}
          onChange={(evento) => {
            const nuevoPrecio = evento.target.value

            if (montoValido(nuevoPrecio)) {
                setPrecioCotizado(nuevoPrecio)
            }
            }}
          placeholder="0.00"
          className="w-full rounded-xl border border-[#E5D7DE] bg-[#FFFDFC] py-3 pl-8 pr-4 text-[#5C3A4D] outline-none transition placeholder:text-[#B7AAB0] focus:border-[#EC3D7F]"
        />
      </div>
    </div>

    {/* Abono */}
    <div>
      <label
        htmlFor="abono"
        className="mb-2 block text-sm font-medium text-[#5C3A4D]"
      >
        Abono
      </label>

      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#756870]">
          $
        </span>

        <input
          id="abono"
          type="number"
          min="0"
          max={precioNumerico}
          step="0.01"
          value={abono}
          onChange={(evento) => {
            const nuevoAbono = evento.target.value

            if (
                montoValido(nuevoAbono) &&
                (
                nuevoAbono === '' ||
                Number(nuevoAbono) <= precioNumerico
                )
            ) {
                setAbono(nuevoAbono)
            }
            }}
          placeholder="0.00"
          className="w-full rounded-xl border border-[#E5D7DE] bg-[#FFFDFC] py-3 pl-8 pr-4 text-[#5C3A4D] outline-none transition placeholder:text-[#B7AAB0] focus:border-[#EC3D7F]"
        />
      </div>
    </div>

    {/* Saldo pendiente */}
    <div>
      <label
        htmlFor="saldoPendiente"
        className="mb-2 block text-sm font-medium text-[#5C3A4D]"
      >
        Saldo pendiente
      </label>

      <div className="rounded-xl border border-[#DCE4D8] bg-[#F8FAF6] px-4 py-3">
        <p className="text-lg font-semibold text-[#64745D]">
          ${saldoPendiente.toFixed(2)}
        </p>
      </div>
    </div>

  </div>
    
    <div className="mt-5 flex items-center justify-between rounded-xl bg-[#FFF9F7] px-4 py-3">

  <p className="text-sm font-medium text-[#756870]">
    Estado del pago
  </p>

  <span
    className={`rounded-full px-3 py-1 text-sm font-semibold ${
    estadoPago === 'Pagado completamente'
      ? 'bg-[#EEF3EB] text-[#64745D]'
      : estadoPago === 'Parcial'
        ? 'bg-[#F3EAF0] text-[#5C3A4D]'
        : 'bg-[#FCE5ED] text-[#D93470]'
  }`}
>
  {estadoPago}
  </span>

</div>

</section>

    {/* Estado del pedido */}
<section className="rounded-2xl border border-[#EEDDE3] bg-white p-6">

  <div className="mb-6">
    <h3 className="text-xl font-semibold text-[#5C3A4D]">
      Estado del pedido
    </h3>

    <p className="mt-1 text-sm text-[#756870]">
      Indica en qué etapa se encuentra actualmente el encargo.
    </p>
  </div>

  <div className="max-w-md">

    <label
      htmlFor="estadoPedido"
      className="mb-2 block text-sm font-medium text-[#5C3A4D]"
    >
      Estado
    </label>

    <select
      id="estadoPedido"
      value={estadoPedido}
      onChange={(evento) =>
        setEstadoPedido(evento.target.value)
      }
      className="w-full rounded-xl border border-[#E5D7DE] bg-[#FFFDFC] px-4 py-3 text-[#5C3A4D] outline-none transition focus:border-[#EC3D7F]"
    >
      <option value="Pendiente">
        Pendiente
      </option>

      <option value="Listo">
        Listo
      </option>

      <option value="Entregado">
        Entregado
      </option>

      <option value="Cancelado">
        Cancelado
      </option>
    </select>

  </div>

</section>

{/* Revisión del formulario */}
<div className="flex flex-col gap-4 pb-6">

  {mensajeFormulario && (
    <div
      className={`rounded-xl px-4 py-3 text-sm font-medium ${
        mensajeFormulario.startsWith('✓')
          ? 'bg-[#EEF3EB] text-[#64745D]'
          : 'bg-[#FCE5ED] text-[#D93470]'
      }`}
    >
      {mensajeFormulario}
    </div>
  )}

  <div className="flex flex-wrap justify-end gap-3">

  <button
    type="button"
    onClick={revisarEncargo}
    disabled={guardandoEncargo}
    className="rounded-xl border border-[#E5D7DE] bg-white px-6 py-3 font-semibold text-[#5C3A4D] transition hover:bg-[#FBF1F4] disabled:cursor-not-allowed disabled:opacity-60"
  >
    Revisar encargo
  </button>

  {listoParaGuardar && (
    <button
      type="button"
      onClick={guardarEncargo}
      disabled={guardandoEncargo}
      className="rounded-xl bg-[#EC3D7F] px-6 py-3 font-semibold text-white transition hover:bg-[#D93470] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {guardandoEncargo
        ? 'Guardando...'
        : 'Guardar encargo'}
    </button>
  )}

  </div>

</div>

      </form>

    </main>
  )
}

export default NuevoEncargo