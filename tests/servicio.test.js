// Pruebas del servicio de demostración: el mismo contrato que tendrá la API REST.
// Cada prueba usa almacenamiento en memoria, reloj fijo, sin latencia y sin la ocupación ficticia sembrada.
// Dos servicios con el mismo almacenamiento y distinta "sesión" simulan dos pestañas (o dos clientes).

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { RESERVAS } from '../js/config/restaurante.js';
import { CODIGOS } from '../js/core/errores.js';
import { almacenEnMemoria, crearServicioDemo, reservasSembradas } from '../js/services/reservas-demo.js';

const MIERCOLES = '2026-11-04';
let almacen;
let ms;
let ahora;

const servicio = (sesion = 'A', extra = {}) => crearServicioDemo({
  almacen, sesion, latencia: 0, sembrar: false,
  reloj: () => ahora, ahoraMs: () => ms, ...extra,
});

const datos = (cambios = {}) => ({ nombre: 'Ana Quispe', contacto: '987654321', fecha: MIERCOLES, hora: '20:00', personas: 2, ...cambios });

/** Espera un rechazo con un código concreto y lo devuelve para revisarlo. */
async function rechaza(promesa, codigo) {
  let error;
  await assert.rejects(promesa, (e) => {
    error = e;
    return e.codigo === codigo;
  });
  return error;
}

beforeEach(() => {
  almacen = almacenEnMemoria();
  ms = Date.parse('2026-11-03T15:00:00Z');
  ahora = { fecha: '2026-11-03', minutos: 10 * 60 };
});

describe('Crear reservas', () => {
  test('una reserva nueva queda pendiente, con código y mesa asignada', async () => {
    const r = await servicio().crearReserva(datos({ personas: 4 }));
    assert.match(r.codigo, /^ALG-[A-Z0-9]{5}$/);
    assert.equal(r.estado, 'pendiente');
    assert.equal(r.mesaAsientos, 4);
    assert.equal(r.modificable, true);
  });

  test('los datos inválidos se rechazan con su código, sin guardar nada', async () => {
    const s = servicio();
    await rechaza(s.crearReserva(datos({ nombre: '' })), CODIGOS.DATOS_INVALIDOS);
    await rechaza(s.crearReserva(datos({ fecha: '2026-11-09' })), CODIGOS.DIA_CERRADO);
    assert.equal((await s.listarMisReservas()).length, 0);
  });

  test('cuando no hay mesa, el error trae alternativas', async () => {
    const s = servicio();
    await s.crearReserva(datos({ personas: 8, contacto: 'a@correo.com' }));
    const e = await rechaza(s.crearReserva(datos({ personas: 7, contacto: 'b@correo.com', hora: '20:30' })), CODIGOS.HORARIO_LLENO);
    assert.ok(e.alternativas.otrosDias.length > 0);
  });
});

describe('Reglas contra duplicados', () => {
  test('el mismo contacto no puede reservar dos veces a la misma hora', async () => {
    const s = servicio();
    await s.crearReserva(datos());
    const e = await rechaza(s.crearReserva(datos({ hora: '20:30', contacto: '+51 987 654 321' })), CODIGOS.CONTACTO_DUPLICADO);
    assert.ok(e.errores.contacto);
  });

  test(`a la ${RESERVAS.maxReservasActivasPorContacto + 1}.ª reserva activa se aplica el límite`, async () => {
    const s = servicio();
    for (const fecha of ['2026-11-04', '2026-11-05', '2026-11-06']) await s.crearReserva(datos({ fecha }));
    await rechaza(s.crearReserva(datos({ fecha: '2026-11-07' })), CODIGOS.LIMITE_RESERVAS);
  });

  test('al cancelar una, se libera un cupo del límite', async () => {
    const s = servicio();
    const [primera] = await Promise.all([s.crearReserva(datos({ fecha: '2026-11-04' }))]);
    await s.crearReserva(datos({ fecha: '2026-11-05' }));
    await s.crearReserva(datos({ fecha: '2026-11-06' }));
    await s.cancelarReserva(primera.codigo, '987654321');
    const cuarta = await s.crearReserva(datos({ fecha: '2026-11-07' }));
    assert.equal(cuarta.estado, 'pendiente');
  });
});

describe('Dos clientes a la vez', () => {
  test('si dos personas van por la última mesa, solo una la consigue', async () => {
    const pestanaA = servicio('A');
    const pestanaB = servicio('B');
    const ganadora = await pestanaA.crearReserva(datos({ personas: 8, contacto: 'a@correo.com' }));
    assert.equal(ganadora.mesa, 'M14');
    await rechaza(pestanaB.crearReserva(datos({ personas: 8, contacto: 'b@correo.com' })), CODIGOS.HORARIO_LLENO);
  });

  test('una pestaña ve al instante lo que reservó la otra', async () => {
    const pestanaA = servicio('A');
    const pestanaB = servicio('B');
    await pestanaA.crearReserva(datos({ personas: 8 }));
    const horarios = await pestanaB.consultarHorarios(MIERCOLES, 8);
    assert.equal(horarios.find((h) => h.hora === '20:00').estado, 'completo');
  });
});

