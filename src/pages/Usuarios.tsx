import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Power, PowerOff, ShieldCheck, UserCog, UserPlus, Users as UsersIcon } from 'lucide-react'

import { supabase } from '../lib/supabase'

type Perfil = {
  id: string
  nombre: string
  usuario: string
  rol: string
  activo: boolean
  created_at?: string | null
}

function Usuarios() {
  const [usuarios, setUsuarios] = useState<Perfil[]>([])
  const [nombre, setNombre] = useState('')
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [rol, setRol] = useState('Empleado')
  const [cargando, setCargando] = useState(true)
  const [creando, setCreando] = useState(false)
  const [actualizandoId, setActualizandoId] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState('')

  const cargarUsuarios = async () => {
    setCargando(true)
    const { data, error } = await supabase
      .from('perfiles')
      .select('id,nombre,usuario,rol,activo,created_at')
      .order('created_at', { ascending: true })

    if (error) {
      console.error(error)
      setMensaje('No se pudieron cargar los usuarios.')
      setUsuarios([])
    } else {
      setUsuarios((data ?? []) as Perfil[])
    }
    setCargando(false)
  }

  useEffect(() => { cargarUsuarios() }, [])

  const crearUsuario = async () => {
    setMensaje('')
    const usuarioLimpio = usuario.trim().toLowerCase()

    if (!nombre.trim()) { setMensaje('Ingresa el nombre del usuario.'); return }
    if (!/^[a-z0-9._-]{3,30}$/.test(usuarioLimpio)) {
      setMensaje('El usuario debe tener 3 a 30 caracteres y solo usar letras minúsculas, números, punto, guion o guion bajo.')
      return
    }
    if (password.length < 8) { setMensaje('La contraseña temporal debe tener al menos 8 caracteres.'); return }

    setCreando(true)
    const { data, error } = await supabase.functions.invoke('crear-usuario', {
      body: { nombre: nombre.trim(), usuario: usuarioLimpio, password, rol },
    })
    setCreando(false)

    if (error) { console.error(error); setMensaje(error.message || 'No se pudo crear el usuario.'); return }
    if (data?.error) { setMensaje(data.error); return }

    setNombre('')
    setUsuario('')
    setPassword('')
    setRol('Empleado')
    setMensaje('✓ Usuario creado correctamente.')
    await cargarUsuarios()
  }

  const actualizarPerfil = async (perfil: Perfil, cambios: Partial<Pick<Perfil, 'rol' | 'activo'>>) => {
    if (perfil.rol === 'Propietario') {
      setMensaje('La cuenta Propietario está protegida desde esta pantalla.')
      return
    }

    setActualizandoId(perfil.id)
    setMensaje('')

    const { error } = await supabase
      .from('perfiles')
      .update(cambios)
      .eq('id', perfil.id)

    setActualizandoId(null)

    if (error) {
      console.error(error)
      setMensaje(error.message || 'No se pudo actualizar el usuario.')
      return
    }

    setUsuarios((actuales) =>
      actuales.map((item) => item.id === perfil.id ? { ...item, ...cambios } : item),
    )
    setMensaje('✓ Permisos del usuario actualizados.')
  }

  const alternarAcceso = async (perfil: Perfil) => {
    if (perfil.activo && !window.confirm(`¿Desactivar la cuenta de ${perfil.nombre}? Perderá acceso a Sweet Cakes.`)) return
    await actualizarPerfil(perfil, { activo: !perfil.activo })
  }

  return (
    <main className="px-4 py-5 pb-28 sm:px-5 md:ml-20 md:p-6 lg:ml-64 lg:p-8 xl:p-10">
      <header className="mb-6 sm:mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#B07A91] sm:text-sm sm:normal-case sm:tracking-normal sm:text-[#756870]">Administración</p>
        <h2 className="mt-1 text-2xl font-bold text-[#5C3A4D] sm:text-3xl">Usuarios y permisos</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#756870]">Solo el Propietario administra cuentas. Los cambios de rol o de estado se aplican al acceso del usuario, no modifican los pedidos que ya registró.</p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <section className="rounded-2xl border border-[#EEDDE3] bg-white p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#F6E6EB] p-2 text-[#EC3D7F]"><UserPlus size={20}/></div>
            <div><h3 className="font-bold text-[#5C3A4D]">Crear usuario</h3><p className="text-xs text-[#9A8B93]">La cuenta usará usuario + contraseña.</p></div>
          </div>

          <div className="mt-5 space-y-4">
            <Campo etiqueta="Nombre completo"><input value={nombre} onChange={(e) => setNombre(e.target.value)} className="campo" placeholder="Ej. María López"/></Campo>
            <Campo etiqueta="Usuario"><input value={usuario} onChange={(e) => setUsuario(e.target.value.toLowerCase())} className="campo" placeholder="Ej. maria" autoCapitalize="none"/></Campo>
            <Campo etiqueta="Contraseña temporal"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="campo" placeholder="Mínimo 8 caracteres"/></Campo>
            <Campo etiqueta="Rol"><select value={rol} onChange={(e) => setRol(e.target.value)} className="campo"><option value="Empleado">Empleado</option><option value="Encargado">Encargado</option></select></Campo>
          </div>

          <div className="mt-4 space-y-2 rounded-xl bg-[#FFF9F7] p-3 text-xs leading-5 text-[#756870]">
            <p><b>Empleado:</b> crea y consulta pedidos, cambia Pendiente/Listo, cobra, registra pagos, confirma entregas e imprime hojas.</p>
            <p><b>Encargado:</b> además puede editar pedidos, ajustar precios, cancelar, eliminar pedidos y anular pagos.</p>
            <p><b>Propietario:</b> acceso total y administración de usuarios.</p>
          </div>

          <button type="button" onClick={crearUsuario} disabled={creando} className="mt-5 w-full rounded-xl bg-[#EC3D7F] px-5 py-3 font-semibold text-white hover:bg-[#D93470] disabled:opacity-60">{creando ? 'Creando usuario...' : 'Crear usuario'}</button>
        </section>

        <section className="rounded-2xl border border-[#EEDDE3] bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-[#F6E6EB] p-2 text-[#EC3D7F]"><UsersIcon size={20}/></div>
              <div><h3 className="font-bold text-[#5C3A4D]">Equipo actual</h3><p className="text-xs text-[#9A8B93]">{cargando ? 'Cargando...' : `${usuarios.length} usuarios registrados`}</p></div>
            </div>
            <ShieldCheck size={22} className="text-[#557260]"/>
          </div>

          {mensaje && <div className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${mensaje.startsWith('✓') ? 'bg-[#EEF3EB] text-[#557260]' : 'bg-[#FFF0F5] text-[#D93470]'}`}>{mensaje}</div>}

          <div className="mt-5 space-y-3">
            {usuarios.map((perfil) => {
              const propietario = perfil.rol === 'Propietario'
              const actualizando = actualizandoId === perfil.id

              return (
                <div key={perfil.id} className={`rounded-2xl border p-4 ${perfil.activo ? 'border-[#F0E4E8] bg-white' : 'border-[#E4E0E2] bg-[#FAF9F9]'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#5C3A4D]">{perfil.nombre}</p>
                      <p className="mt-1 truncate text-xs text-[#9A8B93]">@{perfil.usuario}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${propietario ? 'bg-[#FCE5ED] text-[#D93470]' : perfil.rol === 'Encargado' ? 'bg-[#F3EAF0] text-[#6F4C69]' : 'bg-[#EEF3EB] text-[#64745D]'}`}>{perfil.rol}</span>
                  </div>

                  {propietario ? (
                    <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#FFF8FA] px-3 py-2 text-xs font-semibold text-[#8A6877]"><ShieldCheck size={15}/> Cuenta propietaria protegida</div>
                  ) : (
                    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                      <label>
                        <span className="mb-1.5 block text-xs font-semibold text-[#756870]">Rol</span>
                        <select
                          value={perfil.rol}
                          disabled={actualizando}
                          onChange={(e) => actualizarPerfil(perfil, { rol: e.target.value })}
                          className="campo compacta"
                        >
                          <option value="Empleado">Empleado</option>
                          <option value="Encargado">Encargado</option>
                        </select>
                      </label>

                      <div>
                        <span className="mb-1.5 block text-xs font-semibold text-[#756870]">Acceso</span>
                        <button
                          type="button"
                          disabled={actualizando}
                          onClick={() => alternarAcceso(perfil)}
                          className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold sm:w-auto ${perfil.activo ? 'border border-[#E3D6DB] bg-white text-[#8A6877]' : 'bg-[#557260] text-white'} disabled:opacity-50`}
                        >
                          {perfil.activo ? <PowerOff size={16}/> : <Power size={16}/>} {actualizando ? 'Guardando...' : perfil.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex items-center gap-2 text-[11px] text-[#9A8B93]"><UserCog size={14}/>{perfil.activo ? 'Cuenta activa' : 'Cuenta sin acceso al sistema'}</div>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      <style>{`.campo{width:100%;min-height:48px;border:1px solid #E5D7DE;background:#FFFDFC;border-radius:.75rem;padding:.75rem 1rem;color:#5C3A4D;font-size:16px;outline:none}.campo.compacta{min-height:44px;padding:.6rem .85rem}.campo:focus{border-color:#EC3D7F;box-shadow:0 0 0 3px rgba(236,61,127,.08)}`}</style>
    </main>
  )
}

function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-medium text-[#5C3A4D]">{etiqueta}</span>{children}</label>
}

export default Usuarios
