// Carta digital con filtros por categoría, a modo de «pase de cocina»: los nombres de los platos
// mandan, en una carta tipográfica, y a su lado una sola «ventana de cocina» muestra en grande el
// plato que se está mirando (foto, origen, descripción). Al pasar el mouse o enfocar un nombre, la
// ventana cambia de plato. En móvil no hay ventana: cada fila lleva su foto y su descripción.
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

  // Control segmentado: la categoría elegida se rellena de carbón.
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
    const grupos = [];
    let par = null;
    for (const c of categorias) {
      const platos = PLATOS.filter((p) => p.categoria === c.id);
      if (!platos.length) continue;
      const forma = presentacion(c.id).forma;
      // Postres y bebidas comparten un pase: son cartas cortas.
      if (forma === 'par') {
        if (!par) grupos.push(par = { categorias: [], forma });
        par.categorias.push({ c, platos });
      } else grupos.push({ categorias: [{ c, platos }], forma });
    }
    // La ventana se alterna de lado para dar ritmo a la carta completa.
    destino.replaceChildren(...grupos.map((g, i) => pase(g, i % 2 === 1)));
  }

  pintar();
  revelar(destino.querySelectorAll('.pase-cabeza, .pase-fila, .ventana-cocina'));
}

// ---------- Piezas ----------

const etiqueta = (plato) =>
  plato.etiqueta && h('span', { class: `etiqueta etiqueta--${plato.etiqueta}` }, ETIQUETAS[plato.etiqueta]);

const agotadoHoy = (plato) => (plato.disponible ? null : h('span', { class: 'agotado-hoy' }, 'Agotado hoy'));

