import type { Encargo } from '../types/encargo'
import { fechaISOADate, formatearHora, obtenerPago } from '../types/encargo'

type DatosHojaEncargo = {
  pedido: Encargo
  imagenes: string[]
  logoUrl: string
}

type VentanaConSelectorArchivo = Window & {
  showSaveFilePicker?: (opciones?: {
    suggestedName?: string
    types?: Array<{
      description?: string
      accept: Record<string, string[]>
    }>
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>
      close: () => Promise<void>
    }>
  }>
}

const ANCHO_PDF_PX = 816
const ALTO_PDF_PX = 1056

const escaparHtml = (valor: unknown) => String(valor ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

const textoOGuion = (valor: string | null | undefined) => {
  const limpio = valor?.trim()
  return escaparHtml(limpio || 'No registrado')
}

const valorPlano = (valor: string | null | undefined) => valor?.trim() || 'No registrado'

const identificadorPedido = (id: string | number) => {
  const valor = String(id)
  if (/^\d+$/.test(valor)) return `SC-${valor}`
  const compacto = valor.replaceAll('-', '').toUpperCase()
  return `SC-${compacto.slice(-8)}`
}

const formatearFechaImpresion = (fecha: Date) => new Intl.DateTimeFormat('es-SV', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
}).format(fecha)

const fechaArchivo = (fecha: Date) => {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

const generarBloqueImagenes = (imagenes: string[]) => {
  if (!imagenes.length) {
    return '<div class="sin-imagenes">Sin imágenes de referencia.</div>'
  }

  const clase = imagenes.length === 1 ? 'imagenes una' : 'imagenes varias'
  const elementos = imagenes.map((url, indice) => `
    <figure class="referencia">
      <img src="${escaparHtml(url)}" alt="Referencia ${indice + 1}">
      ${imagenes.length > 1 ? `<figcaption>Ref. ${indice + 1}</figcaption>` : ''}
    </figure>
  `).join('')

  return `<div class="${clase}">${elementos}</div>`
}

const blobADataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const lector = new FileReader()
  lector.onload = () => resolve(String(lector.result))
  lector.onerror = () => reject(lector.error ?? new Error('No se pudo leer la imagen.'))
  lector.readAsDataURL(blob)
})

const convertirImagenADataUrl = async (url: string) => {
  if (url.startsWith('data:')) return url
  const respuesta = await fetch(url)
  if (!respuesta.ok) throw new Error(`No se pudo cargar una imagen (${respuesta.status}).`)
  return blobADataUrl(await respuesta.blob())
}

const cargarImagen = async (url: string) => {
  const dataUrl = await convertirImagenADataUrl(url)
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const imagen = new Image()
    imagen.onload = () => resolve(imagen)
    imagen.onerror = () => reject(new Error('No se pudo preparar una imagen para el PDF.'))
    imagen.src = dataUrl
  })
}

