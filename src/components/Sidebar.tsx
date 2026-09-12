import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  CalendarDays,
  ClipboardList,
  Home,
  LogOut,
  Plus,
  UserRound,
  Users,
  X,
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
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false)

  const cerrarSesion = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) console.error('Error al cerrar sesión:', error)
  }

  const opciones =
    perfil?.rol === 'Propietario'
      ? [...opcionesBase, { id: 'usuarios', etiqueta: 'Usuarios', icono: Users }]
      : opcionesBase

  const irA = (pagina: string) => {
    onCambiarPagina(pagina)
    setMenuMovilAbierto(false)
  }

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[#EEDDE3] bg-white/95 px-4 backdrop-blur md:hidden">
        <button type="button" onClick={() => irA('inicio')} className="flex min-w-0 items-center gap-3 text-left">
          <img src={logo} alt="Sweet Cakes" className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-[#F0DCE3]" />
          <div className="min-w-0">
            <p className="truncate font-bold text-[#5C3A4D]">Sweet Cakes</p>
            <p className="truncate text-[11px] font-medium text-[#9A8B93]">{perfil?.rol || 'Agenda de encargos'}</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setMenuMovilAbierto((actual) => !actual)}
          className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${menuMovilAbierto ? 'bg-[#F6E6EB] text-[#D93470]' : 'text-[#756870] hover:bg-[#FBF1F4]'}`}
          aria-label={menuMovilAbierto ? 'Cerrar menú de usuario' : 'Abrir menú de usuario'}
        >
          {menuMovilAbierto ? <X size={20} /> : <UserRound size={20} />}
        </button>

        {menuMovilAbierto && (
          <div className="absolute right-3 top-[58px] w-64 overflow-hidden rounded-2xl border border-[#EEDDE3] bg-white shadow-[0_18px_50px_rgba(92,58,77,0.16)]">
            <div className="border-b border-[#F0E4E8] px-4 py-4">
              <p className="truncate font-semibold text-[#5C3A4D]">{perfil?.nombre || 'Usuario'}</p>
              <p className="mt-0.5 text-xs text-[#9A8B93]">{perfil?.rol || 'Cargando...'}</p>
            </div>

            {perfil?.rol === 'Propietario' && (
              <button
                type="button"
                onClick={() => irA('usuarios')}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-[#5C3A4D] hover:bg-[#FFF8FA]"
              >
                <Users size={18} />
                Usuarios del equipo
              </button>
            )}

            <button
              type="button"
              onClick={cerrarSesion}
              className="flex w-full items-center gap-3 border-t border-[#F0E4E8] px-4 py-3 text-left text-sm font-semibold text-[#D93470] hover:bg-[#FFF4F8]"
            >
              <LogOut size={18} />
              Cerrar sesión
            </button>
          </div>
        )}
      </header>

      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-20 flex-col border-r border-[#EEDDE3] bg-white px-3 py-5 md:flex lg:w-64 lg:p-5">
        <button type="button" onClick={() => irA('inicio')} className="flex items-center justify-center gap-3 lg:justify-start">
          <img src={logo} alt="Logo de Sweet Cakes" className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-[#F0DCE3] lg:h-14 lg:w-14" />
          <div className="hidden text-left lg:block">
            <h1 className="text-xl font-bold text-[#5C3A4D]">Sweet Cakes</h1>
            <p className="text-sm text-[#756870]">Agenda de encargos</p>
          </div>
        </button>

        <nav className="mt-8 flex flex-col gap-2 lg:mt-10">
          {opciones.map(({ id, etiqueta, icono: Icono }) => (
            <button
              key={id}
              type="button"
              onClick={() => irA(id)}
              title={etiqueta}
              className={`flex min-h-12 items-center justify-center gap-3 rounded-xl px-3 py-3 text-left font-medium transition lg:justify-start lg:px-4 ${
                paginaActual === id
                  ? 'bg-[#F6E6EB] text-[#D93470]'
                  : 'text-[#756870] hover:bg-[#FBF1F4]'
              }`}
            >
              <Icono size={21} className="shrink-0" />
              <span className="hidden lg:inline">{etiqueta}</span>
            </button>
          ))}

          <button
            type="button"
            onClick={() => irA('nuevo')}
            title="Nuevo encargo"
            className={`mt-3 flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 py-3 font-semibold transition lg:px-4 ${
              paginaActual === 'nuevo'
                ? 'bg-[#D93470] text-white'
                : 'bg-[#EC3D7F] text-white hover:bg-[#D93470]'
            }`}
          >
            <Plus size={21} />
            <span className="hidden lg:inline">Nuevo encargo</span>
          </button>
        </nav>

        <div className="mt-auto border-t border-[#EEDDE3] pt-4">
          <div className="mb-3 hidden items-center gap-3 lg:flex">
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
            title="Cerrar sesión"
            className="flex w-full items-center justify-center gap-3 rounded-xl px-3 py-3 text-left font-medium text-[#756870] transition hover:bg-[#FBF1F4] hover:text-[#D93470] lg:justify-start lg:px-4"
          >
            <LogOut size={19} />
            <span className="hidden lg:inline">Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <nav className="mobile-safe-bottom fixed bottom-0 left-0 right-0 z-50 grid h-[76px] grid-cols-4 border-t border-[#EEDDE3] bg-white/95 px-2 pt-1.5 shadow-[0_-8px_30px_rgba(92,58,77,0.08)] backdrop-blur md:hidden">
        <BotonMovil id="inicio" etiqueta="Inicio" paginaActual={paginaActual} onClick={irA} icono={<Home size={21} />} />
        <BotonMovil id="calendario" etiqueta="Calendario" paginaActual={paginaActual} onClick={irA} icono={<CalendarDays size={21} />} />

        <button type="button" onClick={() => irA('nuevo')} className="relative flex flex-col items-center justify-end gap-0.5 pb-1 text-[10px] font-bold text-[#D93470]">
          <span className={`absolute -top-5 flex h-14 w-14 items-center justify-center rounded-full border-4 border-white shadow-[0_8px_22px_rgba(236,61,127,0.28)] ${paginaActual === 'nuevo' ? 'bg-[#D93470]' : 'bg-[#EC3D7F]'}`}>
            <Plus size={27} className="text-white" />
          </span>
          <span>Nuevo</span>
        </button>

        <BotonMovil id="pedidos" etiqueta="Pedidos" paginaActual={paginaActual} onClick={irA} icono={<ClipboardList size={21} />} />
      </nav>
    </>
  )
}

function BotonMovil({
  id,
  etiqueta,
  paginaActual,
  onClick,
  icono,
}: {
  id: string
  etiqueta: string
  paginaActual: string
  onClick: (pagina: string) => void
  icono: ReactNode
}) {
  const activo = paginaActual === id

  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold transition ${activo ? 'text-[#D93470]' : 'text-[#756870]'}`}
    >
      <span className={`flex h-8 w-10 items-center justify-center rounded-xl ${activo ? 'bg-[#FCE5ED]' : ''}`}>{icono}</span>
      {etiqueta}
    </button>
  )
}

export default Sidebar
