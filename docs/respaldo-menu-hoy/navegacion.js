// Menú móvil, estado del header al bajar y aviso de redes de demostración.

import { $, $$ } from './dom.js';

export function iniciarNavegacion() {
  iniciarMenuMovil();

  // El header es transparente arriba y toma fondo al bajar.
  const cabecera = $('[data-cabecera]');
  const marcar = () => cabecera.setAttribute('data-scrolled', String(window.scrollY > 24));
  marcar();
  window.addEventListener('scroll', marcar, { passive: true });

  iniciarRedes();
}

/** Menú móvil a pantalla completa: diálogo modal con foco atrapado, Escape y scroll bloqueado. */
function iniciarMenuMovil() {
  const boton = $('[data-abrir-menu]');
  const menu = $('[data-menu-movil]');
  if (!boton || !menu) return;
  const duracionCierre = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 380);
  let temporizador;

  const enfocables = () => $$('a[href], button:not([disabled])', menu);

  function abrir() {
    clearTimeout(temporizador);
    menu.hidden = false;
    document.body.style.overflow = 'hidden';
    boton.setAttribute('aria-expanded', 'true');
    // Un cuadro después, para que la transición parta del estado cerrado.
    requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('abierto')));
    enfocables()[1]?.focus({ preventScroll: true });
  }

  function cerrar({ devolverFoco = true } = {}) {
    menu.classList.remove('abierto');
    boton.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    temporizador = setTimeout(() => { menu.hidden = true; }, duracionCierre());
    if (devolverFoco) boton.focus({ preventScroll: true });
  }

  boton.addEventListener('click', abrir);
  $('[data-cerrar-menu]', menu).addEventListener('click', () => cerrar());
  $$('a', menu).forEach((a) => a.addEventListener('click', () => cerrar({ devolverFoco: false })));

  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cerrar();
      return;
    }
    if (e.key !== 'Tab') return;
    const lista = enfocables();
    const primero = lista[0];
    const ultimo = lista.at(-1);
    if (e.shiftKey && document.activeElement === primero) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primero.focus();
    }
  });

  // Si la ventana crece hasta escritorio con el menú abierto, se cierra solo.
  matchMedia('(min-width: 1024px)').addEventListener('change', (e) => {
    if (e.matches && !menu.hidden) cerrar({ devolverFoco: false });
  });
}

function iniciarRedes() {
  $$('[data-red-demo]').forEach((enlace) =>
    enlace.addEventListener('click', (e) => {
      e.preventDefault();
      const nota = $('[data-redes-nota]');
      nota.textContent = 'Este perfil es de demostración: el restaurante no existe, así que no hay red social a la que ir.';
      nota.classList.add('text-blanco');
    }));
}
