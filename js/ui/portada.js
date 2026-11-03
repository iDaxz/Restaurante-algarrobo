// Portada "Recién del fogón": las piezas se mueven un poco con el mouse, cada una a su profundidad
// (--prof en el CSS), como si flotaran sobre la mesa. Solo con mouse y sin movimiento reducido.
// La coreografía de entrada es CSS.

import { $ } from './dom.js';

const RECORRIDO = 14; // píxeles máximos hacia cada lado

export function iniciarPortada() {
  const escena = $('[data-flyer]');
  if (!escena || matchMedia('(prefers-reduced-motion: reduce)').matches || !matchMedia('(hover: hover)').matches) return;
  let pendiente = null;
  escena.addEventListener('pointermove', (e) => {
    const r = escena.getBoundingClientRect();
    pendiente = { x: ((e.clientX - r.left) / r.width - 0.5) * 2, y: ((e.clientY - r.top) / r.height - 0.5) * 2 };
    requestAnimationFrame(() => {
      if (!pendiente) return;
      escena.style.setProperty('--mx', (pendiente.x * -RECORRIDO).toFixed(1));
      escena.style.setProperty('--my', (pendiente.y * -RECORRIDO).toFixed(1));
      pendiente = null;
    });
  });
  escena.addEventListener('pointerleave', () => {
    escena.style.setProperty('--mx', '0');
    escena.style.setProperty('--my', '0');
  });
}
