import type { Encargo } from '../types/encargo'
import { obtenerPago } from '../types/encargo'

const compactarFecha = (fechaISO: string) => fechaISO.replaceAll('-', '')
const compactarHora = (hora: string) => hora.replace(':', '').slice(0, 4)

const sumarUnaHora = (fechaISO: string, hora: string) => {
  const [anio, mes, dia] = fechaISO.split('-').map(Number)
  const [horas, minutos] = hora.split(':').map(Number)
  const fecha = new Date(anio, mes - 1, dia, horas, minutos, 0)

  fecha.setHours(fecha.getHours() + 1)

  const finFecha = `${fecha.getFullYear()}${String(fecha.getMonth() + 1).padStart(2, '0')}${String(fecha.getDate()).padStart(2, '0')}`
  const finHora = `${String(fecha.getHours()).padStart(2, '0')}${String(fecha.getMinutes()).padStart(2, '0')}00`

  return `${finFecha}T${finHora}`
}

export const crearUrlGoogleCalendar = (
  pedido: Pick<
    Encargo,
    | 'nombre_cliente'
    | 'fecha_entrega'
    | 'hora_entrega'
    | 'sabor_torta'
    | 'sabor_relleno'
    | 'chantilly'
    | 'dedicatoria'
    | 'observaciones'
    | 'precio_cotizado'
    | 'abono'
  >
) => {
  const inicio = `${compactarFecha(pedido.fecha_entrega)}T${compactarHora(pedido.hora_entrega)}00`
  const fin = sumarUnaHora(pedido.fecha_entrega, pedido.hora_entrega)
  const pago = obtenerPago(pedido)

  const detalles = [
    `Cliente: ${pedido.nombre_cliente}`,
    `Torta: ${pedido.sabor_torta}`,
    `Relleno: ${pedido.sabor_relleno}`,
    `Chantilly: ${pedido.chantilly}`,
    pedido.dedicatoria ? `Dedicatoria: ${pedido.dedicatoria}` : '',
    pedido.observaciones ? `Observaciones: ${pedido.observaciones}` : '',
    `Pago: ${pago.estado}`,
    `Saldo: $${pago.saldo.toFixed(2)}`,
  ]
    .filter(Boolean)
    .join('\n')

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Sweet Cakes - ${pedido.nombre_cliente}`,
    dates: `${inicio}/${fin}`,
    details: detalles,
    ctz: 'America/El_Salvador',
  })

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
