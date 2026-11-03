// Pruebas del ciclo de vida de una reserva y de los errores con código.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { CODIGOS, ErrorReserva } from '../js/core/errores.js';
import { estadoVisible, ordenarMisReservas, puedeTransicionar, sigueEnMisReservas, transicionar } from '../js/core/estados.js';

describe('Transiciones de estado', () => {
  const permitidas = [
    ['pendiente', 'confirmada'],
    ['pendiente', 'cancelada'],
    ['confirmada', 'completada'],
    ['confirmada', 'cancelada'],
  ];
  const prohibidas = [
    ['cancelada', 'confirmada'],
    ['cancelada', 'pendiente'],
    ['completada', 'cancelada'],
    ['pendiente', 'completada'],
    ['confirmada', 'pendiente'],
  ];

  for (const [desde, hacia] of permitidas) {
    test(`${desde} → ${hacia} está permitida`, () => assert.equal(puedeTransicionar(desde, hacia), true));
  }
  for (const [desde, hacia] of prohibidas) {
    test(`${desde} → ${hacia} no está permitida`, () => assert.equal(puedeTransicionar(desde, hacia), false));
  }

  test('transicionar devuelve una copia y no modifica la original', () => {
    const original = { codigo: 'ALG-1', estado: 'pendiente' };
    const nueva = transicionar(original, 'confirmada');
    assert.equal(nueva.estado, 'confirmada');
    assert.equal(original.estado, 'pendiente');
  });

  test('una transición inválida lanza TRANSICION_INVALIDA', () => {
    assert.throws(
      () => transicionar({ codigo: 'ALG-1', estado: 'cancelada' }, 'confirmada'),
      (e) => e instanceof ErrorReserva && e.codigo === CODIGOS.TRANSICION_INVALIDA,
    );
  });
});

describe('Estado visible', () => {
  const r = { fecha: '2026-11-04', hora: '20:00', estado: 'confirmada' };

  test('antes y durante la comida sigue confirmada', () => {
    assert.equal(estadoVisible(r, { fecha: '2026-11-04', minutos: 20 * 60 + 30 }), 'confirmada');
  });

  test('cuando termina su tiempo de mesa se ve como completada', () => {
    assert.equal(estadoVisible(r, { fecha: '2026-11-04', minutos: 21 * 60 + 30 }), 'completada');
  });

  test('una cancelada sigue cancelada', () => {
    assert.equal(estadoVisible({ ...r, estado: 'cancelada' }, { fecha: '2026-12-01', minutos: 0 }), 'cancelada');
  });
});

describe('Errores con código', () => {
  test('toJSON tiene la forma que devolverá la API', () => {
    const e = new ErrorReserva(CODIGOS.HORARIO_LLENO, 'Sin mesa', { errores: { hora: 'lleno' } });
    assert.deepEqual(e.toJSON(), { codigo: 'HORARIO_LLENO', mensaje: 'Sin mesa', errores: { hora: 'lleno' }, alternativas: null });
  });
});

describe('Orden de "Mis reservas"', () => {
  test('activas primero; en cada grupo, la hecha más recientemente arriba', () => {
    const r = (codigo, estado, creada) => ({ codigo, estado, creada });
    const lista = [
      r('A', 'confirmada', '2026-10-20T10:00:00Z'),
      r('B', 'cancelada', '2026-10-25T10:00:00Z'),
      r('C', 'pendiente', '2026-10-27T09:00:00Z'),
      r('D', 'completada', '2026-10-10T10:00:00Z'),
    ];
    assert.deepEqual(ordenarMisReservas(lista).map((x) => x.codigo), ['C', 'A', 'B', 'D']);
  });
});

describe('Cuánto se ven las reservas anteriores en "Mis reservas"', () => {
  const ahora = { fecha: '2026-12-05', minutos: 600 };
  test('las activas siempre; las anteriores, hasta 30 días después de su fecha', () => {
    assert.equal(sigueEnMisReservas({ estado: 'confirmada', fecha: '2026-01-01' }, ahora), true);
    assert.equal(sigueEnMisReservas({ estado: 'cancelada', fecha: '2026-11-05' }, ahora), true);
    assert.equal(sigueEnMisReservas({ estado: 'no_asistio', fecha: '2026-11-04' }, ahora), false);
  });
});
