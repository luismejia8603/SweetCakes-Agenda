import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'

import { supabase } from './lib/supabase'

import Sidebar from './components/Sidebar'
import Inicio from './pages/Inicio'
import NuevoEncargo from './pages/NuevoEncargo'
import Login from './pages/Login'

function App() {
  const [paginaActual, setPaginaActual] = useState('inicio')

  const [sesion, setSesion] = useState<Session | null>(null)
  const [cargandoSesion, setCargandoSesion] = useState(true)

  useEffect(() => {
    const revisarSesion = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      setSesion(session)
      setCargandoSesion(false)
    }

    revisarSesion()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_evento, session) => {
        setSesion(session)
        setCargandoSesion(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  if (cargandoSesion) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FFF9F7]">
        <p className="font-medium text-[#756870]">
          Cargando Sweet Cakes...
        </p>
      </div>
    )
  }

  if (!sesion) {
    return <Login />
  }

  return (
    <div className="min-h-screen bg-[#FFF9F7] text-[#5C3A4D]">

      <Sidebar
        paginaActual={paginaActual}
        onCambiarPagina={setPaginaActual}
      />

      {paginaActual === 'inicio' && <Inicio />}

      {paginaActual === 'nuevo' && <NuevoEncargo />}

    </div>
  )
}

export default App