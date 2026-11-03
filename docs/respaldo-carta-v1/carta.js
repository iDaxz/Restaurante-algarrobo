// Carta digital con filtros por categoría. Se lee como la carta impresa de una picantería: cada
// categoría tiene su título y su presentación a un lado y, al otro, los platos en filas de menú
// (nombre, guía punteada, precio; origen y descripción debajo). Las fotos van en platos redondos con
// borde blanco, como en la mesa de la portada. Las especialidades conservan la única banda rojo ají.
// Toda la fila abre la ventana de detalle con la historia del plato.

import { CATEGORIAS, ETIQUETAS, PLATOS } from '../data/carta.js';
import { $, h, plural, soles } from './dom.js';
import { abrirPlato } from './plato-detalle.js';
import { revelar } from './revelar.js';

/** Cómo se presenta cada categoría y la línea que la introduce. */
const PRESENTACION = {
  entradas: { forma: 'pagina', corto: 'Entradas', texto: 'Para abrir la mesa: lo frío, lo ácido y el ají limo del norte.' },
  principales: { forma: 'pagina', corto: 'Principales', texto: 'Platos de fondo, de olla y de fogón, servidos como en casa.' },
  especialidades: { forma: 'destacado', corto: 'Especialidades', texto: 'Lo que nos piden por su nombre. Para compartir sin apuro.' },
  postres: { forma: 'par', corto: 'Postres', texto: 'Para cerrar dulce.' },
  bebidas: { forma: 'par', corto: 'Bebidas', texto: 'Chichas, refrescos y un cóctel de la casa.' },
};
const presentacion = (id) => PRESENTACION[id] ?? { forma: 'pagina', corto: null, texto: '' };

const contenedor = (...hijos) => h('div', { class: 'mx-auto max-w-7xl px-4 sm:px-8' }, ...hijos);

export function iniciarCarta() {
  const destino = $('[data-carta]');
  const filtros = $('[data-filtros]');
  const anuncio = $('[data-carta-anuncio]');
  if (!destino || !filtros) return;

  const opciones = [{ id: 'todas', nombre: 'Toda la carta', corto: 'Toda la carta' },
    ...CATEGORIAS.map((c) => ({ ...c, corto: presentacion(c.id).corto ?? c.nombre }))];
  let activa = 'todas';

  // Pestañas de texto en una sola fila: la elegida lleva el subrayado ají.
  const botones = opciones.map((cat) => {
    const cantidad = cat.id === 'todas' ? PLATOS.length : PLATOS.filter((p) => p.categoria === cat.id).length;
    return h('button', {
      type: 'button',
      class: 'pestana-carta',
      'aria-pressed': String(cat.id === activa),
      'data-categoria': cat.id,
      'aria-label': `${cat.nombre}: ${plural(cantidad, 'plato', 'platos')}`,
      onclick: () => elegir(cat.id),
    }, h('span', {}, cat.corto), h('span', { class: 'pestana-carta-cuenta', 'aria-hidden': 'true' }, cantidad));
  });
  filtros.replaceChildren(...botones);

  function elegir(id) {
    activa = id;
    botones.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.categoria === id)));
    $(`[data-categoria="${id}"]`, filtros).scrollIntoView({ block: 'nearest', inline: 'nearest' });
    pintar();
    const nombre = opciones.find((c) => c.id === id).nombre;
    const total = PLATOS.filter((p) => id === 'todas' || p.categoria === id).length;
    anuncio.textContent = `${nombre}: ${plural(total, 'plato', 'platos')}.`;
  }

  function pintar() {
    const categorias = CATEGORIAS.filter((c) => activa === 'todas' || c.id === activa);
    const bloques = [];
    const pares = [];
    for (const c of categorias) {
      const platos = PLATOS.filter((p) => p.categoria === c.id);
      if (!platos.length) continue;
      const forma = presentacion(c.id).forma;
      if (forma === 'par') pares.push(bloquePar(c, platos));
      else if (forma === 'destacado') bloques.push(bloqueDestacado(c, platos));
      else bloques.push(bloquePagina(c, platos));
    }
    // Postres y bebidas comparten una página: son cartas cortas.
    if (pares.length) bloques.push(h('section', { class: 'carta-pagina', 'aria-label': 'Postres y bebidas' },
      contenedor(h('div', { class: 'grid gap-14 lg:grid-cols-2 lg:gap-16' }, pares))));
    destino.replaceChildren(...bloques);
  }

  pintar();
  revelar(destino.querySelectorAll('.carta-presentacion, .plato-fila, .destacado-plato'));
}

// ---------- Piezas ----------

const tituloCategoria = (c, clases = '') =>
  h('h3', { id: `cat-${c.id}`, class: `titulo-carta-categoria display ${clases}` }, c.nombre);

/** Plato redondo con borde blanco, como los de la mesa de la portada. */
const platoRedondo = (plato, clases = '') =>
  h('span', { class: `plato-redondo ${clases}`, 'aria-hidden': 'true' },
    h('img', { src: plato.foto, alt: '', loading: 'lazy', decoding: 'async', width: 960, height: 720 }));

const etiqueta = (plato) =>
  plato.etiqueta && h('span', { class: `etiqueta etiqueta--${plato.etiqueta}` }, ETIQUETAS[plato.etiqueta]);