const crearPdfUnaPagina = (jpeg: Uint8Array, anchoImagen: number, altoImagen: number) => {
  const codificador = new TextEncoder()
  const partes: Uint8Array[] = []
  const offsets: number[] = [0]
  let posicion = 0

  const agregarBytes = (bytes: Uint8Array) => {
    partes.push(bytes)
    posicion += bytes.length
  }

  const agregarTexto = (texto: string) => agregarBytes(codificador.encode(texto))

  agregarTexto('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n')

  const objetoTexto = (numero: number, contenido: string) => {
    offsets[numero] = posicion
    agregarTexto(`${numero} 0 obj\n${contenido}\nendobj\n`)
  }

  objetoTexto(1, '<< /Type /Catalog /Pages 2 0 R >>')
  objetoTexto(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  objetoTexto(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>')

  offsets[4] = posicion
  agregarTexto(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${anchoImagen} /Height ${altoImagen} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`)
  agregarBytes(jpeg)
  agregarTexto('\nendstream\nendobj\n')

  const contenido = 'q\n612 0 0 792 0 0 cm\n/Im0 Do\nQ\n'
  const contenidoBytes = codificador.encode(contenido)
  offsets[5] = posicion
  agregarTexto(`5 0 obj\n<< /Length ${contenidoBytes.length} >>\nstream\n`)
  agregarBytes(contenidoBytes)
  agregarTexto('endstream\nendobj\n')

  const inicioXref = posicion
  agregarTexto('xref\n0 6\n0000000000 65535 f \n')
  for (let numero = 1; numero <= 5; numero += 1) {
    agregarTexto(`${String(offsets[numero]).padStart(10, '0')} 00000 n \n`)
  }
  agregarTexto(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF`)

  const totalBytes = partes.reduce((total, parte) => total + parte.length, 0)
  const pdfBytes = new Uint8Array(totalBytes)
  let cursor = 0
  for (const parte of partes) {
    pdfBytes.set(parte, cursor)
    cursor += parte.length
  }

  return new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' })
}

const redondearRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  ancho: number,
  alto: number,
  radio: number,
) => {
  const r = Math.min(radio, ancho / 2, alto / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + ancho, y, x + ancho, y + alto, r)
  ctx.arcTo(x + ancho, y + alto, x, y + alto, r)
  ctx.arcTo(x, y + alto, x, y, r)
  ctx.arcTo(x, y, x + ancho, y, r)
  ctx.closePath()
}

const partirTexto = (ctx: CanvasRenderingContext2D, texto: string, anchoMaximo: number) => {
  const palabras = texto.split(/\s+/).filter(Boolean)
  if (!palabras.length) return ['']

  const lineas: string[] = []
  let actual = palabras[0]

  for (let i = 1; i < palabras.length; i += 1) {
    const candidato = `${actual} ${palabras[i]}`
    if (ctx.measureText(candidato).width <= anchoMaximo) actual = candidato
    else {
      lineas.push(actual)
      actual = palabras[i]
    }
  }

  lineas.push(actual)
  return lineas
}

const dibujarImagenContain = (
  ctx: CanvasRenderingContext2D,
  imagen: HTMLImageElement,
  x: number,
  y: number,
  ancho: number,
  alto: number,
) => {
  const proporcion = Math.min(ancho / imagen.naturalWidth, alto / imagen.naturalHeight)
  const w = imagen.naturalWidth * proporcion
  const h = imagen.naturalHeight * proporcion
  ctx.drawImage(imagen, x + (ancho - w) / 2, y + (alto - h) / 2, w, h)
}

const bytesDesdeDataUrl = (dataUrl: string) => {
  const base64 = dataUrl.split(',')[1]
  const binario = atob(base64)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i)
  return bytes
}

