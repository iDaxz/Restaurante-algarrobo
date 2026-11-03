// Servicio de reservas de DEMOSTRACIÓN.
// Imita la futura API REST (mismos métodos, respuestas asíncronas y con latencia), pero guarda las
// reservas solo en este navegador (localStorage). Nada se envía al restaurante.
// En la etapa 3 este archivo se sustituye por un cliente fetch() contra Spring Boot con la misma interfaz
// (ver docs/api-reservas.md). Los errores llevan los mismos códigos que dará el servidor (js/core/errores.js).
//
// crearServicioDemo() recibe el almacenamiento, el reloj y la latencia para poder probarlo sin navegador.

import { RESERVAS } from '../config/restaurante.js';
import {
  asignarMesa, buscarAlternativas, estadoDelDia, esFeriado, estaCerrado, horariosDelDia,
  estadoDeMesas, horariosDelTurno, mesaLibre, mesasCompatibles, normalizarContacto, puedeCambiar,
  validarReglasDeContacto, validarSolicitud,
} from '../core/disponibilidad.js';
import { CODIGOS, ErrorReserva } from '../core/errores.js';
import { ESTADOS_ACTIVOS, estadoVisible, ordenarMisReservas, sigueEnMisReservas, transicionar } from '../core/estados.js';
import { ahoraLima, diasEnMes, primerDiaMes, sumarDias } from '../core/fechas.js';

export { ErrorReserva };

const CLAVE_RESERVAS = 'algarrobo.reservas.v1';
const CLAVE_RETENCIONES = 'algarrobo.retenciones.v1';

/* ---------- Reservas sembradas: ocupación ficticia pero estable para cada fecha ---------- */

