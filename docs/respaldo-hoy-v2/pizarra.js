// Banda "Hoy": la fecha, si el local está abierto ahora y las mesas que quedan en cada turno.
// Los precios ya están en la carta, justo debajo; aquí solo se decide cuándo venir.
// El mismo estado ("Abierto ahora · …") se pinta en el menú móvil y se refresca cada minuto.

import { estadoDelLocal } from '../core/abierto.js';
import { formatoLargo, sumarDias } from '../core/fechas.js';
import { $$, $, h, plural } from './dom.js';

export async function iniciarPizarra(servicio, { alElegirTurno }) {
  const raiz = $('[data-pizarra]');
  if (!raiz) return;
  const hoy = servicio.ahora().fecha;

  // "Miércoles" grande y "28 de octubre" debajo.
  const [dia, ...resto] = formatoLargo(hoy).split(', ');
  $('[data-pizarra-dia]', raiz).textContent = dia.charAt(0).toUpperCase() + dia.slice(1);
  $('[data-pizarra-fecha]', raiz).textContent = resto.join(', ');
  if (servicio.maxPersonas) {
    $('[data-pizarra-nota]', raiz).textContent = `Reserva en línea hasta ${servicio.maxPersonas} personas. Para grupos más grandes, llámanos.`;
  }

  const turnos = $('[data-pizarra-turnos]', raiz);
  let resumen;
  try {
    resumen = await servicio.resumenDeHoy();
  } catch {
    turnos.replaceChildren(h('p', { class: 'text-marfil' }, 'No pudimos contar las mesas. Revisa la disponibilidad en la sección de reservas.'));
    pintarEstado(null);
    return;
  }

  const actualizarEstado = () => {
    const estado = estadoDelLocal(resumen, servicio.ahora().minutos);
    pintarEstado(estado);
    return estado;
  };
  const estado = actualizarEstado();
  setInterval(actualizarEstado, 60_000);

  if (resumen.cerrado) {
    turnos.replaceChildren(h('div', { class: 'hoy-descanso' },
      h('p', { class: 'hoy-descanso-texto' }, 'Hoy no hay turnos: el fogón descansa.'),
      h('button', { type: 'button', class: 'btn btn-maiz', onclick: () => alElegirTurno({ fecha: sumarDias(hoy, 1) }) }, 'Reservar para mañana')));
    return;
  }
  turnos.replaceChildren(...resumen.turnos.map((t) => tarjetaTurno(t, hoy, estado.turnoActual === t.id, alElegirTurno)));
}

/** Pinta el estado en todos los sitios que lo muestran (banda "Hoy" y menú móvil). */
function pintarEstado(estado) {
  for (const el of $$('[data-estado-local]')) {
    el.dataset.abierto = String(Boolean(estado?.abierto));
    $('[data-estado-local-texto]', el).textContent = estado?.texto ?? 'Barranco, Lima';
  }
}

/** Cuánto sitio queda, en tres tramos: el medidor lo dibuja y el texto lo dice. */
const nivel = (libres) => (libres >= 8 ? 3 : libres >= 4 ? 2 : libres >= 1 ? 1 : 0);

function tarjetaTurno(turno, fecha, esAhora, alElegirTurno) {
  const apagado = turno.terminado || turno.mesasLibres === 0;
  let estado;
  if (turno.terminado) estado = `Terminó por hoy (última llegada ${turno.ultimaHora}).`;
  else if (turno.mesasLibres === 0) estado = 'Completo. Prueba el otro turno u otro día.';
  else if (turno.mesasLibres <= 3) estado = `Últimas ${plural(turno.mesasLibres, 'mesa', 'mesas')}, desde las ${turno.proximaHora}`;
  else estado = `Quedan ${turno.mesasLibres} mesas, desde las ${turno.proximaHora}`;

  const llenos = apagado ? 0 : nivel(turno.mesasLibres);
  return h('article', { class: `hoy-turno ${esAhora ? 'es-ahora' : ''} ${apagado ? 'apagado' : ''}` },
    h('div', { class: 'hoy-turno-cabeza' },
      h('h3', { class: 'hoy-turno-nombre display' }, turno.nombre),
      esAhora ? h('span', { class: 'hoy-turno-ahora' }, 'Ahora') : null),
    h('p', { class: 'hoy-turno-horas' }, `${turno.inicio} – ${turno.fin}`),
    h('div', { class: 'hoy-medidor', 'aria-hidden': 'true' },
      [1, 2, 3].map((i) => h('span', { class: i <= llenos ? 'lleno' : '' }))),
    h('p', { class: 'hoy-turno-estado' }, estado),
    apagado ? null : h('button', {
      type: 'button',
      class: 'btn btn-maiz hoy-turno-boton',
      onclick: () => alElegirTurno({ fecha, hora: turno.proximaHora }),
      'aria-label': `Reservar ${turno.nombre.toLowerCase()} de hoy a las ${turno.proximaHora}`,
    }, `Reservar ${turno.proximaHora}`));
}
