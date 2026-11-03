// Entrada del titular del inicio: las letras llegan de izquierda a derecha, línea por línea.
// Corre una sola vez, al cargar.

import { $, $$, h } from './dom.js';

const PASO_LETRA = 24;   // ms entre letras
const PAUSA_LINEA = 90;  // ms extra al empezar cada línea

export function iniciarTitular() {
  const titular = $('[data-titular]');
  if (!titular) return;
  const raiz = document.documentElement;

  // Los lectores de pantalla leen la frase entera, sin letras sueltas.
  titular.setAttribute('aria-label', titular.textContent.replace(/\s+/g, ' ').trim());

  let retraso = 0;
  for (const linea of $$(':scope > span', titular)) {
    retraso += PAUSA_LINEA;
    const nodos = [...linea.childNodes];
    linea.replaceChildren();
    for (const nodo of nodos) {
      if (nodo.nodeType !== Node.TEXT_NODE) {
        linea.append(nodo);
        continue;
      }
      // Palabras sin cortar entre líneas; letras sueltas dentro de cada palabra.
      for (const parte of nodo.textContent.split(/(\s+)/)) {
        if (!parte) continue;
        if (/^\s+$/.test(parte)) {
          linea.append(' ');
          continue;
        }
        const palabra = h('span', { class: 'palabra', 'aria-hidden': 'true' });
        for (const letra of parte) {
          palabra.append(h('span', { class: 'letra', style: `--retraso:${retraso}ms` }, letra));
          retraso += PASO_LETRA;
        }
        linea.append(palabra);
      }
    }
  }

  // La fila de datos entra cuando termina la frase.
  $$('[data-inicio-datos]').forEach((el, i) => el.style.setProperty('--retraso', `${retraso + 120 + i * 80}ms`));
  raiz.classList.add('titular-listo');
}
