// Sección "Hoy": la jornada como una línea (los turnos, la hora de ahora y lo que ya pasó),
// las mesas que quedan en cada turno y los próximos siete días para reservar con un toque.
// Sin precios: ya están en la carta, justo debajo. El estado ("Abierto ahora · …") se pinta
// también en el menú móvil y se refresca cada minuto, junto con la aguja de la regla.

import { RESERVAS } from '../config/restaurante.js';
import { estadoDelLocal } from '../core/abierto.js';
import { aHora, formatoLargo, sumarDias } from '../core/fechas.js';
import { posicionEnRegla, reglaDelDia } from '../core/jornada.js';
import { $$, $, h, plural } from './dom.js';

const DIAS_A_LA_VISTA = 7;

export async function iniciarPizarra(servicio, { alElegirTurno }) {
  const raiz = $('[data-pizarra]');
  if (!raiz) return;
  const hoy = servicio.ahora().fecha;

  // "Miércoles" y "28 de octubre".
  const [dia, ...resto] = formatoLargo(hoy).split(', ');
  $('[data-pizarra-dia]', raiz).textContent = dia.charAt(0).toUpperCase() + dia.slice(1);
  $('[data-pizarra-fecha]', raiz).textContent = resto.join(', ');
  if (servicio.maxPersonas) {
    $('[data-pizarra-nota]', raiz).textContent = `Reserva en línea hasta ${servicio.maxPersonas} personas. Para grupos más grandes, llámanos.`;
  }

  pintarSemana($('[data-pizarra-semana]', raiz), servicio, hoy, alElegirTurno);

  const contenedor = $('[data-pizarra-turnos]', raiz);
  let resumen;
  try {
    resumen = await servicio.resumenDeHoy();
  } catch {
    contenedor.replaceChildren(h('p', { class: 'jornada-aviso' }, 'No pudimos contar las mesas. Revisa la disponibilidad en la sección de reservas.'));
    pintarEstado(null);
    return;
  }

  // En día de descanso el resumen no trae turnos: la regla se dibuja con los de siempre, apagados.
  const turnos = resumen.cerrado ? RESERVAS.turnos : resumen.turnos;
  const regla = reglaDelDia(turnos);
  const pintar = () => {
    const minutos = servicio.ahora().minutos;
    const estado = estadoDelLocal(resumen, minutos);
    pintarEstado(estado);
    contenedor.replaceChildren(
      dibujarRegla(regla, turnos, minutos, estado.turnoActual, resumen.cerrado),
      resumen.cerrado ? descanso(hoy, alElegirTurno) : listaDeTurnos(regla, turnos, hoy, estado.turnoActual, alElegirTurno));
  };
  pintar();
  setInterval(pintar, 60_000);
}

/** Pinta el estado en todos los sitios que lo muestran (sección "Hoy" y menú móvil). */
function pintarEstado(estado) {
  for (const el of $$('[data-estado-local]')) {
    el.dataset.abierto = String(Boolean(estado?.abierto));
    $('[data-estado-local-texto]', el).textContent = estado?.texto ?? 'Barranco, Lima';
  }
}

const sinSitio = (t) => t.terminado || t.mesasLibres === 0;
const etiquetaHora = (minutos) => (minutos >= 1440 ? '00:00' : aHora(minutos));

/** La regla: horas, un tramo por turno, la parte del día que ya pasó y la aguja de ahora. Es solo dibujo. */
function dibujarRegla(regla, turnos, minutos, turnoActual, cerrado) {
  const pos = posicionEnRegla(minutos, regla);
  const pista = h('div', { class: 'jornada-pista' });
  pista.style.setProperty('--columnas', regla.columnas.map((m) => `${m}fr`).join(' '));
  regla.columnas.forEach((_, i) => {
    if (i % 2 === 0) {
      // Las pausas entre turnos se nombran; los bordes de la regla quedan vacíos.
      const entreTurnos = i > 0 && i < regla.columnas.length - 1;
      pista.append(h('div', { class: 'jornada-hueco' }, entreTurnos ? h('span', {}, 'Pausa') : null));
      return;
    }
    const t = turnos[(i - 1) / 2];
    const clase = cerrado ? 'descansa' : t.id === turnoActual ? 'es-ahora' : sinSitio(t) ? 'sin-sitio' : '';
    pista.append(h('div', { class: `jornada-tramo ${clase}` }, h('span', {}, t.nombre)));
  });

  const pasado = h('div', { class: 'jornada-pasado' });
  pasado.style.width = `${pos}%`;
  const aguja = h('div', { class: 'jornada-aguja' }, h('span', { class: 'jornada-aguja-hora' }, `Ahora ${etiquetaHora(minutos)}`));
  aguja.style.setProperty('--p', pos);

  const horas = h('div', { class: 'jornada-horas' }, regla.horas.map((m) => {
    const marca = h('span', { class: 'jornada-hora', 'data-cada': (m / 60) % 4 === 0 ? '4' : (m / 60) % 2 === 0 ? '2' : '1' }, etiquetaHora(m));
    marca.style.left = `${posicionEnRegla(m, regla)}%`;
    return marca;
  }));

  return h('div', { class: 'jornada-regla', 'aria-hidden': 'true' }, h('div', { class: 'jornada-carril' }, pista, pasado, aguja), horas);
}