describe('Mesa apartada mientras se llenan los datos', () => {
  test('la mesa retenida no está disponible para otra pestaña, pero sí para quien la retuvo', async () => {
    const pestanaA = servicio('A');
    const pestanaB = servicio('B');
    const retencion = await pestanaB.retenerMesa(MIERCOLES, '13:00', 8);
    assert.equal(retencion.mesa, 'M14');
    assert.equal(retencion.expira, ms + RESERVAS.retencionMinutos * 60_000);
    assert.equal((await pestanaA.consultarHorarios(MIERCOLES, 8)).find((h) => h.hora === '13:00').estado, 'completo');
    assert.equal((await pestanaB.consultarHorarios(MIERCOLES, 8)).find((h) => h.hora === '13:00').estado, 'libre');
  });

  test('quien retuvo la mesa puede reservarla aunque otra pestaña lo intente', async () => {
    const pestanaA = servicio('A');
    const pestanaB = servicio('B');
    await pestanaB.retenerMesa(MIERCOLES, '13:00', 8);
    await rechaza(pestanaA.crearReserva(datos({ hora: '13:00', personas: 8, contacto: 'a@correo.com' })), CODIGOS.HORARIO_LLENO);
    const r = await pestanaB.crearReserva(datos({ hora: '13:00', personas: 8, contacto: 'b@correo.com' }));
    assert.equal(r.mesa, 'M14');
  });

  test(`la retención caduca a los ${RESERVAS.retencionMinutos} minutos`, async () => {
    const pestanaA = servicio('A');
    const pestanaB = servicio('B');
    await pestanaB.retenerMesa(MIERCOLES, '13:00', 8);
    ms += RESERVAS.retencionMinutos * 60_000 + 1;
    assert.equal((await pestanaA.consultarHorarios(MIERCOLES, 8)).find((h) => h.hora === '13:00').estado, 'libre');
  });

  test('retener otra hora libera la anterior; al reservar se libera la retención', async () => {
    const pestanaA = servicio('A');
    const pestanaB = servicio('B');
    await pestanaB.retenerMesa(MIERCOLES, '13:00', 8);
    await pestanaB.retenerMesa(MIERCOLES, '20:00', 8);
    assert.equal((await pestanaA.consultarHorarios(MIERCOLES, 8)).find((h) => h.hora === '13:00').estado, 'libre');
    await pestanaB.crearReserva(datos({ hora: '20:00', personas: 8 }));
    await pestanaB.liberarRetencion();
    assert.equal(JSON.parse(almacen.getItem('algarrobo.retenciones.v1')).length, 0);
  });

  test('no se puede retener una mesa que ya no existe', async () => {
    const s = servicio('A');
    await s.crearReserva(datos({ personas: 8 }));
    await rechaza(servicio('B').retenerMesa(MIERCOLES, '20:00', 8), CODIGOS.HORARIO_LLENO);
  });
});

describe('Confirmación simulada', () => {
  test(`a los ${RESERVAS.confirmacionSimuladaSegundos} segundos la reserva pasa a confirmada`, async () => {
    const s = servicio();
    const r = await s.crearReserva(datos());
    ms += (RESERVAS.confirmacionSimuladaSegundos - 1) * 1000;
    assert.equal((await s.buscarReserva(r.codigo, '987654321')).estado, 'pendiente');
    ms += 2000;
    const confirmada = await s.buscarReserva(r.codigo, '987654321');
    assert.equal(confirmada.estado, 'confirmada');
    assert.equal(confirmada.confirmadaSimulada, true);
  });

  test('avisa a quien escucha cuando se confirma', async () => {
    const s = servicio();
    const motivos = [];
    s.escuchar(({ motivo }) => motivos.push(motivo));
    await s.crearReserva(datos());
    ms += RESERVAS.confirmacionSimuladaSegundos * 1000 + 1;
    await s.listarMisReservas();
    assert.ok(motivos.includes('reservas'));
    assert.ok(motivos.includes('confirmacion'));
  });
});

