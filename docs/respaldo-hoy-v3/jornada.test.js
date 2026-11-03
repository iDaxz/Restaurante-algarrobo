// Pruebas de la regla del día que dibuja la sección "Hoy".

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { reglaDelDia, posicionEnRegla } from '../js/core/jornada.js';

const turnos = [
  { id: 'almuerzo', nombre: 'Almuerzo', inicio: '12:00', fin: '16:30' },
  { id: 'cena', nombre: 'Cena', inicio: '19:00', fin: '23:00' },
];

describe('Regla del día', () => {
  test('va de una hora antes del primer turno a una después del último', () => {
    const regla = reglaDelDia(turnos);
    assert.equal(regla.desde, 11 * 60);
    assert.equal(regla.hasta, 24 * 60);
    assert.equal(regla.horas.length, 14);
  });

  test('alterna huecos y turnos en minutos que suman toda la regla', () => {
    const { columnas, desde, hasta } = reglaDelDia(turnos);
    assert.deepEqual(columnas, [60, 270, 150, 240, 60]);
    assert.equal(columnas.reduce((a, b) => a + b, 0), hasta - desde);
  });

  test('no pasa de medianoche', () => {
    const { hasta } = reglaDelDia([{ inicio: '20:00', fin: '23:30' }]);
    assert.equal(hasta, 24 * 60);
  });

  test('la posición se queda en los bordes fuera del rango', () => {
    const regla = reglaDelDia(turnos);
    assert.equal(posicionEnRegla(9 * 60, regla), 0);
    assert.equal(posicionEnRegla(24 * 60 + 30, regla), 100);
    assert.equal(posicionEnRegla(12 * 60, regla), 100 * 60 / 780);
  });
});
