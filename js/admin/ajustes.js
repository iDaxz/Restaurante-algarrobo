// Ajustes del panel (solo administradores): horarios y reglas, mesas, días especiales, carta y cuentas.
// Cada sección explica en una frase qué efecto tiene. Si el servidor responde CONFLICTO_RESERVAS
// (el cambio dejaría reservas futuras sin horario o sin mesa), se muestra la lista y no se guarda nada.

import { $, $$, h, soles } from '../ui/dom.js';
import { api } from './api.js';

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const ETIQUETAS = { 'mas-vendido': 'Más vendido', nuevo: 'Nuevo', recomendado: 'Recomendado' };
const fmtMomento = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' });
const fmtFecha = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const fechaLarga = (f) => fmtFecha.format(new Date(`${f}T12:00:00Z`));

/**
 * @param {{ avisar: Function, abrirDialogo: Function, cerrarDialogo: Function, usuario: () => object, hoy: () => string }} entorno
 */
export function iniciarAjustes({ avisar, abrirDialogo, cerrarDialogo, usuario, hoy }) {
  let seccion = 'horarios';
  let datos = null;
  let errorDeCarga = null;
  const errorGeneral = $('[data-ajustes-error]');

  $$('[data-ajuste-boton]').forEach((b) => b.addEventListener('click', () => elegir(b.dataset.ajusteBoton)));

  function elegir(nombre) {
    seccion = nombre;
    $$('[data-ajuste-boton]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ajusteBoton === nombre)));
    $$('[data-ajuste]').forEach((d) => { d.hidden = d.dataset.ajuste !== nombre; });
    limpiarError();
    // El historial se relee siempre: puede haber cambios hechos en otras secciones (carta, cuentas…).
    if (nombre === 'cambios') cargar();
    else pintar();
  }

  function mostrarError(error) {
    errorGeneral.replaceChildren(
      h('strong', {}, error.codigo === 'CONFLICTO_RESERVAS' ? 'No se guardó. ' : 'No se pudo guardar. '), error.message);
    errorGeneral.hidden = false;
    errorGeneral.scrollIntoView({ block: 'nearest' });
  }
  function limpiarError() {
    errorGeneral.hidden = true;
  }

  /** Ejecuta un guardado: deshabilita el botón, muestra errores por campo o generales y repinta. */
  async function guardar(boton, accion, { exito, formulario } = {}) {
    limpiarError();
    if (formulario) $$('[data-error]', formulario).forEach((p) => { p.textContent = ''; });
    const texto = boton?.textContent;
    if (boton) {
      boton.disabled = true;
      boton.textContent = 'Guardando…';
    }
    try {
      const resultado = await accion();
      if (resultado?.politicas) datos = resultado;
      if (exito) avisar(exito);
      return resultado ?? true;
    } catch (e) {
      let ubicado = false;
      if (formulario) {
        for (const [campo, mensaje] of Object.entries(e.errores ?? {})) {
          const destino = $(`[data-error="${CSS.escape(campo)}"]`, formulario);
          if (destino) {
            destino.textContent = mensaje;
            ubicado = true;
          }
        }
      }
      if (!ubicado || e.codigo === 'CONFLICTO_RESERVAS') mostrarError(e);
      return null;
    } finally {
      if (boton) {
        boton.disabled = false;
        boton.textContent = texto;
      }
    }
  }

  async function cargar() {
    errorDeCarga = null;
    try {
      datos = await api.ajustes();
    } catch (e) {
      datos = null;
      errorDeCarga = e;
    }
    pintar();
  }

  /** Si los ajustes no cargan, cada sección lo dice y ofrece reintentar (en vez de quedar en blanco). */
  function pintarFalloDeCarga() {
    const e = errorDeCarga;
    const servidorAntiguo = e?.codigo === 'NO_EXISTE';
    $(`[data-ajuste="${seccion}"]`).replaceChildren(h('div', { class: 'conflicto' },
      h('p', {}, h('strong', {}, 'No se pudieron cargar los ajustes. '),
        servidorAntiguo
          ? 'El servidor no tiene esta función: probablemente sigue funcionando una versión anterior. Reinícialo y vuelve a intentarlo.'
          : (e?.message ?? 'Vuelve a intentarlo en un momento.')),
      h('button', { type: 'button', class: 'btn btn-linea btn-chico mt-3', onclick: (ev) => { ev.currentTarget.disabled = true; cargar(); } }, 'Reintentar')));
  }

  function pintar() {
    if (!datos) {
      if (errorDeCarga) pintarFalloDeCarga();
      else $(`[data-ajuste="${seccion}"]`).replaceChildren(h('p', { class: 'text-carbon-suave' }, 'Cargando…'));
      return;
    }
    ({ horarios: pintarHorarios, mesas: pintarMesas, dias: pintarDias, carta: pintarCarta, cuentas: pintarCuentas, cambios: pintarCambios })[seccion]();
  }

  // ---------- Pequeñas piezas de formulario ----------

  const campoNumero = (nombre, etiqueta, valor, ayuda, { min, max, paso = 1, sufijo = '' } = {}) => h('div', { class: 'campo-ajuste' },
    h('label', { for: `aj-${nombre}`, class: 'block font-bold' }, etiqueta),
    h('p', { class: 'ayuda-ajuste' }, ayuda),
    h('div', { class: 'flex items-center gap-2 mt-1.5' },
      h('input', { id: `aj-${nombre}`, name: nombre, type: 'number', class: 'campo !w-28 !py-2', min, max, step: paso, value: valor, required: true }),
      sufijo ? h('span', { class: 'text-carbon-suave font-semibold' }, sufijo) : null),
    h('p', { class: 'mt-1 text-[0.88rem] font-semibold error-msg', 'data-error': nombre }));

  const tarjeta = (titulo, ayuda, ...contenido) => h('section', { class: 'tarjeta-ajuste' },
    h('h2', { class: 'text-[1.2rem] font-extrabold' }, titulo),
    ayuda ? h('p', { class: 'mt-1 text-carbon-suave' }, ayuda) : null,
    ...contenido);

  // ---------- Horarios y reglas ----------

  function pintarHorarios() {
    const p = datos.politicas;
    const formTurnos = h('form', { class: 'mt-4 grid gap-3', novalidate: true },
      ...datos.turnos.map((t) => h('fieldset', { class: 'fila-turno' },
        h('legend', { class: 'sr-only' }, t.nombre),
        h('div', {}, h('label', { for: `t-${t.id}-nombre`, class: 'block text-[0.85rem] font-bold' }, 'Nombre'),
          h('input', { id: `t-${t.id}-nombre`, class: 'campo !py-2', 'data-turno': t.id, 'data-campo': 'nombre', value: t.nombre, maxlength: '30' })),
        h('div', {}, h('label', { for: `t-${t.id}-inicio`, class: 'block text-[0.85rem] font-bold' }, 'Abre'),
          h('input', { id: `t-${t.id}-inicio`, type: 'time', class: 'campo !py-2', 'data-turno': t.id, 'data-campo': 'inicio', value: t.inicio })),
        h('div', {}, h('label', { for: `t-${t.id}-fin`, class: 'block text-[0.85rem] font-bold' }, 'Cierra'),
          h('input', { id: `t-${t.id}-fin`, type: 'time', class: 'campo !py-2', 'data-turno': t.id, 'data-campo': 'fin', value: t.fin })),
        h('p', { class: 'col-span-full text-[0.88rem] font-semibold error-msg', 'data-error': `${t.id}.horas` }),
        h('p', { class: 'col-span-full text-[0.88rem] font-semibold error-msg', 'data-error': `${t.id}.nombre` }))),
      h('div', {}, h('button', { type: 'submit', class: 'btn btn-primario btn-chico' }, 'Guardar turnos')));
    formTurnos.addEventListener('submit', async (e) => {
      e.preventDefault();
      const turnos = datos.turnos.map((t) => ({
        id: t.id,
        nombre: $(`[data-turno="${t.id}"][data-campo="nombre"]`, formTurnos).value,
        inicio: $(`[data-turno="${t.id}"][data-campo="inicio"]`, formTurnos).value,
        fin: $(`[data-turno="${t.id}"][data-campo="fin"]`, formTurnos).value,
      }));
      if (await guardar(e.submitter, () => api.guardarTurnos(turnos), { exito: 'Cambios guardados. La web ya muestra los nuevos horarios.', formulario: formTurnos })) pintar();
    });

    const formReglas = h('form', { class: 'mt-4 grid gap-5', novalidate: true },
      h('fieldset', {},
        h('legend', { class: 'font-bold' }, 'Días de descanso'),
        h('p', { class: 'ayuda-ajuste' }, 'Esos días la web no ofrece horarios.'),
        h('div', { class: 'mt-2 flex flex-wrap gap-2' }, ...DIAS.map((dia, i) => h('label', { class: 'casilla-dia' },
          h('input', { type: 'checkbox', name: 'diasCerrados', value: String(i), checked: p.diasCerrados.includes(i) }), h('span', {}, dia)))),
        h('p', { class: 'mt-1 text-[0.88rem] font-semibold error-msg', 'data-error': 'diasCerrados' })),
      h('div', { class: 'grid gap-5 md:grid-cols-2' },
        campoNumero('duracionMinutos', 'Tiempo de mesa', p.duracionMinutos, 'Cuánto dura una reserva. Se aplica a las reservas nuevas.', { min: 30, max: 300, paso: 15, sufijo: 'minutos' }),
        h('div', { class: 'campo-ajuste' },
          h('label', { for: 'aj-intervaloMinutos', class: 'block font-bold' }, 'Horarios cada'),
          h('p', { class: 'ayuda-ajuste' }, 'Cada cuánto se ofrece una hora de llegada.'),
          h('select', { id: 'aj-intervaloMinutos', name: 'intervaloMinutos', class: 'campo !w-36 !py-2 mt-1.5' },
            ...[15, 30, 60].map((m) => h('option', { value: String(m), selected: m === p.intervaloMinutos }, `${m} minutos`))),
          h('p', { class: 'mt-1 text-[0.88rem] font-semibold error-msg', 'data-error': 'intervaloMinutos' })),
        campoNumero('ventanaDias', 'Reservar con anticipación', p.ventanaDias, 'Hasta cuántos días antes se puede reservar.', { min: 1, max: 365, sufijo: 'días' }),
        campoNumero('maxPersonasEnLinea', 'Personas por reserva en la web', p.maxPersonasEnLinea, 'Grupos más grandes deben llamar (el personal los registra en "Nueva reserva").', { min: 1, max: 20, sufijo: 'personas' }),
        campoNumero('horasParaCambios', 'Plazo para cambiar o cancelar', p.horasParaCambios, 'El cliente puede cambiar o cancelar hasta estas horas antes de llegar.', { min: 0, max: 72, sufijo: 'horas' }),
        campoNumero('toleranciaMinutos', 'Tolerancia de llegada', p.toleranciaMinutos, 'Cuánto se guarda la mesa después de la hora reservada.', { min: 0, max: 60, sufijo: 'minutos' }),
        campoNumero('maxReservasActivasPorContacto', 'Reservas activas por cliente', p.maxReservasActivasPorContacto, 'Máximo de reservas a futuro con el mismo teléfono o correo.', { min: 1, max: 20, sufijo: 'reservas' }),
        campoNumero('retencionMinutos', 'Mesa apartada mientras reserva', p.retencionMinutos, 'Minutos que se guarda la mesa mientras el cliente llena sus datos.', { min: 1, max: 30, sufijo: 'minutos' }),
        campoNumero('holguraAsientos', 'Asientos libres permitidos', p.holguraAsientos, 'Cuántos asientos pueden sobrar al asignar una mesa (por ejemplo, 2 personas en una mesa de 4).', { min: 0, max: 10, sufijo: 'asientos' })),
      h('div', {}, h('button', { type: 'submit', class: 'btn btn-primario btn-chico' }, 'Guardar reglas')));
    formReglas.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(formReglas);
      const numero = (n) => (f.get(n) === '' ? null : Number(f.get(n)));
      const politicas = {
        duracionMinutos: numero('duracionMinutos'), intervaloMinutos: numero('intervaloMinutos'), ventanaDias: numero('ventanaDias'),
        maxPersonasEnLinea: numero('maxPersonasEnLinea'), holguraAsientos: numero('holguraAsientos'), horasParaCambios: numero('horasParaCambios'),
        toleranciaMinutos: numero('toleranciaMinutos'), maxReservasActivasPorContacto: numero('maxReservasActivasPorContacto'),
        retencionMinutos: numero('retencionMinutos'), diasCerrados: f.getAll('diasCerrados').map(Number),
      };
      if (await guardar(e.submitter, () => api.guardarPoliticas(politicas), { exito: 'Cambios guardados. Las nuevas reglas ya se aplican a las reservas.', formulario: formReglas })) pintar();
    });

    $('[data-ajuste="horarios"]').replaceChildren(
      tarjeta('Turnos', 'Horario de cada turno. La última llegada es un tiempo de mesa antes del cierre.', formTurnos),
      tarjeta('Reglas de reserva', null, formReglas));
  }

  // ---------- Mesas ----------

  function pintarMesas() {
    const filas = datos.mesas.map((m) => {
      const form = h('form', { class: `fila-mesa${m.activa ? '' : ' inactiva'}`, novalidate: true },
        h('p', { class: 'fila-mesa-id' }, m.id),
        h('div', {}, h('label', { class: 'sr-only', for: `m-${m.id}-asientos` }, `Asientos de ${m.id}`),
          h('input', { id: `m-${m.id}-asientos`, name: 'asientos', type: 'number', min: '1', max: '20', class: 'campo !py-2', value: m.asientos })),
        h('div', {}, h('label', { class: 'sr-only', for: `m-${m.id}-nombre` }, `Nombre de ${m.id}`),
          h('input', { id: `m-${m.id}-nombre`, name: 'nombre', class: 'campo !py-2', placeholder: 'Sin nombre', maxlength: '30', value: m.nombre ?? '' })),
        h('label', { class: 'interruptor' }, h('input', { type: 'checkbox', name: 'activa', checked: m.activa }), h('span', {}, 'Activa')),
        h('button', { type: 'submit', class: 'btn btn-primario btn-mini', hidden: true }, 'Guardar'));
      // Solo la fila que se modificó muestra su botón "Guardar".
      const original = () => String(form.asientos.value) === String(m.asientos) && form.nombre.value === (m.nombre ?? '') && form.activa.checked === m.activa;
      form.addEventListener('input', () => { $('button', form).hidden = original(); });
      form.addEventListener('change', () => { $('button', form).hidden = original(); });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const cambios = { asientos: Number(form.asientos.value), nombre: form.nombre.value, activa: form.activa.checked };
        if (await guardar(e.submitter, () => api.editarMesa(m.id, cambios), { exito: `Mesa ${m.id} guardada.` })) pintar();
      });
      return h('li', {}, form);
    });
    const nueva = h('form', { class: 'mt-4 flex flex-wrap items-end gap-3', novalidate: true },
      h('div', {}, h('label', { for: 'nueva-mesa-asientos', class: 'block font-bold mb-1' }, 'Asientos'),
        h('input', { id: 'nueva-mesa-asientos', name: 'asientos', type: 'number', min: '1', max: '20', value: '4', class: 'campo !w-24 !py-2' })),
      h('div', {}, h('label', { for: 'nueva-mesa-nombre', class: 'block font-bold mb-1' }, 'Nombre ', h('span', { class: 'font-normal text-carbon-suave' }, '(opcional)')),
        h('input', { id: 'nueva-mesa-nombre', name: 'nombre', maxlength: '30', class: 'campo !py-2', placeholder: 'Terraza' })),
      h('button', { type: 'submit', class: 'btn btn-primario btn-chico' }, 'Agregar mesa'));
    nueva.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (await guardar(e.submitter, () => api.crearMesa({ asientos: Number(nueva.asientos.value), nombre: nueva.nombre.value }), { exito: 'Mesa agregada.' })) pintar();
    });
    const activas = datos.mesas.filter((m) => m.activa);
    $('[data-ajuste="mesas"]').replaceChildren(
      tarjeta('Mesas del comedor',
        `${activas.length} activas · ${activas.reduce((n, m) => n + m.asientos, 0)} asientos. Cambia lo que necesites y pulsa "Guardar" en esa fila. Desactiva una mesa (por ejemplo, si está rota) para que la web deje de ofrecerla; no se borra para no perder su historial.`,
        h('div', { class: 'fila-mesa encabezado', 'aria-hidden': 'true' }, h('span', {}, 'Mesa'), h('span', {}, 'Asientos'), h('span', {}, 'Nombre'), h('span', {}, 'Estado'), h('span', {})),
        h('ul', { class: 'lista-mesas' }, ...filas)),
      tarjeta('Agregar una mesa', 'Recibe el siguiente número libre (M15, M16…).', nueva));
  }

  // ---------- Días especiales ----------

  function pintarDias() {
    const form = h('form', { class: 'mt-4 grid gap-3 sm:grid-cols-[12rem_1fr_auto] items-start', novalidate: true },
      h('div', {}, h('label', { for: 'dia-fecha-especial', class: 'block font-bold mb-1' }, 'Fecha'),
        h('input', { id: 'dia-fecha-especial', name: 'fecha', type: 'date', min: hoy(), class: 'campo !py-2' }),
        h('p', { class: 'mt-1 text-[0.88rem] font-semibold error-msg', 'data-error': 'fecha' })),
      h('div', {}, h('label', { for: 'dia-motivo', class: 'block font-bold mb-1' }, 'Motivo ', h('span', { class: 'font-normal text-carbon-suave' }, '(lo verá el cliente si se cancela su reserva)')),
        h('input', { id: 'dia-motivo', name: 'motivo', maxlength: '120', class: 'campo !py-2', placeholder: 'Evento privado' }),
        h('p', { class: 'mt-1 text-[0.88rem] font-semibold error-msg', 'data-error': 'motivo' })),
      h('button', { type: 'submit', class: 'btn btn-primario btn-chico sm:mt-7' }, 'Cerrar ese día'),
      h('div', { class: 'sm:col-span-3', 'data-confirmar-cierre': true }));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await cerrar(e.submitter, false);
    });
    async function cerrar(boton, cancelarReservas) {
      const pedido = { fecha: form.fecha.value, motivo: form.motivo.value, cancelarReservas };
      const caja = $('[data-confirmar-cierre]', form);
      caja.replaceChildren();
      $$('[data-error]', form).forEach((p) => { p.textContent = ''; });
      limpiarError();
      try {
        boton.disabled = true;
        datos = await api.cerrarDia(pedido);
        avisar(cancelarReservas ? 'Día cerrado. Se cancelaron sus reservas y se avisó a los clientes (aviso simulado).' : 'Día cerrado.');
        pintar();
      } catch (err) {
        if (err.codigo === 'CONFLICTO_RESERVAS') {
          // Hay reservas ese día: se piden explícitamente antes de cancelarlas.
          caja.replaceChildren(h('div', { class: 'conflicto' },
            h('p', {}, err.message.replace(' Cámbialas o cancélalas primero.', '')),
            h('p', { class: 'mt-2' }, 'Si cierras el día, esas reservas se cancelan y cada cliente recibe un aviso con el motivo.'),
            h('div', { class: 'mt-3 flex flex-wrap gap-2' },
              h('button', { type: 'button', class: 'btn btn-primario btn-chico', onclick: (ev) => cerrar(ev.currentTarget, true) }, 'Cerrar y cancelar esas reservas'),
              h('button', { type: 'button', class: 'btn btn-linea btn-chico', onclick: () => caja.replaceChildren() }, 'No, dejarlo abierto'))));
        } else {
          for (const [campo, mensaje] of Object.entries(err.errores ?? {})) {
            const destino = $(`[data-error="${campo}"]`, form);
            if (destino) destino.textContent = mensaje;
          }
          if (!Object.keys(err.errores ?? {}).length) mostrarError(err);
        }
      } finally {
        boton.disabled = false;
      }
    }
    const lista = datos.diasEspeciales.length
      ? h('ul', { class: 'mt-4 grid gap-2' }, ...datos.diasEspeciales.map((d) => h('li', { class: 'fila-dia' },
        h('div', {}, h('p', { class: 'font-extrabold first-letter:uppercase' }, fechaLarga(d.fecha)), h('p', { class: 'text-carbon-suave' }, d.motivo)),
        h('button', {
          type: 'button', class: 'btn btn-linea btn-mini',
          onclick: async (e) => {
            if (await guardar(e.currentTarget, async () => (datos = await api.abrirDia(d.fecha)), { exito: 'El día vuelve a estar abierto.' })) pintar();
          },
        }, 'Volver a abrir'))))
      : h('p', { class: 'mt-3 text-carbon-suave' }, 'No hay días especiales cerrados.');
    $('[data-ajuste="dias"]').replaceChildren(
      tarjeta('Cerrar un día', 'Para un evento privado, un feriado o una reparación. La web deja de ofrecer ese día.', form),
      tarjeta('Próximos días cerrados', null, lista));
  }

  // ---------- Carta ----------

  let carta = null;
  let galeria = null;

  async function pintarCarta() {
    const caja = $('[data-ajuste="carta"]');
    if (!carta) caja.replaceChildren(h('p', { class: 'text-carbon-suave' }, 'Cargando la carta…'));
    try {
      [carta, galeria] = await Promise.all([api.carta(), api.fotos()]);
    } catch (e) {
      errorDeCarga = e;
      pintarFalloDeCarga();
      return;
    }
    const porCategoria = carta.categorias.map((c) => {
      const platos = carta.platos.filter((p) => p.categoria === c.id);
      return h('section', { class: 'mt-5 first:mt-0' },
        h('h3', { class: 'categoria-carta' }, c.nombre, h('span', {}, ` · ${platos.length}`)),
        h('ul', { class: 'lista-platos' }, ...platos.map((p) => h('li', { class: `fila-plato-admin${p.disponible ? '' : ' agotado'}` },
          h('img', { src: p.foto, alt: '', loading: 'lazy', width: '64', height: '48' }),
          h('div', { class: 'min-w-0' },
            h('p', { class: 'font-extrabold' }, p.nombre, p.etiqueta ? h('span', { class: 'etiqueta-mini' }, ETIQUETAS[p.etiqueta]) : null),
            h('p', { class: 'text-[0.88rem] text-carbon-suave truncate' }, p.descripcion)),
          h('p', { class: 'precio-admin' }, soles(Number(p.precio))),
          h('label', { class: 'interruptor' },
            h('input', {
              type: 'checkbox', checked: p.disponible,
              onchange: async (e) => {
                const casilla = e.currentTarget;
                const ok = await guardar(null, () => api.platoDisponible(p.id, casilla.checked),
                  { exito: casilla.checked ? `«${p.nombre}» vuelve a la carta.` : `«${p.nombre}» aparece como agotado.` });
                if (!ok) casilla.checked = !casilla.checked;
                else pintarCarta();
              },
            }), h('span', {}, 'Disponible')),
          h('div', { class: 'flex gap-1.5' },
            h('button', { type: 'button', class: 'btn btn-linea btn-mini', onclick: () => editarPlato(p) }, 'Editar'),
            h('button', { type: 'button', class: 'btn btn-texto btn-mini', onclick: (e) => confirmarBorrado(e.currentTarget, p) }, 'Borrar'))))));
    });
    caja.replaceChildren(tarjeta('Carta',
      'Los platos agotados siguen visibles en la web con la etiqueta "Agotado". Edita precios, fotos y textos con "Editar".',
      h('div', { class: 'mt-4' }, h('button', { type: 'button', class: 'btn btn-primario btn-chico', onclick: () => editarPlato(null) }, 'Nuevo plato')),
      h('div', { class: 'mt-5' }, ...porCategoria)));
  }

  function confirmarBorrado(boton, p) {
    const acciones = boton.parentElement;
    const original = [...acciones.childNodes];
    acciones.replaceChildren(
      h('span', { class: 'text-[0.88rem] font-semibold' }, '¿Borrar?'),
      h('button', {
        type: 'button', class: 'btn btn-primario btn-mini',
        onclick: async (e) => { if (await guardar(e.currentTarget, () => api.borrarPlato(p.id), { exito: `«${p.nombre}» se borró de la carta.` })) pintarCarta(); },
      }, 'Sí'),
      h('button', { type: 'button', class: 'btn btn-linea btn-mini', onclick: () => acciones.replaceChildren(...original) }, 'No'));
  }

  // Editor de plato (diálogo) con galería y subida de fotos
  const dialogoPlato = $('[data-plato-editor]');
  const formPlato = $('[data-form-plato]');
  let platoEditado = null;
  let fotoElegida = null;

  function editarPlato(p) {
    platoEditado = p;
    formPlato.reset();
    $$('[data-error]', formPlato).forEach((x) => { x.textContent = ''; });
    $('[data-error-plato]').textContent = '';
    $('[data-estado-subida]').textContent = '';
    $('[data-plato-titulo]').textContent = p ? `Editar: ${p.nombre}` : 'Nuevo plato';
    $('[data-plato-categorias]').replaceChildren(...carta.categorias.map((c) => h('option', { value: c.id }, c.nombre)));
    if (p) {
      formPlato.nombre.value = p.nombre;
      formPlato.precio.value = Number(p.precio).toFixed(2);
      formPlato.categoria.value = p.categoria;
      formPlato.etiqueta.value = p.etiqueta ?? '';
      formPlato.origen.value = p.origen ?? '';
      formPlato.descripcion.value = p.descripcion ?? '';
      formPlato.historia.value = p.historia ?? '';
      formPlato.disponible.checked = p.disponible;
    }
    fotoElegida = p?.foto ?? null;
    pintarGaleria();
    abrirDialogo(dialogoPlato);
    formPlato.nombre.focus();
  }

  function pintarGaleria() {
    const opcion = (url, texto, ...extra) => h('li', { class: 'foto-item' }, h('label', { class: 'foto-opcion' },
      h('input', { type: 'radio', name: 'foto', value: url, checked: url === fotoElegida, onchange: () => { fotoElegida = url; } }),
      h('img', { src: url, alt: '', loading: 'lazy' }),
      h('span', { class: 'sr-only' }, texto)), ...extra);
    // Solo las fotos subidas se pueden borrar; las de la galería vienen con el sitio.
    $('[data-galeria]').replaceChildren(
      ...galeria.subidas.map((f) => opcion(f.url, `Foto subida: ${f.nombre}`, botonBorrarFoto(f))),
      ...galeria.predeterminadas.map((url) => opcion(url, `Foto de la galería: ${url.split('/').pop().replace('.jpg', '').replaceAll('-', ' ')}`)));
  }

  /** Borrar en dos pasos (la papelera pide confirmación encima de la miniatura). El servidor no deja borrar una foto en uso. */
  function botonBorrarFoto(foto) {
    const estado = $('[data-estado-subida]');
    const papelera = h('button', {
      type: 'button', class: 'foto-borrar', 'aria-label': `Borrar la foto subida ${foto.nombre}`,
      html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>',
      onclick: () => {
        const confirmar = h('div', { class: 'foto-confirmar', role: 'group', 'aria-label': `¿Borrar ${foto.nombre}?` },
          h('p', {}, '¿Borrar?'),
          h('div', { class: 'flex gap-1' },
            h('button', { type: 'button', class: 'btn btn-primario btn-mini', onclick: borrar }, 'Sí'),
            h('button', { type: 'button', class: 'btn btn-linea btn-mini !bg-blanco', onclick: () => { confirmar.replaceWith(papelera); papelera.focus(); } }, 'No')));
        papelera.replaceWith(confirmar);
        $('button', confirmar).focus();
      },
    });

    async function borrar(e) {
      e.currentTarget.disabled = true;
      estado.classList.remove('error-msg');
      try {
        galeria = await api.borrarFoto(foto.id);
        // Si estaba elegida en el editor, se vuelve a la foto que el plato ya tenía (o a ninguna).
        if (fotoElegida === foto.url) fotoElegida = platoEditado?.foto !== foto.url ? platoEditado?.foto ?? null : null;
        pintarGaleria();
        estado.textContent = `Foto «${foto.nombre}» borrada.`;
      } catch (err) {
        pintarGaleria();
        estado.textContent = err.message;
        estado.classList.add('error-msg');
      }
    }
    return papelera;
  }

  $('[data-subir-foto]').addEventListener('change', async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    const estado = $('[data-estado-subida]');
    estado.classList.remove('error-msg');
    if (archivo.size > 3 * 1024 * 1024) {
      estado.textContent = 'La imagen pesa más de 3 MB. Redúcela e inténtalo de nuevo.';
      estado.classList.add('error-msg');
      e.target.value = '';
      return;
    }
    estado.textContent = 'Subiendo…';
    try {
      const subida = await api.subirFoto(archivo);
      galeria = await api.fotos();
      fotoElegida = subida.url;
      pintarGaleria();
      estado.textContent = `Foto «${subida.nombre}» subida y elegida.`;
    } catch (err) {
      estado.textContent = err.message;
      estado.classList.add('error-msg');
    } finally {
      e.target.value = '';
    }
  });

  formPlato.addEventListener('submit', async (e) => {
    e.preventDefault();
    const precioTexto = formPlato.precio.value.replace(',', '.').trim();
    const plato = {
      nombre: formPlato.nombre.value, categoria: formPlato.categoria.value, etiqueta: formPlato.etiqueta.value || null,
      origen: formPlato.origen.value, descripcion: formPlato.descripcion.value, historia: formPlato.historia.value,
      precio: precioTexto === '' || Number.isNaN(Number(precioTexto)) ? null : Number(precioTexto),
      foto: fotoElegida, disponible: formPlato.disponible.checked,
    };
    $('[data-error-plato]').textContent = '';
    const boton = $('[data-guardar-plato]');
    $$('[data-error]', formPlato).forEach((x) => { x.textContent = ''; });
    boton.disabled = true;
    try {
      carta = platoEditado ? await api.editarPlato(platoEditado.id, plato) : await api.crearPlato(plato);
      cerrarDialogo(dialogoPlato);
      avisar(platoEditado ? `«${plato.nombre}» guardado.` : `«${plato.nombre}» agregado a la carta.`);
      pintarCarta();
    } catch (err) {
      let ubicado = false;
      for (const [campo, mensaje] of Object.entries(err.errores ?? {})) {
        const destino = $(`[data-error="${campo}"]`, formPlato);
        if (destino) {
          destino.textContent = mensaje;
          ubicado = true;
        }
      }
      if (!ubicado) $('[data-error-plato]').textContent = err.message;
    } finally {
      boton.disabled = false;
    }
  });

  // ---------- Cuentas del panel ----------

  async function pintarCuentas() {
    const caja = $('[data-ajuste="cuentas"]');
    let cuentas;
    try {
      cuentas = await api.cuentas();
    } catch (e) {
      errorDeCarga = e;
      pintarFalloDeCarga();
      return;
    }
    const yo = usuario();
    const filas = cuentas.map((c) => {
      const propia = c.id === yo.id;
      const fila = h('li', { class: `fila-cuenta${c.activo ? '' : ' inactiva'}` },
        h('div', { class: 'min-w-0' },
          h('p', { class: 'font-extrabold' }, c.nombre, propia ? h('span', { class: 'etiqueta-mini' }, 'Tú') : null),
          h('p', { class: 'text-[0.88rem] text-carbon-suave break-all' }, c.correo),
          h('p', { class: 'text-[0.82rem] text-carbon-suave' }, c.ultimoAcceso ? `Último acceso: ${fmtMomento.format(new Date(c.ultimoAcceso))}` : 'Aún no ha entrado')),
        h('label', { class: 'sr-only', for: `rol-${c.id}` }, `Rol de ${c.nombre}`),
        h('select', {
          id: `rol-${c.id}`, class: 'campo !w-auto !py-2', disabled: propia,
          onchange: async (e) => { if (!(await guardar(null, () => api.editarCuenta(c.id, { rol: e.target.value }), { exito: 'Rol actualizado.' }))) pintarCuentas(); },
        }, h('option', { value: 'personal', selected: c.rol === 'personal' }, 'Personal'), h('option', { value: 'administrador', selected: c.rol === 'administrador' }, 'Administrador')),
        h('label', { class: 'interruptor' },
          h('input', {
            type: 'checkbox', checked: c.activo, disabled: propia,
            onchange: async (e) => { await guardar(null, () => api.editarCuenta(c.id, { activo: e.target.checked }), { exito: e.target.checked ? 'Cuenta activada.' : 'Cuenta desactivada: su sesión se cierra en su próxima acción.' }); pintarCuentas(); },
          }), h('span', {}, 'Activa')),
        h('button', { type: 'button', class: 'btn btn-linea btn-mini', onclick: () => reiniciar(fila, c) }, 'Nueva contraseña'));
      return fila;
    });

    function reiniciar(fila, c) {
      const id = `reinicio-${c.id}`;
      const campo = h('input', { id, type: 'password', class: 'campo !py-2', minlength: '12', autocomplete: 'new-password', placeholder: 'Al menos 12 caracteres' });
      const zona = h('div', { class: 'col-span-full grid gap-2 sm:grid-cols-[1fr_auto_auto] items-center' },
        h('label', { class: 'sr-only', for: id }, `Nueva contraseña para ${c.nombre}`), campo,
        h('button', {
          type: 'button', class: 'btn btn-primario btn-mini',
          onclick: async (e) => { if (await guardar(e.currentTarget, () => api.reiniciarClave(c.id, campo.value), { exito: `Contraseña de ${c.nombre} cambiada. Dísela en persona.` })) pintarCuentas(); },
        }, 'Guardar'),
        h('button', { type: 'button', class: 'btn btn-linea btn-mini', onclick: () => zona.remove() }, 'Cancelar'));
      fila.append(zona);
      campo.focus();
    }

    const nueva = h('form', { class: 'mt-4 grid gap-3 md:grid-cols-2', novalidate: true },
      h('div', {}, h('label', { for: 'c-nombre', class: 'block font-bold mb-1' }, 'Nombre'), h('input', { id: 'c-nombre', name: 'nombre', class: 'campo !py-2', maxlength: '60' }),
        h('p', { class: 'mt-1 text-[0.88rem] font-semibold error-msg', 'data-error': 'nombre' })),
      h('div', {}, h('label', { for: 'c-correo', class: 'block font-bold mb-1' }, 'Correo'), h('input', { id: 'c-correo', name: 'correo', type: 'email', class: 'campo !py-2', autocomplete: 'off' }),
        h('p', { class: 'mt-1 text-[0.88rem] font-semibold error-msg', 'data-error': 'correo' })),
      h('div', {}, h('label', { for: 'c-rol', class: 'block font-bold mb-1' }, 'Rol'),
        h('select', { id: 'c-rol', name: 'rol', class: 'campo !py-2' }, h('option', { value: 'personal' }, 'Personal: gestiona reservas'), h('option', { value: 'administrador' }, 'Administrador: además, ajustes y carta'))),
      h('div', {}, h('label', { for: 'c-clave', class: 'block font-bold mb-1' }, 'Contraseña inicial'), h('input', { id: 'c-clave', name: 'clave', type: 'password', class: 'campo !py-2', autocomplete: 'new-password', placeholder: 'Al menos 12 caracteres' }),
        h('p', { class: 'mt-1 text-[0.88rem] font-semibold error-msg', 'data-error': 'clave' })),
      h('div', { class: 'md:col-span-2' }, h('button', { type: 'submit', class: 'btn btn-primario btn-chico' }, 'Crear cuenta'),
        h('span', { class: 'ml-3 text-[0.88rem] text-carbon-suave' }, 'La persona puede cambiar su contraseña en "Mi cuenta".')));
    nueva.addEventListener('submit', async (e) => {
      e.preventDefault();
      const cuenta = { nombre: nueva.nombre.value, correo: nueva.correo.value, rol: nueva.rol.value, clave: nueva.clave.value };
      if (await guardar(e.submitter, () => api.crearCuenta(cuenta), { exito: `Cuenta de ${cuenta.nombre} creada.`, formulario: nueva })) pintarCuentas();
    });

    caja.replaceChildren(
      tarjeta('Cuentas del panel', 'Personal ve el día y gestiona reservas. Administrador, además, cambia ajustes, carta y cuentas. Una cuenta desactivada no puede entrar.',
        h('ul', { class: 'mt-4 grid gap-2' }, ...filas)),
      tarjeta('Nueva cuenta', null, nueva));
  }

  // ---------- Historial de cambios ----------

  function pintarCambios() {
    const AREAS = { politicas: 'Reglas', turnos: 'Turnos', mesas: 'Mesas', dias: 'Días especiales', carta: 'Carta', usuarios: 'Cuentas' };
    $('[data-ajuste="cambios"]').replaceChildren(tarjeta('Últimos cambios', 'Quién cambió qué en los ajustes, del más reciente al más antiguo.',
      datos.cambios.length
        ? h('ol', { class: 'historial-admin mt-4' }, ...datos.cambios.map((c) => h('li', {},
          h('p', { class: 'font-bold' }, c.descripcion),
          h('p', { class: 'text-[0.88rem] text-carbon-suave' }, `${AREAS[c.area] ?? c.area} · ${c.usuario} · ${fmtMomento.format(new Date(c.momento))}`))))
        : h('p', { class: 'mt-3 text-carbon-suave' }, 'Todavía no hay cambios.')));
  }

  return {
    abrir: () => {
      carta = null;
      cargar();
    },
  };
}