const flecha = (clases = 'w-4 h-4') => h('svg', { class: clases, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', html: '<path d="M5 12h14M13 6l6 6-6 6"/>' });

/** El nombre del plato es el botón: su área se estira a toda la fila (ver .plato-abrir en CSS). */
const botonAbrir = (plato) => h('button', {
  type: 'button',
  class: 'plato-abrir',
  'aria-haspopup': 'dialog',
  'data-plato': plato.id,
  onclick: () => abrirPlato(plato.id),
}, plato.nombre, h('span', { class: 'sr-only' }, ': ver descripción e historia'));

/** Una línea de la carta: nombre y precio; origen debajo. En móvil suma foto y descripción. */
function fila(plato) {
  return h('article', { class: `plato pase-fila ${plato.disponible ? '' : 'agotado'}`, 'data-pase-plato': plato.id },
    h('span', { class: 'pase-foto', 'aria-hidden': 'true' },
      h('img', { src: plato.foto, alt: '', loading: 'lazy', decoding: 'async', width: 960, height: 720 })),
    h('div', { class: 'min-w-0' },
      h('div', { class: 'pase-linea' },
        h('span', { class: 'pase-flecha', 'aria-hidden': 'true' }, flecha('w-5 h-5')),
        h('h4', { class: 'pase-nombre display' }, botonAbrir(plato)),
        h('p', { class: `precio pase-precio ${plato.disponible ? '' : 'precio-agotado'}` },
          h('span', { class: 'sr-only' }, plato.disponible ? 'Precio: ' : 'Agotado hoy. Precio: '), soles(plato.precio))),
      h('p', { class: 'pase-meta' },
        plato.origen ? h('span', { class: 'pase-origen' }, plato.origen) : null,
        etiqueta(plato),
        agotadoHoy(plato)),
      h('p', { class: 'pase-descripcion' }, plato.descripcion)));
}

/** Cabecera de una categoría dentro del pase. */
const cabeza = (c, platos) =>
  h('header', { class: 'pase-cabeza' },
    h('h3', { id: `cat-${c.id}`, class: 'pase-titulo display' }, c.nombre),
    h('p', { class: 'pase-intro' }, presentacion(c.id).texto,
      h('span', { class: 'pase-cuenta' }, plural(platos.length, 'plato', 'platos'))));

/**
 * La ventana de cocina: el plato que se mira, en grande. Repite lo que la fila ya dice, así que
 * queda fuera del árbol de accesibilidad; con teclado y lector se usa la fila y su ventana de detalle.
 */
function ventanaCocina() {
  const foto = h('div', { class: 'ventana-foto' });
  const marcas = h('p', { class: 'ventana-marcas' });
  const nombre = h('p', { class: 'ventana-nombre display' });
  const precio = h('p', { class: 'ventana-precio display' });
  const origen = h('p', { class: 'ventana-origen' });
  const texto = h('p', { class: 'ventana-texto' });
  let actual = null;
  const historia = h('button', { type: 'button', class: 'ventana-historia', tabindex: '-1', onclick: () => actual && abrirPlato(actual.id) },
    'Ver su historia', flecha());
  const raiz = h('div', { class: 'ventana-cocina', 'aria-hidden': 'true' },
    foto, h('div', { class: 'ventana-cuerpo' }, marcas, h('div', { class: 'ventana-linea' }, nombre, precio), origen, texto, historia));

  function mostrar(plato) {
    if (actual?.id === plato.id) return;
    const primera = !actual;
    actual = plato;
    // Fundido: la foto nueva entra sobre la anterior y la anterior se retira al terminar.
    const img = h('img', { src: plato.foto, alt: '', decoding: 'async', width: 960, height: 720, class: primera ? '' : 'entrando' });
    [...foto.children].slice(0, -1).forEach((x) => x.remove());
    foto.append(img);
    if (!primera) {
      const entrar = () => requestAnimationFrame(() => requestAnimationFrame(() => img.classList.remove('entrando')));
      img.decode().then(entrar, entrar);
      img.addEventListener('transitionend', () => { while (foto.firstChild !== img && foto.firstChild) foto.firstChild.remove(); }, { once: true });
    }
    raiz.classList.toggle('agotado', !plato.disponible);
    marcas.replaceChildren(...[etiqueta(plato), agotadoHoy(plato)].filter(Boolean));
    nombre.textContent = plato.nombre;
    precio.textContent = soles(plato.precio);
    precio.classList.toggle('precio-agotado', !plato.disponible);
    origen.textContent = plato.origen ?? '';
    texto.textContent = plato.descripcion;
  }
  return { raiz, mostrar };
}

/** Un pase: la carta tipográfica de una o dos categorías y su ventana de cocina. */
function pase({ categorias, forma }, ventanaIzquierda) {
  const sobreAji = forma === 'destacado';
  const todos = categorias.flatMap((x) => x.platos);
  const porId = new Map(todos.map((p) => [p.id, p]));
  const ventana = ventanaCocina();
  ventana.mostrar(todos.find((p) => p.etiqueta === 'mas-vendido') ?? todos[0]);

  const filas = categorias.map(({ c, platos }) =>
    h('section', { 'aria-labelledby': `cat-${c.id}`, class: 'pase-grupo' }, cabeza(c, platos),
      h('div', { class: 'pase-lista' }, platos.map(fila))));
  const lista = h('div', { class: 'lg:col-span-7' }, filas);

  const marcar = (filaEl) => {
    const plato = porId.get(filaEl?.dataset.pasePlato);
    if (!plato) return;
    lista.querySelectorAll('.pase-fila.en-pase').forEach((x) => x.classList.remove('en-pase'));
    filaEl.classList.add('en-pase');
    ventana.mostrar(plato);
  };
  lista.addEventListener('pointerover', (e) => { if (e.pointerType === 'mouse') marcar(e.target.closest('.pase-fila')); });
  lista.addEventListener('focusin', (e) => marcar(e.target.closest('.pase-fila')));
  // Al acercarse a la lista se adelantan las fotos para que el cambio sea inmediato.
  lista.addEventListener('pointerenter', () => todos.forEach((p) => { new Image().src = p.foto; }), { once: true });
  const inicial = lista.querySelector(`[data-pase-plato="${CSS.escape(todos.find((p) => p.etiqueta === 'mas-vendido')?.id ?? todos[0].id)}"]`);
  inicial?.classList.add('en-pase');

  const atributos = categorias.length > 1
    ? { 'aria-label': categorias.map((x) => x.c.nombre).join(' y ') }
    : {};
  return h('section', { ...atributos, class: `carta-pase ${sobreAji ? 'sobre-aji bloque-aji bg-aji text-marfil' : ''}` },
    contenedor(h('div', { class: 'grid gap-10 lg:grid-cols-12 lg:gap-14 items-start' },
      lista,
      h('div', { class: `hidden lg:block lg:col-span-5 lg:sticky lg:top-28 ${ventanaIzquierda ? 'lg:order-first' : ''}` }, ventana.raiz))));
}
