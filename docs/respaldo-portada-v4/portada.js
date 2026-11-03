// Portada: el plato que sale como el sol. Mientras la portada está a la vista, el plato gira muy
// despacio y, al bajar, gira más (el anillo de nombres va al revés, desde el CSS). Escribe --giro en
// la sección. Con movimiento reducido no hace nada: el plato queda quieto.

import { $ } from './dom.js';

const GRADOS_POR_SEGUNDO = 3; // giro en reposo: una vuelta cada dos minutos
const GRADOS_POR_PIXEL = 0.12; // giro extra por cada píxel que se baja

export function iniciarPortada() {
  const sol = $('[data-sol]');
  if (!sol || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let visible = true;
  let inicio = null;

  function cuadro(ahora) {
    if (inicio === null) inicio = ahora;
    if (visible) {
      const giro = ((ahora - inicio) / 1000) * GRADOS_POR_SEGUNDO + scrollY * GRADOS_POR_PIXEL;
      sol.style.setProperty('--giro', `${giro.toFixed(2)}deg`);
    }
    requestAnimationFrame(cuadro);
  }

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(sol);
  requestAnimationFrame(cuadro);
}
