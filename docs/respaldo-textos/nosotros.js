// Nosotros y "Lo que llega del norte".
// El camino: una ruta SVG que pasa por el centro de cada foto (se vuelve a trazar si cambia el tamaño)
// y se dibuja al bajar. Un viajero la recorre a la altura del 60 % de la pantalla y, cuando llega a
// una parada, su foto se abre como un lente. Con movimiento reducido el camino aparece entero y quieto.
// La tira: la franja elegida se despliega; en escritorio al pasar el cursor, y siempre con toque o teclado.

import { $, $$ } from './dom.js';

export function iniciarNosotros() {
  iniciarCamino();
  iniciarTira();
}

function iniciarCamino() {
  const camino = $('[data-camino]');
  if (!camino) return;
  const svg = $('.camino-trazo', camino);
  const fondo = $('.camino-fondo', camino);
  const recorrido = $('[data-camino-recorrido]', camino);
  const viajero = $('[data-camino-viajero]', camino);
  const paradas = $$('[data-parada]', camino);
  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let largo = 0;
  let muestras = []; // { largo, y } a lo largo del camino, para saber dónde va el viajero
  let llegadas = []; // en qué punto del camino está cada parada

  if (!reducido) camino.classList.add('con-recorrido');

  // Las fotos se piden cuando el camino está a una pantalla y media, no al llegar a cada parada.
  new IntersectionObserver(([e], obs) => {
    if (!e.isIntersecting) return;
    $$('img', camino).forEach((img) => { img.loading = 'eager'; });
    obs.disconnect();
  }, { rootMargin: '150% 0px' }).observe(camino);

  /** El camino baja de foto en foto con curvas suaves y termina en la caja "Hoy". */
  function trazar() {
    const caja = camino.getBoundingClientRect();
    const relativo = (el, alArriba = false) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2 - caja.left, y: (alArriba ? r.top : r.top + r.height / 2) - caja.top };
    };
    const puntos = paradas.map((p) => {
      const lente = $('.parada-lente', p);
      return lente ? relativo(lente) : relativo(p, true);
    });
    const inicio = { x: puntos[0].x, y: 0 };
    let d = `M ${inicio.x} ${inicio.y}`;
    [inicio, ...puntos].forEach((p0, i, todos) => {
      const p1 = todos[i + 1];
      if (!p1) return;
      const medio = (p1.y - p0.y) / 2;
      d += ` C ${p0.x} ${p0.y + medio} ${p1.x} ${p1.y - medio} ${p1.x} ${p1.y}`;
    });
    svg.setAttribute('viewBox', `0 0 ${caja.width} ${caja.height}`);
    fondo.setAttribute('d', d);
    recorrido.setAttribute('d', d);
    largo = recorrido.getTotalLength();
    recorrido.style.strokeDasharray = `${largo}`;
    muestras = Array.from({ length: 241 }, (_, i) => {
      const l = (largo * i) / 240;
      return { largo: l, y: recorrido.getPointAtLength(l).y };
    });
    llegadas = puntos.map((p) => largoEnY(p.y));
  }

  /** El camino siempre baja, así que a cada altura le corresponde un punto del recorrido. */
  function largoEnY(y) {
    if (y <= 0) return 0;
    const i = muestras.findIndex((m) => m.y >= y);
    if (i === -1) return largo;
    const a = muestras[i - 1] ?? muestras[i];
    const b = muestras[i];
    return b.y === a.y ? b.largo : a.largo + ((y - a.y) / (b.y - a.y)) * (b.largo - a.largo);
  }

  function avanzar() {
    if (reducido) {
      recorrido.style.strokeDashoffset = '0';
      return;
    }
    const caja = camino.getBoundingClientRect();
    const recorridoHasta = largoEnY(innerHeight * 0.6 - caja.top);
    recorrido.style.strokeDashoffset = `${largo - recorridoHasta}`;
    const punto = recorrido.getPointAtLength(recorridoHasta);
    viajero.style.transform = `translate(${punto.x}px, ${punto.y}px)`;
    camino.classList.toggle('en-marcha', recorridoHasta > 0);
    // Una parada, una vez alcanzada, queda abierta aunque se vuelva a subir.
    // La foto se abre recién cuando ya está descargada: si no, el lente se abriría sobre un hueco vacío.
    paradas.forEach((p, i) => {
      if (recorridoHasta < llegadas[i] - 2 || p.classList.contains('llego')) return;
      const img = $('img', p);
      if (!img || img.complete) p.classList.add('llego');
      else img.decode().catch(() => {}).finally(() => p.classList.add('llego'));
    });
  }

  let pendiente = false;
  const programar = () => {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => { pendiente = false; avanzar(); });
  };
  new ResizeObserver(() => { trazar(); avanzar(); }).observe(camino);
  addEventListener('scroll', programar, { passive: true });
}

function iniciarTira() {
  const tira = $('[data-tira]');
  if (!tira) return;
  const franjas = $$('[data-franja]', tira);
  const conCursor = matchMedia('(hover: hover) and (min-width: 900px)');
  const botones = franjas.map((f) => $('.franja-boton', f));

  function abrir(elegida) {
    franjas.forEach((f, i) => {
      const abierta = f === elegida;
      f.classList.toggle('abierta', abierta);
      botones[i].setAttribute('aria-expanded', String(abierta));
    });
  }

  franjas.forEach((franja, i) => {
    botones[i].addEventListener('click', () => abrir(franja));
    // Con cursor se abre al detenerse un instante encima: así cruzar la tira no la hace saltar.
    let espera;
    franja.addEventListener('mouseenter', () => {
      if (!conCursor.matches) return;
      espera = setTimeout(() => abrir(franja), 140);
    });
    franja.addEventListener('mouseleave', () => clearTimeout(espera));
    // Flechas para pasar de una franja a otra con el teclado.
    botones[i].addEventListener('keydown', (e) => {
      const paso = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!paso) return;
      e.preventDefault();
      const destino = (i + paso + franjas.length) % franjas.length;
      botones[destino].focus();
      abrir(franjas[destino]);
    });
  });
}
