import {
  CalendarDays,
  ClipboardList,
  Home,
  LogOut,
  Plus,
  UserRound,
  Users,
} from 'lucide-react'

import logo from '../assets/sweet-cakes-logo.jpeg'
import { supabase } from '../lib/supabase'

type Perfil = {
  nombre: string
  rol: string
} | null

type SidebarProps = {
  paginaActual: string
  onCambiarPagina: (pagina: string) => void
  perfil: Perfil
}

const opcionesBase = [
  { id: 'inicio', etiqueta: 'Inicio', icono: Home },
  { id: 'pedidos', etiqueta: 'Pedidos', icono: ClipboardList },
  { id: 'calendario', etiqueta: 'Calendario', icono: CalendarDays },
]

function Sidebar({ paginaActual, onCambiarPagina, perfil }: SidebarProps) {
  const cerrarSesion = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) console.error('Error al cerrar sesión:', error)
  }

  const opciones =
    perfil?.rol === 'Propietario'
      ? [...opcionesBase, { id: 'usuarios', etiqueta: 'Usuarios', icono: Users }]
      : opcionesBase

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[#EEDDE3] bg-white/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Sweet Cakes" className="h-10 w-10 rounded-full object-cover" />
          <div>
            <p className="font-bold text-[#5C3A4D]">Sweet Cakes</p>
            <p className="text-[11px] text-[#9A8B93]">{perfil?.rol || 'Agenda de encargos'}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={cerrarSesion}
          className="rounded-xl p-2 text-[#756870] hover:bg-[#FBF1F4] hover:text-[#D93470]"
          aria-label="Cerrar sesión"
        >
          <LogOut size={19} />
        </button>
      </header>

      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r border-[#EEDDE3] bg-white p-5 md:flex">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Logo de Sweet Cakes" className="h-14 w-14 rounded-full object-cover" />
          <div>
            <h1 className="text-xl font-bold text-[#5C3A4D]">Sweet Cakes</h1>
            <p className="text-sm text-[#756870]">Agenda de encargos</p>
          </div>
        </div>

        <nav className="mt-10 flex flex-col gap-2">
          {opciones.map(({ id, etiqueta, icono: Icono }) => (
            <button
              key={id}
              type="button"
              onClick={() => onCambiarPagina(id)}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left font-medium transition ${
                paginaActual === id
                  ? 'bg-[#F6E6EB] text-[#5C3A4D]'
                  : 'text-[#756870] hover:bg-[#FBF1F4]'
              }`}
            >
              <Icono size={20} />
              {etiqueta}
            </button>
          ))}

          <button
            type="button"
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
              <p className="truncate text-sm font-semibold text-[#5C3A4D]">{perfil?.nombre || 'Usuario'}</p>
              <p className="truncate text-xs text-[#9A8B93]">{perfil?.rol || 'Cargando...'}</p>
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

      <nav className="fixed bottom-0 left-0 right-0 z-50 grid border-t border-[#EEDDE3] bg-white/95 px-2 py-2 backdrop-blur md:hidden" style={{ gridTemplateColumns: `repeat(${Math.min(opciones.length + 1, 5)}, minmax(0, 1fr))` }}>
        {opciones.slice(0, 4).map(({ id, etiqueta, icono: Icono }) => (
          <button
            key={id}
            type="button"
            onClick={() => onCambiarPagina(id)}
            className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold ${
              paginaActual === id ? 'bg-[#F6E6EB] text-[#D93470]' : 'text-[#756870]'
            }`}
          >
            <Icono size={19} />
            {etiqueta}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onCambiarPagina('nuevo')}
          className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold ${
            paginaActual === 'nuevo' ? 'bg-[#F6E6EB] text-[#D93470]' : 'text-[#756870]'
          }`}
        >
          <Plus size={19} />
          Nuevo
        </button>
      </nav>
    </>
  )
}

export default Sidebar
