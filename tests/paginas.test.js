// Pruebas de los números de página bajo la carta.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { numerosDePagina } from '../js/core/paginas.js';

describe('Números de página', () => {
  test('con pocas páginas se muestran todas', () => {
    assert.deepEqual(numerosDePagina(1, 0), [0]);
    assert.deepEqual(numerosDePagina(4, 2), [0, 1, 2, 3]);
    assert.deepEqual(numerosDePagina(7, 6), [0, 1, 2, 3, 4, 5, 6]);
  });

  test('con muchas, la primera, la última y las vecinas de la actual', () => {
    assert.deepEqual(numerosDePagina(12, 5), [0, '…', 4, 5, 6, '…', 11]);
  });

  test('en los extremos no repite páginas ni pone "…" de más', () => {
    assert.deepEqual(numerosDePagina(12, 0), [0, 1, '…', 11]);
    assert.deepEqual(numerosDePagina(12, 11), [0, '…', 10, 11]);
    assert.deepEqual(numerosDePagina(12, 2), [0, 1, 2, 3, '…', 11]);
  });
});
