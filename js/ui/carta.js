// Carta digital: todos los platos en una sola rejilla de cards, con los filtros a un lado
// (buscador, categorías y "ocultar agotados") y una invitación a reservar. Cada card es la foto
// del plato a sangre con el precio en un sello de maíz; al pasar el mouse sube la descripción.
// Al filtrar, las cards se reacomodan con una transición de vista (si el navegador la tiene).
// Se ven como mucho cuatro filas; el resto pasa a páginas que se recorren de lado (números,
// flechas o deslizando el dedo sobre la rejilla), para que la carta no crezca sin fin.
// Toda la card abre la ventana de detalle con la historia del plato.

import { numerosDePagina } from '../core/paginas.js';
import { CATEGORIAS, ETIQUETAS, PLATOS } from '../data/carta.js';
import { $, atributosFoto, h, plural, soles } from './dom.js';
import { abrirPlato } from './plato-detalle.js';
import { revelar } from './revelar.js';

/** Nombre corto (filtro) y singular (rótulo de la card) de cada categoría. */
const NOMBRES = {
  entradas: { corto: 'Entradas', uno: 'Entrada' },
  principales: { corto: 'Principales', uno: 'Plato principal' },
  especialidades: { corto: 'Especialidades', uno: 'Especialidad' },
  postres: { corto: 'Postres', uno: 'Postre' },
  bebidas: { corto: 'Bebidas', uno: 'Bebida' },
};
const nombres = (c) => NOMBRES[c.id] ?? { corto: c.nombre, uno: c.nombre };

/** Minúsculas y sin tildes, para que "chabelo" encuentre "Chabelo" y "cafe" encuentre "café". */
const normalizar = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const movimientoReducido = matchMedia('(prefers-reduced-motion: reduce)');
const FILAS_POR_PAGINA = 4;
const EASE_SALIDA = 'cubic-bezier(0.16, 1, 0.3, 1)';

