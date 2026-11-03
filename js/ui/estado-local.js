// Estado del local ("Abierto ahora · almuerzo hasta las 16:30") en el menú móvil, recalculado cada minuto.

import { estadoDelLocal } from '../core/abierto.js';
import { $, $$ } from './dom.js';

export async function iniciarEstadoLocal(servicio) {
  const sitios = $$('[data-estado-local]');
  if (!sitios.length) return;
  const pintar = (estado) => {
    for (const el of sitios) {
      el.dataset.abierto = String(Boolean(estado?.abierto));
      $('[data-estado-local-texto]', el).textContent = estado?.texto ?? 'Barranco, Lima';
    }
  };
  let resumen;
  try {
    resumen = await servicio.resumenDeHoy();
  } catch {
    pintar(null);
    return;
  }
  const actualizar = () => pintar(estadoDelLocal(resumen, servicio.ahora().minutos));
  actualizar();
  setInterval(actualizar, 60_000);
}
