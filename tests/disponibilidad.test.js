// Pruebas del motor de disponibilidad (funciones puras). Ejecutar con: npm test
// Fechas de referencia (2026): martes 3 de noviembre; el lunes 2 el local está cerrado.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { RESERVAS } from '../js/config/restaurante.js';
import {
  asignarMesa, buscarAlternativas, esContactoValido, estadoDelDia, horariosDelDia, horariosDelTurno,
  mesaLibre, mesasCompatibles, normalizarContacto, puedeCambiar, turnoDeHora,
  validarReglasDeContacto, validarSolicitud,
} from '../js/core/disponibilidad.js';
import { CODIGOS } from '../js/core/errores.js';

const MARTES = '2026-11-03';
const MIERCOLES = '2026-11-04';
const LUNES = '2026-11-09';
const AHORA = { fecha: MARTES, minutos: 10 * 60 }; // martes 10:00 en Lima

let n = 0;
const reserva = (datos) => ({ codigo: `T-${++n}`, estado: 'confirmada', personas: 2, ...datos });
const solicitud = (datos = {}) => ({ nombre: 'Ana Quispe', contacto: '987654321', fecha: MIERCOLES, hora: '20:00', personas: 2, ...datos });

/** La mesa larga (única para 7 u 8) ocupada en los horarios dados. */
const mesaLargaOcupada = (fecha, horas) => horas.map((hora) => reserva({ fecha, hora, mesa: 'M14', personas: 8 }));

describe('Turnos y horarios', () => {
  test('el almuerzo ofrece llegadas cada 30 min hasta 90 min antes del cierre', () => {
    const almuerzo = horariosDelTurno(RESERVAS.turnos[0]);
    assert.deepEqual(almuerzo, ['12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00']);
  });

  test('la cena termina su última llegada a las 21:30', () => {
    assert.equal(horariosDelTurno(RESERVAS.turnos[1]).at(-1), '21:30');
  });

  test('una hora fuera de turno no pertenece a ninguno', () => {
    assert.equal(turnoDeHora('15:30'), null);
    assert.equal(turnoDeHora('16:00'), null);
    assert.equal(turnoDeHora('15:00').id, 'almuerzo');
  });

  test('el lunes no hay horarios', () => {
    assert.deepEqual(horariosDelDia(LUNES, 2, [], AHORA), []);
  });

  test('hoy, las horas ya pasadas se marcan como pasadas', () => {
    const ahora = { fecha: MARTES, minutos: 13 * 60 + 10 };
    const horarios = horariosDelDia(MARTES, 2, [], ahora);
    const pasadas = horarios.filter((h) => h.estado === 'pasado').map((h) => h.hora);
    assert.deepEqual(pasadas, ['12:00', '12:30', '13:00']);
    assert.equal(horarios.find((h) => h.hora === '13:30').estado, 'libre');
  });
});

describe('Mesas y capacidad', () => {
  test('cada grupo recibe mesas de su tamaño, sin desperdiciar más de 2 asientos', () => {
    assert.equal(mesasCompatibles(1).length, 6);                                  // solo mesas de 2
    assert.ok(mesasCompatibles(3).every((m) => m.asientos === 4));
    assert.deepEqual(mesasCompatibles(5).map((m) => m.asientos), [6, 6]);
    assert.deepEqual(mesasCompatibles(7).map((m) => m.id), ['M14']);
    assert.deepEqual(mesasCompatibles(9), []);
  });

  test('se asigna la mesa más pequeña que sirve', () => {
    assert.equal(asignarMesa([], 3, '20:00').asientos, 4);
    assert.equal(asignarMesa([], 2, '20:00').asientos, 2);
  });

  test('dos reservas en la misma mesa chocan si están a menos de 90 min; a 90 exactos, no', () => {
    const ocupadas = [reserva({ fecha: MIERCOLES, hora: '20:00', mesa: 'M1' })];
    assert.equal(mesaLibre(ocupadas, 'M1', '21:00'), false);
    assert.equal(mesaLibre(ocupadas, 'M1', '19:00'), false);
    assert.equal(mesaLibre(ocupadas, 'M1', '21:30'), true);
    assert.equal(mesaLibre(ocupadas, 'M1', '18:30'), true);
    assert.equal(mesaLibre(ocupadas, 'M2', '20:00'), true);
  });

  test('las canceladas no ocupan; las retenidas sí', () => {
    const cancelada = [reserva({ hora: '20:00', mesa: 'M1', estado: 'cancelada' })];
    const retenida = [reserva({ hora: '20:00', mesa: 'M1', estado: 'retenida' })];
    assert.equal(mesaLibre(cancelada, 'M1', '20:00'), true);
    assert.equal(mesaLibre(retenida, 'M1', '20:00'), false);
  });

  test('nunca se supera la capacidad: a las 20:00 caben 11 parejas y ninguna mesa se repite', () => {
    const ocupadas = [];
    let mesa;
    while ((mesa = asignarMesa(ocupadas, 2, '20:00'))) {
      ocupadas.push(reserva({ fecha: MIERCOLES, hora: '20:00', mesa: mesa.id }));
    }
    assert.equal(ocupadas.length, 11); // 6 mesas de 2 + 5 de 4 (4 − 2 = 2 de holgura)
    assert.equal(new Set(ocupadas.map((r) => r.mesa)).size, ocupadas.length);
  });
});