/** Devuelve { repintar }: vuelve a dibujar filtros y cards con los datos actuales de PLATOS, sin perder el filtro. */
export function iniciarCarta() {
  const rejilla = $('[data-carta]');
  const filtros = $('[data-filtros]');
  const resultado = $('[data-carta-resultado]');
  const buscador = $('[data-carta-buscar]');
  const disponibles = $('[data-carta-disponibles]');
  if (!rejilla || !filtros) return { repintar() {} };

  const estado = { categoria: 'todas', texto: '', soloDisponibles: false, pagina: 0 };
  const paginas = h('nav', { class: 'carta-paginas', 'aria-label': 'Páginas de la carta', hidden: true });
  rejilla.after(paginas);
  /** Columnas reales de la rejilla en este ancho (2, 3 o 4): cuatro filas de ellas forman una página. */
  const porPagina = () => getComputedStyle(rejilla).gridTemplateColumns.split(' ').length * FILAS_POR_PAGINA;
  let opciones;
  let botones;
  let cards;
  const vacio = h('div', { class: 'carta-vacia', hidden: true },
    h('p', { class: 'carta-vacia-titulo display' }, 'No encontramos ese plato'),
    h('p', { class: 'carta-vacia-texto' }, 'Prueba con otra palabra o mira toda la carta.'),
    h('button', { type: 'button', class: 'btn btn-linea', onclick: () => {
      buscador.value = '';
      disponibles.checked = false;
      cambiar(() => Object.assign(estado, { categoria: 'todas', texto: '', soloDisponibles: false }));
    } }, 'Ver toda la carta'));

  function construir() {
    // Si la categoría elegida ya no existe (la borró el administrador), se vuelve a toda la carta.
    if (estado.categoria !== 'todas' && !CATEGORIAS.some((c) => c.id === estado.categoria)) estado.categoria = 'todas';
    opciones = [{ id: 'todas', nombre: 'Toda la carta', corto: 'Toda la carta' },
      ...CATEGORIAS.map((c) => ({ ...c, corto: nombres(c).corto }))];
    botones = opciones.map((cat) => {
      const cantidad = cat.id === 'todas' ? PLATOS.length : PLATOS.filter((p) => p.categoria === cat.id).length;
      return h('button', {
        type: 'button',
        class: 'filtro-carta',
        'aria-pressed': String(cat.id === estado.categoria),
        'data-categoria': cat.id,
        'aria-label': `${cat.corto} ${plural(cantidad, 'plato', 'platos')}`,
        onclick: () => cambiar(() => { estado.categoria = cat.id; }),
      }, h('span', { class: 'filtro-carta-nombre' }, cat.corto), ' ', h('span', { class: 'filtro-carta-cuenta', 'aria-hidden': 'true' }, cantidad));
    });
    filtros.replaceChildren(...botones);

    cards = PLATOS.map((plato) => ({ plato, el: card(plato), busca: normalizar([plato.nombre, plato.origen ?? '', plato.descripcion].join(' ')) }));
    rejilla.replaceChildren(...cards.map((c) => c.el), vacio);
  }

  const coincidentes = () => {
    const texto = normalizar(estado.texto);
    return cards.filter(({ plato, busca }) => (estado.categoria === 'todas' || plato.categoria === estado.categoria)
      && (!texto || busca.includes(texto))
      && (!estado.soloDisponibles || plato.disponible));
  };

  function aplicar() {
    const lista = coincidentes();
    const visibles = lista.length;
    const tamano = porPagina();
    const total = Math.max(1, Math.ceil(visibles / tamano));
    estado.pagina = Math.min(estado.pagina, total - 1);
    const desde = estado.pagina * tamano;
    const enPagina = new Set(lista.slice(desde, desde + tamano));
    for (const c of cards) c.el.hidden = !enPagina.has(c);
    vacio.hidden = visibles > 0;
    pintarPaginas(total);
    botones.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.categoria === estado.categoria)));
    const categoria = opciones.find((c) => c.id === estado.categoria);
    resultado.textContent = [
      plural(visibles, 'plato', 'platos'),
      estado.categoria === 'todas' ? 'en toda la carta' : `en ${categoria.nombre}`,
      estado.texto.trim() ? `para «${estado.texto.trim()}»` : '',
      estado.soloDisponibles ? '· solo disponibles hoy' : '',
      total > 1 ? `· del ${desde + 1} al ${Math.min(desde + tamano, visibles)}` : '',
    ].filter(Boolean).join(' ');
  }

  /** Flechas y números debajo de la rejilla; solo aparecen si hay más de una página. */
  function pintarPaginas(total) {
    paginas.hidden = total <= 1;
    if (total <= 1) return paginas.replaceChildren();
    const enfocado = paginas.contains(document.activeElement) ? document.activeElement.dataset.ir : null;
    const flechaPagina = (dir, texto) => h('button', {
      type: 'button', class: 'carta-pagina-flecha', 'data-ir': dir, 'aria-label': texto,
      disabled: dir === 'anterior' ? estado.pagina === 0 : estado.pagina === total - 1,
      onclick: () => irA(estado.pagina + (dir === 'anterior' ? -1 : 1)),
      html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${dir === 'anterior' ? 'm15 6-6 6 6 6' : 'm9 6 6 6-6 6'}"/></svg>`,
    });
    paginas.replaceChildren(
      flechaPagina('anterior', 'Página anterior'),
      h('ol', { class: 'carta-pagina-numeros' }, ...numerosDePagina(total, estado.pagina).map((n) => (n === '…'
        ? h('li', { class: 'carta-pagina-hueco', 'aria-hidden': 'true' }, '…')
        : h('li', {}, h('button', {
          type: 'button', class: 'carta-pagina', 'data-ir': String(n),
          'aria-label': `Página ${n + 1} de ${total}`, 'aria-current': n === estado.pagina ? 'page' : null,
          onclick: () => irA(n),
        }, String(n + 1)))))),
      flechaPagina('siguiente', 'Página siguiente'));
    // Tras cambiar de página, el foco sigue en el mismo control (o en el número activo si la flecha se apagó).
    if (enfocado) {
      const destino = $(`[data-ir="${enfocado}"]:not([disabled])`, paginas) ?? $('[aria-current="page"]', paginas);
      destino?.focus({ preventScroll: true });
    }
  }

  /** Cambia de página deslizando la rejilla hacia el lado que corresponde. */
  async function irA(n) {
    const total = Math.max(1, Math.ceil(coincidentes().length / porPagina()));
    const destino = Math.min(Math.max(n, 0), total - 1);
    if (destino === estado.pagina) return;
    const lado = destino > estado.pagina ? 1 : -1;
    const animar = !movimientoReducido.matches;
    if (animar) {
      await rejilla.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-lado * 32}px)` }],
        { duration: 160, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' }).finished.catch(() => {});
    }
    estado.pagina = destino;
    aplicar();
    // Si el comienzo de la carta quedó arriba de la pantalla, se vuelve a él para leer la página desde el principio.
    if (resultado.getBoundingClientRect().top < 0) resultado.scrollIntoView({ block: 'start', behavior: animar ? 'smooth' : 'auto' });
    rejilla.getAnimations().forEach((a) => a.cancel());
    if (animar) {
      rejilla.animate([{ opacity: 0, transform: `translateX(${lado * 40}px)` }, { opacity: 1, transform: 'none' }],
        { duration: 380, easing: EASE_SALIDA });
    }
  }

  // Las cards se reacomodan con una transición de vista: cada una conserva su nombre de transición.
  function cambiar(modificar) {
    modificar();
    estado.pagina = 0;
    if (!document.startViewTransition || movimientoReducido.matches) aplicar();
    else document.startViewTransition(aplicar);
    $(`[data-categoria="${estado.categoria}"]`, filtros).scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  let espera;
  buscador?.addEventListener('input', () => {
    clearTimeout(espera);
    espera = setTimeout(() => cambiar(() => { estado.texto = buscador.value; }), 220);
  });
  disponibles?.addEventListener('change', () => cambiar(() => { estado.soloDisponibles = disponibles.checked; }));

  // Deslizar el dedo de lado sobre la rejilla pasa de página (solo si el gesto es claramente horizontal).
  let toque = null;
  rejilla.addEventListener('touchstart', (e) => { toque = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }, { passive: true });
  rejilla.addEventListener('touchend', (e) => {
    if (!toque || paginas.hidden) return;
    const dx = e.changedTouches[0].clientX - toque.x;
    const dy = e.changedTouches[0].clientY - toque.y;
    toque = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) irA(estado.pagina + (dx < 0 ? 1 : -1));
  }, { passive: true });

  // Si cambia el número de columnas (girar el teléfono, agrandar la ventana), la página se recalcula
  // para seguir mostrando el primer plato que se estaba viendo.
  let tamanoAnterior = porPagina();
  for (const corte of ['(min-width: 640px)', '(min-width: 1280px)']) {
    matchMedia(corte).addEventListener('change', () => {
      estado.pagina = Math.floor((estado.pagina * tamanoAnterior) / porPagina());
      tamanoAnterior = porPagina();
      aplicar();
    });
  }

  construir();
  aplicar();
  revelar(rejilla.querySelectorAll('.carta-card'));

  // Al repintar, las cards nuevas aparecen ya visibles (sin la entrada al hacer scroll).
  return {
    repintar() {
      construir();
      aplicar();
    },
  };
}

// ---------- Piezas ----------

const etiqueta = (plato) =>
  plato.etiqueta && h('span', { class: `etiqueta etiqueta--${plato.etiqueta}` }, ETIQUETAS[plato.etiqueta]);

const flecha = () => h('svg', { class: 'w-4 h-4', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', html: '<path d="M5 12h14M13 6l6 6-6 6"/>' });

/** El nombre del plato es el botón: su área se estira a toda la card (ver .plato-abrir en CSS). */
const botonAbrir = (plato) => h('button', {
  type: 'button',
  class: 'plato-abrir',
  'aria-haspopup': 'dialog',
  'data-plato': plato.id,
  onclick: () => abrirPlato(plato.id),
}, plato.nombre, h('span', { class: 'sr-only' }, ': ver descripción e historia'));

/** Una card: foto a sangre, sello con el precio, etiquetas arriba y el nombre sobre un degradado. */
function card(plato) {
  const categoria = CATEGORIAS.find((c) => c.id === plato.categoria);
  const especial = plato.categoria === 'especialidades';
  const el = h('article', { class: `plato carta-card ${especial ? 'carta-card--especial' : ''} ${plato.disponible ? '' : 'agotado'}` },
    h('img', { class: 'carta-card-foto', ...atributosFoto(plato.foto, '(min-width: 1280px) 15rem, (min-width: 640px) 30vw, 50vw'), alt: '', loading: 'lazy', decoding: 'async', width: 960, height: 720 }),
    h('p', { class: `carta-card-sello display ${plato.disponible ? '' : 'precio-agotado'}` },
      h('span', { class: 'sr-only' }, plato.disponible ? 'Precio: ' : 'Agotado hoy. Precio: '), soles(plato.precio)),
    h('div', { class: 'carta-card-marcas' },
      etiqueta(plato),
      plato.disponible ? null : h('span', { class: 'agotado-hoy' }, 'Agotado hoy')),
    h('div', { class: 'carta-card-pie' },
      h('p', { class: 'carta-card-tipo' }, [categoria ? nombres(categoria).uno : null, plato.origen].filter(Boolean).join(' · ')),
      h('h3', { class: 'carta-card-nombre display' }, botonAbrir(plato)),
      h('div', { class: 'carta-card-mas', 'aria-hidden': 'true' },
        h('p', { class: 'carta-card-texto' }, plato.descripcion),
        h('span', { class: 'carta-card-historia' }, 'Ver su historia', flecha()))));
  el.style.viewTransitionName = `plato-${plato.id.replace(/[^a-z0-9-]/gi, '')}`;
  return el;
}
