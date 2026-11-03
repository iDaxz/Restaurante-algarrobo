// Buscar, modificar y cancelar una reserva con su código y contacto.

import { RESERVAS } from '../config/restaurante.js';
import { formatoLargo } from '../core/fechas.js';
import { $, h, plural } from './dom.js';
import { TEXTO_ESTADO_RESERVA } from './reserva.js';

export function iniciarGestion(servicio, reserva) {
  const form = $('[data-form-buscar]');
  const salida = $('[data-gestion]');
  const boton = $('[data-buscar-enviar]', form);

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const codigo = form.elements.codigo.value.trim();
    const contacto = form.elements.contacto.value.trim();
    if (!codigo || !contacto) {
      salida.replaceChildren(aviso('Escribe el código y el correo o teléfono con el que reservaste.'));
      (codigo ? form.elements.contacto : form.elements.codigo).focus();
      return;
    }
    await buscar(codigo, contacto);
  });

  async function buscar(codigo, contacto) {
    boton.disabled = true;
    salida.replaceChildren(h('p', { class: 'font-semibold text-carbon-suave cargando' }, 'Buscando tu reserva'));
    try {
      const encontrada = await servicio.buscarReserva(codigo, contacto);
      pintar(encontrada, contacto);
    } catch (error) {
      salida.replaceChildren(aviso(error.message));
    } finally {
      boton.disabled = false;
    }
  }

  function pintar(r, contacto) {
    const activa = ['pendiente', 'confirmada'].includes(r.estado);
    const acciones = h('div', { class: 'mt-5 flex flex-wrap gap-3' });
    if (activa && r.modificable) {
      acciones.append(
        h('button', { type: 'button', class: 'btn btn-secundario', onclick: () => reserva.editar(r, contacto) }, 'Cambiar día, hora o personas'),
        h('button', { type: 'button', class: 'btn btn-linea !min-h-[3.25rem]', onclick: () => confirmarCancelacion(r, contacto, acciones) }, 'Cancelar la reserva'),
      );
    } else if (activa) {
      acciones.append(h('p', { class: 'text-carbon-suave' }, `Faltan menos de ${RESERVAS.horasParaCambios} horas para tu llegada: ya no se puede cambiar en línea. Llámanos al +51 900 000 000 (demo).`));
    }
    salida.replaceChildren(
      h('div', { class: 'ticket px-5 py-5 sm:px-6' },
        h('div', { class: 'flex flex-wrap items-baseline justify-between gap-3' },
          h('p', { class: 'display text-[1.6rem] text-aji tabular-nums' }, r.codigo),
          h('p', { class: `font-bold ${r.estado === 'cancelada' ? 'text-carbon-suave' : 'text-hierbas'}` }, TEXTO_ESTADO_RESERVA[r.estado])),
        h('p', { class: `mt-2 text-[1.05rem] ${r.estado === 'cancelada' ? 'line-through text-carbon-suave' : ''}` },
          `${formatoLargo(r.fecha)} · ${r.hora} · ${plural(r.personas, 'persona', 'personas')} · a nombre de ${r.nombre}`),
        acciones,
      ),
    );
  }

  function confirmarCancelacion(r, contacto, acciones) {
    acciones.replaceChildren(
      h('p', { class: 'w-full font-semibold' }, `¿Seguro que quieres cancelar la reserva ${r.codigo}? La mesa quedará libre para otra persona.`),
      h('button', {
        type: 'button', class: 'btn btn-primario',
        onclick: async (e) => {
          e.currentTarget.disabled = true;
          e.currentTarget.textContent = 'Cancelando…';
          try {
            const cancelada = await servicio.cancelarReserva(r.codigo, contacto);
            pintar({ ...cancelada, modificable: false }, contacto);
          } catch (error) {
            salida.prepend(aviso(error.message));
          }
        },
      }, 'Sí, cancelar'),
      h('button', { type: 'button', class: 'btn btn-linea !min-h-[3.25rem]', onclick: () => pintar(r, contacto) }, 'No, mantenerla'),
    );
    acciones.querySelector('button').focus();
  }

  const aviso = (texto) => h('p', { class: 'font-semibold error-msg', role: 'alert' }, texto);

  return {
    abrir(codigo, contacto) {
      form.elements.codigo.value = codigo;
      form.elements.contacto.value = contacto;
      document.getElementById('gestionar').scrollIntoView({ block: 'start' });
      buscar(codigo, contacto);
    },
  };
}
