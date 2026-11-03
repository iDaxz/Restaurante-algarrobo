// Motor de disponibilidad. Funciones puras: reciben las reservas del día y devuelven resultados.
// Son las mismas reglas que deberá aplicar el backend (Spring Boot) dentro de una transacción;
// en el navegador solo sirven para mostrar la disponibilidad y validar antes de enviar.

import { RESERVAS } from '../config/restaurante.js';
import { CODIGOS } from './errores.js';
import { ESTADOS_ACTIVOS, ESTADOS_QUE_OCUPAN, minutosHastaLlegada } from './estados.js';
import { aHora, aMinutos, diaSemana, diferenciaDias, sumarDias } from './fechas.js';

export { ESTADOS_ACTIVOS };

const ocupaMesa = (r) => ESTADOS_QUE_OCUPAN.includes(r.estado);

export function horariosDelTurno(turno, config = RESERVAS) {
  const horas = [];
  const ultimo = aMinutos(turno.fin) - config.duracionMinutos;
  for (let m = aMinutos(turno.inicio); m <= ultimo; m += config.intervaloMinutos) horas.push(aHora(m));
  return horas;
}

export function turnoDeHora(hora, config = RESERVAS) {
  return config.turnos.find((t) => horariosDelTurno(t, config).includes(hora)) ?? null;
}

/** Cerrado por descanso semanal o por ser un día especial (fechasCerradas llega del servidor). */
export const estaCerrado = (fecha, config = RESERVAS) =>
  config.diasCerrados.includes(diaSemana(fecha)) || (config.fechasCerradas ?? []).includes(fecha);

export const esFeriado = (fecha, config = RESERVAS) => config.feriados.includes(fecha.slice(5));

/** Mesas donde cabe el grupo sin desperdiciar más asientos de la holgura permitida, de menor a mayor. */
export function mesasCompatibles(personas, config = RESERVAS) {
  return config.mesas
    .filter((m) => m.asientos >= personas && m.asientos - personas <= config.holguraAsientos)
    .sort((a, b) => a.asientos - b.asientos);
}

/** Una mesa está libre si ninguna reserva que ocupa (pendiente, confirmada o retenida) se cruza con [inicio, inicio + duración). */
export function mesaLibre(reservasDelDia, mesaId, hora, { excluirCodigo, config = RESERVAS } = {}) {
  const inicio = aMinutos(hora);
  return !reservasDelDia.some(
    (r) =>
      ocupaMesa(r) &&
      r.mesa === mesaId &&
      r.codigo !== excluirCodigo &&
      Math.abs(aMinutos(r.hora) - inicio) < config.duracionMinutos,
  );
}

export function mesasLibres(reservasDelDia, personas, hora, opciones = {}) {
  const config = opciones.config ?? RESERVAS;
  return mesasCompatibles(personas, config).filter((m) => mesaLibre(reservasDelDia, m.id, hora, opciones));
}

export function asignarMesa(reservasDelDia, personas, hora, opciones = {}) {
  return mesasLibres(reservasDelDia, personas, hora, opciones)[0] ?? null;
}

/** Cada mesa a esa hora para el plano: 'libre', 'ocupada' o 'no-sirve' (no es del tamaño del grupo). */
export function estadoDeMesas(reservasDelDia, personas, hora, opciones = {}) {
  const config = opciones.config ?? RESERVAS;
  const sirven = new Set(mesasCompatibles(personas, config).map((m) => m.id));
  return config.mesas.map((m) => ({
    id: m.id, asientos: m.asientos, nombre: m.nombre ?? null,
    estado: !sirven.has(m.id) ? 'no-sirve' : mesaLibre(reservasDelDia, m.id, hora, opciones) ? 'libre' : 'ocupada',
  }));
}

/** La mesa elegida en el plano, normalizada, o null si la casa elige. */
const mesaElegida = (mesa) => (typeof mesa === 'string' && mesa.trim() ? mesa.trim().toUpperCase() : null);

/** Una hora ya pasó si es de hoy y empieza antes de ahora. */
const horaPasada = (fecha, hora, ahora) => fecha < ahora.fecha || (fecha === ahora.fecha && aMinutos(hora) <= ahora.minutos);

export function fechaFueraDeVentana(fecha, ahora, config = RESERVAS) {
  return fecha < ahora.fecha || diferenciaDias(ahora.fecha, fecha) > config.ventanaDias;
}

/**
 * Horarios de un día para un grupo.
 * Devuelve [{ hora, turno, estado: 'libre' | 'completo' | 'pasado', mesasLibres }]
 */
