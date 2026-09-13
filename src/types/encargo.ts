export type EstadoPedido = 'Pendiente' | 'Listo' | 'Entregado' | 'Cancelado'

export type ImagenEncargo = {
  id: string
  encargo_id: string | number
  ruta_storage: string
  orden: number
  creado_por?: string | null
  created_at?: string | null
}

export type Encargo = {
  id: string | number
  nombre_cliente: string
  telefono: string | null
  fecha_entrega: string
  hora_entrega: string
  sabor_torta: string
  sabor_relleno: string
  chantilly: string
  imagen_referencia: string | null
  dedicatoria: string | null
  observaciones: string | null
  precio_cotizado: number | string
  abono: number | string
  estado_pedido: EstadoPedido | string
  creado_por?: string | null
  created_at?: string | null
}

export const obtenerPago = (pedido: Pick<Encargo, 'precio_cotizado' | 'abono'>) => {
  const total = Number(pedido.precio_cotizado ?? 0)
  const abono = Number(pedido.abono ?? 0)
  const saldo = Math.max(total - abono, 0)

  return {
    total,
    abono,
    saldo,
    pagado: total > 0 && saldo <= 0.005,
    estado:
      total > 0 && saldo <= 0.005
        ? 'Pagado'
        : abono > 0
          ? 'Pago parcial'
          : 'Pendiente de pago',
  }
}

export const formatearHora = (hora: string) => {
  const [horas, minutos] = hora.split(':').map(Number)

  if (Number.isNaN(horas) || Number.isNaN(minutos)) {
    return hora
  }

  const periodo = horas >= 12 ? 'PM' : 'AM'
  const hora12 = horas % 12 || 12

  return `${hora12}:${String(minutos).padStart(2, '0')} ${periodo}`
}

export const fechaLocalAISO = (fecha: Date) => {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')

  return `${anio}-${mes}-${dia}`
}

export const fechaISOADate = (fechaISO: string) => {
  const [anio, mes, dia] = fechaISO.split('-').map(Number)
  return new Date(anio, mes - 1, dia)
}
