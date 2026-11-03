// Aparición al hacer scroll: cada bloque sube suavemente la primera vez que entra en pantalla.
// Lo que ya está visible al cargar no se oculta nunca, y con movimiento reducido no se anima nada.

const reducido = matchMedia('(prefers-reduced-motion: reduce)');
const ESCALON = 80;      // ms entre piezas que entran juntas
const MAX_ESCALONES = 5; // tope para que un grupo largo no tarde demasiado

let observador = null;

function crearObservador() {
  return new IntersectionObserver((entradas) => {
    const visibles = entradas.filter((e) => e.isIntersecting);
    visibles.forEach((entrada, i) => {
      const el = entrada.target;
      el.style.setProperty('--retraso-r', `${Math.min(i, MAX_ESCALONES) * ESCALON}ms`);
      el.classList.add('visible');
      observador.unobserve(el);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
}

/** Prepara los elementos para aparecer. Solo afecta a los que están por debajo de la pantalla. */
export function revelar(elementos) {
  if (reducido.matches || !('IntersectionObserver' in window)) return;
  observador ??= crearObservador();
  for (const el of elementos) {
    if (el.getBoundingClientRect().top < window.innerHeight) continue;
    el.classList.add('revelar');
    observador.observe(el);
  }
}

export function iniciarRevelado() {
  revelar(document.querySelectorAll('[data-revelar]'));
}