export function horariosDelDia(fecha, personas, reservasDelDia, ahora, opciones = {}) {
  const config = opciones.config ?? RESERVAS;
  if (estaCerrado(fecha, config)) return [];
  return config.turnos.flatMap((turno) =>
    horariosDelTurno(turno, config).map((hora) => {
      if (horaPasada(fecha, hora, ahora)) return { hora, turno: turno.id, estado: 'pasado', mesasLibres: 0 };
      const libres = mesasLibres(reservasDelDia, personas, hora, opciones).length;
      return { hora, turno: turno.id, estado: libres > 0 ? 'libre' : 'completo', mesasLibres: libres };
    }),
  );
}

/**
 * Estado de un día para el calendario, según cuántas combinaciones (horario, mesa compatible) quedan libres.
 * 'pasado' | 'fuera' | 'cerrado' | 'completo' | 'limitado' | 'disponible'
 */
export function estadoDelDia(fecha, personas, reservasDelDia, ahora, config = RESERVAS) {
  if (fecha < ahora.fecha) return 'pasado';
  if (fechaFueraDeVentana(fecha, ahora, config)) return 'fuera';
  if (estaCerrado(fecha, config)) return 'cerrado';
  const horarios = horariosDelDia(fecha, personas, reservasDelDia, ahora, { config }).filter((h) => h.estado !== 'pasado');
  if (horarios.length === 0) return 'pasado';
  const posibles = horarios.length * mesasCompatibles(personas, config).length;
  const libres = horarios.reduce((total, h) => total + h.mesasLibres, 0);
  if (libres === 0) return 'completo';
  return libres / posibles < config.umbralLimitado ? 'limitado' : 'disponible';
}

/**
 * Validación completa de una solicitud.
 * Devuelve { ok, codigo, errores: {campo: mensaje}, mesa }. "codigo" es el primer problema encontrado (ver CODIGOS).
 */
export function validarSolicitud(solicitud, reservasDelDia, ahora, { excluirCodigo, config = RESERVAS } = {}) {
  const errores = {};
  let codigo = null;
  const fallar = (campo, cod, mensaje) => {
    errores[campo] = mensaje;
    codigo ??= cod;
  };
  const { nombre = '', contacto = '', fecha, hora, personas } = solicitud;

  if (nombre.trim().length < 2) fallar('nombre', CODIGOS.DATOS_INVALIDOS, 'Escribe el nombre de quien reserva.');
  if (!contacto.trim()) fallar('contacto', CODIGOS.DATOS_INVALIDOS, 'Necesitamos un correo o un teléfono para avisarte.');
  else if (!esContactoValido(contacto)) fallar('contacto', CODIGOS.DATOS_INVALIDOS, 'Revisa el dato: escribe un correo (nombre@correo.com) o un teléfono de 9 dígitos.');

  if (!Number.isInteger(personas) || personas < config.minPersonas) fallar('personas', CODIGOS.DATOS_INVALIDOS, 'Indica cuántas personas vienen.');
  else if (personas > config.maxPersonasEnLinea) fallar('personas', CODIGOS.GRUPO_GRANDE, `Para grupos de más de ${config.maxPersonasEnLinea} personas, llámanos y armamos la mesa.`);

  if (!fecha) fallar('fecha', CODIGOS.DATOS_INVALIDOS, 'Elige una fecha en el calendario.');
  else if (fecha < ahora.fecha) fallar('fecha', CODIGOS.FECHA_PASADA, 'Esa fecha ya pasó. Elige hoy o un día posterior.');
  else if (fechaFueraDeVentana(fecha, ahora, config)) fallar('fecha', CODIGOS.FECHA_FUERA_DE_PLAZO, `Aceptamos reservas hasta con ${config.ventanaDias} días de anticipación.`);
  else if (estaCerrado(fecha, config)) fallar('fecha', CODIGOS.DIA_CERRADO, 'Ese día descansamos. Elige otra fecha.');

  if (!hora) fallar('hora', CODIGOS.DATOS_INVALIDOS, 'Elige un horario de llegada.');
  else if (!turnoDeHora(hora, config)) fallar('hora', CODIGOS.HORARIO_INVALIDO, 'Ese horario no está dentro de nuestros turnos.');
  else if (fecha && horaPasada(fecha, hora, ahora)) fallar('hora', CODIGOS.HORARIO_PASADO, 'Ese horario ya pasó. Elige uno más tarde.');

  if (codigo) return { ok: false, codigo, errores, mesa: null };

  const elegida = mesaElegida(solicitud.mesa);
  if (elegida) {
    // La persona eligió su mesa en el plano: tiene que servir para su grupo y seguir libre.
    const pedida = mesasCompatibles(personas, config).find((m) => m.id === elegida);
    if (!pedida) {
      return { ok: false, codigo: CODIGOS.MESA_INVALIDA, errores: { mesa: `Esa mesa no es para ${personas} ${personas === 1 ? 'persona' : 'personas'}. Elige otra en el plano.` }, mesa: null };
    }
    if (!mesaLibre(reservasDelDia, elegida, hora, { excluirCodigo, config })) {
      return { ok: false, codigo: CODIGOS.MESA_OCUPADA, errores: { mesa: `Alguien acaba de tomar esa mesa a las ${hora}. Elige otra en el plano.` }, mesa: null };
    }
    return { ok: true, codigo: null, errores: {}, mesa: pedida };
  }
  const mesa = asignarMesa(reservasDelDia, personas, hora, { excluirCodigo, config });
  if (!mesa) {
    return {
      ok: false,
      codigo: CODIGOS.HORARIO_LLENO,
      errores: { hora: `A las ${hora} ya no quedan mesas para ${personas} ${personas === 1 ? 'persona' : 'personas'}.` },
      mesa: null,
    };
  }
  return { ok: true, codigo: null, errores: {}, mesa };
}

