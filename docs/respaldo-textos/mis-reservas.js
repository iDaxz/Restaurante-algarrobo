// "Mis reservas": panel lateral con la ficha completa de cada reserva hecha desde este navegador,
// con acceso directo a cambiar, cancelar, imprimir o compartir. Se actualiza sola cuando cambia
// algo (en esta pestaña o en otra) y se abre desde la cabecera o desde cualquier enlace a #mis-reservas.

import { RESERVAS, RESTAURANTE } from '../config/restaurante.js';
import { formatoLargo } from '../core/fechas.js';
import { accionesComprobante, datosComprobante, horario, limiteDeCambios, textoEstado } from './comprobante.js';
import { $, $$, h, plural } from './dom.js';

const esInactiva = (r) => !['pendiente', 'confirmada'].includes(r.estado);

export function iniciarMisReservas(servicio, reserva) {
  const dialogo = $('[data-mis-reservas]');
  const lista = $('[data-mis-reservas-lista]', dialogo ?? document);
  if (!dialogo || !lista) return { refrescar: () => {}, abrir: () => {} };
  const botonCabecera = $('[data-abrir-mis-reservas]');
  const numero = $('[data-mis-reservas-num]');
  const enlaceMenu = $('[data-enlace-mis-reservas]');
  const avisoMenu = $('[data-aviso-menu]');
  let origenDelFoco = null;

  // ---------- Abrir y cerrar ----------
  function abrir() {
    if (dialogo.open) return;
    origenDelFoco = document.activeElement;
    dialogo.removeAttribute('data-cerrando');
    dialogo.showModal();
    refrescar();
  }

  function cerrar(despues) {
    if (!dialogo.open) return;
    const sinAnimacion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    dialogo.setAttribute('data-cerrando', '');
    setTimeout(() => {
      dialogo.close();
      dialogo.removeAttribute('data-cerrando');
      if (despues) despues();
      else origenDelFoco?.focus?.({ preventScroll: true });
    }, sinAnimacion ? 0 : 220);
  }

  botonCabecera?.addEventListener('click', abrir);
  $$('[data-cerrar-mis-reservas]', dialogo).forEach((b) => b.addEventListener('click', () => cerrar()));
  dialogo.addEventListener('cancel', (e) => { e.preventDefault(); cerrar(); });
  dialogo.addEventListener('click', (e) => { if (e.target === dialogo) cerrar(); });
  // Cualquier enlace a #mis-reservas (aviso de duplicado, menú móvil…) abre el panel.
  document.addEventListener('click', (e) => {
    const enlace = e.target.closest?.('a[href="#mis-reservas"]');
    if (!enlace) return;
    e.preventDefault();
    abrir();
  });
  if (location.hash === '#mis-reservas') abrir();

  // ---------- Datos ----------
  let pidiendo = 0;
  async function refrescar() {
    const pedido = ++pidiendo;
    let reservas;
    try {
      reservas = await servicio.listarMisReservas();
    } catch {
      return; // si falla, se deja la lista como estaba
    }
    if (pedido !== pidiendo) return;
    pintarAcceso(reservas);
    // Si el foco está dentro (por ejemplo en "Sí, cancelar"), se devuelve al panel tras repintar.
    const habiaFoco = lista.contains(document.activeElement);
    lista.replaceChildren(...contenido(reservas));
    if (habiaFoco) $('h3, summary, button', lista)?.focus?.({ preventScroll: true });
    programarConfirmacion(reservas);
  }

  function pintarAcceso(reservas) {
    const activas = reservas.filter((r) => !esInactiva(r)).length;
    const hay = reservas.length > 0;
    if (botonCabecera) {
      botonCabecera.hidden = !hay;
      botonCabecera.setAttribute('aria-label', activas ? `Mis reservas (${activas} activas)` : 'Mis reservas');
    }
    if (numero) numero.textContent = activas ? String(activas) : '';
    if (enlaceMenu) {
      enlaceMenu.hidden = !hay;
      $('[data-enlace-mis-reservas-num]', enlaceMenu).textContent = activas ? `(${activas})` : '';
    }
    // En móvil el botón de la cabecera no cabe: el menú lleva un punto y el enlace.
    if (avisoMenu) avisoMenu.hidden = !activas;
  }

  // La confirmación simulada ocurre al leer: se vuelve a leer cuando le toque a la próxima pendiente.
  let espera = null;
  function programarConfirmacion(reservas) {
    clearTimeout(espera);
    const proximas = reservas.filter((r) => r.estado === 'pendiente' && r.confirmarEn).map((r) => r.confirmarEn);
    if (!proximas.length) return;
    espera = setTimeout(refrescar, Math.max(0, Math.min(...proximas) - Date.now()) + 300);
  }

  // ---------- Pintado ----------
  function contenido(reservas) {
    if (!reservas.length) {
      return [h('div', { class: 'text-center py-10' },
        h('p', { class: 'display text-[1.5rem]' }, 'Aún no tienes reservas'),
        h('p', { class: 'mt-2 text-carbon-suave' }, 'Cuando reserves desde este navegador, aparecerán aquí con todos sus datos.'),
        h('button', { type: 'button', class: 'btn btn-primario mt-6', onclick: () => irAReservar() }, 'Reservar mesa'))];
    }
    const activas = reservas.filter((r) => !esInactiva(r));
    const pasadas = reservas.filter(esInactiva);
    const partes = [];
    if (activas.length) {
      partes.push(h('p', { class: 'mb-4 text-[0.8rem] font-extrabold uppercase tracking-[0.1em] text-aji' },
        activas.length === 1 ? 'Reserva activa' : `Reservas activas (${activas.length}) · la más reciente primero`));
      partes.push(...activas.map(boleto));
    } else {
      partes.push(h('p', { class: 'mb-6 text-carbon-suave' }, 'No tienes reservas activas.',
        ' ', h('button', { type: 'button', class: 'underline font-bold text-carbon', onclick: () => irAReservar() }, 'Reservar mesa')));
    }
    if (pasadas.length) {
      partes.push(h('p', { class: 'mt-8 text-[0.8rem] font-extrabold uppercase tracking-[0.1em] text-carbon-suave' },
        'Anteriores y canceladas'),
      h('p', { class: 'mt-1 mb-4 text-[0.88rem] text-carbon-suave' },
        `Se quitan solas de esta lista ${RESERVAS.diasHistorialCliente} días después de su fecha.`));
      partes.push(...pasadas.map(boletoPasado));
    }
    return partes;
  }

  function chip(r) {
    return h('span', { class: `chip-estado chip-${r.estado}` }, textoEstado(r));
  }

  /** Ficha completa: todos los datos que se registraron con la reserva (la misma del comprobante). */
  function ficha(r) {
    return h('dl', { class: 'boleto-datos' },
      ...datosComprobante(r).map(({ titulo, valor, ancho, vacio }) =>
        h('div', { class: ancho ? 'ancho' : '' },
          h('dt', {}, titulo),
          h('dd', { class: vacio ? 'font-normal text-carbon-suave' : '' }, valor))));
  }

  function boleto(r) {
    const titulo = `boleto-${r.codigo}`;
    const acciones = h('div', { class: 'mt-4 flex flex-wrap gap-2' });
    if (r.modificable) {
      acciones.append(
        h('button', { type: 'button', class: 'btn btn-secundario btn-chico', onclick: () => cambiar(r) }, 'Cambiar'),
        h('button', { type: 'button', class: 'btn btn-linea btn-chico', onclick: () => confirmar(r, acciones) }, 'Cancelar'),
      );
    }
    const comprobante = accionesComprobante(r);
    acciones.append(...comprobante.botones);

    const plazo = r.modificable
      ? h('p', { class: 'boleto-plazo' },
        h('strong', {}, 'Cambios y cancelación: '), `hasta el ${limiteDeCambios(r)}.`)
      : h('p', { class: 'boleto-plazo vencido' },
        h('strong', {}, 'Plazo de cambios vencido '), `(era hasta el ${limiteDeCambios(r)}). `,
        'Para cambiarla, llámanos al ', h('a', { href: RESTAURANTE.telefonoHref, class: 'underline font-bold' }, RESTAURANTE.telefono), ' (demo).');

    const pendiente = r.estado === 'pendiente'
      ? h('p', { class: 'mt-3 text-[0.9rem] text-carbon-suave' }, servicio.esDemo
        ? 'El restaurante la está revisando. En esta demo se confirma sola en unos segundos.'
        : 'El restaurante la está revisando; aquí verás cuando la confirme.')
      : null;

    return h('article', { class: 'boleto', 'aria-labelledby': titulo },
      h('div', { class: 'boleto-cabeza' },
        h('div', { class: 'flex flex-wrap items-center justify-between gap-x-4 gap-y-2' },
          h('p', { class: 'display text-[1.35rem] text-aji tabular-nums tracking-[0.02em]' }, r.codigo),
          chip(r)),
        h('h3', { id: titulo, class: 'mt-2 text-[1.2rem] font-extrabold', tabindex: '-1' }, formatoLargo(r.fecha)),
        h('p', { class: 'mt-0.5 text-carbon-suave font-semibold tabular-nums' }, horario(r)),
        pendiente),
      h('div', { class: 'boleto-perforado', 'aria-hidden': 'true' }),
      h('div', { class: 'boleto-cuerpo' },
        ficha(r),
        plazo,
        h('p', { class: 'mt-3 text-[0.88rem] text-carbon-suave' },
          `Te guardamos la mesa ${RESERVAS.toleranciaMinutos} minutos después de la hora de llegada.`),
        acciones,
        comprobante.opciones),
    );
  }

  function boletoPasado(r) {
    return h('details', { class: 'boleto boleto-pasado' },
      h('summary', {},
        h('span', {},
          h('span', { class: 'display text-[1.1rem] text-carbon-suave tabular-nums' }, r.codigo),
          h('span', { class: `block text-[0.92rem] ${r.estado === 'cancelada' ? 'line-through' : ''} text-carbon-suave` },
            `${formatoLargo(r.fecha)} · ${r.hora} · ${plural(r.personas, 'persona', 'personas')}`)),
        chip(r)),
      h('div', { class: 'boleto-cuerpo' }, ficha(r), quitar(r)),
    );
  }

  /** "Quitar de mi lista" con confirmación en el mismo lugar. */
  function quitar(r) {
    const caja = h('div', { class: 'mt-4 flex flex-wrap items-center gap-2' });
    const inicial = () => caja.replaceChildren(
      h('button', { type: 'button', class: 'btn btn-linea btn-chico', onclick: preguntar }, 'Quitar de mi lista'),
      h('p', { class: 'text-[0.85rem] text-carbon-suave' }, 'Solo se quita de este navegador.'));
    function preguntar() {
      caja.replaceChildren(
        h('p', { class: 'w-full font-semibold' }, `¿Quitar ${r.codigo} de tu lista?`),
        h('button', {
          type: 'button', class: 'btn btn-primario btn-chico',
          onclick: async (e) => {
            e.currentTarget.disabled = true;
            try {
              await servicio.olvidarReserva(r.codigo, r.estado);
              refrescar();
            } catch (error) {
              caja.prepend(h('p', { class: 'w-full font-semibold error-msg', role: 'alert' }, error.message));
            }
          },
        }, 'Sí, quitar'),
        h('button', { type: 'button', class: 'btn btn-linea btn-chico', onclick: inicial }, 'No'));
      caja.querySelector('button').focus();
    }
    inicial();
    return caja;
  }

  // ---------- Acciones ----------
  function cambiar(r) {
    cerrar(() => reserva.editar(r, r.contacto));
  }

  function irAReservar() {
    cerrar(() => document.getElementById('reservas').scrollIntoView({ block: 'start' }));
  }

  function confirmar(r, acciones) {
    acciones.replaceChildren(
      h('p', { class: 'w-full font-semibold' }, `¿Cancelar la reserva ${r.codigo}? La mesa quedará libre para otra persona.`),
      h('button', {
        type: 'button', class: 'btn btn-primario btn-chico',
        onclick: async (e) => {
          e.currentTarget.disabled = true;
          e.currentTarget.textContent = 'Cancelando…';
          try {
            await servicio.cancelarReserva(r.codigo, r.contacto);
          } catch (error) {
            acciones.prepend(h('p', { class: 'w-full font-semibold error-msg', role: 'alert' }, error.message));
          }
        },
      }, 'Sí, cancelar'),
      h('button', { type: 'button', class: 'btn btn-linea btn-chico', onclick: () => refrescar() }, 'No, mantenerla'),
    );
    acciones.querySelector('button').focus();
  }

  servicio.escuchar(({ motivo }) => {
    if (motivo !== 'retenciones') refrescar();
  });
  refrescar();
  return { refrescar, abrir };
}
