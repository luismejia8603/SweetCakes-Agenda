import { useEffect, useState } from 'react'

import {
  CalendarDays,
  ClipboardList,
  Home,
  LogOut,
  Plus,
  UserRound,
} from 'lucide-react'

import logo from '../assets/sweet-cakes-logo.jpeg'

import { supabase } from '../lib/supabase'

type Perfil = {
  nombre: string
  rol: string
}


type SidebarProps = {
  paginaActual: string
  onCambiarPagina: (pagina: string) => void
}

function Sidebar({
  paginaActual,
  onCambiarPagina,
}: SidebarProps) {
  const [perfil, setPerfil] = useState<Perfil | null>(null)

  useEffect(() => {
    const cargarPerfil = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return
      }

      const { data, error } = await supabase
        .from('perfiles')
        .select('nombre, rol')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error al cargar el perfil:', error)
        return
      }

      setPerfil(data)
    }

    cargarPerfil()
  }, [])

  const cerrarSesion = async () => {
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Error al cerrar sesión:', error)
    }
  }

  return (
    <aside className="fixed left-0 top-0 hidden h-screen w-64 flex-col border-r border-[#EEDDE3] bg-white p-5 md:flex">

      <div className="flex items-center gap-3">
        <img
          src={logo}
          alt="Logo de Sweet Cakes"
          className="h-14 w-14 rounded-full object-cover"
        />

        <div>
          <h1 className="text-xl font-bold text-[#5C3A4D]">
            Sweet Cakes
          </h1>

          <p className="text-sm text-[#756870]">
            Agenda de encargos
          </p>
        </div>
      </div>

      <nav className="mt-10 flex flex-col gap-2">

        <button
          onClick={() => onCambiarPagina('inicio')}
          className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left font-medium transition ${
            paginaActual === 'inicio'
              ? 'bg-[#F6E6EB] text-[#5C3A4D]'
              : 'text-[#756870] hover:bg-[#FBF1F4]'
          }`}
        >
          <Home size={20} />
          Inicio
        </button>

        <button className="flex items-center gap-3 rounded-xl px-4 py-3 text-left text-[#756870] transition hover:bg-[#FBF1F4]">
          <ClipboardList size={20} />
          Pedidos
        </button>

        <button className="flex items-center gap-3 rounded-xl px-4 py-3 text-left text-[#756870] transition hover:bg-[#FBF1F4]">
          <CalendarDays size={20} />
          Calendario
        </button>

        <button
          onClick={() => onCambiarPagina('nuevo')}
          className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-[#EC3D7F] px-4 py-3 font-semibold text-white transition hover:bg-[#D93470]"
        >
          <Plus size={20} />
          Nuevo encargo
        </button>

      </nav>

            <div className="mt-auto border-t border-[#EEDDE3] pt-5">

        <div className="mb-4 flex items-center gap-3">

          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F6E6EB] text-[#5C3A4D]">
            <UserRound size={20} />
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#5C3A4D]">
              {perfil?.nombre || 'Usuario'}
            </p>

            <p className="truncate text-xs text-[#9A8B93]">
              {perfil?.rol || 'Cargando...'}
            </p>
          </div>

        </div>

        <button
          type="button"
          onClick={cerrarSesion}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left font-medium text-[#756870] transition hover:bg-[#FBF1F4] hover:text-[#D93470]"
        >
          <LogOut size={19} />
          Cerrar sesión
        </button>

      </div>

    </aside>
  )
}

export default Sidebar