/** "Mi cuenta": cambiar la propia contraseña (todas las cuentas). */
export function iniciarMiCuenta({ abrirDialogo, cerrarDialogo, usuario }) {
  const dialogo = $('[data-mi-cuenta]');
  const form = $('[data-form-clave]');
  $('[data-abrir-cuenta]').addEventListener('click', () => {
    const u = usuario();
    form.reset();
    $$('[data-error]', form).forEach((p) => { p.textContent = ''; });
    $('[data-estado-clave]').textContent = '';
    $('[data-cuenta-datos]').textContent = `${u.nombre} · ${u.correo} · ${u.rol}`;
    abrirDialogo(dialogo);
    form.actual.focus();
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    $$('[data-error]', form).forEach((p) => { p.textContent = ''; });
    const estado = $('[data-estado-clave]');
    estado.textContent = '';
    if (form.nueva.value !== form.repetida.value) {
      $('[data-error="repetida"]', form).textContent = 'Las dos contraseñas nuevas no coinciden.';
      return;
    }
    try {
      await api.cambiarMiClave(form.actual.value, form.nueva.value);
      form.reset();
      estado.textContent = 'Contraseña cambiada. Úsala la próxima vez que entres.';
      setTimeout(() => cerrarDialogo(dialogo), 1600);
    } catch (err) {
      let ubicado = false;
      for (const [campo, mensaje] of Object.entries(err.errores ?? {})) {
        const destino = $(`[data-error="${campo}"]`, form);
        if (destino) {
          destino.textContent = mensaje;
          ubicado = true;
        }
      }
      if (!ubicado) estado.textContent = err.message;
    }
  });
}
