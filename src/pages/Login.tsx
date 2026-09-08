import { useState, type FormEvent } from 'react'
import {
  ArrowRight,
  CalendarDays,
  CircleAlert,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react'

import sweetCakesLogo from '../assets/sweet-cakes-logo.jpeg'
import { supabase } from '../lib/supabase'

function Login() {
  const [usuario, setUsuario] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [mostrarContrasena, setMostrarContrasena] = useState(false)
  const [mensajeError, setMensajeError] = useState('')
  const [iniciandoSesion, setIniciandoSesion] = useState(false)

  const iniciarSesion = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    setMensajeError('')

    const usuarioLimpio = usuario.trim().toLowerCase()

    if (usuarioLimpio === '') {
      setMensajeError('Ingresa tu usuario.')
      return
    }

    if (contrasena === '') {
      setMensajeError('Ingresa tu contraseña.')
      return
    }

    setIniciandoSesion(true)
    const emailInterno = `${usuarioLimpio}@sweetcakes.test`

    const { error } = await supabase.auth.signInWithPassword({
      email: emailInterno,
      password: contrasena,
    })

    setIniciandoSesion(false)

    if (error) {
      setMensajeError('Usuario o contraseña incorrectos.')
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#FFF9F7]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#F9C7D9]/40 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -right-16 h-80 w-80 rounded-full bg-[#F4D9E3]/60 blur-3xl"
      />

      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden items-center px-12 py-12 lg:flex xl:px-16">
          <div className="w-full max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#EBCDD8] bg-white/70 px-4 py-2 text-sm font-semibold text-[#A94A70] shadow-sm backdrop-blur">
              <Sparkles size={16} strokeWidth={2.2} />
              Agenda de encargos
            </div>

            <div className="mt-8 flex items-center gap-5">
              <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-[2rem] border border-[#F0DCE3] bg-white p-3 shadow-[0_18px_50px_rgba(92,58,77,0.10)]">
                <img
                  src={sweetCakesLogo}
                  alt="Logo de Sweet Cakes"
                  className="max-h-full max-w-full object-contain"
                />
              </div>

              <div>
                <p className="text-3xl font-bold tracking-tight text-[#5C3A4D]">
                  Sweet Cakes
                </p>
                <p className="mt-1 text-sm font-medium text-[#8A7480]">
                  Pedidos organizados, entregas bajo control.
                </p>
              </div>
            </div>

            <h1 className="mt-10 max-w-lg text-5xl font-bold leading-[1.08] tracking-[-0.035em] text-[#5C3A4D]">
              Tu agenda dulce,
              <span className="text-[#EC3D7F]"> clara de principio a fin.</span>
            </h1>

            <p className="mt-5 max-w-lg text-base leading-7 text-[#756870]">
              Centraliza los encargos de Sweet Cakes, revisa próximas entregas y
              mantén cada pedido en su lugar desde una sola pantalla.
            </p>

            <div className="mt-9 grid max-w-lg grid-cols-2 gap-4">
              <div className="rounded-2xl border border-[#EEDDE3] bg-white/75 p-4 shadow-sm backdrop-blur">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FCE5ED] text-[#D93470]">
                  <CalendarDays size={20} />
                </div>
                <p className="mt-3 font-semibold text-[#5C3A4D]">
                  Todo en agenda
                </p>
                <p className="mt-1 text-sm leading-5 text-[#8A7480]">
                  Pedidos y entregas siempre a la vista.
                </p>
              </div>

              <div className="rounded-2xl border border-[#EEDDE3] bg-white/75 p-4 shadow-sm backdrop-blur">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FCE5ED] text-[#D93470]">
                  <ShieldCheck size={20} />
                </div>
                <p className="mt-3 font-semibold text-[#5C3A4D]">
                  Acceso privado
                </p>
                <p className="mt-1 text-sm leading-5 text-[#8A7480]">
                  Solo para el equipo autorizado.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-8 lg:px-10">
          <div className="w-full max-w-md">
            <div className="mb-7 flex items-center justify-center gap-3 lg:hidden">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#F0DCE3] bg-white p-2 shadow-sm">
                <img
                  src={sweetCakesLogo}
                  alt="Logo de Sweet Cakes"
                  className="max-h-full max-w-full object-contain"
                />
              </div>

              <div>
                <p className="text-xl font-bold text-[#5C3A4D]">Sweet Cakes</p>
                <p className="text-xs font-medium text-[#8A7480]">
                  Agenda de encargos
                </p>
              </div>
            </div>

            <section className="rounded-[2rem] border border-[#EEDDE3] bg-white/95 p-6 shadow-[0_24px_70px_rgba(92,58,77,0.12)] backdrop-blur sm:p-8">
              <div className="mb-7">
                <span className="inline-flex items-center gap-2 rounded-full bg-[#FFF0F5] px-3 py-1.5 text-xs font-semibold text-[#C83A6F]">
                  <LockKeyhole size={14} />
                  Acceso al equipo
                </span>

                <h2 className="mt-4 text-3xl font-bold tracking-tight text-[#5C3A4D]">
                  Bienvenido
                </h2>

                <p className="mt-2 text-sm leading-6 text-[#756870]">
                  Ingresa tus credenciales para acceder a la agenda de Sweet
                  Cakes.
                </p>
              </div>

              <form onSubmit={iniciarSesion} className="space-y-5">
                <div>
                  <label
                    htmlFor="usuario"
                    className="mb-2 block text-sm font-semibold text-[#5C3A4D]"
                  >
                    Usuario
                  </label>

                  <div className="relative">
                    <UserRound
                      aria-hidden="true"
                      size={19}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#A9929D]"
                    />

                    <input
                      id="usuario"
                      type="text"
                      value={usuario}
                      onChange={(evento) => setUsuario(evento.target.value)}
                      placeholder="Ej. luis"
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      className="w-full rounded-xl border border-[#E5D7DE] bg-[#FFFDFC] py-3.5 pl-11 pr-4 text-[#5C3A4D] outline-none transition placeholder:text-[#B7AAB0] hover:border-[#DDBFCB] focus:border-[#EC3D7F] focus:ring-4 focus:ring-[#EC3D7F]/10"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="contrasena"
                    className="mb-2 block text-sm font-semibold text-[#5C3A4D]"
                  >
                    Contraseña
                  </label>

                  <div className="relative">
                    <LockKeyhole
                      aria-hidden="true"
                      size={19}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#A9929D]"
                    />

                    <input
                      id="contrasena"
                      type={mostrarContrasena ? 'text' : 'password'}
                      value={contrasena}
                      onChange={(evento) => setContrasena(evento.target.value)}
                      placeholder="Ingresa tu contraseña"
                      autoComplete="current-password"
                      className="w-full rounded-xl border border-[#E5D7DE] bg-[#FFFDFC] py-3.5 pl-11 pr-12 text-[#5C3A4D] outline-none transition placeholder:text-[#B7AAB0] hover:border-[#DDBFCB] focus:border-[#EC3D7F] focus:ring-4 focus:ring-[#EC3D7F]/10"
                    />

                    <button
                      type="button"
                      onClick={() => setMostrarContrasena((valor) => !valor)}
                      aria-label={
                        mostrarContrasena
                          ? 'Ocultar contraseña'
                          : 'Mostrar contraseña'
                      }
                      className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#A9929D] transition hover:bg-[#FCE5ED] hover:text-[#D93470] focus:outline-none focus:ring-2 focus:ring-[#EC3D7F]/20"
                    >
                      {mostrarContrasena ? (
                        <EyeOff size={19} />
                      ) : (
                        <Eye size={19} />
                      )}
                    </button>
                  </div>
                </div>

                {mensajeError && (
                  <div
                    role="alert"
                    className="flex items-start gap-3 rounded-xl border border-[#F7C9DA] bg-[#FFF0F5] px-4 py-3 text-sm font-medium text-[#C72F67]"
                  >
                    <CircleAlert
                      size={18}
                      className="mt-0.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{mensajeError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={iniciandoSesion}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#EC3D7F] px-6 py-3.5 font-semibold text-white shadow-[0_12px_24px_rgba(236,61,127,0.22)] transition hover:bg-[#D93470] hover:shadow-[0_14px_28px_rgba(217,52,112,0.26)] focus:outline-none focus:ring-4 focus:ring-[#EC3D7F]/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {iniciandoSesion ? (
                    <>
                      <LoaderCircle
                        size={19}
                        className="animate-spin"
                        aria-hidden="true"
                      />
                      Iniciando sesión...
                    </>
                  ) : (
                    <>
                      Iniciar sesión
                      <ArrowRight
                        size={19}
                        className="transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-7 border-t border-[#F0E4E8] pt-5 text-center">
                <p className="text-xs leading-5 text-[#9A858F]">
                  Acceso de uso interno para el equipo de Sweet Cakes.
                </p>
              </div>
            </section>

            <p className="mt-5 text-center text-xs text-[#A18C96]">
              Sweet Cakes · Agenda digital de encargos
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}

export default Login
