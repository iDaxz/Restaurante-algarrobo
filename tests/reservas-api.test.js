// Pruebas del cliente de la API (js/services/reservas-api.js) con un fetch simulado: no hace falta servidor.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { aplicarConfiguracion, conectarApi, crearServicioApi, CLAVE_MIS_RESERVAS } from '../js/services/reservas-api.js';
import { almacenEnMemoria } from '../js/services/reservas-demo.js';
import { CODIGOS } from '../js/core/errores.js';

const AHORA = () => ({ fecha: '2026-11-03', minutos: 600 });

/** fetch falso: responde según "rutas" y guarda cada llamada para revisarla. */
function fetchFalso(rutas) {
  const llamadas = [];
  const fn = async (url, opciones = {}) => {
    llamadas.push({ url, metodo: opciones.method ?? 'GET', cuerpo: opciones.body ? JSON.parse(opciones.body) : null, cabeceras: opciones.headers ?? {} });
    const clave = `${opciones.method ?? 'GET'} ${url.split('?')[0]}`;
    const r = rutas[clave];
    if (!r) return respuesta(404, { codigo: 'NO_EXISTE', mensaje: 'No existe.' });
    if (r === 'caida') throw new TypeError('Failed to fetch');
    return typeof r === 'function' ? r(llamadas.at(-1)) : respuesta(200, r);
  };
  fn.llamadas = llamadas;
  return fn;
}

function respuesta(status, cuerpo) {
  return {
    status, ok: status >= 200 && status < 300,
    headers: { get: () => 'application/json' },
    json: async () => cuerpo,
  };
}

const reserva = (datos) => ({ codigo: 'ALG-K7Q3M', fecha: '2026-11-04', hora: '20:00', personas: 2, estado: 'pendiente', contacto: '987654321', ...datos });

function servicio(rutas, almacen = almacenEnMemoria()) {
  const fetch = fetchFalso(rutas);
  return { s: crearServicioApi({ fetch, almacen, almacenSesion: almacenEnMemoria(), reloj: AHORA, config: aplicarConfiguracion(CONFIG, {}) }), fetch, almacen };
}

const CONFIG = {
  turnos: [{ id: 'cena', nombre: 'Cena', inicio: '19:00:00', fin: '23:00:00' }],
  mesas: [{ id: 'M1', asientos: 2 }, { id: 'M14', asientos: 8, nombre: 'Mesa larga' }],
  diasCerrados: [1], duracionMinutos: 90, intervaloMinutos: 30, ventanaDias: 60, minPersonas: 1, maxPersonasEnLinea: 8,
  holguraAsientos: 2, horasParaCambios: 3, toleranciaMinutos: 15, umbralLimitado: 0.3, maxReservasActivasPorContacto: 3, retencionMinutos: 5,
};

describe('Configuración del servidor', () => {
  test('se adapta a la forma que usa la interfaz (horas HH:MM)', () => {
    const destino = aplicarConfiguracion(CONFIG, {});
    assert.deepEqual(destino.turnos[0], { id: 'cena', nombre: 'Cena', inicio: '19:00', fin: '23:00' });
    assert.equal(destino.mesas[1].nombre, 'Mesa larga');
    assert.equal(destino.maxPersonasEnLinea, 8);
  });

  test('conectarApi devuelve null si no hay servidor (hosting estático)', async () => {
    assert.equal(await conectarApi({ fetch: fetchFalso({}), config: {} }), null);
    assert.equal(await conectarApi({ fetch: fetchFalso({ 'GET /api/v1/configuracion': 'caida' }), config: {} }), null);
  });

  test('conectarApi devuelve el servicio si el servidor responde', async () => {
    const api = await conectarApi({ fetch: fetchFalso({ 'GET /api/v1/configuracion': CONFIG }), config: {}, almacen: almacenEnMemoria(), almacenSesion: almacenEnMemoria() });
    assert.equal(api.esDemo, false);
  });
});

