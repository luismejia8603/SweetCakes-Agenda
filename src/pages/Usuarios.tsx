import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ShieldCheck, UserPlus, Users as UsersIcon } from 'lucide-react'

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
  const [mensaje, setMensaje] = useState('')

  const cargarUsuarios = async () => {
    setCargando(true)
    const { data, error } = await supabase.from('perfiles').select('id,nombre,usuario,rol,activo,created_at').order('created_at', { ascending: true })
    if (error) { console.error(error); setMensaje('No se pudieron cargar los usuarios.'); setUsuarios([]) }
    else setUsuarios((data ?? []) as Perfil[])
    setCargando(false)
  }

  useEffect(() => { cargarUsuarios() }, [])

  const crearUsuario = async () => {
    setMensaje('')
    const usuarioLimpio = usuario.trim().toLowerCase()
    if (!nombre.trim()) { setMensaje('Ingresa el nombre del usuario.'); return }
    if (!/^[a-z0-9._-]{3,30}$/.test(usuarioLimpio)) { setMensaje('El usuario debe tener 3 a 30 caracteres y solo usar letras minúsculas, números, punto, guion o guion bajo.'); return }
    if (password.length < 8) { setMensaje('La contraseña temporal debe tener al menos 8 caracteres.'); return }

    setCreando(true)
    const { data, error } = await supabase.functions.invoke('crear-usuario', { body: { nombre: nombre.trim(), usuario: usuarioLimpio, password, rol } })
    setCreando(false)

    if (error) { console.error(error); setMensaje(error.message || 'No se pudo crear el usuario.'); return }
    if (data?.error) { setMensaje(data.error); return }

    setNombre(''); setUsuario(''); setPassword(''); setRol('Empleado')
    setMensaje('✓ Usuario creado correctamente.')
    await cargarUsuarios()
  }

  return (
    <main className="p-5 md:ml-64 md:p-8 lg:p-10">
      <header className="mb-8"><p className="text-sm text-[#756870]">Administración</p><h2 className="mt-1 text-3xl font-bold text-[#5C3A4D]">Usuarios del equipo</h2><p className="mt-2 text-sm text-[#756870]">Solo el propietario puede crear cuentas nuevas de empleados y encargados.</p></header>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-2xl border border-[#EEDDE3] bg-white p-5 sm:p-6">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-[#F6E6EB] p-2 text-[#EC3D7F]"><UserPlus size={20}/></div><div><h3 className="font-bold text-[#5C3A4D]">Crear usuario</h3><p className="text-xs text-[#9A8B93]">La cuenta usará usuario + contraseña.</p></div></div>
          <div className="mt-5 space-y-4">
            <Campo etiqueta="Nombre completo"><input value={nombre} onChange={(e) => setNombre(e.target.value)} className="campo" placeholder="Ej. María López"/></Campo>
            <Campo etiqueta="Usuario"><input value={usuario} onChange={(e) => setUsuario(e.target.value.toLowerCase())} className="campo" placeholder="Ej. maria" autoCapitalize="none"/></Campo>
            <Campo etiqueta="Contraseña temporal"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="campo" placeholder="Mínimo 8 caracteres"/></Campo>
            <Campo etiqueta="Rol"><select value={rol} onChange={(e) => setRol(e.target.value)} className="campo"><option value="Empleado">Empleado</option><option value="Encargado">Encargado</option></select></Campo>
          </div>
          <div className="mt-4 rounded-xl bg-[#FFF9F7] p-3 text-xs leading-5 text-[#756870]"><b>Empleado:</b> trabaja con pedidos y calendario. <b>Encargado:</b> mismo acceso operativo por ahora, preparado para permisos adicionales después. La gestión de usuarios sigue reservada al Propietario.</div>
          {mensaje && <div className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${mensaje.startsWith('✓') ? 'bg-[#EEF3EB] text-[#557260]' : 'bg-[#FFF0F5] text-[#D93470]'}`}>{mensaje}</div>}
          <button type="button" onClick={crearUsuario} disabled={creando} className="mt-5 w-full rounded-xl bg-[#EC3D7F] px-5 py-3 font-semibold text-white hover:bg-[#D93470] disabled:opacity-60">{creando ? 'Creando usuario...' : 'Crear usuario'}</button>
        </section>

        <section className="rounded-2xl border border-[#EEDDE3] bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="rounded-xl bg-[#F6E6EB] p-2 text-[#EC3D7F]"><UsersIcon size={20}/></div><div><h3 className="font-bold text-[#5C3A4D]">Equipo actual</h3><p className="text-xs text-[#9A8B93]">{cargando ? 'Cargando...' : `${usuarios.length} usuarios registrados`}</p></div></div><ShieldCheck size={22} className="text-[#557260]"/></div>
          <div className="mt-5 space-y-3">
            {usuarios.map((perfil) => <div key={perfil.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#F0E4E8] p-4"><div className="min-w-0"><p className="truncate font-semibold text-[#5C3A4D]">{perfil.nombre}</p><p className="mt-1 truncate text-xs text-[#9A8B93]">@{perfil.usuario}</p></div><div className="text-right"><span className={`rounded-full px-3 py-1 text-xs font-bold ${perfil.rol === 'Propietario' ? 'bg-[#FCE5ED] text-[#D93470]' : perfil.rol === 'Encargado' ? 'bg-[#F3EAF0] text-[#6F4C69]' : 'bg-[#EEF3EB] text-[#64745D]'}`}>{perfil.rol}</span><p className="mt-1 text-[10px] text-[#9A8B93]">{perfil.activo ? 'Activo' : 'Inactivo'}</p></div></div>)}
          </div>
        </section>
      </div>
      <style>{`.campo{width:100%;border:1px solid #E5D7DE;background:#FFFDFC;border-radius:.75rem;padding:.75rem 1rem;color:#5C3A4D;outline:none}.campo:focus{border-color:#EC3D7F;box-shadow:0 0 0 3px rgba(236,61,127,.08)}`}</style>
    </main>
  )
}

function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) { return <label className="block"><span className="mb-2 block text-sm font-medium text-[#5C3A4D]">{etiqueta}</span>{children}</label> }

export default Usuarios