const generarPdfDesdeDatos = async ({ pedido, imagenes, logoUrl }: DatosHojaEncargo) => {
  const escala = 2
  const canvas = document.createElement('canvas')
  canvas.width = ANCHO_PDF_PX * escala
  canvas.height = ALTO_PDF_PX * escala

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo preparar el PDF en este dispositivo.')

  ctx.scale(escala, escala)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, ANCHO_PDF_PX, ALTO_PDF_PX)

  const colorTexto = '#3f2b35'
  const colorSuave = '#8a7480'
  const colorBorde = '#e6dce1'
  const colorAcento = '#5c3a4d'
  const colorFondo = '#fbf7f9'
  const margen = 42
  const anchoUtil = ANCHO_PDF_PX - margen * 2
  let y = 36

  const pago = obtenerPago(pedido)
  const fechaEntrega = fechaISOADate(pedido.fecha_entrega).toLocaleDateString('es-SV', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const impresoEl = formatearFechaImpresion(new Date())
  const estadoPago = pago.saldo <= 0.005 ? 'Pagado' : pago.abono > 0 ? 'Pago parcial' : 'Pendiente de pago'
  const folio = identificadorPedido(pedido.id)

  let logo: HTMLImageElement | null = null
  try { logo = await cargarImagen(logoUrl) } catch (error) { console.warn('Logo no disponible en PDF:', error) }

  const imagenesCargadas: Array<HTMLImageElement | null> = []
  for (const url of imagenes.slice(0, 5)) {
    try { imagenesCargadas.push(await cargarImagen(url)) }
    catch (error) {
      console.warn('Referencia no disponible en PDF:', error)
      imagenesCargadas.push(null)
    }
  }

  if (logo) dibujarImagenContain(ctx, logo, margen, y, 66, 66)

  ctx.fillStyle = colorTexto
  ctx.font = '700 29px Arial, Helvetica, sans-serif'
  ctx.fillText('SWEET CAKES', margen + 82, y + 28)
  ctx.fillStyle = colorSuave
  ctx.font = '700 13px Arial, Helvetica, sans-serif'
  ctx.fillText('HOJA DE ENCARGO · PRODUCCIÓN', margen + 82, y + 50)

  ctx.textAlign = 'right'
  ctx.fillStyle = colorTexto
  ctx.font = '700 16px Arial, Helvetica, sans-serif'
  ctx.fillText(folio, ANCHO_PDF_PX - margen, y + 24)
  ctx.fillStyle = colorSuave
  ctx.font = '11px Arial, Helvetica, sans-serif'
  ctx.fillText(`Impreso el: ${impresoEl}`, ANCHO_PDF_PX - margen, y + 46)
  ctx.textAlign = 'left'

  y += 78
  ctx.strokeStyle = colorAcento
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(margen, y)
  ctx.lineTo(ANCHO_PDF_PX - margen, y)
  ctx.stroke()
  y += 23

  const titulo = (texto: string) => {
    ctx.fillStyle = '#8a6577'
    ctx.font = '700 13px Arial, Helvetica, sans-serif'
    ctx.fillText(texto.toUpperCase(), margen, y)
    y += 12
  }

  const campo = (x: number, yy: number, w: number, h: number, etiqueta: string, valor: string, valorFont = 14) => {
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = colorBorde
    ctx.lineWidth = 1
    redondearRect(ctx, x, yy, w, h, 8)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = colorSuave
    ctx.font = '700 10px Arial, Helvetica, sans-serif'
    ctx.fillText(etiqueta.toUpperCase(), x + 10, yy + 16)

    ctx.fillStyle = colorTexto
    ctx.font = `700 ${valorFont}px Arial, Helvetica, sans-serif`
    const lineas = partirTexto(ctx, valor, w - 20)
    lineas.slice(0, 3).forEach((linea, indice) => ctx.fillText(linea, x + 10, yy + 36 + indice * (valorFont + 3)))
  }

  titulo('Cliente y entrega')
  const gap = 8
  const dos = (anchoUtil - gap) / 2
  campo(margen, y, dos, 58, 'Cliente', valorPlano(pedido.nombre_cliente))
  campo(margen + dos + gap, y, dos, 58, 'Teléfono', valorPlano(pedido.telefono))
  y += 66
  campo(margen, y, dos, 62, 'Fecha de entrega', fechaEntrega, 13)
  campo(margen + dos + gap, y, dos, 62, 'Hora de entrega', formatearHora(pedido.hora_entrega))
  y += 82

  titulo('Detalles del pastel')
  const tres = (anchoUtil - gap * 2) / 3
  campo(margen, y, tres, 62, 'Sabor de torta', valorPlano(pedido.sabor_torta), 13)
  campo(margen + tres + gap, y, tres, 62, 'Sabor de relleno', valorPlano(pedido.sabor_relleno), 12)
  campo(margen + (tres + gap) * 2, y, tres, 62, 'Chantilly', valorPlano(pedido.chantilly), 13)
  y += 82

  titulo('Indicaciones')
  const textoBox = (etiqueta: string, valor: string, altura: number, tamano = 13) => {
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = colorBorde
    redondearRect(ctx, margen, y, anchoUtil, altura, 8)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = colorSuave
    ctx.font = '700 10px Arial, Helvetica, sans-serif'
    ctx.fillText(etiqueta.toUpperCase(), margen + 10, y + 16)
    ctx.fillStyle = colorTexto
    ctx.font = `${tamano}px Arial, Helvetica, sans-serif`
    const lineas = partirTexto(ctx, valor, anchoUtil - 20)
    lineas.slice(0, 5).forEach((linea, indice) => ctx.fillText(linea, margen + 10, y + 36 + indice * (tamano + 3)))
    y += altura + 7
  }

  textoBox('Dedicatoria', valorPlano(pedido.dedicatoria), 54, 13)
  textoBox('Observaciones', valorPlano(pedido.observaciones), 76, 12)
  y += 10

  titulo('Imágenes de referencia')
  const altoImagenes = imagenesCargadas.length <= 1 ? 190 : 118
  ctx.fillStyle = '#faf7f8'
  ctx.strokeStyle = colorBorde
  redondearRect(ctx, margen, y, anchoUtil, altoImagenes, 8)
  ctx.fill()
  ctx.stroke()

  if (!imagenesCargadas.length) {
    ctx.fillStyle = colorSuave
    ctx.font = '12px Arial, Helvetica, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Sin imágenes de referencia.', ANCHO_PDF_PX / 2, y + altoImagenes / 2)
    ctx.textAlign = 'left'
  } else if (imagenesCargadas.length === 1) {
    const imagen = imagenesCargadas[0]
    if (imagen) dibujarImagenContain(ctx, imagen, margen + 12, y + 10, anchoUtil - 24, altoImagenes - 20)
  } else {
    const n = imagenesCargadas.length
    const gapImg = 5
    const w = (anchoUtil - 20 - gapImg * (n - 1)) / n
    imagenesCargadas.forEach((imagen, indice) => {
      const x = margen + 10 + indice * (w + gapImg)
      if (imagen) dibujarImagenContain(ctx, imagen, x, y + 8, w, altoImagenes - 16)
    })
  }
  y += altoImagenes + 24

  titulo('Pago y estado')
  const cuatro = (anchoUtil - gap * 3) / 4
  const finanzas = [
    ['Precio actual', `$${pago.total.toFixed(2)}`],
    ['Total pagado', `$${pago.abono.toFixed(2)}`],
    ['Saldo pendiente', `$${pago.saldo.toFixed(2)}`],
    ['Estado de pago', estadoPago],
  ] as const

  finanzas.forEach(([etiqueta, valor], indice) => {
    const x = margen + indice * (cuatro + gap)
    ctx.fillStyle = colorFondo
    ctx.strokeStyle = colorBorde
    redondearRect(ctx, x, y, cuatro, 58, 8)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = colorSuave
    ctx.font = '700 9px Arial, Helvetica, sans-serif'
    ctx.fillText(etiqueta.toUpperCase(), x + 8, y + 16)
    ctx.fillStyle = colorTexto
    ctx.font = '700 13px Arial, Helvetica, sans-serif'
    const lineas = partirTexto(ctx, valor, cuatro - 16)
    lineas.slice(0, 2).forEach((linea, idx) => ctx.fillText(linea, x + 8, y + 37 + idx * 15))
  })

  y += 70
  ctx.fillStyle = '#f3eaf0'
  redondearRect(ctx, margen, y, 190, 28, 14)
  ctx.fill()
  ctx.fillStyle = colorAcento
  ctx.font = '700 11px Arial, Helvetica, sans-serif'
  ctx.fillText(`PEDIDO: ${String(pedido.estado_pedido).toUpperCase()}`, margen + 12, y + 18)

  const yPie = ALTO_PDF_PX - 32
  ctx.strokeStyle = colorBorde
  ctx.beginPath()
  ctx.moveTo(margen, yPie - 10)
  ctx.lineTo(ANCHO_PDF_PX - margen, yPie - 10)
  ctx.stroke()
  ctx.fillStyle = colorSuave
  ctx.font = '9px Arial, Helvetica, sans-serif'
  ctx.fillText('Sweet Cakes · Hoja interna de producción', margen, yPie)
  ctx.textAlign = 'right'
  ctx.fillText(folio, ANCHO_PDF_PX - margen, yPie)
  ctx.textAlign = 'left'

  const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
  const jpeg = bytesDesdeDataUrl(dataUrl)
  return crearPdfUnaPagina(jpeg, canvas.width, canvas.height)
}