describe('Peticiones', () => {
  test('cada petición lleva la sesión de la pestaña; la disponibilidad va por GET con parámetros', async () => {
    const { s, fetch } = servicio({ 'GET /api/v1/disponibilidad/mes': { '2026-11-04': 'disponible' } });
    const mes = await s.consultarMes('2026-11-01', 4, { excluir: 'ALG-K7Q3M' });
    assert.equal(mes['2026-11-04'], 'disponible');
    assert.equal(fetch.llamadas[0].url, '/api/v1/disponibilidad/mes?mes=2026-11&personas=4&excluir=ALG-K7Q3M');
    assert.match(fetch.llamadas[0].cabeceras['X-Sesion'], /^[A-Za-z0-9-]{6,64}$/);
  });

  test('el contacto nunca va en la URL', async () => {
    const { s, fetch } = servicio({ 'POST /api/v1/reservas/consultar': reserva() });
    await s.buscarReserva('ALG-K7Q3M', '987654321');
    assert.ok(!fetch.llamadas[0].url.includes('987654321'));
    assert.deepEqual(fetch.llamadas[0].cuerpo, { codigo: 'ALG-K7Q3M', contacto: '987654321' });
  });

  test('modificar envía { contacto, cambios } por PATCH', async () => {
    const { s, fetch } = servicio({ 'PATCH /api/v1/reservas/ALG-K7Q3M': reserva({ hora: '21:00' }) });
    await s.modificarReserva('ALG-K7Q3M', '987654321', { hora: '21:00' });
    assert.deepEqual(fetch.llamadas[0].cuerpo, { contacto: '987654321', cambios: { hora: '21:00' } });
  });
});

describe('Errores', () => {
  test('los errores del servidor llegan como ErrorReserva con su código, campos y alternativas', async () => {
    const { s } = servicio({
      'POST /api/v1/reservas': () => respuesta(409, {
        codigo: 'HORARIO_LLENO', mensaje: 'No pudimos registrar la reserva.',
        errores: { hora: 'A las 20:00 ya no quedan mesas.' }, alternativas: { mismoDia: [], otrosDias: [{ fecha: '2026-11-05', hora: '20:00' }] },
      }),
    });
    await assert.rejects(s.crearReserva({}), (e) =>
      e.codigo === CODIGOS.HORARIO_LLENO && e.errores.hora && e.alternativas.otrosDias.length === 1);
  });

  test('sin conexión da SIN_CONEXION; un código desconocido se trata como ERROR_INTERNO', async () => {
    const caido = servicio({ 'GET /api/v1/disponibilidad/hoy': 'caida' }).s;
    await assert.rejects(caido.resumenDeHoy(), (e) => e.codigo === CODIGOS.SIN_CONEXION);
    const raro = servicio({ 'GET /api/v1/disponibilidad/hoy': () => respuesta(500, { codigo: 'ALGO_RARO', mensaje: 'x' }) }).s;
    await assert.rejects(raro.resumenDeHoy(), (e) => e.codigo === CODIGOS.ERROR_INTERNO);
  });

  test('el límite por IP llega como DEMASIADAS_PETICIONES', async () => {
    const { s } = servicio({ 'POST /api/v1/retenciones': () => respuesta(429, { codigo: 'DEMASIADAS_PETICIONES', mensaje: 'Espera un minuto.' }) });
    await assert.rejects(s.retenerMesa('2026-11-04', '20:00', 2), (e) => e.codigo === CODIGOS.DEMASIADAS_PETICIONES);
  });
});