describe('Estado de cada día en el calendario', () => {
  test('pasado, fuera de plazo y cerrado', () => {
    assert.equal(estadoDelDia('2026-11-02', 2, [], AHORA), 'pasado');
    assert.equal(estadoDelDia('2027-01-15', 2, [], AHORA), 'fuera');
    assert.equal(estadoDelDia(LUNES, 2, [], AHORA), 'cerrado');
  });

  test('sin reservas, hay mesas', () => {
    assert.equal(estadoDelDia(MIERCOLES, 2, [], AHORA), 'disponible');
  });

  test('una sola reserva no llena el día', () => {
    const una = [reserva({ fecha: MIERCOLES, hora: '20:00', mesa: 'M1' })];
    assert.equal(estadoDelDia(MIERCOLES, 2, una, AHORA), 'disponible');
  });

  test('con pocas combinaciones libres el día queda como "pocas mesas"', () => {
    const casiLleno = mesaLargaOcupada(MIERCOLES, ['12:00', '13:30', '19:00', '20:30']);
    assert.equal(estadoDelDia(MIERCOLES, 7, casiLleno, AHORA), 'limitado'); // solo queda 15:00
  });

  test('sin ninguna mesa compatible en todo el día, está completo', () => {
    const lleno = mesaLargaOcupada(MIERCOLES, ['12:00', '13:30', '15:00', '19:00', '20:30']);
    assert.equal(estadoDelDia(MIERCOLES, 7, lleno, AHORA), 'completo');
    assert.equal(estadoDelDia(MIERCOLES, 2, lleno, AHORA), 'disponible'); // para parejas sigue libre
  });
});

describe('Validación de una solicitud (con código de error)', () => {
  const casos = [
    ['nombre demasiado corto', { nombre: 'A' }, CODIGOS.DATOS_INVALIDOS, 'nombre'],
    ['contacto inválido', { contacto: 'hola' }, CODIGOS.DATOS_INVALIDOS, 'contacto'],
    ['grupo de más de 8', { personas: 9 }, CODIGOS.GRUPO_GRANDE, 'personas'],
    ['fecha pasada', { fecha: '2026-11-01' }, CODIGOS.FECHA_PASADA, 'fecha'],
    ['más de 60 días', { fecha: '2027-02-01' }, CODIGOS.FECHA_FUERA_DE_PLAZO, 'fecha'],
    ['lunes', { fecha: LUNES }, CODIGOS.DIA_CERRADO, 'fecha'],
    ['hora fuera de turno', { hora: '16:00' }, CODIGOS.HORARIO_INVALIDO, 'hora'],
    ['hora de hoy ya pasada', { fecha: MARTES, hora: '12:00' }, CODIGOS.HORARIO_PASADO, 'hora'],
  ];
  for (const [nombre, cambios, codigo, campo] of casos) {
    test(nombre, () => {
      const ahora = { fecha: MARTES, minutos: 13 * 60 };
      const r = validarSolicitud(solicitud(cambios), [], ahora);
      assert.equal(r.ok, false);
      assert.equal(r.codigo, codigo);
      assert.ok(r.errores[campo], `debería explicar el problema en "${campo}"`);
    });
  }

  test('horario lleno', () => {
    const lleno = mesaLargaOcupada(MIERCOLES, ['20:00']);
    const r = validarSolicitud(solicitud({ personas: 8 }), lleno, AHORA);
    assert.equal(r.codigo, CODIGOS.HORARIO_LLENO);
  });

  test('una solicitud correcta recibe mesa', () => {
    const r = validarSolicitud(solicitud({ personas: 4 }), [], AHORA);
    assert.equal(r.ok, true);
    assert.equal(r.codigo, null);
    assert.equal(r.mesa.asientos, 4);
  });

  test('al modificar, la propia reserva no se cuenta como ocupada', () => {
    const propia = reserva({ codigo: 'ALG-PROPIA', fecha: MIERCOLES, hora: '20:00', mesa: 'M14', personas: 8 });
    const r = validarSolicitud(solicitud({ personas: 8, hora: '20:30' }), [propia], AHORA, { excluirCodigo: 'ALG-PROPIA' });
    assert.equal(r.ok, true);
  });
});

