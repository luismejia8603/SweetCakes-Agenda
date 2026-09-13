import { supabase } from './supabase'

export type MetodoPago = 'Efectivo' | 'Transferencia' | 'Otro' | 'No especificado'

export type PagoEncargo = {
  id: string
  encargo_id: string
  monto: number | string
  fecha_pago: string
  metodo_pago: MetodoPago | string
  nota: string | null
  anulado: boolean
  anulado_at: string | null
  motivo_anulacion: string | null
  creado_por: string | null
  created_at: string
}

export const cargarPagosEncargo = async (encargoId: string | number) => {
  const { data, error } = await supabase
    .from('encargo_pagos')
    .select('id,encargo_id,monto,fecha_pago,metodo_pago,nota,anulado,anulado_at,motivo_anulacion,creado_por,created_at')
    .eq('encargo_id', encargoId)
    .order('fecha_pago', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as PagoEncargo[]
}

type RegistrarPagoArgs = {
  encargoId: string | number
  monto: number
  fechaPago: string
  metodoPago: MetodoPago | string
  nota?: string
  creadoPor: string
}

export const registrarPagoEncargo = async ({
  encargoId,
  monto,
  fechaPago,
  metodoPago,
  nota,
  creadoPor,
}: RegistrarPagoArgs) => {
  const { data, error } = await supabase
    .from('encargo_pagos')
    .insert({
      encargo_id: encargoId,
      monto,
      fecha_pago: fechaPago,
      metodo_pago: metodoPago,
      nota: nota?.trim() || null,
      creado_por: creadoPor,
    })
    .select('id')
    .single()

  if (error) throw error
  return data
}

export const anularPagoEncargo = async (
  pagoId: string,
  motivo: string,
  usuarioId: string,
) => {
  const { error } = await supabase
    .from('encargo_pagos')
    .update({
      anulado: true,
      anulado_at: new Date().toISOString(),
      anulado_por: usuarioId,
      motivo_anulacion: motivo.trim() || 'Pago anulado',
    })
    .eq('id', pagoId)
    .eq('anulado', false)

  if (error) throw error
}
