// Ayudas mínimas para construir DOM sin innerHTML con datos del usuario.

export const $ = (selector, raiz = document) => raiz.querySelector(selector);
export const $$ = (selector, raiz = document) => [...raiz.querySelectorAll(selector)];

/** h('p', { class: 'x', onclick }, 'texto', otroNodo) */
export function h(etiqueta, atributos = {}, ...hijos) {
  const el = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(atributos ?? {})) {
    if (valor === false || valor == null) continue;
    if (clave.startsWith('on') && typeof valor === 'function') el.addEventListener(clave.slice(2), valor);
    else if (clave === 'class') el.className = valor;
    else if (clave === 'html') el.innerHTML = valor; // solo para SVG y textos propios
    else el.setAttribute(clave, valor === true ? '' : valor);
  }
  for (const hijo of hijos.flat()) {
    if (hijo == null || hijo === false) continue;
    el.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
  return el;
}

/**
 * Las fotos que trae el sitio tienen una versión liviana (WebP de 640 px) en la subcarpeta m/.
 * Devuelve { src, srcset, sizes } para que el navegador baje la liviana y la original solo si la
 * necesita. Las fotos subidas desde el panel (/api/v1/fotos/…) van tal cual.
 */
export function atributosFoto(url, sizes) {
  const m = /^(assets\/img\/(?:platos|paisajes))\/([a-z0-9-]+)\.jpg$/.exec(url ?? '');
  if (!m) return { src: url, srcset: null, sizes: null };
  const ligera = `${m[1]}/m/${m[2]}.webp`;
  return { src: ligera, srcset: `${ligera} 640w, ${url} 1280w`, sizes };
}
export const fotoLigera = (url) => atributosFoto(url).src;

/** Aplica atributosFoto a un <img> ya existente. */
export function ponerFoto(img, url, sizes) {
  const { src, srcset } = atributosFoto(url, sizes);
  if (srcset) {
    img.srcset = srcset;
    img.sizes = sizes;
  } else {
    img.removeAttribute('srcset');
    img.removeAttribute('sizes');
  }
  img.src = src;
}

export const soles = (monto) => `S/ ${monto % 1 === 0 ? monto : monto.toFixed(2)}`;

export const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

export const ICONOS = {
  flechaIzq: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>',
  flechaDer: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
  check: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5 10 17 19 7"/></svg>',
};
