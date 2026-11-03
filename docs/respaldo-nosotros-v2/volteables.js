// Tarjetas que giran (Nosotros y "Lo que llega del norte"). Con cursor giran solas al pasar por
// encima (CSS); con el dedo o el teclado, el botón que cubre cada tarjeta la gira y la devuelve,
// y aria-pressed dice de qué lado está.

import { $$ } from './dom.js';

export function iniciarVolteables() {
  for (const tarjeta of $$('[data-volteable]')) {
    const boton = tarjeta.querySelector('.volteable-boton');
    boton?.addEventListener('click', () => {
      boton.setAttribute('aria-pressed', String(tarjeta.classList.toggle('volteada')));
    });
  }
}
