// Cinta decorativa entre la portada y la carta.

import { $ } from './dom.js';

/** La cinta entre la portada y la carta: duplica su grupo para un bucle sin costuras y se detiene fuera de pantalla. */
export function iniciarCinta() {
  const cinta = $('[data-cinta]');
  if (!cinta) return;
  const pista = $('[data-cinta-pista]', cinta);
  pista.append(pista.firstElementChild.cloneNode(true));
  new IntersectionObserver(([e]) => cinta.classList.toggle('en-pantalla', e.isIntersecting)).observe(cinta);
}