const precio = (plato, clases = '') =>
  h('p', { class: `precio precio-carta ${plato.disponible ? '' : 'precio-agotado'} ${clases}` },
    h('span', { class: 'sr-only' }, plato.disponible ? 'Precio: ' : 'Agotado hoy. Precio: '), soles(plato.precio));

/** El nombre del plato es el botón: su área se estira a toda la fila (ver .plato-abrir en CSS). */
const botonAbrir = (plato) => h('button', {
  type: 'button',
  class: 'plato-abrir',
  'aria-haspopup': 'dialog',
  'data-plato': plato.id,
  onclick: () => abrirPlato(plato.id),
}, plato.nombre, h('span', { class: 'sr-only' }, ': ver descripción e historia'));

const flecha = () => h('svg', { class: 'w-4 h-4', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', html: '<path d="M5 12h14M13 6l6 6-6 6"/>' });

/** Una fila de la carta: plato redondo, nombre … precio, origen y descripción. */
function fila(plato, { sobreAji = false } = {}) {
  return h('article', { class: `plato plato-fila ${plato.disponible ? '' : 'agotado'} ${sobreAji ? 'sobre-aji' : ''}` },
    platoRedondo(plato, 'plato-fila-foto'),
    h('div', { class: 'min-w-0' },
      h('div', { class: 'plato-fila-linea' },
        h('h4', { class: 'plato-fila-nombre' }, botonAbrir(plato)),
        h('span', { class: 'plato-fila-guia', 'aria-hidden': 'true' }),
        precio(plato)),
      h('p', { class: 'plato-fila-meta' },
        plato.origen ? h('span', { class: 'plato-fila-origen' }, plato.origen) : null,
        etiqueta(plato),
        plato.disponible ? null : h('span', { class: 'agotado-hoy' }, 'Agotado hoy')),
      h('p', { class: 'plato-fila-descripcion' }, plato.descripcion),
      h('span', { class: 'plato-fila-historia', 'aria-hidden': 'true' }, 'Ver su historia', flecha())));
}

/** Presentación de la categoría: nombre, la línea que la introduce y, en escritorio, su plato insignia. */
function presentacionCategoria(c, platos, { sobreAji = false, conPlato = true } = {}) {
  const insignia = platos.find((p) => p.etiqueta === 'mas-vendido') ?? platos[0];
  return h('div', { class: 'carta-presentacion' },
    tituloCategoria(c, sobreAji ? 'text-blanco' : 'text-carbon'),
    h('p', { class: `carta-presentacion-texto ${sobreAji ? 'text-marfil' : 'text-carbon-suave'}` }, presentacion(c.id).texto),
    h('p', { class: `carta-presentacion-cuenta ${sobreAji ? 'text-maiz' : 'text-aji'}` }, plural(platos.length, 'plato', 'platos')),
    conPlato ? platoRedondo(insignia, 'plato-insignia') : null);
}

/** Entradas y principales: presentación a la izquierda y la lista de platos a la derecha. */
function bloquePagina(c, platos) {
  return h('section', { 'aria-labelledby': `cat-${c.id}`, class: 'carta-pagina' },
    contenedor(h('div', { class: 'grid gap-8 lg:grid-cols-12 lg:gap-12' },
      h('div', { class: 'lg:col-span-4' }, h('div', { class: 'lg:sticky lg:top-28' }, presentacionCategoria(c, platos))),
      h('div', { class: 'lg:col-span-8 lista-carta' }, platos.map((p) => fila(p))))));
}

/** Postres y bebidas: cartas cortas, una al lado de la otra. */
function bloquePar(c, platos) {
  return h('div', { 'aria-labelledby': `cat-${c.id}`, role: 'region' },
    presentacionCategoria(c, platos, { conPlato: false }),
    h('div', { class: 'lista-carta mt-6' }, platos.map((p) => fila(p))));
}

/** Especialidades: la única banda rojo ají, con el plato principal servido en grande. */
function bloqueDestacado(c, platos) {
  const [principal, ...resto] = platos;
  return h('section', { 'aria-labelledby': `cat-${c.id}`, class: 'bloque-aji carta-destacado bg-aji text-marfil' },
    contenedor(h('div', { class: 'grid gap-10 lg:grid-cols-12 lg:gap-12 items-center' },
      h('div', { class: 'lg:col-span-6' },
        presentacionCategoria(c, platos, { sobreAji: true, conPlato: false }),
        h('div', { class: 'lista-carta mt-6' }, resto.map((p) => fila(p, { sobreAji: true })))),
      h('article', { class: `plato destacado-plato lg:col-span-6 lg:order-first ${principal.disponible ? '' : 'agotado'}` },
        platoRedondo(principal, 'plato-destacado'),
        etiqueta(principal),
        h('div', { class: 'destacado-texto' },
          h('h4', { class: 'display text-[clamp(1.9rem,3.4vw,2.6rem)] text-blanco leading-tight' }, botonAbrir(principal)),
          precio(principal, 'text-[2.4rem] !text-maiz'),
          h('p', { class: 'mt-1 font-semibold text-marfil marcador' }, principal.origen),
          h('p', { class: 'mt-3 text-marfil max-w-[34rem]' }, principal.descripcion),
          h('span', { class: 'plato-fila-historia text-maiz', 'aria-hidden': 'true' }, 'Ver su historia', flecha()))))));
}