const guardarBlob = async (ventana: Window, blob: Blob, nombre: string) => {
  const ventanaConSelector = ventana as VentanaConSelectorArchivo

  if (ventanaConSelector.showSaveFilePicker) {
    try {
      const archivo = await ventanaConSelector.showSaveFilePicker({
        suggestedName: nombre,
        types: [{ description: 'Documento PDF', accept: { 'application/pdf': ['.pdf'] } }],
      })
      const escritura = await archivo.createWritable()
      await escritura.write(blob)
      await escritura.close()
      return
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      console.warn('No se pudo usar el selector de archivos; se usará descarga normal.', error)
    }
  }

  const url = URL.createObjectURL(blob)
  const enlace = ventana.document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  enlace.rel = 'noopener'
  enlace.style.display = 'none'
  ventana.document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  ventana.setTimeout(() => URL.revokeObjectURL(url), 4000)
}

const ESTILOS_HOJA = `
  :root { font-family: Arial, Helvetica, sans-serif; color: #3f2b35; background: #f5f1f3; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f5f1f3; }
  .acciones { position: sticky; top: 0; z-index: 10; display: flex; justify-content: center; flex-wrap: wrap; gap: 8px; padding: 12px; background: rgba(255,255,255,.97); border-bottom: 1px solid #e6dce1; }
  .acciones button { border: 0; border-radius: 10px; padding: 11px 16px; font-size: 14px; font-weight: 700; cursor: pointer; background: #ec3d7f; color: white; }
  .acciones button.pdf { background: #6f4c69; }
  .acciones button.secundario { background: white; color: #5c3a4d; border: 1px solid #dfd3d9; }
  .acciones button:disabled { opacity: .65; cursor: wait; }
  .hoja { width: 216mm; min-height: 279mm; margin: 16px auto; padding: 10mm; background: white; box-shadow: 0 10px 30px rgba(74, 50, 62, .12); }
  .cabecera { display: grid; grid-template-columns: 68px 1fr auto; gap: 12px; align-items: center; padding-bottom: 10px; border-bottom: 2px solid #5c3a4d; }
  .logo { width: 64px; height: 64px; object-fit: contain; border-radius: 11px; }
  h1 { margin: 0; font-size: 24px; letter-spacing: .04em; }
  .subtitulo { margin: 4px 0 0; color: #8a7480; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
  .folio { text-align: right; }
  .folio strong { display: block; font-size: 15px; }
  .folio span { display: block; margin-top: 4px; color: #7d6b74; font-size: 10px; }
  .seccion { margin-top: 11px; break-inside: avoid; }
  .titulo-seccion { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #8a6577; }
  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
  .grid.tres { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .campo { border: 1px solid #eadfe4; border-radius: 7px; padding: 7px 9px; min-height: 46px; }
  .campo .etiqueta { color: #8f7d86; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
  .campo .valor { margin-top: 3px; font-size: 12px; font-weight: 700; line-height: 1.3; white-space: pre-wrap; }
  .texto { border: 1px solid #eadfe4; border-radius: 7px; padding: 7px 9px; min-height: 45px; }
  .texto + .texto { margin-top: 6px; }
  .texto .etiqueta { color: #8f7d86; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
  .texto .valor { margin-top: 4px; font-size: 11px; line-height: 1.35; white-space: pre-wrap; }
  .imagenes { display: grid; gap: 6px; }
  .imagenes.una { grid-template-columns: minmax(0, 1fr); }
  .imagenes.varias { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .referencia { margin: 0; border: 1px solid #eadfe4; border-radius: 7px; overflow: hidden; background: #faf7f8; break-inside: avoid; }
  .referencia img { display: block; width: 100%; height: 92px; object-fit: contain; }
  .imagenes.una .referencia { max-width: 320px; margin-inline: auto; width: 100%; }
  .imagenes.una .referencia img { height: 155px; }
  .referencia figcaption { padding: 3px 5px; border-top: 1px solid #eadfe4; color: #8f7d86; font-size: 8px; font-weight: 700; text-align: center; }
  .sin-imagenes { border: 1px dashed #d9c7cf; border-radius: 7px; padding: 12px; color: #8f7d86; text-align: center; font-size: 10px; }
  .finanzas { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
  .finanza { border-radius: 7px; padding: 7px 9px; background: #fbf7f9; border: 1px solid #eadfe4; }
  .finanza .etiqueta { color: #8f7d86; font-size: 8px; font-weight: 700; text-transform: uppercase; }
  .finanza .valor { margin-top: 3px; font-size: 12px; font-weight: 800; }
  .estado { display: inline-block; padding: 4px 8px; border-radius: 999px; background: #f3eaf0; color: #6f4c69; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; }
  .pie { margin-top: 10px; padding-top: 6px; border-top: 1px solid #eadfe4; display: flex; justify-content: space-between; gap: 12px; color: #8f7d86; font-size: 8px; }

  @page { size: Letter; margin: 7mm; }
  @media print {
    body { background: white; }
    .acciones { display: none !important; }
    .hoja { width: auto; min-height: auto; margin: 0; padding: 0; box-shadow: none; }
    .cabecera { grid-template-columns: 58px 1fr auto; gap: 10px; padding-bottom: 8px; }
    .logo { width: 54px; height: 54px; }
    h1 { font-size: 22px; }
    .subtitulo { font-size: 10px; }
    .folio strong { font-size: 14px; }
    .folio span { font-size: 9px; }
    .seccion { margin-top: 8px; }
    .titulo-seccion { margin-bottom: 4px; font-size: 10.5px; }
    .grid { gap: 4px; }
    .campo { padding: 6px 8px; min-height: 42px; border-radius: 5px; }
    .campo .etiqueta, .texto .etiqueta { font-size: 8.5px; }
    .campo .valor { margin-top: 2px; font-size: 11px; line-height: 1.22; }
    .texto { padding: 6px 8px; min-height: 39px; border-radius: 5px; }
    .texto + .texto { margin-top: 4px; }
    .texto .valor { margin-top: 3px; font-size: 10.5px; line-height: 1.28; }
    .imagenes { gap: 4px; }
    .imagenes.una .referencia { max-width: 285px; }
    .imagenes.una .referencia img { height: 145px; }
    .imagenes.varias { grid-template-columns: repeat(5, minmax(0, 1fr)); }
    .referencia img { height: 84px; }
    .referencia figcaption { padding: 2px; font-size: 7px; }
    .sin-imagenes { padding: 8px; font-size: 9px; }
    .finanzas { gap: 4px; }
    .finanza { padding: 6px 8px; border-radius: 5px; }
    .finanza .etiqueta { font-size: 7.5px; }
    .finanza .valor { margin-top: 2px; font-size: 11px; }
    .estado { padding: 3px 7px; font-size: 8.5px; }
    .pie { margin-top: 7px; padding-top: 4px; font-size: 7.5px; }
  }

  @media (max-width: 760px) {
    .hoja { width: calc(100% - 16px); min-height: auto; margin: 8px; padding: 14px; }
    .cabecera { grid-template-columns: 58px 1fr; }
    .logo { width: 54px; height: 54px; }
    .folio { grid-column: 1 / -1; text-align: left; }
    .grid, .grid.tres, .finanzas { grid-template-columns: 1fr 1fr; }
    .imagenes.varias { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
`

