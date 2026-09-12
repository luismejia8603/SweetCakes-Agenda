import { useEffect, useRef, useState } from 'react'
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

type EstadoHistorialSweetCakes = {
  sweetCakesApp: true
  paginaActual: string
  fechaPedidos: string | null
  pedidoSeleccionado: string | number | null
  paginaAnterior: string
  nivel: number
}

function App() {
  const [paginaActual, setPaginaActual] = useState('inicio')
  const [sesion, setSesion] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [cargandoSesion, setCargandoSesion] = useState(true)
  const [fechaPedidos, setFechaPedidos] = useState<string | null>(null)
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<string | number | null>(null)
  const [paginaAnterior, setPaginaAnterior] = useState('pedidos')
  const nivelHistorial = useRef(0)

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

  useEffect(() => {
    if (!sesion) return

    const estadoActual = window.history.state as EstadoHistorialSweetCakes | null

    if (estadoActual?.sweetCakesApp) {
      nivelHistorial.current = estadoActual.nivel ?? 0
      setPaginaActual(estadoActual.paginaActual ?? 'inicio')
      setFechaPedidos(estadoActual.fechaPedidos ?? null)
      setPedidoSeleccionado(estadoActual.pedidoSeleccionado ?? null)
      setPaginaAnterior(estadoActual.paginaAnterior ?? 'pedidos')
    } else {
      const estadoInicial: EstadoHistorialSweetCakes = {
        sweetCakesApp: true,
        paginaActual: 'inicio',
        fechaPedidos: null,
        pedidoSeleccionado: null,
        paginaAnterior: 'pedidos',
        nivel: 0,
      }

      window.history.replaceState(estadoInicial, '', window.location.href)
      nivelHistorial.current = 0
    }

    const manejarRetroceso = (evento: PopStateEvent) => {
      const estado = evento.state as EstadoHistorialSweetCakes | null

      if (!estado?.sweetCakesApp) return

      nivelHistorial.current = estado.nivel ?? 0
      setPaginaActual(estado.paginaActual ?? 'inicio')
      setFechaPedidos(estado.fechaPedidos ?? null)
      setPedidoSeleccionado(estado.pedidoSeleccionado ?? null)
      setPaginaAnterior(estado.paginaAnterior ?? 'pedidos')
    }

    window.addEventListener('popstate', manejarRetroceso)
    return () => window.removeEventListener('popstate', manejarRetroceso)
  }, [sesion])

  const guardarEnHistorial = (
    siguientePagina: string,
    siguienteFecha: string | null,
    siguientePedido: string | number | null,
    siguienteAnterior: string,
  ) => {
    const siguienteNivel = nivelHistorial.current + 1
    nivelHistorial.current = siguienteNivel

    const estado: EstadoHistorialSweetCakes = {
      sweetCakesApp: true,
      paginaActual: siguientePagina,
      fechaPedidos: siguienteFecha,
      pedidoSeleccionado: siguientePedido,
      paginaAnterior: siguienteAnterior,
      nivel: siguienteNivel,
    }

    window.history.pushState(estado, '', window.location.href)
  }

  const aplicarNavegacion = (
    siguientePagina: string,
    siguienteFecha: string | null,
    siguientePedido: string | number | null,
    siguienteAnterior: string,
  ) => {
    setPaginaActual(siguientePagina)
    setFechaPedidos(siguienteFecha)
    setPedidoSeleccionado(siguientePedido)
    setPaginaAnterior(siguienteAnterior)
    guardarEnHistorial(siguientePagina, siguienteFecha, siguientePedido, siguienteAnterior)
  }

  const cambiarPagina = (pagina: string) => {
    if (pagina === 'usuarios' && perfil?.rol !== 'Propietario') return

    aplicarNavegacion(
      pagina,
      pagina === 'pedidos-dia' ? fechaPedidos : null,
      pagina === 'detalle' ? pedidoSeleccionado : null,
      paginaAnterior,
    )
  }

  const abrirPedidosDia = (fechaISO: string) => {
    aplicarNavegacion('pedidos-dia', fechaISO, null, paginaActual)
  }

  const abrirDetalle = (id: string | number, desde = paginaActual) => {
    const anterior = desde === 'detalle' ? 'pedidos' : desde
    aplicarNavegacion('detalle', null, id, anterior)
  }

  const volverDentroDeLaApp = (paginaRespaldo: string) => {
    if (nivelHistorial.current > 0) {
      window.history.back()
      return
    }

    aplicarNavegacion(paginaRespaldo, null, null, 'pedidos')
  }

  if (cargandoSesion) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FFF9F7]">
        <p className="font-medium text-[#756870]">Cargando Sweet Cakes...</p>
      </div>
    )
  }

  if (!sesion) return <Login />

  const paginaSidebar = paginaActual === 'pedidos-dia'
    ? paginaAnterior === 'calendario'
      ? 'calendario'
      : paginaAnterior === 'inicio'
        ? 'inicio'
        : 'pedidos'
    : paginaActual === 'detalle'
      ? paginaAnterior === 'calendario'
        ? 'calendario'
        : paginaAnterior === 'inicio'
          ? 'inicio'
          : paginaAnterior === 'nuevo'
            ? 'nuevo'
            : 'pedidos'
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
            onVolver={() => volverDentroDeLaApp(paginaAnterior === 'calendario' ? 'calendario' : 'inicio')}
            onVerDetalle={(id) => abrirDetalle(id, 'pedidos-dia')}
          />
        )}

        {paginaActual === 'detalle' && pedidoSeleccionado !== null && (
          <DetallePedido
            idPedido={pedidoSeleccionado}
            onVolver={() => volverDentroDeLaApp(paginaAnterior === 'detalle' ? 'pedidos' : paginaAnterior)}
          />
        )}

        {paginaActual === 'usuarios' && perfil?.rol === 'Propietario' && <Usuarios />}
      </div>
    </div>
  )
}

export default App
