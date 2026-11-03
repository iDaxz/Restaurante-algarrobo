// Punto de entrada. El servicio de reservas es la única pieza que cambia al conectar el backend.

import { MODO_RESERVAS } from './config/restaurante.js';
import { conectarApi } from './services/reservas-api.js';
import { reservasDemo } from './services/reservas-demo.js';
import { CATEGORIAS, PLATOS } from './data/carta.js';
import { CREDITOS } from './data/creditos.js';
import { iniciarCarta } from './ui/carta.js';
import { iniciarGestion } from './ui/gestion.js';
import { iniciarMisReservas } from './ui/mis-reservas.js';
import { iniciarNavegacion } from './ui/navegacion.js';
import { iniciarAntojo } from './ui/antojo.js';
import { iniciarNosotros } from './ui/nosotros.js';
import { iniciarPortada } from './ui/portada.js';
import { iniciarEstadoLocal } from './ui/estado-local.js';
import { iniciarReserva } from './ui/reserva.js';
import { iniciarTitular } from './ui/titular.js';
import { iniciarRevelado } from './ui/revelar.js';
import { iniciarDetalle } from './ui/plato-detalle.js';
import { $, $$, h } from './ui/dom.js';

// La entrada del titular es decorativa: si falla, se muestra el texto y el resto de la página sigue.
try {
  iniciarTitular();
} catch {
  document.documentElement.classList.add('titular-listo');
}
iniciarNavegacion();
iniciarNosotros();
iniciarPortada();
iniciarDetalle();

// Lo visual arranca sin esperar; las reservas y la carta, cuando se sabe si hay servidor.
let ultimaCarta = ''; // la última carta recibida del servidor, para repintar solo si cambió
const servicio = await elegirServicio();
aplicarTextosDelModo(servicio);
if (!servicio.esDemo) await cargarCartaDelServidor();
const carta = iniciarCarta();
if (!servicio.esDemo) mantenerCartaAlDia();
iniciarAntojo();

let gestion;
const reserva = iniciarReserva(servicio, { alVerGestion: (codigo, contacto) => gestion.abrir(codigo, contacto) });
gestion = iniciarGestion(servicio, reserva);
iniciarMisReservas(servicio, reserva);

// Otra pestaña reservó o liberó una mesa: el servicio avisa y la interfaz se actualiza.
window.addEventListener('storage', (e) => servicio.notificarCambioExterno(e.key));

iniciarEstadoLocal(servicio);
iniciarRevelado();

$('[data-creditos]').replaceChildren(...CREDITOS.map((c) =>
  h('li', {},
    h('a', { class: 'underline', href: c.fuente, target: '_blank', rel: 'noopener' }, c.titulo),
    ` · ${c.autor} · `,
    c.licenciaUrl ? h('a', { class: 'underline', href: c.licenciaUrl, target: '_blank', rel: 'noopener license' }, c.licencia) : c.licencia,
  )));

/** Demo (localStorage) o API, según MODO_RESERVAS o ?modo= en la URL. */
async function elegirServicio() {
  const pedido = new URLSearchParams(location.search).get('modo');
  const modo = ['auto', 'demo', 'api'].includes(pedido) ? pedido : MODO_RESERVAS;
  if (modo === 'demo') return reservasDemo;
  const api = await conectarApi();
  if (api) return api;
  if (modo === 'api') {
    document.documentElement.dataset.sinServidor = '';
    console.warn('Modo API sin servidor: se usa la demostración.');
  }
  return reservasDemo;
}

/** Los textos fijos de la página que dependen de si la reserva llega o no a un servidor. */
function aplicarTextosDelModo(s) {
  document.documentElement.dataset.modoReservas = s.esDemo ? 'demo' : 'api';
  if (s.esDemo) return;
  $$('[data-texto-api]').forEach((el) => { el.textContent = el.dataset.textoApi; });
  // Al volver a la pestaña: puede haber reservas confirmadas por el personal u horarios ocupados.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') s.refrescar();
  });
}

/**
 * En modo API la carta sale del servidor (la edita el administrador). Se reemplaza el contenido de las
 * listas de js/data/carta.js para que la carta y el detalle la usen sin cambios. Si el
 * servidor no responde, se queda la carta incluida en la página.
 */
async function cargarCartaDelServidor() {
  try {
    const respuesta = await fetch('/api/v1/carta', { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!respuesta.ok) return false;
    const texto = await respuesta.text();
    if (texto === ultimaCarta) return false;
    ultimaCarta = texto;
    const carta = JSON.parse(texto);
    CATEGORIAS.splice(0, CATEGORIAS.length, ...carta.categorias);
    PLATOS.splice(0, PLATOS.length, ...carta.platos.map((p) => ({ ...p, precio: Number(p.precio) })));
    return true;
  } catch {
    // sin conexión: se usa la carta incluida en la página (o la última que llegó)
    return false;
  }
}

/**
 * Lo que el administrador cambia en la carta (etiquetas, precios, agotados, platos nuevos) llega a la
 * web abierta sin recargar: se vuelve a pedir al regresar a la pestaña y cada minuto mientras está a la vista.
 */
function mantenerCartaAlDia() {
  const revisar = async () => {
    if (document.visibilityState === 'visible' && (await cargarCartaDelServidor())) {
      carta.repintar();
    }
  };
  document.addEventListener('visibilitychange', revisar);
  setInterval(revisar, 60_000);
}
