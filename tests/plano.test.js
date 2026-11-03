// Pruebas de la mesa elegida en el plano: motor, servicio de demostración y datos del plano.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { RESERVAS } from '../js/config/restaurante.js';
import { estadoDeMesas, validarSolicitud } from '../js/core/disponibilidad.js';
import { CODIGOS } from '../js/core/errores.js';
import { PISOS, UBICACION_MESAS, ubicacionDe } from '../js/data/plano.js';
import { almacenEnMemoria, crearServicioDemo } from '../js/services/reservas-demo.js';

const MIERCOLES = '2026-11-04';
const AHORA = { fecha: '2026-11-03', minutos: 600 };
const solicitud = (cambios = {}) => ({ nombre: 'Ana Quispe', contacto: '987654321', fecha: MIERCOLES, hora: '20:00', personas: 4, ...cambios });
const ocupa = (mesa, hora) => ({ codigo: `T-${mesa}`, mesa, hora, estado: 'confirmada' });

describe('Mesa elegida en el motor', () => {
  test('se respeta si sirve para el grupo y está libre (aunque se escriba en minúscula)', () => {
    const v = validarSolicitud(solicitud({ mesa: 'm9' }), [], AHORA);
    assert.equal(v.ok, true);
    assert.equal(v.mesa.id, 'M9');
  });

  test('una mesa de otro tamaño se rechaza en el campo mesa', () => {
    const v = validarSolicitud(solicitud({ mesa: 'M1' }), [], AHORA);
    assert.equal(v.codigo, CODIGOS.MESA_INVALIDA);
    assert.ok(v.errores.mesa);
  });

  test('una mesa ocupada a esa hora se rechaza; sin elegir, la casa asigna otra', () => {
    const ocupadas = [ocupa('M9', '19:30')];
    assert.equal(validarSolicitud(solicitud({ mesa: 'M9' }), ocupadas, AHORA).codigo, CODIGOS.MESA_OCUPADA);
    const sinElegir = validarSolicitud(solicitud(), ocupadas, AHORA);
    assert.equal(sinElegir.ok, true);
    assert.notEqual(sinElegir.mesa.id, 'M9');
  });

  test('el plano dice de cada mesa si está libre, ocupada o no sirve', () => {
    const estados = estadoDeMesas([ocupa('M7', '20:00')], 4, '20:00');
    const de = (id) => estados.find((m) => m.id === id).estado;
    assert.equal(estados.length, RESERVAS.mesas.length);
    assert.equal(de('M7'), 'ocupada');
    assert.equal(de('M8'), 'libre');
    assert.equal(de('M1'), 'no-sirve');
  });
});

describe('Mesa elegida en el servicio de demostración', () => {
  let almacen;
  const servicio = (sesion) => crearServicioDemo({
    almacen, sesion, latencia: 0, sembrar: false, reloj: () => AHORA, ahoraMs: () => Date.parse('2026-11-03T15:00:00Z'),
  });
  beforeEach(() => { almacen = almacenEnMemoria(); });

  test('apartar la mesa elegida la bloquea para otra pestaña, que la ve ocupada', async () => {
    const a = servicio('A');
    const b = servicio('B');
    const retencion = await a.retenerMesa(MIERCOLES, '20:00', 4, { mesa: 'M9' });
    assert.equal(retencion.mesa, 'M9');
    assert.equal((await a.consultarMesas(MIERCOLES, '20:00', 4)).find((m) => m.id === 'M9').estado, 'libre');
    assert.equal((await b.consultarMesas(MIERCOLES, '20:00', 4)).find((m) => m.id === 'M9').estado, 'ocupada');
    await assert.rejects(b.retenerMesa(MIERCOLES, '20:00', 4, { mesa: 'M9' }), (e) => e.codigo === CODIGOS.MESA_OCUPADA);
  });

  test('la reserva queda en la mesa elegida', async () => {
    const r = await servicio('A').crearReserva(solicitud({ mesa: 'M9' }));
    assert.equal(r.mesa, 'M9');
  });

  test('al modificar no se arrastra la mesa anterior: con más personas la casa asigna otra', async () => {
    const s = servicio('A');
    const r = await s.crearReserva(solicitud({ personas: 2, mesa: 'M3' }));
    const cambiada = await s.modificarReserva(r.codigo, '987654321', { personas: 4 });
    assert.equal(cambiada.mesaAsientos, 4);
  });
});

describe('Datos del plano', () => {
  test('cada mesa de la configuración tiene su lugar en un piso y una zona que existen', () => {
    for (const m of RESERVAS.mesas) {
      const u = UBICACION_MESAS[m.id];
      assert.ok(u, `${m.id} no está en el plano`);
      const piso = PISOS.find((p) => p.id === u.piso);
      assert.ok(piso && piso.zonas.some((z) => z.id === u.zona), `${m.id}: piso o zona inexistente`);
    }
  });

  test('ubicacionDe arma el texto para el comprobante', () => {
    assert.equal(ubicacionDe('M1').texto, 'Junto al ventanal · 1.er piso');
    assert.equal(ubicacionDe('M99'), null);
  });
});
