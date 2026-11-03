// Servicio de reservas contra la API REST (backend Spring Boot, docs/api-reservas.md).
// Tiene la MISMA interfaz que js/services/reservas-demo.js: la interfaz no sabe cuál de los dos usa,
// salvo por "esDemo" para ajustar algunos textos.
//
// "Mis reservas": el servidor no lista reservas por contacto (cualquiera podría ver las de otra persona
// sabiendo su teléfono). Este navegador guarda solo los códigos y contactos de las reservas que hizo, y
// las consulta todas juntas con POST /reservas/consultar-varias.
//
// crearServicioApi() recibe fetch, el almacenamiento y la base para poder probarlo sin navegador.

import { RESERVAS } from '../config/restaurante.js';
import { mesasCompatibles, normalizarContacto } from '../core/disponibilidad.js';
import { CODIGOS, ErrorReserva } from '../core/errores.js';
import { ESTADOS_ACTIVOS, ordenarMisReservas, sigueEnMisReservas } from '../core/estados.js';
import { ahoraLima } from '../core/fechas.js';

export const CLAVE_MIS_RESERVAS = 'algarrobo.mis-reservas-api.v1';
const ESPERA_MAXIMA_MS = 12_000;

function idDeSesion(almacenSesion) {
  const nuevo = () => `s-${Math.random().toString(36).slice(2, 12)}`;
  try {
    let id = almacenSesion?.getItem('algarrobo.sesion');
    if (!id || !/^[A-Za-z0-9-]{6,64}$/.test(id)) {
      id = nuevo();
      almacenSesion?.setItem('algarrobo.sesion', id);
    }
    return id;
  } catch {
    return nuevo();
  }
}

/** "12:00:00" → "12:00" */
const hhmm = (hora) => String(hora).slice(0, 5);

/**
 * Lleva la configuración del servidor (GET /configuracion) al objeto RESERVAS que usa la interfaz,
 * para que el formulario muestre los mismos turnos, mesas y límites que aplica el backend.
 */
export function aplicarConfiguracion(config, destino = RESERVAS) {
  Object.assign(destino, {
    turnos: config.turnos.map((t) => ({ id: t.id, nombre: t.nombre, inicio: hhmm(t.inicio), fin: hhmm(t.fin) })),
    mesas: config.mesas.map((m) => (m.nombre ? { id: m.id, asientos: m.asientos, nombre: m.nombre } : { id: m.id, asientos: m.asientos })),
    diasCerrados: [...config.diasCerrados],
    fechasCerradas: [...(config.fechasCerradas ?? [])],
    duracionMinutos: config.duracionMinutos,
    intervaloMinutos: config.intervaloMinutos,
    ventanaDias: config.ventanaDias,
    minPersonas: config.minPersonas,
    maxPersonasEnLinea: config.maxPersonasEnLinea,
    holguraAsientos: config.holguraAsientos,
    horasParaCambios: config.horasParaCambios,
    toleranciaMinutos: config.toleranciaMinutos,
    umbralLimitado: config.umbralLimitado,
    maxReservasActivasPorContacto: config.maxReservasActivasPorContacto,
    retencionMinutos: config.retencionMinutos,
    // Propio del navegador (el servidor no lo envía): cuánto tiempo se ven las reservas anteriores.
    diasHistorialCliente: config.diasHistorialCliente ?? destino.diasHistorialCliente ?? 30,
  });
  return destino;
}

/**
 * @param {object} opciones
 * @param {string} [opciones.base]        prefijo de la API ('/api/v1')
 * @param {typeof fetch} [opciones.fetch]
 * @param {Storage} [opciones.almacen]    dónde recordar los códigos propios (localStorage)
 * @param {Storage} [opciones.almacenSesion]  sessionStorage (identifica la pestaña)
 * @param {() => {fecha:string, minutos:number}} [opciones.reloj]
 * @param {typeof RESERVAS} [opciones.config]
 */
