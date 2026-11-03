// La jornada de hoy como una línea: de una hora antes del primer turno a una después del último.
// Los turnos y las pausas se reparten en columnas proporcionales a sus minutos, así la regla,
// los tramos y el texto de cada turno quedan alineados con la misma rejilla.

import { aMinutos } from './fechas.js';

/**
 * @param {{ inicio: string, fin: string }[]} turnos  en orden del día
 * @returns {{ desde: number, hasta: number, columnas: number[], horas: number[] }}
 *   columnas: minutos de cada hueco y cada turno, alternados (hueco, turno, hueco, …, hueco)
 *   horas: cada hora en punto de la regla, en minutos
 */
export function reglaDelDia(turnos) {
  const desde = Math.max(0, Math.floor(aMinutos(turnos[0].inicio) / 60) * 60 - 60);
  const hasta = Math.min(1440, Math.ceil(aMinutos(turnos.at(-1).fin) / 60) * 60 + 60);
  const columnas = [];
  let cursor = desde;
  for (const t of turnos) {
    columnas.push(aMinutos(t.inicio) - cursor, aMinutos(t.fin) - aMinutos(t.inicio));
    cursor = aMinutos(t.fin);
  }
  columnas.push(hasta - cursor);
  const horas = [];
  for (let m = desde; m <= hasta; m += 60) horas.push(m);
  return { desde, hasta, columnas, horas };
}

/** Dónde cae un minuto en la regla, de 0 a 100 (fuera del rango se queda en el borde). */
export const posicionEnRegla = (minutos, { desde, hasta }) =>
  Math.min(100, Math.max(0, ((minutos - desde) / (hasta - desde)) * 100));
