// "¿Qué se te antoja?": eliges un antojo y la casa sugiere un plato de la carta.
// Sin precios (están en la carta, justo debajo). Al cambiar, el plato gira como sobre la mesa.
// Solo sugiere platos que existen y están disponibles hoy; un antojo sin ninguno no se muestra.

import { PLATOS } from '../data/carta.js';
import { abrirPlato } from './plato-detalle.js';
import { $, $$, fotoLigera, h, ponerFoto } from './dom.js';

const ANTOJOS = [
  { id: 'fresco', nombre: 'Algo fresco', platos: ['ceviche-de-mero', 'leche-de-tigre', 'chinguirito'] },
  { id: 'contundente', nombre: 'Algo contundente', platos: ['seco-de-cabrito', 'cabrito-con-zarandaja', 'arroz-con-pato'] },
  { id: 'compartir', nombre: 'Para compartir', platos: ['arroz-con-pato-mesa'] },
  { id: 'dulce', nombre: 'Algo dulce', platos: ['king-kong', 'mazamorra-morada', 'arroz-zambito'] },
  { id: 'brindar', nombre: 'Para brindar', platos: ['chicha-de-jora', 'coctel-de-algarrobina', 'chicha-morada'] },
];
const SORPRESA = 'sorpresa';
const TAMANO_PLATO = '(min-width: 1024px) 24rem, 68vw';
const INICIAL = 'contundente';
const EASE_SALIDA = 'cubic-bezier(0.16, 1, 0.3, 1)';

const ICONO_SORPRESA =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/></svg>';

export function iniciarAntojo() {
  const raiz = $('[data-antojo]');
  if (!raiz) return;
  const disponible = (id) => PLATOS.find((p) => p.id === id && p.disponible !== false);
  const antojos = ANTOJOS
    .map((a) => ({ ...a, lista: a.platos.map(disponible).filter(Boolean) }))
    .filter((a) => a.lista.length);
  if (!antojos.length) {
    raiz.closest('section').hidden = true;
    return;
  }
  // Las fotos se piden ya, para que el giro no espere a la red.
  antojos.forEach((a) => a.lista.forEach((p) => ponerFoto(new Image(), p.foto, TAMANO_PLATO)));

  const foto = $('[data-antojo-foto]', raiz);
  const ficha = $('[data-antojo-ficha]', raiz);
  const otra = $('[data-antojo-otra]', raiz);
  const estado = { antojo: null, indice: 0, plato: null, turno: 0 };

  const opciones = [
    ...antojos.map((a) => opcion(a.id, a.nombre, h('img', { src: fotoLigera(a.lista[0].foto), alt: '', loading: 'lazy' }))),
    opcion(SORPRESA, 'Sorpréndeme', h('span', { class: 'antojo-opcion-icono', html: ICONO_SORPRESA })),
  ];
  $('[data-antojo-opciones]', raiz).replaceChildren(...opciones);

  function opcion(id, nombre, figura) {
    return h('button', { type: 'button', class: 'antojo-opcion', 'aria-pressed': 'false', 'data-antojo-id': id, onclick: () => elegir(id) },
      figura, h('span', {}, nombre));
  }

  function alAzar() {
    const otros = PLATOS.filter((p) => p.disponible !== false && p.id !== estado.plato?.id);
    return otros[Math.floor(Math.random() * otros.length)] ?? estado.plato;
  }

  function elegir(id, { animar = true } = {}) {
    const mismo = id === estado.antojo;
    estado.antojo = id;
    $$('[data-antojo-id]', raiz).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.antojoId === id)));
    if (id === SORPRESA) {
      mostrar(alAzar(), animar);
    } else {
      const lista = antojos.find((a) => a.id === id).lista;
      // Volver a tocar el mismo antojo pasa a la siguiente idea.
      estado.indice = mismo ? (estado.indice + 1) % lista.length : 0;
      mostrar(lista[estado.indice], animar);
    }
    const lista = antojos.find((a) => a.id === id)?.lista;
    otra.hidden = id !== SORPRESA && lista.length < 2;
  }

  async function mostrar(plato, animar) {
    if (!plato || plato === estado.plato) return;
    estado.plato = plato;
    const turno = ++estado.turno;
    const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (animar) {
      const salida = foto.animate(
        reducido ? [{ opacity: 1 }, { opacity: 0 }] : [{ transform: 'none', opacity: 1 }, { transform: 'rotate(70deg) scale(0.86)', opacity: 0 }],
        { duration: reducido ? 120 : 240, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' });
      ficha.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' });
      await salida.finished.catch(() => {});
      if (turno !== estado.turno) return;
    }

    ponerFoto(foto, plato.foto, TAMANO_PLATO);
    foto.alt = `Foto ilustrativa: ${plato.nombre}`;
    $('[data-antojo-origen]', raiz).textContent = plato.origen ?? '';
    $('[data-antojo-nombre]', raiz).textContent = plato.nombre;
    $('[data-antojo-descripcion]', raiz).textContent = plato.descripcion;
    if (!animar) return;
    await foto.decode().catch(() => {});
    if (turno !== estado.turno) return;

    foto.getAnimations().forEach((a) => a.cancel());
    ficha.getAnimations().forEach((a) => a.cancel());
    foto.animate(
      reducido ? [{ opacity: 0 }, { opacity: 1 }] : [{ transform: 'rotate(-70deg) scale(0.86)', opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: reducido ? 160 : 560, easing: EASE_SALIDA });
    ficha.animate(
      reducido ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
      { duration: 420, delay: reducido ? 0 : 120, easing: EASE_SALIDA, fill: 'backwards' });
  }

  $('[data-antojo-historia]', raiz).addEventListener('click', () => estado.plato && abrirPlato(estado.plato.id));
  otra.addEventListener('click', () => elegir(estado.antojo));

  elegir(antojos.some((a) => a.id === INICIAL) ? INICIAL : antojos[0].id, { animar: false });
}
