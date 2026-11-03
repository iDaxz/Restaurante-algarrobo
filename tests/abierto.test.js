// Pruebas del estado "abierto / cerrado ahora" que muestran el menú y la banda "Hoy".

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { estadoDelLocal } from '../js/core/abierto.js';

const turnos = [
  { id: 'almuerzo', nombre: 'Almuerzo', inicio: '12:00', fin: '16:30' },
  { id: 'cena', nombre: 'Cena', inicio: '19:00', fin: '23:00' },
];
const a = (hora) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3));

describe('Estado del local', () => {
  test('antes de abrir anuncia el primer turno', () => {
    assert.deepEqual(estadoDelLocal({ turnos }, a('10:15')), { abierto: false, turnoActual: null, texto: 'Cerrado ahora · almuerzo desde las 12:00' });
  });
  test('durante un turno dice hasta qué hora', () => {
    const e = estadoDelLocal({ turnos }, a('12:00'));
    assert.equal(e.abierto, true);
    assert.equal(e.turnoActual, 'almuerzo');
    assert.equal(e.texto, 'Abierto ahora · almuerzo hasta las 16:30');
  });
  test('entre turnos anuncia la cena; al cerrar un turno ya no está abierto', () => {
    assert.equal(estadoDelLocal({ turnos }, a('16:30')).texto, 'Cerrado ahora · cena desde las 19:00');
  });
  test('después del último turno y en día de descanso', () => {
    assert.equal(estadoDelLocal({ turnos }, a('23:30')).texto, 'Cerrado por hoy');
    assert.equal(estadoDelLocal({ cerrado: true, turnos: [] }, a('13:00')).texto, 'Hoy descansamos');
  });
});
