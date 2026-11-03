// Pruebas del comprobante que se imprime o se comparte como imagen desde la confirmación y "Mis reservas".

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { datosComprobante, horario, limiteDeCambios, textoEstado } from '../js/ui/comprobante.js';

const reserva = {
  codigo: 'ALG-K7Q3M', fecha: '2026-11-04', hora: '20:00', personas: 4, turno: 'cena',
  mesa: 'M8', mesaAsientos: 4, mesaNombre: null, estado: 'confirmada', confirmadaSimulada: true,
  nombre: 'Ana Quispe', contacto: '987654321', comentarios: 'Es un cumpleaños', creada: '2026-10-27T15:00:00.000Z',
};

test('el horario muestra llegada, salida (90 min) y turno', () => {
  assert.equal(horario(reserva), '20:00 a 21:30 · Cena');
});

test('el estado indica cuando la confirmación es simulada', () => {
  assert.equal(textoEstado(reserva), 'Confirmada (simulado)');
  assert.equal(textoEstado({ ...reserva, estado: 'pendiente' }), 'Pendiente de confirmación');
});

test('el plazo de cambios es 3 horas antes y puede caer el día anterior', () => {
  assert.match(limiteDeCambios(reserva), /4 nov a las 17:00/);
  assert.match(limiteDeCambios({ ...reserva, fecha: '2026-11-04', hora: '01:30' }), /3 nov a las 22:30/);
});

test('la ficha completa lleva el contacto; la de la imagen para compartir no', () => {
  const titulos = (d) => d.map((x) => x.titulo);
  assert.ok(titulos(datosComprobante(reserva)).includes('Correo o teléfono'));
  assert.ok(!titulos(datosComprobante(reserva, { conContacto: false })).includes('Correo o teléfono'));
});

test('sin comentarios se indica en lugar de dejar el hueco', () => {
  const comentario = datosComprobante({ ...reserva, comentarios: '' }).find((d) => d.titulo === 'Comentarios');
  assert.equal(comentario.valor, 'Sin comentarios');
  assert.equal(comentario.vacio, true);
});