export const imprimirHojaEncargo = ({ pedido, imagenes, logoUrl }: DatosHojaEncargo) => {
  const ventana = window.open('', '_blank')

  if (!ventana) {
    throw new Error('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para Sweet Cakes e inténtalo otra vez.')
  }

  const pago = obtenerPago(pedido)
  const fechaEntrega = fechaISOADate(pedido.fecha_entrega).toLocaleDateString('es-SV', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const fechaImpresion = new Date()
  const impresoEl = formatearFechaImpresion(fechaImpresion)
  const estadoPago = pago.saldo <= 0.005 ? 'Pagado' : pago.abono > 0 ? 'Pago parcial' : 'Pendiente de pago'
  const folio = identificadorPedido(pedido.id)
  const nombrePdf = `SweetCakes-${folio}-${fechaArchivo(fechaImpresion)}.pdf`

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hoja de encargo ${escaparHtml(folio)}</title>
  <style>${ESTILOS_HOJA}</style>
</head>
<body>
  <div class="acciones">
    <button id="btn-imprimir" type="button">Imprimir</button>
    <button id="btn-pdf" class="pdf" type="button">Guardar PDF</button>
    <button id="btn-cerrar" class="secundario" type="button">Cerrar</button>
  </div>

  <article class="hoja" id="hoja-encargo">
    <header class="cabecera">
      <img class="logo" src="${escaparHtml(logoUrl)}" alt="Sweet Cakes">
      <div>
        <h1>SWEET CAKES</h1>
        <p class="subtitulo">Hoja de encargo · Producción</p>
      </div>
      <div class="folio">
        <strong>${escaparHtml(folio)}</strong>
        <span>Impreso el: ${escaparHtml(impresoEl)}</span>
      </div>
    </header>

    <section class="seccion">
      <h2 class="titulo-seccion">Cliente y entrega</h2>
      <div class="grid">
        <div class="campo"><div class="etiqueta">Cliente</div><div class="valor">${textoOGuion(pedido.nombre_cliente)}</div></div>
        <div class="campo"><div class="etiqueta">Teléfono</div><div class="valor">${textoOGuion(pedido.telefono)}</div></div>
        <div class="campo"><div class="etiqueta">Fecha de entrega</div><div class="valor">${escaparHtml(fechaEntrega)}</div></div>
        <div class="campo"><div class="etiqueta">Hora de entrega</div><div class="valor">${escaparHtml(formatearHora(pedido.hora_entrega))}</div></div>
      </div>
    </section>

    <section class="seccion">
      <h2 class="titulo-seccion">Detalles del pastel</h2>
      <div class="grid tres">
        <div class="campo"><div class="etiqueta">Sabor de torta</div><div class="valor">${textoOGuion(pedido.sabor_torta)}</div></div>
        <div class="campo"><div class="etiqueta">Sabor de relleno</div><div class="valor">${textoOGuion(pedido.sabor_relleno)}</div></div>
        <div class="campo"><div class="etiqueta">Chantilly</div><div class="valor">${textoOGuion(pedido.chantilly)}</div></div>
      </div>
    </section>

    <section class="seccion">
      <h2 class="titulo-seccion">Indicaciones</h2>
      <div class="texto"><div class="etiqueta">Dedicatoria</div><div class="valor">${textoOGuion(pedido.dedicatoria)}</div></div>
      <div class="texto"><div class="etiqueta">Observaciones</div><div class="valor">${textoOGuion(pedido.observaciones)}</div></div>
    </section>

    <section class="seccion">
      <h2 class="titulo-seccion">Imágenes de referencia</h2>
      ${generarBloqueImagenes(imagenes)}
    </section>

    <section class="seccion">
      <h2 class="titulo-seccion">Pago y estado</h2>
      <div class="finanzas">
        <div class="finanza"><div class="etiqueta">Precio actual</div><div class="valor">$${pago.total.toFixed(2)}</div></div>
        <div class="finanza"><div class="etiqueta">Total pagado</div><div class="valor">$${pago.abono.toFixed(2)}</div></div>
        <div class="finanza"><div class="etiqueta">Saldo pendiente</div><div class="valor">$${pago.saldo.toFixed(2)}</div></div>
        <div class="finanza"><div class="etiqueta">Estado de pago</div><div class="valor">${escaparHtml(estadoPago)}</div></div>
      </div>
      <div style="margin-top:6px"><span class="estado">Pedido: ${escaparHtml(pedido.estado_pedido)}</span></div>
    </section>

    <footer class="pie">
      <span>Sweet Cakes · Hoja interna de producción</span>
      <span>${escaparHtml(folio)}</span>
    </footer>
  </article>
</body>
</html>`

  ventana.document.open()
  ventana.document.write(html)
  ventana.document.close()

  try { ventana.opener = null } catch { /* navegador sin soporte */ }

  const configurarAcciones = () => {
    const botonImprimir = ventana.document.getElementById('btn-imprimir') as HTMLButtonElement | null
    const botonPdf = ventana.document.getElementById('btn-pdf') as HTMLButtonElement | null
    const botonCerrar = ventana.document.getElementById('btn-cerrar') as HTMLButtonElement | null

    botonImprimir?.addEventListener('click', () => ventana.print())
    botonCerrar?.addEventListener('click', () => ventana.close())

    botonPdf?.addEventListener('click', async () => {
      if (!botonPdf) return

      const textoOriginal = botonPdf.textContent
      botonPdf.disabled = true
      botonPdf.textContent = 'Preparando PDF...'

      try {
        const pdf = await generarPdfDesdeDatos({ pedido, imagenes, logoUrl })
        await guardarBlob(ventana, pdf, nombrePdf)
      } catch (error) {
        console.error(error)
        ventana.alert(error instanceof Error ? error.message : 'No se pudo generar el PDF.')
      } finally {
        botonPdf.disabled = false
        botonPdf.textContent = textoOriginal
      }
    })

    ventana.focus()
  }

  if (ventana.document.readyState === 'complete') configurarAcciones()
  else ventana.addEventListener('load', configurarAcciones, { once: true })
}
