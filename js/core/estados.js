// Ciclo de vida de una reserva. Funciones puras: las usará también el panel administrativo (etapa 3).
//
//   pendiente ──► confirmada ──► completada
//       │              │   └──► no_asistio
//       └──► cancelada ◄┘

import { RESERVAS } from '../config/restaurante.js';
import { aMinutos, diferenciaDias } from './fechas.js';
import { CODIGOS, ErrorReserva } from './errores.js';

export const ESTADOS = Object.freeze(['pendiente', 'confirmada', 'cancelada', 'completada', 'no_asistio']);

/** Estados que ocupan mesa. "retenida" es una mesa apartada mientras alguien llena el formulario. */
export const ESTADOS_QUE_OCUPAN = Object.freeze(['pendiente', 'confirmada', 'retenida']);

/** Estados que la persona puede todavía modificar o cancelar. */
export const ESTADOS_ACTIVOS = Object.freeze(['pendiente', 'confirmada']);

const TRANSICIONES = Object.freeze({
  pendiente: ['confirmada', 'cancelada'],
  confirmada: ['completada', 'cancelada', 'no_asistio'],
  cancelada: [],
  completada: [],
  no_asistio: [],
});

export const puedeTransicionar = (desde, hacia) => TRANSICIONES[desde]?.includes(hacia) ?? false;

/** Devuelve la reserva en su nuevo estado o lanza TRANSICION_INVALIDA. No modifica la original. */
export function transicionar(reserva, hacia) {
  if (!puedeTransicionar(reserva.estado, hacia)) {
    throw new ErrorReserva(CODIGOS.TRANSICION_INVALIDA,
      `Una reserva ${reserva.estado} no puede pasar a ${hacia}.`);
  }
  return { ...reserva, estado: hacia };
}

/** Minutos desde "ahora" hasta la llegada (negativo si ya pasó). */
export function minutosHastaLlegada(reserva, ahora) {
  return diferenciaDias(ahora.fecha, reserva.fecha) * 1440 + aMinutos(reserva.hora) - ahora.minutos;
}

/**
 * Estado que debe verse hoy. Una reserva confirmada cuya mesa ya terminó se muestra completada;
 * una pendiente que nunca se confirmó y ya pasó también se cierra como completada en la demo.
 * (En la etapa 3 lo marca el personal; esto solo evita mostrar como "activas" reservas de días pasados.)
 */
export function estadoVisible(reserva, ahora, config = RESERVAS) {
  if (!ESTADOS_ACTIVOS.includes(reserva.estado)) return reserva.estado;
  return minutosHastaLlegada(reserva, ahora) + config.duracionMinutos <= 0 ? 'completada' : reserva.estado;
}

/**
 * Orden de "Mis reservas": primero las activas y luego el resto; dentro de cada grupo, la reserva
 * hecha más recientemente arriba. "lista" llega en el orden en que se hicieron (desempata si dos
 * tienen la misma hora de creación).
 */
export function ordenarMisReservas(lista) {
  const grupo = (r) => (ESTADOS_ACTIVOS.includes(r.estado) ? 0 : 1);
  return lista
    .map((r, i) => [r, i])
    .sort(([a, i], [b, j]) => grupo(a) - grupo(b) || String(b.creada ?? '').localeCompare(String(a.creada ?? '')) || j - i)
    .map(([r]) => r);
}

/**
 * Si una reserva sigue en "Mis reservas": las activas siempre; las anteriores y canceladas, hasta
 * config.diasHistorialCliente días después de su fecha. Después se quitan de la lista del navegador
 * (en el servidor siguen existiendo para el restaurante).
 */
export function sigueEnMisReservas(reserva, ahora, config = RESERVAS) {
  if (ESTADOS_ACTIVOS.includes(reserva.estado)) return true;
  return diferenciaDias(reserva.fecha, ahora.fecha) <= config.diasHistorialCliente;
}