/** Lo que dice cada turno, alineado bajo su tramo (en móvil, uno debajo del otro). */
function listaDeTurnos(regla, turnos, fecha, turnoActual, alElegirTurno) {
  const lista = h('ul', { class: 'jornada-turnos' });
  lista.style.setProperty('--columnas', regla.columnas.map((m) => `${m}fr`).join(' '));
  turnos.forEach((t, i) => {
    let texto;
    if (t.terminado) texto = `Terminó por hoy. La última llegada fue a las ${t.ultimaHora}.`;
    else if (t.mesasLibres === 0) texto = 'Completo. Prueba el otro turno u otro día.';
    else if (t.mesasLibres <= 3) texto = `Últimas ${plural(t.mesasLibres, 'mesa', 'mesas')}, desde las ${t.proximaHora}.`;
    else texto = `Quedan ${t.mesasLibres} mesas, desde las ${t.proximaHora}.`;

    const item = h('li', { class: `jornada-turno ${sinSitio(t) ? 'sin-sitio' : ''}` },
      h('h3', { class: 'jornada-turno-nombre' },
        t.nombre,
        h('span', { class: 'jornada-turno-horas' }, `${t.inicio}–${t.fin}`),
        t.id === turnoActual ? h('span', { class: 'jornada-turno-ahora' }, 'Ahora') : null),
      h('p', { class: 'jornada-turno-texto' }, texto),
      sinSitio(t) ? null : h('button', {
        type: 'button',
        class: 'btn btn-linea jornada-reservar',
        onclick: () => alElegirTurno({ fecha, hora: t.proximaHora }),
        'aria-label': `Reservar ${t.nombre.toLowerCase()} de hoy a las ${t.proximaHora}`,
      }, `Reservar ${t.proximaHora}`));
    item.style.gridColumn = String(2 * i + 2);
    lista.append(item);
  });
  return lista;
}

function descanso(hoy, alElegirTurno) {
  return h('div', { class: 'jornada-descanso' },
    h('p', {}, h('strong', {}, 'Hoy descansamos.'), ` El fogón vuelve mañana a las ${RESERVAS.turnos[0].inicio}.`),
    h('button', { type: 'button', class: 'btn btn-linea', onclick: () => alElegirTurno({ fecha: sumarDias(hoy, 1) }) }, 'Reservar para mañana'));
}

const NOMBRES_ESTADO = {
  disponible: 'Libre',
  limitado: 'Pocas mesas',
  completo: 'Completo',
  cerrado: 'Descanso',
};
const fmtCorto = new Intl.DateTimeFormat('es-PE', { weekday: 'short', timeZone: 'UTC' });
const fmtNumero = new Intl.DateTimeFormat('es-PE', { day: 'numeric', timeZone: 'UTC' });
const fmtEntero = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const aDate = (fecha) => new Date(`${fecha}T12:00:00Z`);

/** Los siete días que siguen a hoy, con cómo están de mesas (para dos personas). Toca uno y abre la reserva. */
async function pintarSemana(lista, servicio, hoy, alElegirTurno) {
  if (!lista) return;
  const fechas = Array.from({ length: DIAS_A_LA_VISTA }, (_, i) => sumarDias(hoy, i + 1));
  let estados = {};
  try {
    const meses = [...new Set(fechas.map((f) => f.slice(0, 7)))];
    const respuestas = await Promise.all(meses.map((m) => servicio.consultarMes(`${m}-01`, 2)));
    estados = Object.assign({}, ...respuestas);
  } catch {
    // Sin estados, los días se muestran igual y la reserva dirá lo que haya.
  }
  lista.replaceChildren(...fechas.map((fecha) => {
    const estado = estados[fecha] ?? 'sin-datos';
    const nombre = NOMBRES_ESTADO[estado] ?? 'Ver horarios';
    const sinReserva = estado === 'cerrado' || estado === 'completo' || estado === 'fuera';
    const fechaLarga = fmtEntero.format(aDate(fecha));
    return h('li', {},
      h('button', {
        type: 'button',
        class: 'jornada-dia-boton',
        'data-estado': estado,
        disabled: sinReserva,
        'aria-label': `${fechaLarga.charAt(0).toUpperCase()}${fechaLarga.slice(1)}: ${nombre.toLowerCase()}`,
        onclick: () => alElegirTurno({ fecha }),
      },
      h('span', { class: 'jornada-dia-nombre' }, fmtCorto.format(aDate(fecha)).replace('.', '')),
      h('span', { class: 'jornada-dia-numero display' }, fmtNumero.format(aDate(fecha))),
      h('span', { class: 'jornada-dia-estado' }, h('span', { class: 'jornada-dia-punto' }), h('span', { class: 'jornada-dia-texto' }, nombre))));
  }));
}