/** Forma comparable de un contacto: correo en minúsculas o teléfono de 9 dígitos sin prefijo 51. */
export const normalizarContacto = (c = '') => c.trim().toLowerCase().replace(/[\s()+-]/g, '').replace(/^51(?=\d{9}$)/, '');

/**
 * Reglas contra duplicados y abuso para un mismo contacto.
 * - No puede tener dos reservas activas que se crucen (mismo día, a menos de la duración de una reserva).
 * - No puede tener más de config.maxReservasActivasPorContacto reservas activas a futuro.
 * "reservas" son todas las reservas conocidas; aquí se filtran por contacto.
 * Devuelve { ok: true } o { ok: false, codigo, mensaje, choque }.
 */
export function validarReglasDeContacto(solicitud, reservas, ahora, { excluirCodigo, config = RESERVAS } = {}) {
  const clave = normalizarContacto(solicitud.contacto);
  const delContacto = reservas.filter((r) =>
    r.codigo !== excluirCodigo &&
    ESTADOS_ACTIVOS.includes(r.estado) &&
    r.contacto && normalizarContacto(r.contacto) === clave &&
    minutosHastaLlegada(r, ahora) + config.duracionMinutos > 0);

  const choque = delContacto.find((r) =>
    r.fecha === solicitud.fecha && Math.abs(aMinutos(r.hora) - aMinutos(solicitud.hora)) < config.duracionMinutos);
  if (choque) {
    return {
      ok: false,
      codigo: CODIGOS.CONTACTO_DUPLICADO,
      mensaje: `Ya tienes una reserva (${choque.codigo}) ese día a las ${choque.hora}. Modifícala en lugar de crear otra.`,
      choque,
    };
  }
  if (delContacto.length >= config.maxReservasActivasPorContacto) {
    return {
      ok: false,
      codigo: CODIGOS.LIMITE_RESERVAS,
      mensaje: `Ya tienes ${delContacto.length} reservas activas. Cancela alguna o llámanos para reservar otra.`,
    };
  }
  return { ok: true };
}

export function esContactoValido(contacto) {
  const texto = contacto.trim();
  if (texto.includes('@')) return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(texto);
  const digitos = texto.replace(/[\s()+-]/g, '').replace(/^51/, '');
  return /^\d{9}$/.test(digitos);
}

/** Alternativas cuando un horario está lleno: horas cercanas ese día y el mismo horario en días próximos. */
export function buscarAlternativas(fecha, hora, personas, reservasDe, ahora, config = RESERVAS) {
  const objetivo = aMinutos(hora);
  const mismoDia = horariosDelDia(fecha, personas, reservasDe(fecha), ahora, { config })
    .filter((h) => h.estado === 'libre')
    .sort((a, b) => Math.abs(aMinutos(a.hora) - objetivo) - Math.abs(aMinutos(b.hora) - objetivo))
    .slice(0, 3)
    .sort((a, b) => aMinutos(a.hora) - aMinutos(b.hora));

  const otrosDias = [];
  for (let i = 1; i <= 21 && otrosDias.length < 3; i++) {
    const otra = sumarDias(fecha, i);
    if (fechaFueraDeVentana(otra, ahora, config) || estaCerrado(otra, config)) continue;
    if (asignarMesa(reservasDe(otra), personas, hora, { config })) otrosDias.push({ fecha: otra, hora });
  }
  return { mismoDia, otrosDias };
}

/** Se puede modificar o cancelar hasta cierto número de horas antes de la llegada. */
export function puedeCambiar(reserva, ahora, config = RESERVAS) {
  if (!ESTADOS_ACTIVOS.includes(reserva.estado)) return false;
  return minutosHastaLlegada(reserva, ahora) >= config.horasParaCambios * 60;
}
