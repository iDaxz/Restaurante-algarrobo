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

/**
 * Menú móvil: una hoja clara que baja bajo la cabecera. La hamburguesa se vuelve una X y sigue
 * siendo el botón para cerrar. Diálogo modal con foco atrapado (botón + hoja), Escape y scroll
 * bloqueado; marca la sección en la que está la persona ("Estás aquí").
 */
function iniciarMenuMovil() {
  const boton = $('[data-abrir-menu]');
  const menu = $('[data-menu-movil]');
  if (!boton || !menu) return;
  const cabecera = $('[data-cabecera]');
  const duracionCierre = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 380);
  let temporizador;

  const abierto = () => boton.getAttribute('aria-expanded') === 'true';
  const enfocables = () => [boton, ...$$('a[href]:not([hidden]), button:not([disabled])', menu)];

  /** La sección cuyo inicio ya pasó el primer tercio de la pantalla. */
  function marcarSeccionActual() {
    const enlaces = $$('[data-seccion]', menu);
    let actual = null;
    for (const enlace of enlaces) {
      const seccion = document.getElementById(enlace.dataset.seccion);
      if (seccion && seccion.getBoundingClientRect().top <= window.innerHeight / 3) actual = enlace;
    }
    enlaces.forEach((e) => (e === actual ? e.setAttribute('aria-current', 'location') : e.removeAttribute('aria-current')));
  }

  function abrir() {
    clearTimeout(temporizador);
    // La hoja empieza justo bajo la cabecera, esté o no visible la franja de arriba.
    menu.style.setProperty('--menu-arriba', `${Math.max(0, cabecera.getBoundingClientRect().bottom)}px`);
    marcarSeccionActual();
    menu.hidden = false;
    document.body.style.overflow = 'hidden';
    document.body.dataset.menuAbierto = '';
    boton.setAttribute('aria-expanded', 'true');
    boton.setAttribute('aria-label', 'Cerrar menú');
    // Un cuadro después, para que la transición parta del estado cerrado.
    requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('abierto')));
    // El foco entra a la hoja (sin dibujar contorno en un enlace); con Tab se llega al primero.
    menu.focus({ preventScroll: true });
  }

  function cerrar({ devolverFoco = true } = {}) {
    menu.classList.remove('abierto');
    boton.setAttribute('aria-expanded', 'false');
    boton.setAttribute('aria-label', 'Abrir menú');
    document.body.style.overflow = '';
    delete document.body.dataset.menuAbierto;
    temporizador = setTimeout(() => { menu.hidden = true; }, duracionCierre());
    if (devolverFoco) boton.focus({ preventScroll: true });
  }

  boton.addEventListener('click', () => (abierto() ? cerrar() : abrir()));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => cerrar({ devolverFoco: false })));

  document.addEventListener('keydown', (e) => {
    if (!abierto()) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      cerrar();
      return;
    }
    if (e.key !== 'Tab') return;
    const lista = enfocables();
    const primero = lista[0];
    const ultimo = lista.at(-1);
    if (!lista.includes(document.activeElement)) {
      // Desde la hoja misma (recién abierta), Tab entra al primer enlace.
      e.preventDefault();
      (e.shiftKey ? ultimo : lista[1] ?? primero).focus();
    } else if (e.shiftKey && document.activeElement === primero) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primero.focus();
    }
  });

  // Si la ventana crece hasta escritorio con el menú abierto, se cierra solo.
  matchMedia('(min-width: 1024px)').addEventListener('change', (e) => {
    if (e.matches && abierto()) cerrar({ devolverFoco: false });
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
