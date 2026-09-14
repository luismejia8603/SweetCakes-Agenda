import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'

import { supabase } from './lib/supabase'
import { puedeEditarPedido, puedeGestionarUsuarios } from './lib/permisos'
import Sidebar from './components/Sidebar'
import Calendario from './pages/Calendario'
import DetallePedido from './pages/DetallePedido'
import EditarPedido from './pages/EditarPedido'
import Inicio from './pages/Inicio'
import Login from './pages/Login'
import NuevoEncargo from './pages/NuevoEncargo'
import Pedidos from './pages/Pedidos'
import PedidosDia from './pages/PedidosDia'
import Usuarios from './pages/Usuarios'

type Perfil = {
  nombre: string
  rol: string
  activo: boolean
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
  const [cargandoPerfil, setCargandoPerfil] = useState(false)
  const [errorPerfil, setErrorPerfil] = useState('')
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
      if (!session) {
        setPerfil(null)
        setErrorPerfil('')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    let activo = true

    const cargarPerfil = async () => {
      if (!sesion?.user.id) {
        setPerfil(null)
        setCargandoPerfil(false)
        return
      }

      setCargandoPerfil(true)
      setErrorPerfil('')

      const { data, error } = await supabase
        .from('perfiles')
        .select('nombre, rol, activo')
        .eq('id', sesion.user.id)
        .single()

      if (!activo) return

      if (error || !data) {
        console.error('Error al cargar el perfil:', error)
        setPerfil(null)
        setErrorPerfil('No se pudo verificar tu perfil de Sweet Cakes.')
        setCargandoPerfil(false)
        return
      }

      setPerfil(data as Perfil)
      setCargandoPerfil(false)
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
    if (pagina === 'usuarios' && !puedeGestionarUsuarios(perfil?.rol)) return
    if (pagina === 'editar' && !puedeEditarPedido(perfil?.rol)) return

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

  const editarPedido = (id: string | number) => {
    if (!puedeEditarPedido(perfil?.rol)) return
    aplicarNavegacion('editar', null, id, 'detalle')
  }

  const volverDentroDeLaApp = (paginaRespaldo: string) => {
    if (nivelHistorial.current > 0) {
      window.history.back()
      return
    }

    aplicarNavegacion(paginaRespaldo, null, null, 'pedidos')
  }

  const cerrarSesion = async () => {
    await supabase.auth.signOut()
  }

  if (cargandoSesion || (sesion && cargandoPerfil)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FFF9F7]">
        <p className="font-medium text-[#756870]">Cargando Sweet Cakes...</p>
      </div>
    )
  }

  if (!sesion) return <Login />

  if (!perfil) {
    return (
      <PantallaAcceso
        titulo="No se pudo verificar tu acceso"
        mensaje={errorPerfil || 'Tu cuenta no tiene un perfil válido en Sweet Cakes.'}
        onCerrarSesion={cerrarSesion}
      />
    )
  }

  if (!perfil.activo) {
    return (
      <PantallaAcceso
        titulo="Cuenta desactivada"
        mensaje="El propietario desactivó esta cuenta. No puedes acceder a los pedidos hasta que vuelva a activarla."
        onCerrarSesion={cerrarSesion}
      />
    )
  }

  const paginaSidebar = paginaActual === 'pedidos-dia'
    ? paginaAnterior === 'calendario'
      ? 'calendario'
      : paginaAnterior === 'inicio'
        ? 'inicio'
        : 'pedidos'
    : paginaActual === 'editar'
      ? 'pedidos'
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
            rol={perfil.rol}
            onVolver={() => volverDentroDeLaApp(paginaAnterior === 'detalle' ? 'pedidos' : paginaAnterior)}
            onEditar={() => editarPedido(pedidoSeleccionado)}
          />
        )}

        {paginaActual === 'editar' && pedidoSeleccionado !== null && puedeEditarPedido(perfil.rol) && (
          <EditarPedido
            idPedido={pedidoSeleccionado}
            onVolver={() => volverDentroDeLaApp('detalle')}
            onGuardado={() => volverDentroDeLaApp('detalle')}
          />
        )}

        {paginaActual === 'editar' && pedidoSeleccionado !== null && !puedeEditarPedido(perfil.rol) && (
          <AccesoRestringido onVolver={() => volverDentroDeLaApp('detalle')} />
        )}

        {paginaActual === 'usuarios' && puedeGestionarUsuarios(perfil.rol) && <Usuarios />}
      </div>
    </div>
  )
}

function PantallaAcceso({ titulo, mensaje, onCerrarSesion }: { titulo: string; mensaje: string; onCerrarSesion: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FFF9F7] px-5">
      <section className="w-full max-w-md rounded-3xl border border-[#EEDDE3] bg-white p-6 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-[#5C3A4D]">{titulo}</h1>
        <p className="mt-3 text-sm leading-6 text-[#756870]">{mensaje}</p>
        <button type="button" onClick={onCerrarSesion} className="mt-6 min-h-12 w-full rounded-xl bg-[#EC3D7F] px-4 font-bold text-white hover:bg-[#D93470]">Cerrar sesión</button>
      </section>
    </main>
  )
}

function AccesoRestringido({ onVolver }: { onVolver: () => void }) {
  return (
    <main className="px-4 py-8 pb-28 sm:px-5 md:ml-20 md:p-8 lg:ml-64">
      <section className="mx-auto max-w-xl rounded-2xl border border-[#EEDDE3] bg-white p-6 text-center">
        <h2 className="text-xl font-bold text-[#5C3A4D]">Acción reservada</h2>
        <p className="mt-2 text-sm leading-6 text-[#756870]">Tu rol puede trabajar el pedido, cobrar y actualizar su estado, pero no editar sus datos administrativos.</p>
        <button type="button" onClick={onVolver} className="mt-5 min-h-11 rounded-xl bg-[#EC3D7F] px-5 font-semibold text-white">Volver al pedido</button>
      </section>
    </main>
  )
}

export default App
