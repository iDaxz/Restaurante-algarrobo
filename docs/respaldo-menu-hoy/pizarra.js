// "Hoy en la cocina": platos del día y mesas que quedan en cada turno de hoy.

import { PLATOS, PLATOS_DEL_DIA } from '../data/carta.js';
import { diaSemana, formatoLargo, sumarDias } from '../core/fechas.js';
import { estaCerrado } from '../core/disponibilidad.js';
import { $, h, plural, soles } from './dom.js';

export async function iniciarPizarra(servicio, { alElegirTurno, alVerPlato }) {
  const raiz = $('[data-pizarra]');
  if (!raiz) return;
  const hoy = servicio.ahora().fecha;

  $('[data-pizarra-fecha]', raiz).textContent = `· ${formatoLargo(hoy).toLowerCase()}`;

  const lista = $('[data-pizarra-platos]', raiz);
  const cerrado = estaCerrado(hoy);
  const idsHoy = PLATOS_DEL_DIA[diaSemana(hoy)] ?? PLATOS_DEL_DIA[2];
  lista.replaceChildren(
    ...(cerrado
      ? [h('li', { class: 'text-marfil' }, diaSemana(hoy) === 1
        ? 'Los lunes descansamos. Mañana volvemos con espesado.'
        : 'Hoy el restaurante no atiende. Te esperamos otro día.')]
      : idsHoy.map((id) => PLATOS.find((p) => p.id === id)).filter((plato) => plato?.disponible !== false).map((plato) => {
          return h('li', { class: 'flex items-baseline gap-3 text-[1.05rem]' },
            h('a', { href: '#carta', class: 'font-semibold text-blanco no-underline hover:underline', 'aria-haspopup': 'dialog', onclick: (e) => { if (!alVerPlato) return; e.preventDefault(); alVerPlato(plato.id); } }, plato.nombre),
            h('span', { class: 'guia', 'aria-hidden': 'true' }),
            h('span', { class: 'display text-[1.15rem] text-maiz tabular-nums whitespace-nowrap' }, soles(plato.precio)),
          );
        })),
  );

  const turnos = $('[data-pizarra-turnos]', raiz);
  try {
    const resumen = await servicio.resumenDeHoy();
    if (resumen.cerrado) {
      turnos.replaceChildren(
        h('p', { class: 'text-marfil' }, 'Hoy no hay turnos.'),
        h('button', { type: 'button', class: 'btn btn-linea-claro w-max', onclick: () => alElegirTurno({ fecha: sumarDias(hoy, 1) }) }, 'Reservar para mañana'),
      );
      return;
    }
    turnos.replaceChildren(...resumen.turnos.map((t) => filaTurno(t, hoy, alElegirTurno)));
  } catch {
    turnos.replaceChildren(h('p', { class: 'text-marfil' }, 'No pudimos contar las mesas. Revisa la disponibilidad en la sección de reservas.'));
  }
}

function filaTurno(turno, fecha, alElegirTurno) {
  let estado;
  let accion = null;
  const apagado = turno.terminado || turno.mesasLibres === 0;
  if (turno.terminado) {
    estado = `Ya cerró la reserva de este turno (última llegada ${turno.ultimaHora}).`;
  } else if (turno.mesasLibres === 0) {
    estado = 'Completo. Prueba el otro turno u otro día.';
  } else {
    estado = turno.mesasLibres <= 3
      ? `Últimas ${plural(turno.mesasLibres, 'mesa', 'mesas')}, desde las ${turno.proximaHora}`
      : `Quedan ${turno.mesasLibres} mesas, desde las ${turno.proximaHora}`;
    accion = h('button', {
      type: 'button',
      class: 'btn btn-maiz btn-chico shrink-0',
      onclick: () => alElegirTurno({ fecha, hora: turno.proximaHora }),
      'aria-label': `Reservar ${turno.nombre.toLowerCase()} de hoy a las ${turno.proximaHora}`,
    }, `Reservar ${turno.proximaHora}`);
  }
  return h('div', { class: 'flex items-center gap-4 border-t border-marfil/25 pt-4 first:border-0 first:pt-0' },
    h('div', { class: 'min-w-0 flex-1' },
      h('p', { class: 'flex flex-wrap items-baseline gap-x-2' },
        h('span', { class: `font-semibold ${apagado ? 'text-marfil' : 'text-blanco'}` }, turno.nombre),
        h('span', { class: 'text-[0.9rem] text-marfil tabular-nums' }, `${turno.inicio} – ${turno.fin}`)),
      h('p', { class: `text-[0.98rem] ${apagado ? 'text-marfil' : 'text-marfil font-medium'}` }, estado),
    ),
    accion,
  );
}
