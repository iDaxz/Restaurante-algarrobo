// Utilidades de fecha. Las fechas viajan como texto 'AAAA-MM-DD' y las horas como 'HH:MM',
// siempre en la hora de Lima, para no depender de la zona horaria del navegador.

import { RESTAURANTE } from '../config/restaurante.js';

const partesLima = new Intl.DateTimeFormat('en-CA', {
  timeZone: RESTAURANTE.zonaHoraria,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** Fecha y minuto actuales en Lima: { fecha: 'AAAA-MM-DD', minutos: 0..1439 } */
export function ahoraLima(ahora = new Date()) {
  const p = Object.fromEntries(partesLima.formatToParts(ahora).map((x) => [x.type, x.value]));
  return { fecha: `${p.year}-${p.month}-${p.day}`, minutos: Number(p.hour) * 60 + Number(p.minute) };
}

export const aMinutos = (hora) => {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
};

export const aHora = (minutos) =>
  `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;

/** Crea un Date en UTC a mediodía para operar con días sin saltos de zona horaria. */
const aDate = (fecha) => new Date(`${fecha}T12:00:00Z`);
const deDate = (d) => d.toISOString().slice(0, 10);

export const sumarDias = (fecha, dias) => {
  const d = aDate(fecha);
  d.setUTCDate(d.getUTCDate() + dias);
  return deDate(d);
};

export const diaSemana = (fecha) => aDate(fecha).getUTCDay();

export const diferenciaDias = (desde, hasta) => Math.round((aDate(hasta) - aDate(desde)) / 86400000);

export const primerDiaMes = (fecha) => `${fecha.slice(0, 7)}-01`;

export const sumarMeses = (fecha, meses) => {
  const d = aDate(primerDiaMes(fecha));
  d.setUTCMonth(d.getUTCMonth() + meses);
  return deDate(d);
};

export const diasEnMes = (fecha) => {
  const d = aDate(primerDiaMes(fecha));
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return d.getUTCDate();
};

const fmtLargo = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const fmtCorto = new Intl.DateTimeFormat('es-PE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtMes = new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const fmtDia = new Intl.DateTimeFormat('es-PE', { weekday: 'long', timeZone: 'UTC' });

const capitalizar = (t) => t.charAt(0).toUpperCase() + t.slice(1);

export const formatoLargo = (fecha) => capitalizar(fmtLargo.format(aDate(fecha)));
export const formatoCorto = (fecha) => fmtCorto.format(aDate(fecha)).replace(/\./g, '');
export const formatoMes = (fecha) => capitalizar(fmtMes.format(aDate(fecha)));
export const nombreDia = (fecha) => fmtDia.format(aDate(fecha));
