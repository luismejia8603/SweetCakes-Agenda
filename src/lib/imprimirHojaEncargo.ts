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
      <img src="${escaparHtml(url)}" alt="Referencia ${indice + 1}" crossorigin="anonymous">
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

const incrustarImagenes = async (raiz: HTMLElement) => {
  const imagenes = Array.from(raiz.querySelectorAll<HTMLImageElement>('img'))

  await Promise.all(imagenes.map(async (imagen) => {
    try {
      imagen.src = await convertirImagenADataUrl(imagen.src)
    } catch (error) {
      console.warn('No se pudo incrustar una imagen en el PDF:', error)
      imagen.removeAttribute('src')
      imagen.alt = 'Imagen no disponible en PDF'
    }
  }))
}

const escaparXml = (valor: string) => valor
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')

const elementoAImagenJpeg = async (elemento: HTMLElement, estilos: string) => {
  const clon = elemento.cloneNode(true) as HTMLElement
  clon.classList.add('exportacion')
  await incrustarImagenes(clon)

  const xhtml = `
    <div xmlns="http://www.w3.org/1999/xhtml">
      <style>${escaparXml(estilos)}</style>
      ${clon.outerHTML}
    </div>
  `

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO_PDF_PX}" height="${ALTO_PDF_PX}" viewBox="0 0 ${ANCHO_PDF_PX} ${ALTO_PDF_PX}">
      <foreignObject width="100%" height="100%">${xhtml}</foreignObject>
    </svg>
  `

  const urlSvg = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))

  try {
    const imagen = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('El navegador no pudo preparar la vista del PDF.'))
      img.src = urlSvg
    })

    const escala = 2
    const canvas = document.createElement('canvas')
    canvas.width = ANCHO_PDF_PX * escala
    canvas.height = ALTO_PDF_PX * escala

    const contexto = canvas.getContext('2d')
    if (!contexto) throw new Error('No se pudo preparar el PDF en este dispositivo.')

    contexto.fillStyle = '#ffffff'
    contexto.fillRect(0, 0, canvas.width, canvas.height)
    contexto.scale(escala, escala)
    contexto.drawImage(imagen, 0, 0, ANCHO_PDF_PX, ALTO_PDF_PX)

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    const base64 = dataUrl.split(',')[1]
    const binario = atob(base64)
    const bytes = new Uint8Array(binario.length)
    for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i)
    return bytes
  } finally {
    URL.revokeObjectURL(urlSvg)
  }
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

const guardarBlob = async (blob: Blob, nombre: string) => {
  const ventanaActual = window as VentanaConSelectorArchivo

  if (ventanaActual.showSaveFilePicker) {
    try {
      const archivo = await ventanaActual.showSaveFilePicker({
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
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  enlace.style.display = 'none'
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
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
  .hoja { width: 216mm; min-height: 279mm; margin: 16px auto; padding: 9mm; background: white; box-shadow: 0 10px 30px rgba(74, 50, 62, .12); }
  .cabecera { display: grid; grid-template-columns: 62px 1fr auto; gap: 11px; align-items: center; padding-bottom: 8px; border-bottom: 2px solid #5c3a4d; }
  .logo { width: 58px; height: 58px; object-fit: cover; border-radius: 11px; }
  h1 { margin: 0; font-size: 21px; letter-spacing: .04em; }
  .subtitulo { margin: 3px 0 0; color: #8a7480; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
  .folio { text-align: right; }
  .folio strong { display: block; font-size: 14px; }
  .folio span { display: block; margin-top: 3px; color: #7d6b74; font-size: 9px; }
  .seccion { margin-top: 9px; break-inside: avoid; }
  .titulo-seccion { margin: 0 0 5px; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #8a6577; }
  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px; }
  .grid.tres { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .campo { border: 1px solid #eadfe4; border-radius: 7px; padding: 5px 7px; min-height: 39px; }
  .campo .etiqueta { color: #8f7d86; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
  .campo .valor { margin-top: 2px; font-size: 10px; font-weight: 700; line-height: 1.25; white-space: pre-wrap; }
  .texto { border: 1px solid #eadfe4; border-radius: 7px; padding: 5px 7px; min-height: 38px; }
  .texto + .texto { margin-top: 5px; }
  .texto .etiqueta { color: #8f7d86; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
  .texto .valor { margin-top: 3px; font-size: 9px; line-height: 1.3; white-space: pre-wrap; }
  .imagenes { display: grid; gap: 5px; }
  .imagenes.una { grid-template-columns: minmax(0, 1fr); }
  .imagenes.varias { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .referencia { margin: 0; border: 1px solid #eadfe4; border-radius: 7px; overflow: hidden; background: #faf7f8; break-inside: avoid; }
  .referencia img { display: block; width: 100%; height: 78px; object-fit: contain; }
  .imagenes.una .referencia { max-width: 260px; margin-inline: auto; width: 100%; }
  .imagenes.una .referencia img { height: 125px; }
  .referencia figcaption { padding: 3px 5px; border-top: 1px solid #eadfe4; color: #8f7d86; font-size: 7px; font-weight: 700; text-align: center; }
  .sin-imagenes { border: 1px dashed #d9c7cf; border-radius: 7px; padding: 10px; color: #8f7d86; text-align: center; font-size: 9px; }
  .finanzas { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 5px; }
  .finanza { border-radius: 7px; padding: 5px 7px; background: #fbf7f9; border: 1px solid #eadfe4; }
  .finanza .etiqueta { color: #8f7d86; font-size: 7px; font-weight: 700; text-transform: uppercase; }
  .finanza .valor { margin-top: 2px; font-size: 10px; font-weight: 800; }
  .estado { display: inline-block; padding: 3px 7px; border-radius: 999px; background: #f3eaf0; color: #6f4c69; font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; }
  .pie { margin-top: 8px; padding-top: 5px; border-top: 1px solid #eadfe4; display: flex; justify-content: space-between; gap: 12px; color: #8f7d86; font-size: 7px; }

  .hoja.exportacion { width: 816px; height: 1056px; min-height: 1056px; margin: 0; padding: 23px; box-shadow: none; overflow: hidden; }
  .hoja.exportacion .cabecera { grid-template-columns: 52px 1fr auto; gap: 9px; padding-bottom: 6px; }
  .hoja.exportacion .logo { width: 48px; height: 48px; }
  .hoja.exportacion h1 { font-size: 18px; }
  .hoja.exportacion .seccion { margin-top: 7px; }
  .hoja.exportacion .imagenes.una .referencia img { height: 110px; }
  .hoja.exportacion .referencia img { height: 70px; }

  @page { size: Letter; margin: 6mm; }
  @media print {
    body { background: white; }
    .acciones { display: none !important; }
    .hoja { width: auto; min-height: auto; margin: 0; padding: 0; box-shadow: none; }
    .cabecera { grid-template-columns: 48px 1fr auto; gap: 8px; padding-bottom: 5px; }
    .logo { width: 44px; height: 44px; border-radius: 8px; }
    h1 { font-size: 16px; }
    .subtitulo { font-size: 8px; }
    .folio strong { font-size: 11px; }
    .folio span { font-size: 7px; }
    .seccion { margin-top: 6px; }
    .titulo-seccion { margin-bottom: 3px; font-size: 8px; }
    .grid { gap: 3px; }
    .campo { padding: 3px 5px; min-height: 31px; border-radius: 5px; }
    .campo .etiqueta, .texto .etiqueta { font-size: 6.5px; }
    .campo .valor { margin-top: 1px; font-size: 8px; line-height: 1.15; }
    .texto { padding: 3px 5px; min-height: 29px; border-radius: 5px; }
    .texto + .texto { margin-top: 3px; }
    .texto .valor { margin-top: 2px; font-size: 7.5px; line-height: 1.2; }
    .imagenes { gap: 3px; }
    .imagenes.una .referencia { max-width: 220px; }
    .imagenes.una .referencia img { height: 92px; }
    .imagenes.varias { grid-template-columns: repeat(5, minmax(0, 1fr)); }
    .referencia img { height: 58px; }
    .referencia figcaption { padding: 2px; font-size: 6px; }
    .sin-imagenes { padding: 6px; font-size: 7px; }
    .finanzas { gap: 3px; }
    .finanza { padding: 3px 5px; border-radius: 5px; }
    .finanza .etiqueta { font-size: 6px; }
    .finanza .valor { margin-top: 1px; font-size: 8px; }
    .estado { padding: 2px 5px; font-size: 6.5px; }
    .pie { margin-top: 5px; padding-top: 3px; font-size: 6px; }
  }

  @media (max-width: 760px) {
    .hoja { width: calc(100% - 16px); min-height: auto; margin: 8px; padding: 14px; }
    .cabecera { grid-template-columns: 52px 1fr; }
    .logo { width: 48px; height: 48px; }
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
      <img class="logo" src="${escaparHtml(logoUrl)}" alt="Sweet Cakes" crossorigin="anonymous">
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
      <div style="margin-top:5px"><span class="estado">Pedido: ${escaparHtml(pedido.estado_pedido)}</span></div>
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
    const hoja = ventana.document.getElementById('hoja-encargo') as HTMLElement | null

    botonImprimir?.addEventListener('click', () => ventana.print())
    botonCerrar?.addEventListener('click', () => ventana.close())

    botonPdf?.addEventListener('click', async () => {
      if (!hoja || !botonPdf) return

      const textoOriginal = botonPdf.textContent
      botonPdf.disabled = true
      botonPdf.textContent = 'Preparando PDF...'

      try {
        const jpeg = await elementoAImagenJpeg(hoja, ESTILOS_HOJA)
        const pdf = crearPdfUnaPagina(jpeg, ANCHO_PDF_PX * 2, ALTO_PDF_PX * 2)
        await guardarBlob(pdf, nombrePdf)
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
