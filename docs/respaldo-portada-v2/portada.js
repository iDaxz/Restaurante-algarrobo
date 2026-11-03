// Portada "ventana al norte" y rieles.
// Portada: los paisajes pasan solos cada 6,5 s con un fundido; la barra de cada foto muestra cuánto le
// queda, se puede saltar a cualquiera y pausar (contenido que se mueve solo debe poder detenerse).
// Se pausa sola fuera de pantalla o con la pestaña oculta; con movimiento reducido arranca en pausa.
// Cada foto se pide recién cuando le toca la siguiente, para no cargar seis paisajes de entrada.
// Rieles: dos filas que se desplazan en sentidos opuestos según el scroll, con algo de inercia.

import { $, $$ } from './dom.js';

const DURACION = 6500;

export function iniciarPortada() {
  iniciarFotos();
  iniciarRieles();
}

function iniciarFotos() {
  const portada = $('[data-portada]');
  if (!portada) return;
  const fotos = $$('[data-foto]', portada);
  const pasos = $$('[data-paso]', portada);
  const lugar = $('[data-portada-lugar]', portada);
  const pausa = $('[data-portada-pausa]', portada);
  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let actual = 0;
  let transcurrido = 0;
  let ultimo = null;
  let pausadaPorPersona = reducido;
  let visible = true;

  const cargar = (i) => {
    const img = $('img', fotos[i]);
    if (img?.dataset.srcset) {
      img.srcset = img.dataset.srcset;
      img.removeAttribute('data-srcset');
    }
  };
  // La segunda foto espera a que la primera termine de cargar: así no le quita ancho de banda al inicio.
  const primera = $('img', fotos[0]);
  const prepararSiguiente = () => setTimeout(() => cargar(1 % fotos.length), 1200);
  if (primera?.complete) prepararSiguiente();
  else primera?.addEventListener('load', prepararSiguiente, { once: true });

  function mostrar(i) {
    const anterior = actual;
    actual = (i + fotos.length) % fotos.length;
    cargar(actual);
    cargar((actual + 1) % fotos.length);
    fotos.forEach((f, n) => {
      f.classList.toggle('activa', n === actual);
      f.classList.toggle('saliendo', n === anterior && n !== actual);
    });
    pasos.forEach((p, n) => {
      if (n === actual) p.setAttribute('aria-current', 'true');
      else p.removeAttribute('aria-current');
      $('.portada-barra > span', p)?.style.setProperty('--p', n < actual ? 1 : 0);
    });
    lugar.textContent = fotos[actual].dataset.lugar;
    transcurrido = 0;
  }

  const barra = (i) => $('.portada-barra > span', pasos[i]);
  const enMarcha = () => !pausadaPorPersona && visible && document.visibilityState === 'visible';

  function cuadro(ahora) {
    if (ultimo !== null && enMarcha()) {
      transcurrido += ahora - ultimo;
      barra(actual)?.style.setProperty('--p', Math.min(1, transcurrido / DURACION));
      if (transcurrido >= DURACION) mostrar(actual + 1);
    }
    ultimo = ahora;
    portada.classList.toggle('en-pausa', !enMarcha());
    requestAnimationFrame(cuadro);
  }

  function ponerPausa(pausada) {
    pausadaPorPersona = pausada;
    pausa.setAttribute('aria-pressed', String(pausada));
    pausa.setAttribute('aria-label', pausada ? 'Reanudar las fotos' : 'Pausar las fotos');
  }

  pasos.forEach((p, i) => p.addEventListener('click', () => mostrar(i)));
  pausa.addEventListener('click', () => ponerPausa(!pausadaPorPersona));
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(portada);
  ponerPausa(pausadaPorPersona);
  requestAnimationFrame(cuadro);
}

function iniciarRieles() {
  const rieles = $('[data-rieles]');
  if (!rieles || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const filas = $$('[data-riel]', rieles).map((riel) => ({
    pista: $('.riel-pista', riel),
    sentido: Number(riel.dataset.riel),
    actual: null,
  }));
  let visible = false;
  let andando = false;

  /** 0 cuando los rieles asoman por abajo, 1 cuando salen por arriba. */
  const avance = () => {
    const r = rieles.getBoundingClientRect();
    return Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight + r.height)));
  };

  function cuadro() {
    const a = avance();
    let quieto = true;
    for (const fila of filas) {
      // La pista tiene tres copias del grupo y se mueve alrededor de la del medio. En todo el paso por
      // la pantalla recorre como mucho el ancho de la ventana: acompaña al scroll sin adelantarlo.
      const grupo = fila.pista.scrollWidth / 3;
      const recorrido = Math.min(grupo * 0.8, innerWidth * 0.9);
      const objetivo = -grupo + fila.sentido * (a - 0.5) * recorrido;
      fila.actual = fila.actual === null ? objetivo : fila.actual + (objetivo - fila.actual) * 0.12;
      if (Math.abs(objetivo - fila.actual) > 0.5) quieto = false;
      fila.pista.style.transform = `translate3d(${fila.actual.toFixed(1)}px, 0, 0)`;
    }
    andando = visible || !quieto;
    if (andando) requestAnimationFrame(cuadro);
  }

  const arrancar = () => { if (!andando) { andando = true; requestAnimationFrame(cuadro); } };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) arrancar(); }).observe(rieles);
  addEventListener('scroll', () => { if (visible) arrancar(); }, { passive: true });
  cuadro();
}
