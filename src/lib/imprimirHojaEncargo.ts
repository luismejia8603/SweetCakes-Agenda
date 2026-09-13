import type { Encargo } from '../types/encargo'
import { fechaISOADate, formatearHora, obtenerPago } from '../types/encargo'

type DatosHojaEncargo = {
  pedido: Encargo
  imagenes: string[]
  logoUrl: string
}

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

const generarBloqueImagenes = (imagenes: string[]) => {
  if (!imagenes.length) {
    return '<div class="sin-imagenes">Sin imágenes de referencia.</div>'
  }

  const clase = imagenes.length === 1 ? 'imagenes una' : 'imagenes varias'
  const elementos = imagenes.map((url, indice) => `
    <figure class="referencia">
      <img src="${escaparHtml(url)}" alt="Referencia ${indice + 1}">
      ${imagenes.length > 1 ? `<figcaption>Referencia ${indice + 1}</figcaption>` : ''}
    </figure>
  `).join('')

  return `<div class="${clase}">${elementos}</div>`
}

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
  const impresoEl = formatearFechaImpresion(new Date())
  const estadoPago = pago.saldo <= 0.005 ? 'Pagado' : pago.abono > 0 ? 'Pago parcial' : 'Pendiente de pago'

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hoja de encargo ${escaparHtml(identificadorPedido(pedido.id))}</title>
  <style>
    :root {
      font-family: Arial, Helvetica, sans-serif;
      color: #3f2b35;
      background: #f5f1f3;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: #f5f1f3; }
    .acciones {
      position: sticky; top: 0; z-index: 10; display: flex; justify-content: center; gap: 10px;
      padding: 12px; background: rgba(255,255,255,.96); border-bottom: 1px solid #e6dce1;
    }
    .acciones button {
      border: 0; border-radius: 10px; padding: 11px 18px; font-size: 14px; font-weight: 700;
      cursor: pointer; background: #ec3d7f; color: white;
    }
    .acciones button.secundario { background: white; color: #5c3a4d; border: 1px solid #dfd3d9; }
    .hoja {
      width: 216mm; min-height: 279mm; margin: 18px auto; padding: 11mm;
      background: white; box-shadow: 0 10px 30px rgba(74, 50, 62, .12);
    }
    .cabecera { display: grid; grid-template-columns: 76px 1fr auto; gap: 14px; align-items: center; padding-bottom: 12px; border-bottom: 2px solid #5c3a4d; }
    .logo { width: 72px; height: 72px; object-fit: cover; border-radius: 14px; }
    h1 { margin: 0; font-size: 23px; letter-spacing: .04em; }
    .subtitulo { margin: 4px 0 0; color: #8a7480; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
    .folio { text-align: right; }
    .folio strong { display: block; font-size: 16px; }
    .folio span { display: block; margin-top: 5px; color: #7d6b74; font-size: 11px; }
    .seccion { margin-top: 14px; break-inside: avoid; }
    .titulo-seccion { margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: #8a6577; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .grid.tres { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .campo { border: 1px solid #eadfe4; border-radius: 9px; padding: 8px 10px; min-height: 49px; }
    .campo .etiqueta { color: #8f7d86; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
    .campo .valor { margin-top: 4px; font-size: 13px; font-weight: 700; line-height: 1.35; white-space: pre-wrap; }
    .texto { border: 1px solid #eadfe4; border-radius: 9px; padding: 9px 10px; min-height: 58px; }
    .texto + .texto { margin-top: 7px; }
    .texto .etiqueta { color: #8f7d86; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
    .texto .valor { margin-top: 5px; font-size: 12px; line-height: 1.45; white-space: pre-wrap; }
    .imagenes { display: grid; gap: 7px; }
    .imagenes.una { grid-template-columns: 1fr; }
    .imagenes.varias { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .referencia { margin: 0; border: 1px solid #eadfe4; border-radius: 9px; overflow: hidden; background: #faf7f8; break-inside: avoid; }
    .referencia img { display: block; width: 100%; height: 155px; object-fit: contain; }
    .imagenes.una .referencia img { height: 265px; }
    .referencia figcaption { padding: 5px 8px; border-top: 1px solid #eadfe4; color: #8f7d86; font-size: 9px; font-weight: 700; text-align: center; }
    .sin-imagenes { border: 1px dashed #d9c7cf; border-radius: 9px; padding: 20px; color: #8f7d86; text-align: center; font-size: 12px; }
    .finanzas { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; }
    .finanza { border-radius: 9px; padding: 9px; background: #fbf7f9; border: 1px solid #eadfe4; }
    .finanza .etiqueta { color: #8f7d86; font-size: 9px; font-weight: 700; text-transform: uppercase; }
    .finanza .valor { margin-top: 4px; font-size: 14px; font-weight: 800; }
    .estado { display: inline-block; padding: 5px 9px; border-radius: 999px; background: #f3eaf0; color: #6f4c69; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; }
    .pie { margin-top: 15px; padding-top: 8px; border-top: 1px solid #eadfe4; display: flex; justify-content: space-between; gap: 14px; color: #8f7d86; font-size: 9px; }
    @page { size: Letter; margin: 8mm; }
    @media print {
      body { background: white; }
      .acciones { display: none !important; }
      .hoja { width: auto; min-height: auto; margin: 0; padding: 0; box-shadow: none; }
    }
    @media (max-width: 760px) {
      .hoja { width: calc(100% - 16px); min-height: auto; margin: 8px; padding: 16px; }
      .cabecera { grid-template-columns: 58px 1fr; }
      .logo { width: 54px; height: 54px; }
      .folio { grid-column: 1 / -1; text-align: left; }
      .grid, .grid.tres, .finanzas { grid-template-columns: 1fr 1fr; }
      .imagenes.varias { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="acciones">
    <button onclick="window.print()">Imprimir / Guardar PDF</button>
    <button class="secundario" onclick="window.close()">Cerrar</button>
  </div>

  <article class="hoja">
    <header class="cabecera">
      <img class="logo" src="${escaparHtml(logoUrl)}" alt="Sweet Cakes">
      <div>
        <h1>SWEET CAKES</h1>
        <p class="subtitulo">Hoja de encargo · Producción</p>
      </div>
      <div class="folio">
        <strong>${escaparHtml(identificadorPedido(pedido.id))}</strong>
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
      <div style="margin-top:8px"><span class="estado">Pedido: ${escaparHtml(pedido.estado_pedido)}</span></div>
    </section>

    <footer class="pie">
      <span>Sweet Cakes · Hoja interna de producción</span>
      <span>${escaparHtml(identificadorPedido(pedido.id))}</span>
    </footer>
  </article>

</body>
</html>`

  ventana.document.open()
  ventana.document.write(html)
  ventana.document.close()

  // Conservamos la referencia el tiempo suficiente para escribir la hoja y luego
  // cortamos el acceso al origen. En Android/Chrome, pasar 'noopener' a
  // window.open() hace que la llamada devuelva null aunque la pestaña se abra.
  try { ventana.opener = null } catch { /* navegador sin soporte */ }

  ventana.focus()
}
