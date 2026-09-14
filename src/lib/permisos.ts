export type RolSweetCakes = 'Propietario' | 'Encargado' | 'Empleado'

export const esRolSweetCakes = (rol: string | null | undefined): rol is RolSweetCakes =>
  rol === 'Propietario' || rol === 'Encargado' || rol === 'Empleado'

export const esPropietario = (rol: string | null | undefined) => rol === 'Propietario'

export const esSupervisor = (rol: string | null | undefined) =>
  rol === 'Propietario' || rol === 'Encargado'

export const puedeGestionarUsuarios = esPropietario
export const puedeEditarPedido = esSupervisor
export const puedeAjustarPrecio = esSupervisor
export const puedeCancelarPedido = esSupervisor
export const puedeAnularPago = esSupervisor
export const puedeEliminarPedido = esSupervisor

// Los tres roles activos conservan las acciones operativas del día a día:
// ver y crear pedidos, cambiar Pendiente/Listo, registrar/cobrar pagos,
// confirmar la entrega e imprimir la hoja de producción.
export const puedeOperarPedidos = (rol: string | null | undefined) => esRolSweetCakes(rol)
