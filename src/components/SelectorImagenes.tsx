import { useEffect, useMemo, useRef } from 'react'
import { Camera, Images, ImagePlus, X } from 'lucide-react'

import { validarImagen } from '../lib/imagenes'

type SelectorImagenesProps = {
  archivos: File[]
  onChange: (archivos: File[]) => void
  maximo?: number
  deshabilitado?: boolean
  onError?: (mensaje: string) => void
}

function SelectorImagenes({
  archivos,
  onChange,
  maximo = 5,
  deshabilitado = false,
  onError,
}: SelectorImagenesProps) {
  const inputGaleria = useRef<HTMLInputElement | null>(null)
  const inputCamara = useRef<HTMLInputElement | null>(null)
  const previews = useMemo(
    () => archivos.map((archivo) => ({ archivo, url: URL.createObjectURL(archivo) })),
    [archivos],
  )

  useEffect(() => () => previews.forEach(({ url }) => URL.revokeObjectURL(url)), [previews])

  const agregar = (nuevos: File[]) => {
    if (!nuevos.length) return

    const disponibles = Math.max(0, maximo - archivos.length)
    if (disponibles <= 0) {
      onError?.(`Puedes agregar como máximo ${maximo} imágenes por pedido.`)
      return
    }

    const validos: File[] = []
    for (const archivo of nuevos) {
      const error = validarImagen(archivo)
      if (error) {
        onError?.(`${archivo.name}: ${error}`)
        continue
      }

      const duplicada = [...archivos, ...validos].some(
        (actual) => actual.name === archivo.name && actual.size === archivo.size && actual.lastModified === archivo.lastModified,
      )
      if (!duplicada) validos.push(archivo)
    }

    if (validos.length > disponibles) {
      onError?.(`Solo quedan ${disponibles} espacio${disponibles === 1 ? '' : 's'} disponible${disponibles === 1 ? '' : 's'}.`)
    }

    onChange([...archivos, ...validos.slice(0, disponibles)])
  }

  const quitar = (indice: number) => onChange(archivos.filter((_, actual) => actual !== indice))

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={deshabilitado || archivos.length >= maximo}
          onClick={() => inputGaleria.current?.click()}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#E5D7DE] bg-white px-3 py-3 text-sm font-semibold text-[#5C3A4D] transition hover:bg-[#FFF7FA] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Images size={18} className="text-[#EC3D7F]" />
          Galería
        </button>

        <button
          type="button"
          disabled={deshabilitado || archivos.length >= maximo}
          onClick={() => inputCamara.current?.click()}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#EC3D7F] px-3 py-3 text-sm font-semibold text-white transition hover:bg-[#D93470] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Camera size={18} />
          Cámara
        </button>
      </div>

      <input
        ref={inputGaleria}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(evento) => {
          agregar(Array.from(evento.target.files ?? []))
          evento.currentTarget.value = ''
        }}
      />

      <input
        ref={inputCamara}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={(evento) => {
          agregar(Array.from(evento.target.files ?? []))
          evento.currentTarget.value = ''
        }}
      />

      {previews.length > 0 ? (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {previews.map(({ archivo, url }, indice) => (
            <div key={`${archivo.name}-${archivo.lastModified}-${indice}`} className="relative aspect-square overflow-hidden rounded-xl border border-[#EEDDE3] bg-[#FFF9F7]">
              <img src={url} alt={`Nueva referencia ${indice + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => quitar(indice)}
                aria-label={`Quitar imagen ${indice + 1}`}
                className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-[#D93470] shadow-sm"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 flex min-h-28 items-center justify-center rounded-2xl border-2 border-dashed border-[#DFC9D2] bg-[#FFFDFC] px-4 text-center">
          <div>
            <ImagePlus size={30} className="mx-auto text-[#C98AA4]" />
            <p className="mt-2 text-sm font-semibold text-[#5C3A4D]">Sin imágenes nuevas</p>
          </div>
        </div>
      )}

      <p className="mt-2 text-center text-[11px] leading-4 text-[#9A8B93]">
        {archivos.length}/{maximo} seleccionadas · JPG, PNG o WEBP · originales de hasta 20 MB · Sweet Cakes comprime cada imagen antes de subirla.
      </p>
    </div>
  )
}

export default SelectorImagenes
