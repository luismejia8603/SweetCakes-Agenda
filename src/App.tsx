import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'

import { supabase } from './lib/supabase'
import Sidebar from './components/Sidebar'
import Calendario from './pages/Calendario'
import DetallePedido from './pages/DetallePedido'
import Inicio from './pages/Inicio'
import Login from './pages/Login'
import NuevoEncargo from './pages/NuevoEncargo'
import Pedidos from './pages/Pedidos'
import PedidosDia from './pages/PedidosDia'
import Usuarios from './pages/Usuarios'

type Perfil = {
  nombre: string
  rol: string
}

function App() {
  const [paginaActual, setPaginaActual] = useState('inicio')
  const [sesion, setSesion] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [cargandoSesion, setCargandoSesion] = useState(true)
  const [fechaPedidos, setFechaPedidos] = useState<string | null>(null)
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<string | number | null>(null)
  const [paginaAnterior, setPaginaAnterior] = useState('pedidos')

  useEffect(() => {
    const revisarSesion = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSesion(session)
      setCargandoSesion(false)
    }

    revisarSesion()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evento: string, session: Session | null) => {
      setSesion(session)
      setCargandoSesion(false)
      if (!session) setPerfil(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    let activo = true

    const cargarPerfil = async () => {
      if (!sesion?.user.id) {
        setPerfil(null)
        return
      }

      const { data, error } = await supabase
        .from('perfiles')
        .select('nombre, rol')
        .eq('id', sesion.user.id)
        .single()

      if (!activo) return

      if (error) {
        console.error('Error al cargar el perfil:', error)
        setPerfil(null)
        return
      }

      setPerfil(data)
    }

    cargarPerfil()
    return () => { activo = false }
  }, [sesion?.user.id])

  const cambiarPagina = (pagina: string) => {
    if (pagina === 'usuarios' && perfil?.rol !== 'Propietario') return
    setPaginaActual(pagina)
    if (pagina !== 'pedidos-dia') setFechaPedidos(null)
    if (pagina !== 'detalle') setPedidoSeleccionado(null)
  }

  const abrirPedidosDia = (fechaISO: string) => {
    setPaginaAnterior(paginaActual)
    setFechaPedidos(fechaISO)
    setPaginaActual('pedidos-dia')
  }

  const abrirDetalle = (id: string | number, desde = paginaActual) => {
    setPedidoSeleccionado(id)
    setPaginaAnterior(desde === 'detalle' ? 'pedidos' : desde)
    setPaginaActual('detalle')
  }

  if (cargandoSesion) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FFF9F7]">
        <p className="font-medium text-[#756870]">Cargando Sweet Cakes...</p>
      </div>
    )
  }

  if (!sesion) return <Login />

  const paginaSidebar = ['detalle', 'pedidos-dia'].includes(paginaActual)
    ? paginaAnterior === 'calendario' ? 'calendario' : 'pedidos'
    : paginaActual

  return (
    <div className="min-h-screen bg-[#FFF9F7] text-[#5C3A4D]">
      <Sidebar paginaActual={paginaSidebar} onCambiarPagina={cambiarPagina} perfil={perfil} />

      <div className="pb-24 md:pb-0">
        {paginaActual === 'inicio' && (
          <Inicio
            onSeleccionarDia={abrirPedidosDia}
            onVerPedidos={() => cambiarPagina('pedidos')}
            onVerDetalle={(id) => abrirDetalle(id, 'inicio')}
          />
        )}

        {paginaActual === 'nuevo' && (
          <NuevoEncargo onGuardado={(id) => abrirDetalle(id, 'nuevo')} />
        )}

        {paginaActual === 'pedidos' && (
          <Pedidos onVerDetalle={(id) => abrirDetalle(id, 'pedidos')} />
        )}

        {paginaActual === 'calendario' && (
          <Calendario
            onSeleccionarDia={abrirPedidosDia}
            onVerDetalle={(id) => abrirDetalle(id, 'calendario')}
          />
        )}

        {paginaActual === 'pedidos-dia' && fechaPedidos && (
          <PedidosDia
            fechaISO={fechaPedidos}
            onVolver={() => cambiarPagina(paginaAnterior === 'calendario' ? 'calendario' : 'inicio')}
            onVerDetalle={(id) => abrirDetalle(id, 'pedidos-dia')}
          />
        )}

        {paginaActual === 'detalle' && pedidoSeleccionado !== null && (
          <DetallePedido
            idPedido={pedidoSeleccionado}
            onVolver={() => cambiarPagina(paginaAnterior === 'detalle' ? 'pedidos' : paginaAnterior)}
          />
        )}

        {paginaActual === 'usuarios' && perfil?.rol === 'Propietario' && <Usuarios />}
      </div>
    </div>
  )
}

export default App