describe('Modificar y cancelar', () => {
  test('modificar mueve la reserva sin chocar consigo misma y la deja pendiente de nuevo', async () => {
    const s = servicio();
    const r = await s.crearReserva(datos({ personas: 8 }));
    ms += 60_000;
    const movida = await s.modificarReserva(r.codigo, '987654321', { hora: '20:30' });
    assert.equal(movida.hora, '20:30');
    assert.equal(movida.mesa, 'M14');
    assert.equal(movida.estado, 'pendiente');
  });

  test('no se puede cambiar con menos de 3 horas de anticipación', async () => {
    const s = servicio();
    const r = await s.crearReserva(datos({ fecha: '2026-11-03', hora: '19:00' }));
    ahora = { fecha: '2026-11-03', minutos: 16 * 60 + 30 };
    await rechaza(s.modificarReserva(r.codigo, '987654321', { hora: '19:30' }), CODIGOS.FUERA_DE_PLAZO_CAMBIOS);
    await rechaza(s.cancelarReserva(r.codigo, '987654321'), CODIGOS.FUERA_DE_PLAZO_CAMBIOS);
  });

  test('una reserva cancelada no se puede volver a cancelar ni modificar', async () => {
    const s = servicio();
    const r = await s.crearReserva(datos());
    const cancelada = await s.cancelarReserva(r.codigo, '987654321');
    assert.equal(cancelada.estado, 'cancelada');
    await rechaza(s.cancelarReserva(r.codigo, '987654321'), CODIGOS.TRANSICION_INVALIDA);
    await rechaza(s.modificarReserva(r.codigo, '987654321', { hora: '20:30' }), CODIGOS.TRANSICION_INVALIDA);
  });

  test('cancelar libera la mesa para otros', async () => {
    const s = servicio();
    const r = await s.crearReserva(datos({ personas: 8 }));
    await s.cancelarReserva(r.codigo, '987654321');
    const otra = await servicio('B').crearReserva(datos({ personas: 8, contacto: 'b@correo.com' }));
    assert.equal(otra.mesa, 'M14');
  });
});

describe('Buscar y listar', () => {
  test('se busca por código y contacto, aunque el teléfono se escriba distinto', async () => {
    const s = servicio();
    const r = await s.crearReserva(datos());
    const encontrada = await s.buscarReserva(r.codigo.toLowerCase(), '+51 987-654-321');
    assert.equal(encontrada.codigo, r.codigo);
    await rechaza(s.buscarReserva(r.codigo, '911111111'), CODIGOS.NO_ENCONTRADA);
  });

  test('"Mis reservas" pone arriba la reserva hecha más recientemente; las canceladas, al final', async () => {
    const s = servicio();
    const primera = await s.crearReserva(datos({ fecha: '2026-11-05' }));
    const cancelada = await s.crearReserva(datos({ fecha: '2026-11-04' }));
    const ultima = await s.crearReserva(datos({ fecha: '2026-11-20' })); // más lejana, pero la última en hacerse
    await s.cancelarReserva(cancelada.codigo, '987654321');
    const lista = await s.listarMisReservas();
    assert.deepEqual(lista.map((r) => r.codigo), [ultima.codigo, primera.codigo, cancelada.codigo]);
  });
});

describe('Historial de "Mis reservas"', () => {
  test(`las anteriores y canceladas se quitan solas ${RESERVAS.diasHistorialCliente} días después de su fecha`, async () => {
    const s = servicio();
    const cancelada = await s.crearReserva(datos());
    await s.cancelarReserva(cancelada.codigo, '987654321');
    const activa = await s.crearReserva(datos({ fecha: '2026-11-05' }));

    ahora = { fecha: '2026-12-04', minutos: 600 }; // 30 días después de la cancelada: todavía se ve
    assert.ok((await s.listarMisReservas()).some((r) => r.codigo === cancelada.codigo));
    ahora = { fecha: '2026-12-05', minutos: 600 }; // 31 días: se quita (la otra ya pasó, pero 30 días aún no)
    const lista = await s.listarMisReservas();
    assert.ok(!lista.some((r) => r.codigo === cancelada.codigo));
    assert.ok(lista.some((r) => r.codigo === activa.codigo));
    assert.ok(!almacen.getItem('algarrobo.reservas.v1').includes(cancelada.codigo)); // también del navegador
  });

  test('"Quitar de mi lista" solo funciona con reservas que ya no están activas', async () => {
    const s = servicio();
    const r = await s.crearReserva(datos());
    await rechaza(s.olvidarReserva(r.codigo), CODIGOS.TRANSICION_INVALIDA);
    await s.cancelarReserva(r.codigo, '987654321');
    await s.olvidarReserva(r.codigo);
    assert.equal((await s.listarMisReservas()).length, 0);
  });
});

describe('Almacenamiento', () => {
  test('si el navegador no deja guardar, el error es ALMACENAMIENTO', async () => {
    const lleno = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => {} };
    const s = crearServicioDemo({ almacen: lleno, latencia: 0, sembrar: false, reloj: () => ahora, ahoraMs: () => ms });
    await rechaza(s.crearReserva(datos()), CODIGOS.ALMACENAMIENTO);
  });
});

describe('Ocupación ficticia sembrada', () => {
  test('es la misma cada vez para la misma fecha y nunca supera la capacidad', () => {
    const una = reservasSembradas('2026-11-07');
    const otra = reservasSembradas('2026-11-07');
    assert.deepEqual(una, otra);
    for (const r of una) {
      const choques = una.filter((x) => x !== r && x.mesa === r.mesa &&
        Math.abs(Number(x.hora.slice(0, 2)) * 60 + Number(x.hora.slice(3)) - (Number(r.hora.slice(0, 2)) * 60 + Number(r.hora.slice(3)))) < RESERVAS.duracionMinutos);
      assert.equal(choques.length, 0, `la mesa ${r.mesa} no puede tener dos reservas cruzadas`);
    }
  });

  test('el lunes no hay ocupación', () => {
    assert.deepEqual(reservasSembradas('2026-11-09'), []);
  });
});
