// Comprobante de una reserva: el mismo "boleto" de Mis reservas, listo para imprimir o guardar
// como PDF y para compartir como imagen (PNG) con cualquier app del menú del sistema. La imagen no
// lleva el correo ni el teléfono: es para enviarla a otras personas.

import { RESERVAS, RESTAURANTE } from '../config/restaurante.js';
import { aHora, aMinutos, formatoCorto, formatoLargo, sumarDias } from '../core/fechas.js';
import { h, plural } from './dom.js';

export const TEXTO_ESTADO_RESERVA = {
  pendiente: 'Pendiente de confirmación',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
  completada: 'Completada',
  no_asistio: 'No asistió',
};

const fmtMomento = new Intl.DateTimeFormat('es-PE', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima',
});

// ---------- Datos (funciones puras, probadas con node:test) ----------

export const textoEstado = (r) =>
  TEXTO_ESTADO_RESERVA[r.estado] + (r.confirmadaSimulada && r.estado === 'confirmada' ? ' (simulado)' : '');

export function horario(r) {
  const fin = aHora(aMinutos(r.hora) + RESERVAS.duracionMinutos);
  const turno = RESERVAS.turnos.find((t) => t.id === r.turno)?.nombre;
  return `${r.hora} a ${fin}${turno ? ` · ${turno}` : ''}`;
}

export function textoMesa(r) {
  if (r.mesaNombre) return `${r.mesaNombre} (${r.mesaAsientos} asientos)`;
  return r.mesaAsientos ? `Mesa para ${r.mesaAsientos}` : 'Se asigna al llegar';
}

/** Último momento para cambiar o cancelar: la llegada menos el plazo de cambios. */
export function limiteDeCambios(r) {
  let minutos = aMinutos(r.hora) - RESERVAS.horasParaCambios * 60;
  let fecha = r.fecha;
  while (minutos < 0) { minutos += 1440; fecha = sumarDias(fecha, -1); }
  return `${formatoCorto(fecha)} a las ${aHora(minutos)}`;
}

/** La ficha de la reserva. Sin contacto cuando se comparte con otras personas. */
export function datosComprobante(r, { conContacto = true } = {}) {
  return [
    { titulo: 'Personas', valor: plural(r.personas, 'persona', 'personas') },
    { titulo: 'Mesa', valor: textoMesa(r) },
    { titulo: 'A nombre de', valor: r.nombre || '—', ancho: !conContacto },
    conContacto && { titulo: 'Correo o teléfono', valor: r.contacto || '—' },
    { titulo: 'Comentarios', valor: r.comentarios || 'Sin comentarios', vacio: !r.comentarios, ancho: true },
    conContacto && { titulo: 'Reservada el', valor: r.creada ? fmtMomento.format(new Date(r.creada)) : '—', ancho: true },
  ].filter(Boolean);
}

const nombreArchivo = (r, ext) => `algarrobo-${r.codigo}.${ext}`;

// ---------- Imprimir o guardar como PDF ----------

/**
 * Pinta el boleto en una hoja aparte y abre el diálogo de impresión del navegador, donde se puede
 * elegir "Guardar como PDF". Las reglas @media print muestran solo esta hoja.
 */
export function imprimirComprobante(r) {
  document.querySelector('[data-comprobante-impresion]')?.remove();
  const dato = ({ titulo, valor, ancho, vacio }) =>
    h('div', { class: ancho ? 'ancho' : '' }, h('dt', {}, titulo), h('dd', { class: vacio ? 'vacio' : '' }, valor));

  const hoja = h('div', { class: 'comprobante-impresion', 'data-comprobante-impresion': true },
    h('header', { class: 'comprobante-marca' },
      h('span', { html: '<svg viewBox="0 0 40 40" aria-hidden="true"><use href="#marca"/></svg>' }),
      h('div', {},
        h('p', { class: 'comprobante-nombre' }, RESTAURANTE.nombre),
        h('p', { class: 'comprobante-sub' }, `Cocina norteña · ${RESTAURANTE.direccion}`))),
    h('div', { class: 'boleto comprobante-boleto' },
      h('div', { class: 'boleto-cabeza' },
        h('p', { class: 'comprobante-etiqueta' }, 'Comprobante de reserva'),
        h('div', { class: 'comprobante-fila' },
          h('p', { class: 'comprobante-codigo' }, r.codigo),
          h('span', { class: `chip-estado chip-${r.estado}` }, textoEstado(r))),
        h('p', { class: 'comprobante-fecha' }, formatoLargo(r.fecha)),
        h('p', { class: 'comprobante-hora' }, horario(r))),
      h('div', { class: 'boleto-perforado', 'aria-hidden': 'true' }),
      h('div', { class: 'boleto-cuerpo' },
        h('dl', { class: 'boleto-datos' }, ...datosComprobante(r).map(dato)),
        h('p', { class: 'boleto-plazo' },
          h('strong', {}, 'Cambios y cancelación: '),
          r.modificable ? `hasta el ${limiteDeCambios(r)}.` : `el plazo terminó el ${limiteDeCambios(r)}; para cambios, llama al restaurante.`),
        h('p', { class: 'comprobante-nota' },
          `Te guardamos la mesa ${RESERVAS.toleranciaMinutos} minutos después de la hora de llegada. `,
          `Teléfono: ${RESTAURANTE.telefono}.`))),
    h('p', { class: 'comprobante-pie' },
      `Reserva de demostración de un restaurante ficticio. Generado el ${fmtMomento.format(new Date())}.`),
  );
  document.body.append(hoja);
  document.documentElement.classList.add('imprimiendo-comprobante');
  const tituloOriginal = document.title;
  document.title = nombreArchivo(r, 'pdf').replace(/\.pdf$/, ''); // nombre sugerido al guardar como PDF

  const limpiar = () => {
    document.documentElement.classList.remove('imprimiendo-comprobante');
    document.title = tituloOriginal;
    hoja.remove();
  };
  window.addEventListener('afterprint', limpiar, { once: true });
  window.print();
}