describe('Contacto', () => {
  test('acepta correos y teléfonos peruanos de 9 dígitos', () => {
    assert.ok(esContactoValido('ana@correo.com'));
    assert.ok(esContactoValido('987 654 321'));
    assert.ok(esContactoValido('+51 987-654-321'));
    assert.ok(!esContactoValido('98765'));
    assert.ok(!esContactoValido('ana@correo'));
  });

  test('el mismo teléfono escrito de distintas formas es el mismo contacto', () => {
    assert.equal(normalizarContacto('+51 987 654 321'), normalizarContacto('987654321'));
    assert.equal(normalizarContacto(' Ana@Correo.com '), 'ana@correo.com');
  });
});

describe('Reglas contra duplicados y abuso', () => {
  const mia = (datos) => reserva({ contacto: '987654321', mesa: 'M1', ...datos });

  test('no permite dos reservas que se crucen para el mismo contacto', () => {
    const r = validarReglasDeContacto(solicitud({ hora: '21:00' }), [mia({ fecha: MIERCOLES, hora: '20:00' })], AHORA);
    assert.equal(r.codigo, CODIGOS.CONTACTO_DUPLICADO);
    assert.equal(r.choque.hora, '20:00');
  });

  test('a 90 minutos o en otro día sí se permite', () => {
    const existentes = [mia({ fecha: MIERCOLES, hora: '20:00' })];
    assert.equal(validarReglasDeContacto(solicitud({ hora: '21:30' }), existentes, AHORA).ok, true);
    assert.equal(validarReglasDeContacto(solicitud({ fecha: '2026-11-05' }), existentes, AHORA).ok, true);
  });

  test('reconoce al mismo contacto aunque esté escrito distinto', () => {
    const r = validarReglasDeContacto(solicitud({ contacto: '+51 987 654 321' }), [mia({ fecha: MIERCOLES, hora: '20:00' })], AHORA);
    assert.equal(r.codigo, CODIGOS.CONTACTO_DUPLICADO);
  });

  test('las canceladas y las ya pasadas no cuentan', () => {
    const existentes = [
      mia({ fecha: MIERCOLES, hora: '20:00', estado: 'cancelada' }),
      mia({ fecha: '2026-11-01', hora: '20:00' }),
    ];
    assert.equal(validarReglasDeContacto(solicitud(), existentes, AHORA).ok, true);
  });

  test(`como máximo ${RESERVAS.maxReservasActivasPorContacto} reservas activas por contacto`, () => {
    const tres = ['2026-11-05', '2026-11-06', '2026-11-07'].map((fecha) => mia({ fecha, hora: '20:00' }));
    const r = validarReglasDeContacto(solicitud({ fecha: '2026-11-08' }), tres, AHORA);
    assert.equal(r.codigo, CODIGOS.LIMITE_RESERVAS);
  });

  test('al modificar una reserva, esa misma no cuenta como duplicado', () => {
    const propia = mia({ codigo: 'ALG-PROPIA', fecha: MIERCOLES, hora: '20:00' });
    const r = validarReglasDeContacto(solicitud({ hora: '20:30' }), [propia], AHORA, { excluirCodigo: 'ALG-PROPIA' });
    assert.equal(r.ok, true);
  });
});

describe('Alternativas cuando no hay mesa', () => {
  test('sugiere horas cercanas del mismo día y el mismo horario en próximos días, sin lunes', () => {
    const reservasDe = (fecha) => (fecha === MIERCOLES ? mesaLargaOcupada(MIERCOLES, ['19:00', '20:30']) : []);
    const { mismoDia, otrosDias } = buscarAlternativas(MIERCOLES, '20:00', 8, reservasDe, AHORA);
    assert.ok(mismoDia.every((h) => h.estado === 'libre'));
    assert.ok(mismoDia.length > 0 && mismoDia.length <= 3);
    assert.equal(otrosDias.length, 3);
    assert.ok(!otrosDias.some((d) => d.fecha === LUNES));
    assert.ok(otrosDias.every((d) => d.hora === '20:00'));
  });
});

describe('Política de cambios', () => {
  const hoyALas19 = reserva({ fecha: MARTES, hora: '19:00', mesa: 'M1' });

  test('se puede cambiar hasta exactamente 3 horas antes', () => {
    assert.equal(puedeCambiar(hoyALas19, { fecha: MARTES, minutos: 16 * 60 }), true);
    assert.equal(puedeCambiar(hoyALas19, { fecha: MARTES, minutos: 16 * 60 + 1 }), false);
  });

  test('una reserva cancelada no se puede cambiar', () => {
    assert.equal(puedeCambiar({ ...hoyALas19, estado: 'cancelada' }, AHORA), false);
  });
});