function semilla(texto) {
  let h = 2166136261;
  for (const c of texto) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

function aleatorio(semillaInicial) {
  let a = semillaInicial;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Ocupación objetivo por día de la semana (0 = domingo).
const DEMANDA = [0.8, 0, 0.3, 0.38, 0.5, 0.74, 0.88];
const TAMANOS = [2, 2, 2, 2, 3, 4, 4, 4, 5, 6, 6, 8];

/** Reservas ficticias de otros clientes para una fecha. Siempre las mismas para la misma fecha. */
export function reservasSembradas(fecha, config = RESERVAS) {
  const reservas = [];
  if (estaCerrado(fecha, config)) return reservas;
  const azar = aleatorio(semilla(fecha));
  let demanda = DEMANDA[new Date(`${fecha}T12:00:00Z`).getUTCDay()];
  if (esFeriado(fecha, config)) demanda = 0.97;
  if (azar() < 0.07) demanda = 1; // de vez en cuando, un evento llena el día
  for (const turno of config.turnos) {
    const factorTurno = turno.id === 'cena' ? 1.05 : 0.9;
    for (const hora of horariosDelTurno(turno, config)) {
      for (let intento = 0; intento < 6; intento++) {
        if (azar() > demanda * factorTurno * 0.62) continue;
        const personas = TAMANOS[Math.floor(azar() * TAMANOS.length)];
        const mesa = asignarMesa(reservas, personas, hora, { config });
        if (!mesa) continue;
        reservas.push({
          codigo: `S-${fecha}-${reservas.length}`,
          fecha, hora, personas, mesa: mesa.id, turno: turno.id,
          estado: azar() < 0.8 ? 'confirmada' : 'pendiente',
          sembrada: true,
        });
      }
    }
  }
  return reservas;
}

/* ---------- Ayudas de entorno (navegador o pruebas) ---------- */

/** Almacenamiento en memoria con la misma forma que localStorage. */
export function almacenEnMemoria() {
  const datos = new Map();
  return {
    getItem: (k) => (datos.has(k) ? datos.get(k) : null),
    setItem: (k, v) => { datos.set(k, String(v)); },
    removeItem: (k) => { datos.delete(k); },
  };
}

function almacenDelNavegador() {
  try {
    const prueba = '__algarrobo__';
    globalThis.localStorage.setItem(prueba, '1');
    globalThis.localStorage.removeItem(prueba);
    return globalThis.localStorage;
  } catch {
    return null; // navegación privada estricta o almacenamiento bloqueado
  }
}

function idDeSesion() {
  const nuevo = () => Math.random().toString(36).slice(2, 10);
  try {
    let id = globalThis.sessionStorage.getItem('algarrobo.sesion');
    if (!id) {
      id = nuevo();
      globalThis.sessionStorage.setItem('algarrobo.sesion', id);
    }
    return id;
  } catch {
    return nuevo();
  }
}

const ALFABETO = 'ACDEFGHJKMNPQRTUVWXY34679';

/* ---------- Fábrica del servicio ---------- */

/**
 * @param {object} opciones
 * @param {Storage} [opciones.almacen]    dónde guardar (por defecto localStorage)
 * @param {string}  [opciones.sesion]     identifica esta pestaña (sus mesas retenidas no la bloquean a ella)
 * @param {() => {fecha:string, minutos:number}} [opciones.reloj]  hora de Lima
 * @param {() => number} [opciones.ahoraMs]   reloj en milisegundos para retenciones y confirmación simulada
 * @param {number|[number, number]} [opciones.latencia]  ms de espera simulada (fija o [mínimo, extra al azar])
 * @param {boolean} [opciones.sembrar]  incluir la ocupación ficticia de otros clientes (las pruebas la apagan)
 * @param {typeof RESERVAS} [opciones.config]
 */
export function crearServicioDemo({
  almacen,
  sesion = idDeSesion(),
  reloj = ahoraLima,
  ahoraMs = () => Date.now(),
  latencia = [220, 260],
  sembrar = true,
  config = RESERVAS,
} = {}) {
  const almacenamiento = almacen ?? almacenDelNavegador();
  const memoria = almacenamiento ?? almacenEnMemoria();
  const oyentes = new Set();
  const cacheSembradas = new Map();

  const esperar = () => {
    const ms = Array.isArray(latencia) ? latencia[0] + Math.random() * latencia[1] : latencia;
    return ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();
  };

  const sembradas = (fecha) => {
    if (!sembrar) return [];
    if (!cacheSembradas.has(fecha)) cacheSembradas.set(fecha, reservasSembradas(fecha, config));
    return cacheSembradas.get(fecha);
  };

  const avisar = (motivo) => oyentes.forEach((fn) => fn({ motivo }));

  function leer(clave) {
    try {
      return JSON.parse(memoria.getItem(clave)) ?? [];
    } catch {
      return [];
    }
  }

  function escribir(clave, lista) {
    try {
      memoria.setItem(clave, JSON.stringify(lista));
    } catch {
      throw new ErrorReserva(CODIGOS.ALMACENAMIENTO,
        'Tu navegador no permite guardar la reserva de demostración (almacenamiento bloqueado o lleno).');
    }
  }

  /* --- Reservas propias, con la confirmación simulada aplicada al leer --- */

  function leerPropias() {
    const lista = leer(CLAVE_RESERVAS);
    let cambio = false;
    const ahora = ahoraMs();
    const actualizada = lista.map((r) => {
      if (r.estado === 'pendiente' && r.confirmarEn && r.confirmarEn <= ahora) {
        cambio = true;
        const { confirmarEn, ...resto } = transicionar(r, 'confirmada');
        return { ...resto, confirmadaSimulada: true };
      }
      return r;
    });
    if (cambio) {
      escribir(CLAVE_RESERVAS, actualizada);
      avisar('confirmacion');
    }
    return actualizada;
  }

  const guardarPropias = (lista) => {
    escribir(CLAVE_RESERVAS, lista);
    avisar('reservas');
  };

  /* --- Mesas retenidas (de esta y de otras pestañas) --- */

  function leerRetenciones() {
    const ahora = ahoraMs();
    const lista = leer(CLAVE_RETENCIONES);
    const vigentes = lista.filter((h) => h.expira > ahora);
    if (vigentes.length !== lista.length) escribir(CLAVE_RETENCIONES, vigentes);
    return vigentes;
  }

  /** Todo lo que ocupa mesa en una fecha, visto desde esta pestaña (sus propias retenciones no cuentan). */
  function ocupacionDe(fecha, { excluir } = {}) {
    const retenidasAjenas = leerRetenciones()
      .filter((h) => h.fecha === fecha && h.sesion !== sesion)
      .map((h) => ({ codigo: h.id, fecha: h.fecha, hora: h.hora, mesa: h.mesa, estado: 'retenida' }));
    const lista = [...sembradas(fecha), ...leerPropias().filter((r) => r.fecha === fecha), ...retenidasAjenas];
    return excluir ? lista.filter((r) => r.codigo !== excluir) : lista;
  }

  function liberarMisRetenciones() {
    const todas = leer(CLAVE_RETENCIONES);
    const resto = todas.filter((h) => h.sesion !== sesion);
    if (resto.length !== todas.length) {
      escribir(CLAVE_RETENCIONES, resto);
      avisar('retenciones');
    }
  }

  function nuevoCodigo(existentes) {
    let codigo;
    do {
      codigo = 'ALG-' + Array.from({ length: 5 }, () => ALFABETO[Math.floor(Math.random() * ALFABETO.length)]).join('');
    } while (existentes.some((r) => r.codigo === codigo));
    return codigo;
  }

  function publica(r) {
    const ahora = reloj();
    const datosMesa = config.mesas.find((m) => m.id === r.mesa);
    return {
      codigo: r.codigo, fecha: r.fecha, hora: r.hora, personas: r.personas,
      mesa: r.mesa, mesaAsientos: datosMesa?.asientos, mesaNombre: datosMesa?.nombre ?? null,
      turno: r.turno, estado: estadoVisible(r, ahora, config),
      nombre: r.nombre, contacto: r.contacto, comentarios: r.comentarios, creada: r.creada,
      confirmadaSimulada: Boolean(r.confirmadaSimulada),
      confirmarEn: r.confirmarEn ?? null,
      modificable: puedeCambiar({ ...r, estado: estadoVisible(r, ahora, config) }, ahora, config),
    };
  }

  /** Lanza el error de validación con sus alternativas, si el problema es el horario. */
  function fallarValidacion(resultado, solicitud, ahora, excluir, mensaje) {
    const alternativas = resultado.errores.hora && solicitud.fecha && solicitud.hora
      ? buscarAlternativas(solicitud.fecha, solicitud.hora, solicitud.personas, (f) => ocupacionDe(f, { excluir }), ahora, config)
      : null;
    throw new ErrorReserva(resultado.codigo, mensaje, { errores: resultado.errores, alternativas });
  }

  function buscarPropia(propias, codigo, contacto) {
    const i = propias.findIndex((x) =>
      x.codigo === codigo.trim().toUpperCase() && normalizarContacto(x.contacto) === normalizarContacto(contacto));
    if (i < 0) {
      throw new ErrorReserva(CODIGOS.NO_ENCONTRADA, 'No encontramos una reserva con ese código y ese contacto en este navegador.');
    }
    return i;
  }

  /** Solo las reservas pendientes o confirmadas (y aún no pasadas) admiten cambios. */
  function exigirActiva(reserva, ahora, accion) {
    const estado = estadoVisible(reserva, ahora, config);
    if (!ESTADOS_ACTIVOS.includes(estado)) {
      throw new ErrorReserva(CODIGOS.TRANSICION_INVALIDA, `Esta reserva ya está ${estado}; no se puede ${accion}.`);
    }
  }

  const turnoDe = (hora) => config.turnos.find((t) => horariosDelTurno(t, config).includes(hora));
  const momentoConfirmacion = () => ahoraMs() + config.confirmacionSimuladaSegundos * 1000;

  /* ---------- API pública (misma forma que tendrá el cliente REST) ---------- */
  return {
    esDemo: true,
    sesion,
    maxPersonas: config.maxPersonasEnLinea,
    mesasPara: (personas) => mesasCompatibles(personas, config).length,
    ahora: () => reloj(),

    /** Suscribirse a cambios (esta pestaña u otras). Devuelve la función para dejar de escuchar. */
    escuchar(fn) {
      oyentes.add(fn);
      return () => oyentes.delete(fn);
    },
    /** Lo llama la página cuando otra pestaña modifica el almacenamiento. */
    notificarCambioExterno(clave) {
      if (clave === CLAVE_RESERVAS || clave === CLAVE_RETENCIONES || clave === null) avisar('otra-pestana');
    },

    /** Estado de cada día de un mes para un grupo: { 'AAAA-MM-DD': estado } */
    async consultarMes(fechaDelMes, personas, { excluir } = {}) {
      await esperar();
      const ahora = reloj();
      const inicio = primerDiaMes(fechaDelMes);
      const estados = {};
      for (let i = 0; i < diasEnMes(inicio); i++) {
        const fecha = sumarDias(inicio, i);
        estados[fecha] = estadoDelDia(fecha, personas, ocupacionDe(fecha, { excluir }), ahora, config);
      }
      return estados;
    },

    async consultarHorarios(fecha, personas, { excluir } = {}) {
      await esperar();
      return horariosDelDia(fecha, personas, ocupacionDe(fecha, { excluir }), reloj(), { config });
    },

    /** Para "Hoy en la cocina": mesas libres en el mejor horario restante de cada turno de hoy. */
    async resumenDeHoy() {
      const ahora = reloj();
      const fecha = ahora.fecha;
      if (estaCerrado(fecha, config)) return { fecha, cerrado: true, turnos: [] };
      const reservas = ocupacionDe(fecha);
      const turnos = config.turnos.map((turno) => {
        const horas = horariosDelTurno(turno, config);
        const restantes = horariosDelDia(fecha, 2, reservas, ahora, { config }).filter((h) => h.turno === turno.id && h.estado !== 'pasado');
        if (!restantes.length) return { ...turno, terminado: true, mesasLibres: 0, proximaHora: null, ultimaHora: horas.at(-1) };
        const libresPorHora = restantes.map((h) => ({
          hora: h.hora,
          libres: config.mesas.filter((m) => mesaLibre(reservas, m.id, h.hora, { config })).length,
        }));
        const mejor = libresPorHora.reduce((a, b) => (b.libres > a.libres ? b : a));
        const proxima = libresPorHora.find((h) => h.libres > 0);
        return { ...turno, terminado: false, mesasLibres: mejor.libres, mejorHora: mejor.hora, proximaHora: proxima?.hora ?? null };
      });
      return { fecha, cerrado: false, turnos };
    },

    /**
     * Aparta una mesa durante config.retencionMinutos mientras la persona completa sus datos.
     * Reemplaza cualquier retención anterior de esta pestaña. Devuelve { id, mesa, expira } o lanza HORARIO_LLENO.
     */
    async retenerMesa(fecha, hora, personas, { excluir, mesa: elegida } = {}) {
      await esperar();
      liberarMisRetenciones();
      let mesa;
      if (elegida) {
        // Mismas reglas que al reservar (tamaño y libre), con datos de relleno para nombre y contacto.
        const v = validarSolicitud({ nombre: 'Reserva', contacto: '999999999', fecha, hora, personas, mesa: elegida },
          ocupacionDe(fecha, { excluir }), reloj(), { excluirCodigo: excluir, config });
        if (!v.ok) throw new ErrorReserva(v.codigo, Object.values(v.errores)[0] ?? 'No pudimos apartar esa mesa.', { errores: v.errores });
        mesa = v.mesa;
      } else {
        mesa = asignarMesa(ocupacionDe(fecha, { excluir }), personas, hora, { config });
      }
      if (!mesa) {
        throw new ErrorReserva(CODIGOS.HORARIO_LLENO, `A las ${hora} ya no quedan mesas para ${personas} ${personas === 1 ? 'persona' : 'personas'}.`);
      }
      const retencion = {
        id: `H-${Math.random().toString(36).slice(2, 9)}`,
        sesion, fecha, hora, personas, mesa: mesa.id,
        expira: ahoraMs() + config.retencionMinutos * 60_000,
      };
      escribir(CLAVE_RETENCIONES, [...leerRetenciones(), retencion]);
      avisar('retenciones');
      return { id: retencion.id, mesa: mesa.id, expira: retencion.expira };
    },

    /** Estado de cada mesa a esa hora para el plano (lo que aparta esta pestaña cuenta como libre). */
    async consultarMesas(fecha, hora, personas, { excluir } = {}) {
      await esperar();
      return estadoDeMesas(ocupacionDe(fecha, { excluir }), personas, hora, { config });
    },

    /** Libera la mesa apartada por esta pestaña (al cambiar de hora, salir o terminar). */
    liberarRetencion() {
      liberarMisRetenciones();
    },

    async crearReserva(solicitud) {
      await esperar();
      const ahora = reloj();
      const propias = leerPropias();
      // En el backend estas comprobaciones y el guardado van en la misma transacción.
      const resultado = validarSolicitud(solicitud, ocupacionDe(solicitud.fecha), ahora, { config });
      if (!resultado.ok) fallarValidacion(resultado, solicitud, ahora, undefined, 'No pudimos registrar la reserva.');

      const reglas = validarReglasDeContacto(solicitud, propias, ahora, { config });
      if (!reglas.ok) {
        throw new ErrorReserva(reglas.codigo, reglas.mensaje, { errores: { contacto: reglas.mensaje } });
      }

      const reserva = {
        codigo: nuevoCodigo(propias),
        fecha: solicitud.fecha,
        hora: solicitud.hora,
        personas: solicitud.personas,
        mesa: resultado.mesa.id,
        turno: turnoDe(solicitud.hora).id,
        estado: 'pendiente',
        nombre: solicitud.nombre.trim(),
        contacto: solicitud.contacto.trim(),
        comentarios: (solicitud.comentarios ?? '').trim().slice(0, 280),
        creada: new Date(ahoraMs()).toISOString(),
        confirmarEn: momentoConfirmacion(),
      };
      liberarMisRetenciones();
      guardarPropias([...propias, reserva]);
      return publica(reserva);
    },

    async buscarReserva(codigo, contacto) {
      await esperar();
      const propias = leerPropias();
      return publica(propias[buscarPropia(propias, codigo, contacto)]);
    },

    /**
     * Reservas hechas en este navegador: primero las activas, y en cada grupo la más reciente arriba.
     * Las anteriores y canceladas con más de config.diasHistorialCliente días se borran del navegador.
     */
    async listarMisReservas() {
      await esperar();
      const ahora = reloj();
      const propias = leerPropias();
      const vigentes = propias.filter((r) => sigueEnMisReservas(publica(r), ahora, config));
      if (vigentes.length !== propias.length) guardarPropias(vigentes);
      return ordenarMisReservas(vigentes.map(publica));
    },

    /** "Quitar de mi lista": solo reservas que ya no están activas (una activa se cancela, no se borra). */
    async olvidarReserva(codigo) {
      await esperar();
      const ahora = reloj();
      const propias = leerPropias();
      const reserva = propias.find((r) => r.codigo === codigo);
      if (!reserva) return;
      if (ESTADOS_ACTIVOS.includes(estadoVisible(reserva, ahora, config))) {
        throw new ErrorReserva(CODIGOS.TRANSICION_INVALIDA, 'Esta reserva sigue activa: cancélala antes de quitarla de la lista.');
      }
      guardarPropias(propias.filter((r) => r.codigo !== codigo));
    },

    async modificarReserva(codigo, contacto, cambios) {
      await esperar();
      const ahora = reloj();
      const propias = leerPropias();
      const i = buscarPropia(propias, codigo, contacto);
      const actual = propias[i];
      exigirActiva(actual, ahora, 'modificar');
      if (!puedeCambiar({ ...actual, estado: estadoVisible(actual, ahora, config) }, ahora, config)) {
        throw new ErrorReserva(CODIGOS.FUERA_DE_PLAZO_CAMBIOS,
          `Solo se puede modificar hasta ${config.horasParaCambios} horas antes de la llegada.`);
      }
      // La mesa anterior no se arrastra: o la persona eligió una en el plano o la casa asigna de nuevo.
      const solicitud = { ...actual, ...cambios, mesa: cambios.mesa ?? null };
      const resultado = validarSolicitud(solicitud, ocupacionDe(solicitud.fecha, { excluir: actual.codigo }), ahora, { config });
      if (!resultado.ok) fallarValidacion(resultado, solicitud, ahora, actual.codigo, 'No pudimos cambiar la reserva.');

      const reglas = validarReglasDeContacto(solicitud, propias, ahora, { excluirCodigo: actual.codigo, config });
      if (!reglas.ok) {
        throw new ErrorReserva(reglas.codigo, reglas.mensaje, { errores: { contacto: reglas.mensaje } });
      }

      // Modificar no es una transición de estado: es una nueva solicitud sobre la misma reserva,
      // por eso vuelve a quedar pendiente hasta que el restaurante la confirme.
      const { confirmadaSimulada, ...base } = solicitud;
      propias[i] = {
        ...base,
        nombre: solicitud.nombre.trim(),
        contacto: solicitud.contacto.trim(),
        comentarios: (solicitud.comentarios ?? '').trim().slice(0, 280),
        mesa: resultado.mesa.id,
        turno: turnoDe(solicitud.hora).id,
        estado: 'pendiente',
        confirmarEn: momentoConfirmacion(),
      };
      liberarMisRetenciones();
      guardarPropias(propias);
      return publica(propias[i]);
    },

    async cancelarReserva(codigo, contacto) {
      await esperar();
      const ahora = reloj();
      const propias = leerPropias();
      const i = buscarPropia(propias, codigo, contacto);
      const actual = propias[i];
      exigirActiva(actual, ahora, 'cancelar');
      if (!puedeCambiar({ ...actual, estado: estadoVisible(actual, ahora, config) }, ahora, config)) {
        throw new ErrorReserva(CODIGOS.FUERA_DE_PLAZO_CAMBIOS,
          `Solo se puede cancelar hasta ${config.horasParaCambios} horas antes de la llegada.`);
      }
      const { confirmarEn, ...cancelada } = transicionar(actual, 'cancelada');
      propias[i] = cancelada;
      guardarPropias(propias);
      return publica(propias[i]);
    },

    async alternativas(fecha, hora, personas, { excluir } = {}) {
      await esperar();
      return buscarAlternativas(fecha, hora, personas, (f) => ocupacionDe(f, { excluir }), reloj(), config);
    },
  };
}

/** Instancia que usa la página. */
export const reservasDemo = crearServicioDemo();