// ---------- Imagen (PNG) ----------

const C = {
  aji: '#8f211e', maiz: '#e0aa2f', maizHondo: '#7f5b0f', carbon: '#211e1a', carbonSuave: '#5a5047',
  marfil: '#f6e7cf', marfilLuz: '#fbf3e6', borde: '#d8c19c', blanco: '#ffffff', hierbas: '#4a5a32', piedra: '#ead6b6',
};
const FONDO_CHIP = { pendiente: '#f6e3b4', confirmada: '#e3e6da', cancelada: C.piedra, completada: C.piedra, no_asistio: C.piedra };
const TINTA_CHIP = { pendiente: C.maizHondo, confirmada: C.hierbas, cancelada: C.carbonSuave, completada: C.carbonSuave, no_asistio: C.aji };

function lineasQueCaben(ctx, texto, ancho) {
  const palabras = String(texto).split(/\s+/);
  const lineas = [];
  let actual = '';
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (ctx.measureText(prueba).width > ancho && actual) { lineas.push(actual); actual = p; } else actual = prueba;
  }
  if (actual) lineas.push(actual);
  return lineas;
}

function rectRedondo(ctx, x, y, w, alto, radio) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, alto, radio);
}

function imagenDeMarca() {
  const simbolo = document.getElementById('marca');
  if (!simbolo) return Promise.resolve(null);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="144" height="144">${simbolo.innerHTML}</svg>`;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/** Dibuja el boleto (sin contacto) en un lienzo de 1080 px de ancho y devuelve un PNG. */
export async function imagenComprobante(r) {
  await Promise.all([
    document.fonts.load('64px Calistoga'),
    document.fonts.load('700 32px Archivo'),
    document.fonts.load('800 22px Archivo'),
  ]).catch(() => {});

  const ANCHO = 1080;
  const M = 64;                 // margen exterior
  const X = M + 56;             // margen interior del boleto
  const UTIL = ANCHO - 2 * X;
  const datos = datosComprobante(r, { conContacto: false });

  // Primero se mide el alto de los comentarios para dimensionar el lienzo.
  const medida = document.createElement('canvas').getContext('2d');
  medida.font = '600 32px Archivo';
  const comentario = datos.find((d) => d.titulo === 'Comentarios');
  const lineasComentario = lineasQueCaben(medida, comentario.valor, UTIL).slice(0, 4);
  const ALTO = 1240 + lineasComentario.length * 44;

  const lienzo = document.createElement('canvas');
  lienzo.width = ANCHO;
  lienzo.height = ALTO;
  const ctx = lienzo.getContext('2d');
  const espaciado = (v) => { if ('letterSpacing' in ctx) ctx.letterSpacing = v; };

  ctx.fillStyle = C.marfilLuz;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  // Marca: el mismo símbolo SVG de la página; si no carga, un círculo ají.
  const marca = await imagenDeMarca();
  if (marca) ctx.drawImage(marca, M, M + 4, 72, 72);
  else {
    ctx.fillStyle = C.aji;
    ctx.beginPath(); ctx.arc(M + 36, M + 40, 36, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = C.carbon;
  ctx.font = '56px Calistoga';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(RESTAURANTE.nombre, M + 92, M + 46);
  ctx.fillStyle = C.aji;
  ctx.font = '800 20px Archivo';
  espaciado('3px');
  ctx.fillText('COCINA NORTEÑA · BARRANCO, LIMA', M + 94, M + 76);
  espaciado('0px');

  // Boleto
  const top = M + 130;
  const altoBoleto = ALTO - top - M - 60;
  rectRedondo(ctx, M, top, ANCHO - 2 * M, altoBoleto, 28);
  ctx.fillStyle = C.blanco; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = C.borde; ctx.stroke();

  let y = top + 70;
  ctx.fillStyle = C.carbonSuave;
  ctx.font = '800 22px Archivo';
  espaciado('3px');
  ctx.fillText('COMPROBANTE DE RESERVA', X, y);
  espaciado('0px');

  // Estado, a la derecha de la etiqueta (el código ocupa su propia línea, sea cual sea su ancho)
  ctx.font = '800 26px Archivo';
  const estado = textoEstado(r);
  const anchoChip = ctx.measureText(estado).width + 64;
  rectRedondo(ctx, ANCHO - X - anchoChip, y - 36, anchoChip, 52, 26);
  ctx.fillStyle = FONDO_CHIP[r.estado]; ctx.fill();
  ctx.fillStyle = TINTA_CHIP[r.estado];
  ctx.beginPath(); ctx.arc(ANCHO - X - anchoChip + 26, y - 10, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillText(estado, ANCHO - X - anchoChip + 42, y - 1);

  y += 96;
  ctx.fillStyle = C.aji;
  ctx.font = '84px Calistoga';
  ctx.fillText(r.codigo, X, y);

  y += 80;
  ctx.fillStyle = C.carbon;
  ctx.font = '800 46px Archivo';
  ctx.fillText(formatoLargo(r.fecha), X, y);
  y += 54;
  ctx.fillStyle = C.carbonSuave;
  ctx.font = '600 34px Archivo';
  ctx.fillText(horario(r), X, y);

  // Línea perforada con muescas
  y += 64;
  ctx.setLineDash([14, 12]);
  ctx.strokeStyle = C.borde; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(M + 40, y); ctx.lineTo(ANCHO - M - 40, y); ctx.stroke();
  ctx.setLineDash([]);
  for (const cx of [M, ANCHO - M]) {
    ctx.fillStyle = C.marfilLuz;
    ctx.beginPath(); ctx.arc(cx, y, 24, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = C.borde;
    ctx.beginPath(); ctx.arc(cx, y, 24, cx === M ? -Math.PI / 2 : Math.PI / 2, cx === M ? Math.PI / 2 : Math.PI * 1.5); ctx.stroke();
  }

  // Ficha en dos columnas
  y += 76;
  const col = UTIL / 2 + 20;
  const pintarDato = (d, x, yy) => {
    ctx.fillStyle = C.maizHondo;
    ctx.font = '800 22px Archivo';
    espaciado('2.5px');
    ctx.fillText(d.titulo.toUpperCase(), x, yy);
    espaciado('0px');
    ctx.fillStyle = d.vacio ? C.carbonSuave : C.carbon;
    ctx.font = `${d.vacio ? 400 : 600} 32px Archivo`;
  };
  const [personas, mesa, nombre] = datos;
  pintarDato(personas, X, y); ctx.fillText(personas.valor, X, y + 46);
  pintarDato(mesa, X + col, y); ctx.fillText(mesa.valor, X + col, y + 46);
  y += 112;
  pintarDato(nombre, X, y); ctx.fillText(nombre.valor, X, y + 46);
  y += 112;
  pintarDato(comentario, X, y);
  lineasComentario.forEach((l, i) => ctx.fillText(l, X, y + 46 + i * 44));
  y += 46 + lineasComentario.length * 44 + 40;

  // Aviso de tolerancia
  rectRedondo(ctx, X, y, UTIL, 84, 16);
  ctx.fillStyle = C.marfil; ctx.fill();
  ctx.fillStyle = C.carbon;
  ctx.font = '600 26px Archivo';
  ctx.fillText(`Te guardamos la mesa ${RESERVAS.toleranciaMinutos} minutos después de la hora.`, X + 28, y + 52);

  // Pie
  ctx.fillStyle = C.carbonSuave;
  ctx.font = '500 22px Archivo';
  ctx.fillText(`${RESTAURANTE.direccion} · ${RESTAURANTE.telefono}`, M + 8, ALTO - M - 4);
  ctx.textAlign = 'right';
  ctx.fillText('Demo · restaurante ficticio', ANCHO - M - 8, ALTO - M - 4);

  return new Promise((resolve, reject) =>
    lienzo.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo crear la imagen.'))), 'image/png'));
}

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const enlace = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- Botones reutilizables ----------

const ICONO_COMPARTIR = '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/></svg>';
const ICONO_IMPRIMIR = '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="8" rx="2"/><path d="M7 14h10v6.5H7z"/></svg>';

/**
 * Devuelve { botones, opciones }: "Compartir" e "Imprimir o PDF", y un panel de respaldo que el
 * llamador coloca debajo de los botones. "Compartir" envía la imagen del boleto (no texto) con el
 * menú del sistema, así llega como foto a WhatsApp, Telegram, correo, etc. Si el navegador no
 * puede compartir archivos, el panel ofrece copiar la imagen (para pegarla) o descargarla.
 * `fuente` es la reserva o una función que la lee al momento, para que la imagen salga con el
 * estado actual (por ejemplo, ya confirmada).
 */
export function accionesComprobante(fuente, { clase = 'btn btn-linea btn-chico' } = {}) {
  const leer = async () => (typeof fuente === 'function' ? fuente() : fuente);
  const idOpciones = `compartir-${Math.random().toString(36).slice(2, 9)}`;
  const estadoAccion = h('p', { class: 'w-full text-[0.9rem] font-semibold text-hierbas', role: 'status' });
  const avisar = (mensaje) => {
    estadoAccion.textContent = mensaje;
    setTimeout(() => { if (estadoAccion.textContent === mensaje) estadoAccion.textContent = ''; }, 5000);
  };

  // La imagen se prepara al acercar el puntero o el foco al botón: el menú del sistema exige que
  // share() se llame enseguida tras el toque, y dibujar el boleto toma unos milisegundos.
  let preparada = null;
  const preparar = () => {
    preparada = leer()
      .then(async (r) => new File([await imagenComprobante(r)], nombreArchivo(r, 'png'), { type: 'image/png' }));
    preparada.catch(() => { preparada = null; });
    return preparada;
  };
  const imagen = () => preparada ?? preparar();
  const puedeCompartirImagen = (archivo) => Boolean(navigator.canShare?.({ files: [archivo] }));

  async function copiarImagen() {
    try {
      const archivo = await imagen();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': archivo })]);
      avisar('Imagen copiada. Pégala en el chat o correo donde quieras enviarla.');
    } catch {
      avisar('Tu navegador no deja copiar imágenes. Descárgala y adjúntala.');
    }
  }

  async function bajarImagen() {
    try {
      const archivo = await imagen();
      descargar(archivo, archivo.name);
      avisar('Imagen descargada. Adjúntala en la app donde quieras enviarla.');
    } catch {
      avisar('No se pudo crear la imagen.');
    }
  }

  const opcion = 'btn btn-linea btn-chico';
  const opciones = h('div', { id: idOpciones, class: 'compartir-opciones', hidden: true },
    h('p', { class: 'w-full text-[0.92rem]' },
      'Este navegador no puede enviar la imagen directo a otras apps. Cópiala para pegarla o descárgala para adjuntarla.'),
    'ClipboardItem' in window
      ? h('button', { type: 'button', class: opcion, onclick: copiarImagen }, 'Copiar imagen')
      : null,
    h('button', { type: 'button', class: opcion, onclick: bajarImagen }, 'Descargar imagen'),
    estadoAccion,
  );

  const compartir = h('button', {
    type: 'button', class: clase, 'aria-controls': idOpciones,
    onpointerenter: preparar,
    onfocus: preparar,
    ontouchstart: preparar,
    onclick: async (e) => {
      const boton = e.currentTarget;
      boton.disabled = true;
      try {
        const archivo = await imagen();
        if (puedeCompartirImagen(archivo)) {
          // Solo la imagen: con texto, varias apps descartan la foto y envían solo el mensaje.
          await navigator.share({ files: [archivo], title: `Reserva en ${RESTAURANTE.nombre}` });
          return;
        }
        opciones.hidden = false;
        opciones.querySelector('button')?.focus();
      } catch (error) {
        if (error?.name === 'AbortError') return; // la persona cerró el menú
        opciones.hidden = false;
        avisar('No se pudo abrir el menú para compartir. Usa una de estas opciones.');
      } finally {
        boton.disabled = false;
      }
    },
  }, h('span', { html: ICONO_COMPARTIR }), 'Compartir imagen');

  const imprimir = h('button', { type: 'button', class: clase, onclick: async () => imprimirComprobante(await leer()) },
    h('span', { html: ICONO_IMPRIMIR }), 'Imprimir o PDF');

  return { botones: [compartir, imprimir], opciones };
}
