// Si el local está abierto ahora, a partir del resumen de hoy ({ cerrado, turnos }) y el minuto de Lima.

import { aMinutos } from './fechas.js';

/** Devuelve { abierto, turnoActual, texto } para el chip de estado del menú y de la banda "Hoy". */
export function estadoDelLocal({ cerrado, turnos = [] }, minutos) {
  if (cerrado) return { abierto: false, turnoActual: null, texto: 'Hoy descansamos' };
  const actual = turnos.find((t) => minutos >= aMinutos(t.inicio) && minutos < aMinutos(t.fin));
  if (actual) {
    return { abierto: true, turnoActual: actual.id, texto: `Abierto ahora · ${actual.nombre.toLowerCase()} hasta las ${actual.fin}` };
  }
  const siguiente = turnos.find((t) => minutos < aMinutos(t.inicio));
  if (siguiente) {
    return { abierto: false, turnoActual: null, texto: `Cerrado ahora · ${siguiente.nombre.toLowerCase()} desde las ${siguiente.inicio}` };
  }
  return { abierto: false, turnoActual: null, texto: 'Cerrado por hoy' };
}