describe('Mis reservas (códigos guardados en este navegador)', () => {
  test('al crear se recuerda el código y "Mis reservas" consulta cada uno', async () => {
    const { s, fetch, almacen } = servicio({
      'POST /api/v1/reservas': reserva(),
      'POST /api/v1/reservas/consultar-varias': (ll) => respuesta(200, { reservas: ll.cuerpo.reservas.map((x) => reserva({ codigo: x.codigo })), noEncontradas: [] }),
    });
    await s.crearReserva({ nombre: 'Ana', contacto: '987654321' });
    assert.deepEqual(JSON.parse(almacen.getItem(CLAVE_MIS_RESERVAS)), [{ codigo: 'ALG-K7Q3M', contacto: '987654321' }]);
    const lista = await s.listarMisReservas();
    assert.equal(lista.length, 1);
    assert.equal(fetch.llamadas.at(-1).url, '/api/v1/reservas/consultar-varias'); // una sola petición
  });

  test('las que ya no existen en el servidor se olvidan; las activas van primero', async () => {
    const almacen = almacenEnMemoria();
    almacen.setItem(CLAVE_MIS_RESERVAS, JSON.stringify([
      { codigo: 'ALG-AAAAA', contacto: '987654321' },
      { codigo: 'ALG-CCCCC', contacto: '987654321' },
      { codigo: 'ALG-DDDDD', contacto: '987654321' },
    ]));
    const { s } = servicio({
      'POST /api/v1/reservas/consultar-varias': {
        reservas: [
          reserva({ codigo: 'ALG-AAAAA', estado: 'cancelada', fecha: '2026-11-10' }),
          reserva({ codigo: 'ALG-DDDDD', estado: 'confirmada', fecha: '2026-11-20' }),
        ],
        noEncontradas: ['ALG-CCCCC'],
      },
    }, almacen);
    const lista = await s.listarMisReservas();
    assert.deepEqual(lista.map((r) => r.codigo), ['ALG-DDDDD', 'ALG-AAAAA']);
    assert.ok(!almacen.getItem(CLAVE_MIS_RESERVAS).includes('ALG-CCCCC'));
  });

  test('las anteriores con más de 30 días se olvidan; "Quitar de mi lista" olvida sin tocar el servidor', async () => {
    const almacen = almacenEnMemoria();
    almacen.setItem(CLAVE_MIS_RESERVAS, JSON.stringify([
      { codigo: 'ALG-VIEJA', contacto: '987654321' },
      { codigo: 'ALG-CERCA', contacto: '987654321' },
    ]));
    const { s, fetch } = servicio({
      'POST /api/v1/reservas/consultar-varias': {
        reservas: [
          reserva({ codigo: 'ALG-VIEJA', estado: 'completada', fecha: '2026-09-01' }),
          reserva({ codigo: 'ALG-CERCA', estado: 'cancelada', fecha: '2026-10-20' }),
        ],
        noEncontradas: [],
      },
    }, almacen);
    assert.deepEqual((await s.listarMisReservas()).map((r) => r.codigo), ['ALG-CERCA']);
    assert.ok(!almacen.getItem(CLAVE_MIS_RESERVAS).includes('ALG-VIEJA'));

    const llamadas = fetch.llamadas.length;
    await s.olvidarReserva('ALG-CERCA', 'cancelada');
    assert.equal(fetch.llamadas.length, llamadas); // no se pide nada al servidor
    assert.deepEqual(JSON.parse(almacen.getItem(CLAVE_MIS_RESERVAS)), []);
    await assert.rejects(s.olvidarReserva('ALG-XXXXX', 'confirmada'), (e) => e.codigo === CODIGOS.TRANSICION_INVALIDA);
  });

  test('si se cambia el contacto al modificar, se recuerda el nuevo', async () => {
    const { s, almacen } = servicio({ 'PATCH /api/v1/reservas/ALG-K7Q3M': reserva({ contacto: 'ana@correo.pe' }) });
    await s.modificarReserva('ALG-K7Q3M', '987654321', { contacto: 'ana@correo.pe' });
    assert.deepEqual(JSON.parse(almacen.getItem(CLAVE_MIS_RESERVAS)), [{ codigo: 'ALG-K7Q3M', contacto: 'ana@correo.pe' }]);
  });
});

describe('Retenciones', () => {
  test('liberar solo llama al servidor si esta pestaña tiene una mesa apartada', async () => {
    const { s, fetch } = servicio({
      'POST /api/v1/retenciones': { id: 'h-1', mesa: 'M1', expira: 1 },
      'DELETE /api/v1/retenciones': () => ({ status: 204, ok: true, headers: { get: () => '' }, json: async () => null }),
    });
    s.liberarRetencion();
    assert.equal(fetch.llamadas.length, 0);
    await s.retenerMesa('2026-11-04', '20:00', 2);
    s.liberarRetencion();
    s.liberarRetencion();
    await new Promise((r) => setTimeout(r, 0));
    assert.deepEqual(fetch.llamadas.map((l) => l.metodo), ['POST', 'DELETE']);
  });
});
