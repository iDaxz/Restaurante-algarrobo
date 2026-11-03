// Ventana de detalle de un plato: foto grande, origen, descripción, historia y precio.
// Usa <dialog> nativo (foco atrapado, Escape y retorno del foco) y una animación propia de entrada y salida.

import { ETIQUETAS, PLATOS } from '../data/carta.js';
import { $, ponerFoto, soles } from './dom.js';

const reducido = matchMedia('(prefers-reduced-motion: reduce)');
const DURACION_SALIDA = 240; // ms: la salida es más rápida que la entrada

let dialogo;
let cerrando = false;

export function iniciarDetalle() {
  dialogo = $('[data-plato-detalle]');
  if (!dialogo) {
    console.warn('Algarrobo: falta el <dialog data-plato-detalle> en index.html; la carta no podrá abrir el detalle de los platos.');
    return;
  }

  // Clic en el fondo oscuro (fuera del panel) cierra.
  dialogo.addEventListener('click', (e) => { if (e.target === dialogo) cerrar(); });
  // Escape: animamos la salida en vez del cierre instantáneo del navegador.
  dialogo.addEventListener('cancel', (e) => { e.preventDefault(); cerrar(); });
  dialogo.querySelectorAll('[data-cerrar-detalle]').forEach((b) => b.addEventListener('click', () => cerrar()));
  $('[data-detalle-reservar]', dialogo).addEventListener('click', (e) => {
    e.preventDefault();
    cerrar(() => document.getElementById('reservas').scrollIntoView({ block: 'start' }));
  });
}

export async function abrirPlato(id) {
  const plato = PLATOS.find((p) => p.id === id);
  if (!plato || !dialogo) return;

  const img = $('[data-detalle-foto]', dialogo);
  ponerFoto(img, plato.foto, '(min-width: 768px) 30rem, 100vw');
  img.alt = `Foto ilustrativa: ${plato.nombre}`;
  $('[data-detalle-nombre]', dialogo).textContent = plato.nombre;
  $('[data-detalle-origen]', dialogo).textContent = plato.origen;
  $('[data-detalle-descripcion]', dialogo).textContent = plato.descripcion;
  $('[data-detalle-historia]', dialogo).textContent = plato.historia;
  $('[data-detalle-precio]', dialogo).textContent = soles(plato.precio);
  const etiqueta = $('[data-detalle-etiqueta]', dialogo);
  etiqueta.hidden = !plato.etiqueta;
  etiqueta.className = `etiqueta etiqueta--${plato.etiqueta ?? ''}`;
  etiqueta.textContent = plato.etiqueta ? ETIQUETAS[plato.etiqueta] : '';
  $('[data-detalle-cuerpo]', dialogo).scrollTop = 0;
  // Abrimos con la foto nueva ya lista, para no mostrar un instante la del plato anterior.
  await img.decode().catch(() => {});
  if (dialogo.open) return;

  cerrando = false;
  dialogo.removeAttribute('data-cerrando');
  // Al abrirse, la animación de entrada arranca sola por CSS ([open]); el panel ya es visible por defecto.
  dialogo.showModal();
  document.documentElement.style.overflow = 'hidden';
}

function cerrar(despues) {
  if (!dialogo?.open || cerrando) return;
  cerrando = true;
  dialogo.setAttribute('data-cerrando', '');
  setTimeout(() => {
    dialogo.close();
    dialogo.removeAttribute('data-cerrando');
    document.documentElement.style.overflow = '';
    cerrando = false;
    despues?.();
  }, reducido.matches ? 0 : DURACION_SALIDA);
}
