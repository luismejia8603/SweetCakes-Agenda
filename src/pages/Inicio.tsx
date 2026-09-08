import { useEffect, useState } from 'react'

import {
  Clock3,
  CakeSlice,
} from 'lucide-react'

import { supabase } from '../lib/supabase'

type ResumenDia = {
  total: number
  pendientes: number
  listos: number
  entregados: number
}

type ResumenPorFecha = Record<string, ResumenDia>


const convertirFechaAISO = (fecha: Date) => {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')

  return `${anio}-${mes}-${dia}`
}

const obtenerNombreDia = (fecha: Date) => {
  const nombre = fecha
    .toLocaleDateString('es-SV', {
      weekday: 'short',
    })
    .replace('.', '')

  return nombre.charAt(0).toUpperCase() + nombre.slice(1)
}

function Inicio() {
const [fechaActual, setFechaActual] = useState(new Date())

const [resumenPorFecha, setResumenPorFecha] =
  useState<ResumenPorFecha>({})

const [cargandoProximos, setCargandoProximos] =
  useState(true)

const [errorProximos, setErrorProximos] =
  useState('')

const diasProximos = Array.from(
  { length: 7 },
  (_, index) => {
    const fecha = new Date(fechaActual)

    fecha.setHours(0, 0, 0, 0)
    fecha.setDate(fecha.getDate() + index)

    return {
      fecha,
      fechaISO: convertirFechaAISO(fecha),
      nombre: obtenerNombreDia(fecha),
    }
  }
)

const inicioRangoISO =
  diasProximos[0].fechaISO

const finRangoISO =
  diasProximos[6].fechaISO

useEffect(() => {
  const intervalo = window.setInterval(() => {
    const ahora = new Date()

    setFechaActual((fechaAnterior) => {
      const diaAnterior =
        convertirFechaAISO(fechaAnterior)

      const diaActual =
        convertirFechaAISO(ahora)

      return diaAnterior === diaActual
        ? fechaAnterior
        : ahora
    })
  }, 60 * 1000)

  return () => {
    window.clearInterval(intervalo)
  }
}, [])

useEffect(() => {
  let componenteActivo = true

  const cargarPedidosProximos = async () => {
    setCargandoProximos(true)
    setErrorProximos('')

    const { data, error } = await supabase
      .from('encargos')
      .select('fecha_entrega, estado_pedido')
      .gte('fecha_entrega', inicioRangoISO)
      .lte('fecha_entrega', finRangoISO)
      .neq('estado_pedido', 'Cancelado')

    if (!componenteActivo) {
      return
    }

    if (error) {
      console.error(
        'Error al cargar los pedidos próximos:',
        error
      )

      setErrorProximos(
        'No se pudieron cargar los pedidos próximos.'
      )

      setResumenPorFecha({})
      setCargandoProximos(false)

      return
    }

    const nuevoResumen: ResumenPorFecha = {}

    for (const encargo of data ?? []) {
      const fecha = encargo.fecha_entrega

      if (!nuevoResumen[fecha]) {
        nuevoResumen[fecha] = {
          total: 0,
          pendientes: 0,
          listos: 0,
          entregados: 0,
        }
      }

      nuevoResumen[fecha].total += 1

      if (encargo.estado_pedido === 'Pendiente') {
        nuevoResumen[fecha].pendientes += 1
      }

      if (encargo.estado_pedido === 'Listo') {
        nuevoResumen[fecha].listos += 1
      }

      if (encargo.estado_pedido === 'Entregado') {
        nuevoResumen[fecha].entregados += 1
      }
    }

    setResumenPorFecha(nuevoResumen)
    setCargandoProximos(false)
  }

  cargarPedidosProximos()

  return () => {
    componenteActivo = false
  }
}, [inicioRangoISO, finRangoISO])

const textoRango = `${diasProximos[0].fecha.toLocaleDateString(
  'es-SV',
  {
    day: 'numeric',
    month: 'long',
  }
)} - ${diasProximos[6].fecha.toLocaleDateString(
  'es-SV',
  {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }
)}`
  const pedidosHoy = [
    {
      cliente: 'Ana Martínez',
      hora: '10:30 AM',
      sabor: 'Vainilla',
      estado: 'Pendiente',
    },
    {
      cliente: 'Carlos Rivera',
      hora: '2:00 PM',
      sabor: 'Chocolate',
      estado: 'En preparación',
    },
    {
      cliente: 'María López',
      hora: '5:30 PM',
      sabor: 'Marmoleado',
      estado: 'Listo',
    },
  ]

  return (
    <main className="p-5 md:ml-64 md:p-8 lg:p-10">

      {/* Encabezado */}
      <header className="mb-10">
        <p className="text-sm text-[#756870]">
          Agenda de encargos
        </p>

        <h2 className="mt-1 text-3xl font-bold text-[#5C3A4D]">
          Sweet Cakes
        </h2>

        <p className="mt-2 text-sm text-[#756870]">
          Aquí puedes revisar los pedidos y encargos de esta semana.
        </p>
      </header>

      {/* Pedidos próximos */}
<section>
  <div className="mb-5">
    <h3 className="text-xl font-semibold text-[#5C3A4D]">
      Pedidos próximos
    </h3>

    <p className="mt-1 text-sm text-[#756870]">
      {textoRango}
    </p>

    {errorProximos && (
      <p className="mt-2 text-sm font-medium text-[#D93470]">
        {errorProximos}
      </p>
    )}
  </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">

        {diasProximos.map((dia) => {
  const resumen =
    resumenPorFecha[dia.fechaISO] ?? {
      total: 0,
      pendientes: 0,
      listos: 0,
      entregados: 0,
    }

  const esHoy =
    dia.fechaISO ===
    convertirFechaAISO(fechaActual)

  return (
    <div
      key={dia.fechaISO}
      className={`cursor-pointer rounded-2xl border bg-white p-4 transition hover:-translate-y-1 hover:shadow-sm ${
        esHoy
          ? 'border-[#EC3D7F]'
          : 'border-[#EEDDE3]'
      }`}
    >
      <div className="text-center">

        <p className="text-sm font-semibold text-[#5C3A4D]">
          {dia.nombre}
        </p>

        <p className="mt-1 text-xs text-[#9A8B93]">
          {dia.fecha.toLocaleDateString(
            'es-SV',
            {
              day: 'numeric',
              month: 'short',
            }
          )}
        </p>

        <p className="mt-3 text-3xl font-bold text-[#EC3D7F]">
          {cargandoProximos
            ? '...'
            : resumen.total}
        </p>

        <p className="text-xs text-[#9A8B93]">
          {resumen.total === 1
            ? 'encargo'
            : 'encargos'}
        </p>

      </div>

      <div className="mt-4 space-y-2 border-t border-[#F0E4E8] pt-3">

        <div className="flex items-center justify-between text-xs">
          <span className="text-[#756870]">
            Pendientes
          </span>

          <span className="rounded-full bg-[#FCE5ED] px-2 py-1 font-semibold text-[#D93470]">
            {resumen.pendientes}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-[#756870]">
            Listos
          </span>

          <span className="rounded-full bg-[#F3EAF0] px-2 py-1 font-semibold text-[#6F4C69]">
            {resumen.listos}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-[#756870]">
            Entregados
          </span>

          <span className="rounded-full bg-[#EEF3EB] px-2 py-1 font-semibold text-[#64745D]">
            {resumen.entregados}
          </span>
        </div>

      </div>

    </div>
  )
})}

        </div>
      </section>

      {/* Lista de pedidos */}
      <section className="mt-10">

        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-[#5C3A4D]">
              Próximos pedidos
            </h3>

            <p className="mt-1 text-sm text-[#756870]">
            Encargos programados para hoy
            </p>

          </div>

          <button className="text-sm font-medium text-[#EC3D7F] hover:underline">
            Ver todos
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#EEDDE3] bg-white">

          {pedidosHoy.map((pedido, index) => (
            <div
              key={pedido.cliente}
              className={`flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between ${
                index !== pedidosHoy.length - 1
                  ? 'border-b border-[#F0E4E8]'
                  : ''
              }`}
            >
              <div className="flex items-start gap-4">

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F6E6EB] text-[#EC3D7F]">
                  <CakeSlice size={21} />
                </div>

                <div>
                  <p className="font-semibold text-[#5C3A4D]">
                    {pedido.cliente}
                  </p>

                  <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-[#756870]">

                    <span className="flex items-center gap-1">
                      <Clock3 size={15} />
                      {pedido.hora}
                    </span>

                    <span>
                      {pedido.sabor}
                    </span>

                  </div>
                </div>

              </div>

              <span
                className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${
                  pedido.estado === 'Pendiente'
                    ? 'bg-[#FCE5ED] text-[#D93470]'
                    : pedido.estado === 'En preparación'
                      ? 'bg-[#F3EAF0] text-[#5C3A4D]'
                      : 'bg-[#EEF3EB] text-[#64745D]'
                }`}
              >
                {pedido.estado}
              </span>

            </div>
          ))}

        </div>
      </section>

    </main>
  )
}

export default Inicio