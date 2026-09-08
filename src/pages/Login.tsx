import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

function Login() {
  const [usuario, setUsuario] = useState('')
  const [contrasena, setContrasena] = useState('')
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
    <main className="flex min-h-screen items-center justify-center bg-[#FFF9F7] px-5">

      <div className="w-full max-w-md">

        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-[#5C3A4D]">
            Sweet Cakes
          </h1>

          <p className="mt-2 text-sm text-[#756870]">
            Agenda de encargos
          </p>
        </div>

        <section className="rounded-2xl border border-[#EEDDE3] bg-white p-7 shadow-sm">

          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-[#5C3A4D]">
              Iniciar sesión
            </h2>

            <p className="mt-1 text-sm text-[#756870]">
              Ingresa con tu usuario de Sweet Cakes.
            </p>
          </div>

          <form
            onSubmit={iniciarSesion}
            className="space-y-5"
          >

            <div>
              <label
                htmlFor="usuario"
                className="mb-2 block text-sm font-medium text-[#5C3A4D]"
              >
                Usuario
              </label>

              <input
                id="usuario"
                type="text"
                value={usuario}
                onChange={(evento) =>
                  setUsuario(evento.target.value)
                }
                placeholder="Ej. luis"
                autoComplete="username"
                className="w-full rounded-xl border border-[#E5D7DE] bg-[#FFFDFC] px-4 py-3 text-[#5C3A4D] outline-none transition placeholder:text-[#B7AAB0] focus:border-[#EC3D7F]"
              />
            </div>

            <div>
              <label
                htmlFor="contrasena"
                className="mb-2 block text-sm font-medium text-[#5C3A4D]"
              >
                Contraseña
              </label>

              <input
                id="contrasena"
                type="password"
                value={contrasena}
                onChange={(evento) =>
                  setContrasena(evento.target.value)
                }
                placeholder="Ingresa tu contraseña"
                autoComplete="current-password"
                className="w-full rounded-xl border border-[#E5D7DE] bg-[#FFFDFC] px-4 py-3 text-[#5C3A4D] outline-none transition placeholder:text-[#B7AAB0] focus:border-[#EC3D7F]"
              />
            </div>

            {mensajeError && (
              <div className="rounded-xl bg-[#FCE5ED] px-4 py-3 text-sm font-medium text-[#D93470]">
                {mensajeError}
              </div>
            )}

            <button
              type="submit"
              disabled={iniciandoSesion}
              className="w-full rounded-xl bg-[#EC3D7F] px-6 py-3 font-semibold text-white transition hover:bg-[#D93470] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {iniciandoSesion
                ? 'Iniciando sesión...'
                : 'Iniciar sesión'}
            </button>

          </form>

        </section>

      </div>

    </main>
  )
}

export default Login