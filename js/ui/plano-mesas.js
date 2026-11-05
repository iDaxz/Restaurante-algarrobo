// Plano para elegir mesa, como las butacas de un cine. Dibuja el piso elegido con sus zonas y
// referencias (ventanal, fogón, barra…) y una mesa por botón: libre (se puede tocar), ocupada,
// "no es para tu grupo" o elegida. Elegir es opcional: "Que la casa elija" deja la asignación automática.

import { PISOS, PLANO_ANGOSTO, UBICACION_MESAS, ubicacionDe } from '../data/plano.js';

const angosto = matchMedia('(max-width: 639px)');
/** El dibujo del piso según el ancho: algunos pisos tienen otra distribución en pantallas angostas. */
const dibujo = (pisoId) => (angosto.matches && PLANO_ANGOSTO[pisoId]) || null;
import { $, $$, h, plural } from './dom.js';

const ESTADO_TEXTO = { libre: 'libre', ocupada: 'ocupada', 'no-sirve': 'no es para tu grupo', elegida: 'tu mesa' };

/**
 * @param {{ alElegir: (id: string) => void, alDejarALaCasa: () => void }} acciones
 * @returns {{ el: HTMLElement, pintar: Function, cargando: Function, aviso: Function }}
 */
export function crearPlano({ alElegir, alDejarALaCasa }) {
  let piso = PISOS[0].id;
  let ultimo = null; // { mesas, elegida, porLaCasa, personas }

  const pestanas = h('div', { class: 'plano-pisos', role: 'group', 'aria-label': 'Piso' },
    PISOS.map((p) => h('button', {
      type: 'button', class: 'plano-piso', 'data-piso': p.id, 'aria-pressed': String(p.id === piso),
      onclick: () => { piso = p.id; if (ultimo) pintar(ultimo); },
    }, p.nombre, h('span', { class: 'plano-piso-libres', 'data-libres': p.id }))));
  const lienzo = h('div', { class: 'plano-lienzo' });
  const otras = h('div', { class: 'plano-otras', hidden: true });
  const resumen = h('p', { class: 'plano-resumen', 'aria-live': 'polite' });
  const avisoEl = h('p', { class: 'plano-aviso error-msg', role: 'alert', hidden: true });
  const casa = h('button', { type: 'button', class: 'btn btn-linea btn-chico', onclick: () => alDejarALaCasa() }, 'Que la casa elija');
  const leyenda = h('ul', { class: 'plano-leyenda', 'aria-hidden': 'true' },
    [['libre', 'Libre'], ['elegida', 'Tu mesa'], ['ocupada', 'Ocupada'], ['no-sirve', 'Otro tamaño']]
      .map(([e, t]) => h('li', {}, h('span', { class: `plano-muestra plano-muestra--${e}` }), t)));

  const el = h('div', { class: 'plano-reserva' }, pestanas, lienzo, otras, leyenda, h('div', { class: 'plano-pie' }, resumen, casa), avisoEl);

  function botonMesa(m, estado) {
    const u = ubicacionDe(m.id);
    const nombre = m.nombre ? `${m.id} · ${m.nombre}` : m.id;
    // Empieza con lo que se ve en la mesa (M9) para que el control por voz la encuentre.
    const etiqueta = `${nombre}${u ? `, ${u.zona.nombre}, ${u.piso.nombre.toLowerCase()}` : ''}, ${plural(m.asientos, 'asiento', 'asientos')}, ${ESTADO_TEXTO[estado]}`;
    const b = h('button', {
      type: 'button',
      class: `plano-mesa plano-mesa--${m.asientos >= 8 ? 8 : m.asientos >= 6 ? 6 : m.asientos >= 4 ? 4 : 2} es-${estado}`,
      'data-mesa': m.id,
      'aria-label': etiqueta,
      'aria-pressed': String(estado === 'elegida'),
      disabled: estado !== 'libre' && estado !== 'elegida',
      onclick: () => estado === 'libre' && alElegir(m.id),
    }, h('span', { class: 'plano-mesa-id' }, m.id),
    h('span', { class: 'plano-sillas', 'aria-hidden': 'true' }, Array.from({ length: Math.min(m.asientos, 8) }, () => h('i'))));
    const pos = dibujo(UBICACION_MESAS[m.id]?.piso)?.mesas[m.id] ?? UBICACION_MESAS[m.id];
    if (pos) {
      b.style.left = `${pos.x}%`;
      b.style.top = `${pos.y}%`;
    }
    return b;
  }

  function pintar({ mesas, elegida, porLaCasa, personas }) {
    ultimo = { mesas, elegida, porLaCasa, personas };
    const estadoDe = (m) => (m.id === elegida ? 'elegida' : m.estado);
    // Si la mesa elegida está en el otro piso, el plano se abre en ese piso la primera vez.
    const pisoDeElegida = UBICACION_MESAS[elegida]?.piso;
    if (pisoDeElegida && el.dataset.pisoMostrado !== `${elegida}`) {
      piso = pisoDeElegida;
      el.dataset.pisoMostrado = elegida;
    }
    const p = { ...PISOS.find((x) => x.id === piso), ...dibujo(piso) };
    $$('[data-piso]', pestanas).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.piso === piso)));
    for (const x of PISOS) {
      const libres = mesas.filter((m) => UBICACION_MESAS[m.id]?.piso === x.id && m.estado === 'libre').length;
      $(`[data-libres="${x.id}"]`, pestanas).textContent = ` · ${plural(libres, 'libre', 'libres')}`;
    }
    lienzo.replaceChildren(
      ...p.zonas.map((z) => h('div', { class: 'plano-zona', style: `left:${z.x}%;top:${z.y}%;width:${z.ancho}%;height:${z.alto}%` },
        h('span', {}, z.nombre))),
      ...p.referencias.map((r) => h('div', { class: `plano-ref plano-ref--${r.tipo}`, 'aria-hidden': 'true', style: `left:${r.x}%;top:${r.y}%;width:${r.ancho}%;height:${r.alto}%` },
        h('span', {}, r.texto))),
      h('div', { class: 'plano-reserva-mesas', role: 'group', 'aria-label': `Mesas del ${p.nombre.toLowerCase()}` },
        mesas.filter((m) => UBICACION_MESAS[m.id]?.piso === piso).map((m) => botonMesa(m, estadoDe(m)))));
    // Mesas que el administrador agregó y aún no están dibujadas en el plano.
    const sueltas = mesas.filter((m) => !UBICACION_MESAS[m.id]);
    otras.hidden = !sueltas.length;
    otras.replaceChildren(h('p', { class: 'plano-otras-titulo' }, 'Otras mesas'),
      h('div', { class: 'plano-otras-lista', role: 'group', 'aria-label': 'Otras mesas' }, sueltas.map((m) => botonMesa(m, estadoDe(m)))));

    const m = mesas.find((x) => x.id === elegida);
    const u = ubicacionDe(elegida);
    resumen.replaceChildren(m
      ? h('span', {}, h('strong', {}, `Mesa ${m.id}${m.nombre ? ` · ${m.nombre}` : ''}`),
        ` · ${u ? `${u.texto} · ` : ''}${plural(m.asientos, 'asiento', 'asientos')}`,
        porLaCasa ? h('span', { class: 'plano-casa' }, ' · La eligió la casa. Toca otra libre si prefieres.') : null)
      : h('span', {}, `Toca una mesa libre para ${plural(personas, 'persona', 'personas')}.`));
    casa.hidden = porLaCasa;
    avisoEl.hidden = true;
  }

  function cargando() {
    lienzo.replaceChildren(h('p', { class: 'plano-cargando cargando' }, 'Cargando el plano'));
  }

  function aviso(texto) {
    avisoEl.textContent = texto;
    avisoEl.hidden = !texto;
  }

  // Al girar el teléfono o cambiar el ancho, el plano se vuelve a dibujar con la distribución que toca.
  angosto.addEventListener('change', () => ultimo && pintar(ultimo));

  return { el, pintar, cargando, aviso };
}