export function crearServicioApi({
  base = '/api/v1',
  fetch: pedir = globalThis.fetch?.bind(globalThis),
  almacen = globalThis.localStorage,
  almacenSesion = globalThis.sessionStorage,
  reloj = ahoraLima,
  config = RESERVAS,
} = {}) {
  const sesion = idDeSesion(almacenSesion);
  const oyentes = new Set();
  const avisar = (motivo) => oyentes.forEach((fn) => fn({ motivo }));
  let retencionActual = null;

  /* ---------- HTTP ---------- */

  async function llamar(metodo, ruta, { cuerpo, keepalive = false } = {}) {
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), ESPERA_MAXIMA_MS);
    let respuesta;
    try {
      respuesta = await pedir(base + ruta, {
        method: metodo,
        headers: { Accept: 'application/json', 'X-Sesion': sesion, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
        signal: keepalive ? undefined : controlador.signal,
        keepalive,
        credentials: 'same-origin',
      });
    } catch {
      throw new ErrorReserva(CODIGOS.SIN_CONEXION, 'No pudimos conectar con el restaurante. Revisa tu conexión y vuelve a intentarlo.');
    } finally {
      clearTimeout(temporizador);
    }
    if (respuesta.status === 204) return null;
    let datos = null;
    try {
      datos = await respuesta.json();
    } catch {
      datos = null;
    }
    if (!respuesta.ok) {
      const codigo = datos?.codigo && datos.codigo in CODIGOS ? datos.codigo : CODIGOS.ERROR_INTERNO;
      const mensaje = datos?.mensaje ?? 'Tuvimos un problema al procesar la solicitud. Vuelve a intentarlo en un momento.';
      throw new ErrorReserva(codigo, mensaje, { errores: datos?.errores ?? {}, alternativas: datos?.alternativas ?? null });
    }
    return datos;
  }

  const consulta = (params) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v != null && v !== '') q.set(k, v);
    return q.toString();
  };

  /* ---------- Códigos propios (para "Mis reservas") ---------- */

  function leerPropias() {
    try {
      const lista = JSON.parse(almacen?.getItem(CLAVE_MIS_RESERVAS) ?? '[]');
      return Array.isArray(lista) ? lista.filter((x) => x && typeof x.codigo === 'string' && typeof x.contacto === 'string') : [];
    } catch {
      return [];
    }
  }

  function guardarPropias(lista) {
    try {
      almacen?.setItem(CLAVE_MIS_RESERVAS, JSON.stringify(lista));
    } catch {
      // Sin almacenamiento la reserva igual queda en el servidor; solo no aparecerá en "Mis reservas".
    }
  }

  function recordar(codigo, contacto) {
    const lista = leerPropias().filter((x) => x.codigo !== codigo);
    guardarPropias([...lista, { codigo, contacto }]);
  }

  function olvidar(codigo) {
    guardarPropias(leerPropias().filter((x) => x.codigo !== codigo));
  }

  /* ---------- Interfaz pública (la misma del servicio demo) ---------- */
  return {
    esDemo: false,
    sesion,
    get maxPersonas() { return config.maxPersonasEnLinea; },
    mesasPara: (personas) => mesasCompatibles(personas, config).length,
    ahora: () => reloj(),

    escuchar(fn) {
      oyentes.add(fn);
      return () => oyentes.delete(fn);
    },
    /** Otra pestaña cambió la lista de reservas propias, o la página volvió a verse: hay que releer. */
    notificarCambioExterno(clave) {
      if (clave === CLAVE_MIS_RESERVAS || clave === null) avisar('otra-pestana');
    },
    /** Al volver a la pestaña puede haber reservas confirmadas por el personal u horarios ocupados. */
    refrescar() {
      avisar('otra-pestana');
    },

    consultarMes: (fechaDelMes, personas, { excluir } = {}) =>
      llamar('GET', `/disponibilidad/mes?${consulta({ mes: fechaDelMes.slice(0, 7), personas, excluir })}`),

    consultarHorarios: (fecha, personas, { excluir } = {}) =>
      llamar('GET', `/disponibilidad/dia?${consulta({ fecha, personas, excluir })}`),

    resumenDeHoy: () => llamar('GET', '/disponibilidad/hoy'),

    alternativas: (fecha, hora, personas, { excluir } = {}) =>
      llamar('GET', `/disponibilidad/alternativas?${consulta({ fecha, hora, personas, excluir })}`),

    consultarMesas: (fecha, hora, personas, { excluir } = {}) =>
      llamar('GET', `/disponibilidad/mesas?${consulta({ fecha, hora, personas, excluir })}`),

    async retenerMesa(fecha, hora, personas, { excluir, mesa } = {}) {
      const retencion = await llamar('POST', '/retenciones', { cuerpo: { fecha, hora, personas, excluir: excluir ?? null, mesa: mesa ?? null } });
      retencionActual = retencion.id;
      return retencion;
    },

    /** Libera la mesa apartada por esta pestaña. Sigue funcionando aunque la página se esté cerrando. */
    liberarRetencion() {
      if (!retencionActual) return;
      retencionActual = null;
      llamar('DELETE', '/retenciones', { keepalive: true }).catch(() => {});
    },

    async crearReserva(solicitud) {
      const reserva = await llamar('POST', '/reservas', { cuerpo: solicitud });
      retencionActual = null;
      recordar(reserva.codigo, reserva.contacto);
      avisar('reservas');
      return reserva;
    },

    async buscarReserva(codigo, contacto) {
      const reserva = await llamar('POST', '/reservas/consultar', { cuerpo: { codigo, contacto } });
      // Si la persona la busca desde aquí, pasa a formar parte de "Mis reservas" en este navegador.
      recordar(reserva.codigo, reserva.contacto);
      return reserva;
    },

    /** Reservas hechas (o consultadas) desde este navegador: primero las activas, y en cada grupo la más reciente arriba. */
    async listarMisReservas() {
      const ahora = reloj();
      const propias = leerPropias().slice(-20);
      if (!propias.length) return [];
      // Una sola petición para todas: así abrir y refrescar el panel no gasta el cupo por IP.
      const { reservas, noEncontradas } = await llamar('POST', '/reservas/consultar-varias', { cuerpo: { reservas: propias } });
      noEncontradas.forEach(olvidar); // ya no existen en el servidor
      // Las anteriores y canceladas con más de config.diasHistorialCliente días se olvidan en este navegador.
      const vigentes = reservas.filter((r) => sigueEnMisReservas(r, ahora, config));
      reservas.filter((r) => !vigentes.includes(r)).forEach((r) => olvidar(r.codigo));
      // En el orden en que se hicieron (el de la lista guardada) para desempatar.
      const posicion = new Map(propias.map((x, i) => [x.codigo, i]));
      return ordenarMisReservas(vigentes.sort((x, y) => (posicion.get(x.codigo) ?? 0) - (posicion.get(y.codigo) ?? 0)));
    },

    /** "Quitar de mi lista": la olvida este navegador; en el servidor sigue existiendo para el restaurante. */
    async olvidarReserva(codigo, estado) {
      if (ESTADOS_ACTIVOS.includes(estado)) {
        throw new ErrorReserva(CODIGOS.TRANSICION_INVALIDA, 'Esta reserva sigue activa: cancélala antes de quitarla de la lista.');
      }
      olvidar(codigo);
      avisar('reservas');
    },

    async modificarReserva(codigo, contacto, cambios) {
      const reserva = await llamar('PATCH', `/reservas/${encodeURIComponent(codigo)}`, { cuerpo: { contacto, cambios } });
      retencionActual = null;
      if (normalizarContacto(reserva.contacto) !== normalizarContacto(contacto)) recordar(reserva.codigo, reserva.contacto);
      avisar('reservas');
      return reserva;
    },

    async cancelarReserva(codigo, contacto) {
      const reserva = await llamar('POST', `/reservas/${encodeURIComponent(codigo)}/cancelar`, { cuerpo: { contacto } });
      avisar('reservas');
      return reserva;
    },
  };
}

/**
 * Decide si hay backend: pide la configuración y, si responde, la aplica y devuelve el servicio.
 * Devuelve null si no hay API (por ejemplo, el sitio publicado en un hosting estático).
 */
export async function conectarApi({ base = '/api/v1', espera = 2500, fetch: pedir = globalThis.fetch?.bind(globalThis), ...resto } = {}) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), espera);
  try {
    const respuesta = await pedir(`${base}/configuracion`, { headers: { Accept: 'application/json' }, signal: controlador.signal });
    const tipo = respuesta.headers.get('content-type') ?? '';
    if (!respuesta.ok || !tipo.includes('application/json')) return null;
    aplicarConfiguracion(await respuesta.json(), resto.config ?? RESERVAS);
    return crearServicioApi({ base, fetch: pedir, ...resto });
  } catch {
    return null;
  } finally {
    clearTimeout(temporizador);
  }
}
