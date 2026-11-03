// Panel del personal: acceso, día (pendientes, agenda y plano de mesas), búsqueda, detalle con historial y
// reservas registradas por teléfono. Todo sale de la API (js/admin/api.js); nada se guarda en el navegador.

import { RESERVAS } from '../config/restaurante.js';
import { horariosDelTurno } from '../core/disponibilidad.js';
import { aHora, aMinutos, ahoraLima, formatoLargo, sumarDias } from '../core/fechas.js';
import { aplicarConfiguracion } from '../services/reservas-api.js';
import { $, $$, h, ICONOS, plural } from '../ui/dom.js';
import { iniciarAjustes, iniciarMiCuenta } from './ajustes.js';
import { api, siSePierdeLaSesion } from './api.js';

// Nombres en el lenguaje del salón: lo que el personal dice, no el nombre técnico del estado.
const ACCIONES = {
  confirmar: { texto: 'Confirmar', clase: 'btn-primario', hecho: 'Reserva confirmada. El cliente recibe el aviso.' },
  completar: { texto: 'Sí, llegó', clase: 'btn-secundario', hecho: 'Marcada como atendida.' },
  'no-asistio': { texto: 'No vino', clase: 'btn-linea', hecho: 'Marcada como "no vino".' },
  cancelar: { texto: 'Cancelar reserva', clase: 'btn-linea', hecho: 'Reserva cancelada. El cliente recibe el aviso.' },
};
const ESTADO_ADMIN = { pendiente: 'Por confirmar', confirmada: 'Confirmada', completada: 'Atendida', no_asistio: 'No vino', cancelada: 'Cancelada' };
const ESPERA_REFRESCO_MS = 30_000;

const estado = { vista: 'dia', fecha: ahoraLima().fecha, usuario: null, reservasDia: [], horaPlano: null };
const hoy = () => ahoraLima().fecha;

// ---------- Utilidades ----------

const llego = (r) => r.fecha < hoy() || (r.fecha === hoy() && aMinutos(r.hora) <= ahoraLima().minutos);

/** Acciones posibles para una reserva, en el orden en que se muestran. */
function accionesDe(r) {
  if (r.estado === 'pendiente') return ['confirmar', 'cancelar'];
  if (r.estado === 'confirmada') return llego(r) ? ['completar', 'no-asistio', 'cancelar'] : ['cancelar'];
  return [];
}

const estadoChip = (r) => h('span', { class: `chip-estado chip-${r.estado}` }, ESTADO_ADMIN[r.estado] ?? r.estado);
const mesasTexto = (r) => (r.mesas.length > 1 ? `Mesas ${r.mesas.join(' + ')}` : `Mesa ${r.mesas[0]}`);
const fmtMomento = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' });

// Aviso flotante abajo al centro: confirma cada guardado o explica un error, esté donde esté la página.
// Se queda mientras el puntero está encima y se puede cerrar con la X.
let temporizadorAviso;
const avisoFlotante = $('[data-aviso]');
const ocultarAviso = () => { delete avisoFlotante.dataset.visible; };
const programarCierre = (ms) => {
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(ocultarAviso, ms);
};
function avisar(texto, tipo = 'ok') {
  const region = $('[data-aviso-texto]', avisoFlotante);
  avisoFlotante.dataset.tipo = tipo;
  avisoFlotante.dataset.visible = '';
  // Se vacía y se reescribe en el siguiente cuadro para que el lector de pantalla lo anuncie aunque se repita.
  region.textContent = '';
  requestAnimationFrame(() => { region.textContent = texto; });
  programarCierre(tipo === 'error' ? 9000 : 6000);
}
$('[data-aviso-cerrar]').addEventListener('click', ocultarAviso);
avisoFlotante.addEventListener('mouseenter', () => clearTimeout(temporizadorAviso));
avisoFlotante.addEventListener('mouseleave', () => { if ('visible' in avisoFlotante.dataset) programarCierre(2500); });

// ---------- Acceso ----------

async function iniciar() {
  try {
    aplicarConfiguracion(await api.configuracion());
  } catch {
    // sin configuración del servidor se usan los valores por defecto de js/config
  }
  siSePierdeLaSesion(() => mostrarAcceso('Tu sesión terminó. Vuelve a entrar.'));
  let sesion = null;
  try {
    sesion = await api.sesion();
  } catch (e) {
    mostrarAcceso(e.codigo === 'SIN_CONEXION' ? e.message : 'El panel necesita el servidor: ábrelo desde la dirección del backend.');
    return;
  }
  if (sesion?.usuario) entrarAlPanel(sesion.usuario);
  else mostrarAcceso();
}

function mostrarAcceso(mensaje = '') {
  $('[data-panel]').hidden = true;
  $('[data-acceso]').hidden = false;
  $('[data-error-acceso]').textContent = mensaje;
  $$('dialog[open]').forEach((d) => d.close());
  detenerRefresco();
  $('#acceso-correo').focus();
}

$('[data-form-acceso]').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const boton = $('[data-entrar]');
  const error = $('[data-error-acceso]');
  const correo = form.correo.value.trim();
  const clave = form.clave.value;
  if (!correo || !clave) {
    error.textContent = 'Escribe tu correo y tu contraseña.';
    return;
  }
  boton.disabled = true;
  boton.textContent = 'Entrando…';
  error.textContent = '';
  try {
    await api.sesion(); // asegura la cookie CSRF antes de enviar
    const { usuario } = await api.entrar(correo, clave);
    form.reset();
    entrarAlPanel(usuario);
  } catch (err) {
    error.textContent = err.message;
    form.clave.value = '';
    form.clave.focus();
  } finally {
    boton.disabled = false;
    boton.textContent = 'Entrar';
  }
});

function entrarAlPanel(usuario) {
  estado.usuario = usuario;
  $('[data-acceso]').hidden = true;
  $('[data-panel]').hidden = false;
  $('[data-usuario]').textContent = `${usuario.nombre} · ${usuario.rol}`;
  // La pestaña Ajustes solo existe para administradores (el servidor también lo exige).
  const esAdministrador = usuario.rol === 'administrador';
  $('[data-vista-boton="ajustes"]').hidden = !esAdministrador;
  if (!esAdministrador && estado.vista === 'ajustes') estado.vista = 'dia';
  cambiarVista(estado.vista);
  programarRefresco();
}

$('[data-salir]').addEventListener('click', async () => {
  try {
    await api.salir();
  } finally {
    mostrarAcceso('Cerraste sesión.');
  }
});

// ---------- Vistas ----------

$$('[data-vista-boton]').forEach((b) => b.addEventListener('click', () => cambiarVista(b.dataset.vistaBoton)));

function cambiarVista(vista) {
  estado.vista = vista;
  $$('[data-vista-boton]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.vistaBoton === vista)));
  $$('[data-vista]').forEach((s) => { s.hidden = s.dataset.vista !== vista; });
  if (vista === 'ajustes') ajustes.abrir();
  else refrescar();
}

function refrescar() {
  if (estado.vista === 'ajustes') return null; // no se repinta solo: borraría lo que se está editando
  return estado.vista === 'dia' ? cargarDia() : cargarBusqueda();
}

// Se actualiza solo cada 30 s mientras la pestaña está visible y no hay un diálogo abierto.
let refresco = null;
function programarRefresco() {
  detenerRefresco();
  refresco = setInterval(() => {
    if (document.visibilityState === 'visible' && !$('dialog[open]')) refrescar();
  }, ESPERA_REFRESCO_MS);
}
function detenerRefresco() {
  clearInterval(refresco);
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !$('[data-panel]').hidden && !$('dialog[open]')) refrescar();
});

// ---------- Vista del día ----------
// Pensada para quien empieza: arriba lo que hay que hacer (con instrucciones), en medio la agenda
// para consultar y al lado el plano de mesas a la hora elegida.

$('[data-dia-anterior]').addEventListener('click', () => irADia(sumarDias(estado.fecha, -1)));
$('[data-dia-siguiente]').addEventListener('click', () => irADia(sumarDias(estado.fecha, 1)));
$('[data-dia-hoy]').addEventListener('click', () => irADia(hoy()));
$('[data-dia-fecha]').addEventListener('change', (e) => e.target.value && irADia(e.target.value));
$('[data-ver-cerradas]').addEventListener('change', () => pintarAgenda(estado.reservasDia, estado.fecha));
$('[data-plano-hora]').addEventListener('change', (e) => {
  estado.horaPlano = e.target.value;
  pintarPlano(estado.reservasDia);
});

// La guía rápida queda abierta hasta que la persona la cierre (se recuerda en este navegador).
const guia = $('[data-guia]');
try {
  guia.open = localStorage.getItem('algarrobo.panel.guia') !== 'cerrada';
} catch {
  guia.open = true;
}
guia.addEventListener('toggle', () => {
  try { localStorage.setItem('algarrobo.panel.guia', guia.open ? 'abierta' : 'cerrada'); } catch { /* sin almacenamiento */ }
});

function irADia(fecha) {
  estado.fecha = fecha;
  estado.horaPlano = null;
  cargarDia();
}

let pedidoDia = 0;
async function cargarDia() {
  const pedido = ++pedidoDia;
  const fecha = estado.fecha;
  $('[data-titulo-dia]').textContent = fecha === hoy() ? `Hoy, ${formatoLargo(fecha).toLowerCase()}` : formatoLargo(fecha);
  $('[data-dia-fecha]').value = fecha;
  let reservas;
  try {
    reservas = await api.reservas({ desde: fecha, hasta: fecha });
  } catch (e) {
    if (pedido === pedidoDia) $('[data-tareas]').replaceChildren(h('p', { class: 'font-semibold error-msg' }, e.message));
    return;
  }
  if (pedido !== pedidoDia) return;
  estado.reservasDia = reservas;
  pintarResumen(reservas);
  pintarTareas(reservas);
  pintarAgenda(reservas, fecha);
  prepararPlano(fecha);
  pintarPlano(reservas);
}

const esActiva = (r) => ['pendiente', 'confirmada', 'completada'].includes(r.estado);
const personasDe = (lista) => lista.filter(esActiva).reduce((n, r) => n + r.personas, 0);

/** Una línea en lenguaje llano: cuántas reservas y personas se esperan, y por turno. */
function pintarResumen(reservas) {
  const activas = reservas.filter(esActiva);
  const porTurno = RESERVAS.turnos.map((t) => {
    const del = activas.filter((r) => r.turno === t.id);
    return h('span', { class: 'dato-dia' }, `${t.nombre}: `, h('strong', {}, String(personasDe(del))), ' personas');
  });
  $('[data-contadores]').replaceChildren(
    h('span', { class: 'dato-dia' }, 'Se esperan ', h('strong', {}, String(personasDe(reservas))), ' personas en ',
      h('strong', {}, String(activas.length)), activas.length === 1 ? ' reserva' : ' reservas'),
    ...porTurno,
  );
}

// ----- Pendientes: la lista de tareas -----

/** Confirmadas cuya hora de llegada ya pasó y nadie marcó si vinieron. */
const sinMarcar = (r) => r.estado === 'confirmada' && llego(r);

function pintarTareas(reservas) {
  const caja = $('[data-tareas]');
  const porConfirmar = reservas.filter((r) => r.estado === 'pendiente');
  const porMarcar = reservas.filter(sinMarcar);
  if (!porConfirmar.length && !porMarcar.length) {
    caja.replaceChildren(h('p', { class: 'tarea-vacia' },
      h('span', { class: 'tarea-vacia-icono', html: ICONOS.check, 'aria-hidden': 'true' }),
      'Nada pendiente. Las reservas nuevas aparecerán aquí para que las confirmes.'));
    return;
  }
  const grupo = (titulo, ayuda, lista, acciones) => h('section', { class: 'tarea' },
    h('header', { class: 'tarea-cabeza' },
      h('h3', {}, titulo, h('span', { class: 'tarea-cuenta' }, String(lista.length))),
      h('p', {}, ayuda)),
    h('ul', { class: 'tarea-lista' }, ...lista.map((r) => h('li', { class: 'tarea-fila' },
      h('p', { class: 'tarea-hora' }, r.hora),
      h('div', { class: 'min-w-0' },
        h('button', { type: 'button', class: 'nombre-admin', onclick: () => abrirDetalle(r.codigo) }, r.nombre),
        h('p', { class: 'tarea-dato' }, `${plural(r.personas, 'persona', 'personas')} · ${mesasTexto(r)}`,
          r.comentarios ? h('span', { class: 'tarea-comentario' }, ` · “${r.comentarios}”`) : null)),
      h('div', { class: 'tarea-acciones' }, ...acciones.map((a) => h('button', {
        type: 'button', class: `btn ${ACCIONES[a].clase} btn-chico`,
        onclick: (e) => ejecutar(r.codigo, a, null, e.currentTarget),
      }, ACCIONES[a].texto)))))));
  caja.replaceChildren(
    porConfirmar.length ? grupo('Confirmar reservas nuevas', 'Revisa los datos y confírmalas: el cliente recibe el aviso. Si algo no cuadra, ábrela y cancélala.', porConfirmar, ['confirmar']) : null,
    porMarcar.length ? grupo('¿Vinieron?', 'Ya pasó su hora de llegada. Marca si el cliente llegó o no vino.', porMarcar, ['completar', 'no-asistio']) : null,
  );
}

// ----- Agenda: para consultar (las acciones están en Pendientes y en el detalle) -----

function pintarAgenda(reservas, fecha) {
  const agenda = $('[data-agenda]');
  const diaSemana = new Date(`${fecha}T12:00:00Z`).getUTCDay();
  if (RESERVAS.diasCerrados.includes(diaSemana) && !reservas.length) {
    agenda.replaceChildren(h('p', { class: 'vacio-admin' }, 'Este día el restaurante descansa.'));
    return;
  }
  const verCerradas = $('[data-ver-cerradas]').checked;
  const visibles = reservas.filter((r) => verCerradas || !['cancelada', 'no_asistio'].includes(r.estado));
  const ahora = ahoraLima();
  const minutoActual = fecha === ahora.fecha ? ahora.minutos : null;

  agenda.replaceChildren(...RESERVAS.turnos.map((turno) => {
    const delTurno = visibles.filter((r) => r.turno === turno.id).sort((a, b) => a.hora.localeCompare(b.hora));
    const cabeza = h('header', { class: 'turno-dia-cabeza' },
      h('h3', {}, turno.nombre, h('span', {}, `${turno.inicio}–${turno.fin}`)),
      h('p', {}, `${plural(delTurno.filter(esActiva).length, 'reserva', 'reservas')} · ${personasDe(delTurno)} personas`));
    if (!delTurno.length) {
      return h('section', { class: 'turno-dia' }, cabeza,
        h('p', { class: 'turno-vacio' }, turno.id === 'almuerzo' ? 'Sin reservas en el almuerzo.' : `Sin reservas en la ${turno.nombre.toLowerCase()}.`));
    }
    // Una línea "Ahora" entre la última reserva que ya llegó y la siguiente (solo hoy).
    const filas = [];
    let marcado = minutoActual === null || minutoActual < aMinutos(turno.inicio) || minutoActual > aMinutos(turno.fin);
    for (const r of delTurno) {
      if (!marcado && aMinutos(r.hora) > minutoActual) {
        filas.push(h('li', { class: 'linea-ahora' }, h('span', {}, `Ahora · ${aHora(minutoActual)}`)));
        marcado = true;
      }
      filas.push(h('li', {}, filaAgenda(r)));
    }
    if (!marcado) filas.push(h('li', { class: 'linea-ahora' }, h('span', {}, `Ahora · ${aHora(minutoActual)}`)));
    return h('section', { class: 'turno-dia' }, cabeza, h('ul', { class: 'agenda-lista' }, ...filas));
  }));
}

/** Fila de la agenda: toda la fila abre el detalle. Sin botones, para consultar sin miedo a equivocarse. */
function filaAgenda(r) {
  return h('button', { type: 'button', class: `fila-agenda estado-${r.estado}`, onclick: () => abrirDetalle(r.codigo) },
    h('span', { class: 'fila-agenda-hora' }, r.hora),
    h('span', { class: 'fila-agenda-cliente' },
      h('span', { class: 'fila-agenda-nombre' }, r.nombre),
      h('span', { class: 'fila-agenda-dato' },
        `${plural(r.personas, 'persona', 'personas')} · ${mesasTexto(r)}`,
        r.origen === 'panel' ? ' · por teléfono' : '',
        r.comentarios ? ` · “${r.comentarios}”` : '')),
    estadoChip(r),
    h('span', { class: 'fila-agenda-ver', 'aria-hidden': 'true' }, '›'));
}

// ----- Plano de mesas -----

/** Horarios del día en el selector; por defecto, el actual o el próximo (hoy) o el primero con reservas. */
function prepararPlano(fecha) {
  const select = $('[data-plano-hora]');
  const horas = RESERVAS.turnos.flatMap((t) => horariosDelTurno(t).map((hora) => ({ hora, turno: t })));
  if (!estado.horaPlano || !horas.some((x) => x.hora === estado.horaPlano)) {
    const ahora = ahoraLima();
    const conReservas = estado.reservasDia.filter(esActiva).map((r) => r.hora).sort()[0];
    estado.horaPlano = fecha === ahora.fecha
      ? ([...horas].reverse().find((x) => aMinutos(x.hora) <= ahora.minutos)?.hora ?? horas[0].hora)
      : (conReservas ?? horas[0].hora);
  }
  select.replaceChildren(...RESERVAS.turnos.map((t) => h('optgroup', { label: t.nombre },
    ...horariosDelTurno(t).map((hora) => h('option', { value: hora, selected: hora === estado.horaPlano }, hora)))));
}

/** Qué reserva ocupa cada mesa a la hora elegida (llegó hace menos de la duración de una reserva). */
function pintarPlano(reservas) {
  const minuto = aMinutos(estado.horaPlano);
  const ocupantes = new Map();
  reservas.filter((r) => ['pendiente', 'confirmada'].includes(r.estado))
    .filter((r) => minuto >= aMinutos(r.hora) && minuto < aMinutos(r.hora) + RESERVAS.duracionMinutos)
    .forEach((r) => r.mesas.forEach((m) => ocupantes.set(m, r)));
  const libres = RESERVAS.mesas.filter((m) => !ocupantes.has(m.id)).length;
  const ahora = ahoraLima();
  const ultimo = Math.max(...RESERVAS.turnos.map((t) => aMinutos(t.fin)));
  const terminado = estado.fecha < ahora.fecha || (estado.fecha === ahora.fecha && ahora.minutos >= ultimo);
  $('[data-plano-resumen]').textContent = terminado
    ? `El servicio de este día ya terminó. A las ${estado.horaPlano}: ${libres} de ${RESERVAS.mesas.length} mesas estuvieron libres.`
    : `${libres} de ${RESERVAS.mesas.length} mesas libres a las ${estado.horaPlano}`;
  $('[data-plano-mesas]').replaceChildren(...RESERVAS.mesas.map((m) => {
    const r = ocupantes.get(m.id);
    if (!r) {
      return h('li', {}, h('button', {
        type: 'button', class: `mesa-plano libre asientos-${m.asientos}`,
        onclick: () => abrirNueva({ fecha: estado.fecha, hora: estado.horaPlano, mesa: m.id, personas: m.asientos }),
        // El nombre accesible empieza con lo que se ve en la mesa (control por voz) y luego agrega el detalle.
        'aria-label': `${m.id} ${m.asientos} asientos Libre. ${m.nombre ? `${m.nombre}. ` : ''}Reservar esta mesa`,
      }, h('span', { class: 'mesa-plano-id' }, m.id), ' ', h('span', { class: 'mesa-plano-dato' }, `${m.asientos} asientos`),
      ' ', h('span', { class: 'mesa-plano-estado' }, 'Libre')));
    }
    return h('li', {}, h('button', {
      type: 'button', class: `mesa-plano ${r.estado} asientos-${m.asientos}`,
      onclick: () => abrirDetalle(r.codigo),
      'aria-label': `${m.id} ${r.hora}–${r.horaFin} ${r.nombre}. ${m.nombre ? `${m.nombre}. ` : ''}${r.personas} personas, ${ESTADO_ADMIN[r.estado]}`,
    }, h('span', { class: 'mesa-plano-id' }, m.id), ' ', h('span', { class: 'mesa-plano-dato' }, `${r.hora}–${r.horaFin}`),
    ' ', h('span', { class: 'mesa-plano-nombre' }, r.nombre)));
  }));
}

async function ejecutar(codigo, accion, motivo, boton) {
  if (boton) {
    boton.disabled = true;
    boton.textContent = '…';
  }
  try {
    const detalle = await api.accion(codigo, accion, motivo);
    avisar(`${codigo}: ${ACCIONES[accion].hecho}`);
    await refrescar();
    return detalle;
  } catch (e) {
    avisar(e.message, 'error');
    await refrescar();
    return null;
  }
}

// ---------- Buscar ----------
// Encontrar una reserva (alguien llama), revisar lo que falta confirmar en otros días y el historial.
// Las filas no tienen botones: se abre el detalle, donde están todas las acciones.

const LISTAS = {
  pendientes: { titulo: 'por confirmar en los próximos 60 días', filtro: () => ({ desde: hoy(), hasta: sumarDias(hoy(), 60), estado: 'pendiente' }) },
  proximas: { titulo: 'en los próximos 30 días', filtro: () => ({ desde: hoy(), hasta: sumarDias(hoy(), 30) }) },
  historial: { titulo: (n) => `${n === 1 ? 'cancelada o sin presentarse' : 'canceladas o sin presentarse'} en los últimos 60 días`, filtro: () => ({ desde: sumarDias(hoy(), -60), hasta: hoy() }), solo: ['cancelada', 'no_asistio'] },
};
let listaActual = 'pendientes';
const campoBuscar = $('[data-buscar-q]');
let esperaBusqueda;

$$('[data-lista-tipo]').forEach((b) => b.addEventListener('click', () => {
  listaActual = b.dataset.listaTipo;
  campoBuscar.value = '';
  cargarBusqueda();
}));
$('[data-form-buscar]').addEventListener('submit', (e) => {
  e.preventDefault();
  cargarBusqueda();
});
campoBuscar.addEventListener('input', () => {
  clearTimeout(esperaBusqueda);
  esperaBusqueda = setTimeout(cargarBusqueda, 300);
});

let pedidoLista = 0;
async function cargarBusqueda() {
  const pedido = ++pedidoLista;
  const texto = campoBuscar.value.trim();
  const buscando = texto.length >= 2;
  $$('[data-lista-tipo]').forEach((b) => b.setAttribute('aria-pressed', String(!buscando && b.dataset.listaTipo === listaActual)));
  const lista = $('[data-lista]');
  const config = LISTAS[listaActual];
  const filtro = buscando ? { desde: sumarDias(hoy(), -180), hasta: sumarDias(hoy(), 180), q: texto } : config.filtro();
  let reservas;
  try {
    reservas = await api.reservas(filtro);
  } catch (e) {
    if (pedido === pedidoLista) lista.replaceChildren(h('p', { class: 'font-semibold error-msg' }, e.message));
    return;
  }
  if (pedido !== pedidoLista) return;
  if (!buscando && config.solo) reservas = reservas.filter((r) => config.solo.includes(r.estado));
  if (!buscando && listaActual === 'historial') reservas.reverse();
  $('[data-resumen-lista]').textContent = buscando
    ? `${plural(reservas.length, 'resultado', 'resultados')} para «${texto}»`
    : `${plural(reservas.length, 'reserva', 'reservas')} ${typeof config.titulo === 'function' ? config.titulo(reservas.length) : config.titulo}`;
  if (!reservas.length) {
    lista.replaceChildren(h('p', { class: 'vacio-admin' }, buscando
      ? 'No encontramos reservas. Prueba con otra parte del nombre, el teléfono sin espacios o el código (ALG-…).'
      : 'No hay reservas en esta lista.'));
    return;
  }
  // Agrupadas por día, para leerlas como un calendario.
  const dias = [...new Set(reservas.map((r) => r.fecha))];
  lista.replaceChildren(...dias.map((dia) => h('section', { 'aria-label': formatoLargo(dia) },
    h('h3', { class: 'dia-busqueda' }, dia === hoy() ? `Hoy, ${formatoLargo(dia).toLowerCase()}` : formatoLargo(dia)),
    h('ul', { class: 'agenda-lista mt-2' }, ...reservas.filter((r) => r.fecha === dia).map((r) => h('li', {},
      h('button', { type: 'button', class: `fila-agenda estado-${r.estado}`, onclick: () => abrirDetalle(r.codigo) },
        h('span', { class: 'fila-agenda-hora' }, r.hora),
        h('span', { class: 'fila-agenda-cliente' },
          h('span', { class: 'fila-agenda-nombre' }, r.nombre),
          h('span', { class: 'fila-agenda-dato' }, `${r.contacto} · ${plural(r.personas, 'persona', 'personas')} · ${mesasTexto(r)} · ${r.codigo}`)),
        estadoChip(r),
        h('span', { class: 'fila-agenda-ver', 'aria-hidden': 'true' }, '›'))))))));
}

// ---------- Diálogos ----------

/** Quién abrió cada diálogo, para devolverle el foco al cerrarlo (navegación con teclado). */
const abridores = new WeakMap();

function abrirDialogo(dialogo) {
  dialogo.removeAttribute('data-cerrando');
  if (!dialogo.open) {
    abridores.set(dialogo, document.activeElement);
    dialogo.showModal();
  }
}

function cerrarDialogo(dialogo) {
  if (!dialogo.open) return;
  const sinAnimacion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  dialogo.setAttribute('data-cerrando', '');
  setTimeout(() => {
    dialogo.close();
    dialogo.removeAttribute('data-cerrando');
    devolverFoco(dialogo);
  }, sinAnimacion ? 0 : 220);
}

function devolverFoco(dialogo) {
  const abridor = abridores.get(dialogo);
  if (abridor?.isConnected && abridor !== document.body) {
    abridor.focus({ preventScroll: true });
    return;
  }
  // Si la vista se repintó (por ejemplo, tras cancelar), el foco va al título de la vista actual.
  const titulo = $(`[data-vista="${estado.vista}"] h1`);
  if (titulo) {
    titulo.setAttribute('tabindex', '-1');
    titulo.focus({ preventScroll: true });
  }
}

$$('dialog').forEach((d) => {
  d.addEventListener('cancel', (e) => { e.preventDefault(); cerrarDialogo(d); });
  d.addEventListener('click', (e) => { if (e.target === d) cerrarDialogo(d); });
  $$('[data-cerrar-dialogo]', d).forEach((b) => b.addEventListener('click', () => cerrarDialogo(d)));
});

async function abrirDetalle(codigo, { cancelar = false } = {}) {
  const dialogo = $('[data-detalle]');
  $('[data-detalle-codigo]').textContent = codigo;
  const cuerpo = $('[data-detalle-cuerpo]');
  cuerpo.replaceChildren(h('p', { class: 'text-carbon-suave' }, 'Cargando…'));
  abrirDialogo(dialogo);
  try {
    pintarDetalle(await api.detalle(codigo), { cancelar });
  } catch (e) {
    cuerpo.replaceChildren(h('p', { class: 'font-semibold error-msg' }, e.message));
  }
}

function pintarDetalle({ reserva: r, historial, avisos }, { cancelar }) {
  const cuerpo = $('[data-detalle-cuerpo]');
  const dato = (t, v, ancho = false) => h('div', { class: ancho ? 'ancho' : '' }, h('dt', {}, t), h('dd', {}, v));
  const acciones = h('div', { class: 'mt-5 flex flex-wrap gap-2' });
  const pintarAcciones = () => acciones.replaceChildren(...accionesDe(r).map((a) =>
    h('button', {
      type: 'button', class: `btn ${ACCIONES[a].clase} btn-chico`,
      onclick: async (e) => {
        if (a === 'cancelar') return pedirMotivo();
        const nuevo = await ejecutar(r.codigo, a, null, e.currentTarget);
        if (nuevo) pintarDetalle(nuevo, {});
      },
    }, ACCIONES[a].texto)));

  function pedirMotivo() {
    const motivo = h('textarea', { id: 'motivo-cancelacion', class: 'campo', rows: '2', maxlength: '200', placeholder: 'Ej.: el cliente llamó para cancelar' });
    acciones.replaceChildren(h('div', { class: 'w-full' },
      h('label', { for: 'motivo-cancelacion', class: 'block font-bold mb-1.5' }, 'Motivo de la cancelación ', h('span', { class: 'font-normal text-carbon-suave' }, '(opcional, se guarda en el historial)')),
      motivo,
      h('div', { class: 'mt-3 flex flex-wrap gap-2' },
        h('button', {
          type: 'button', class: 'btn btn-primario btn-chico',
          onclick: async (e) => {
            const nuevo = await ejecutar(r.codigo, 'cancelar', motivo.value.trim(), e.currentTarget);
            if (nuevo) pintarDetalle(nuevo, {});
          },
        }, 'Sí, cancelar la reserva'),
        h('button', { type: 'button', class: 'btn btn-linea btn-chico', onclick: pintarAcciones }, 'No, volver'))));
    motivo.focus();
  }

  cuerpo.replaceChildren(
    h('div', { class: 'flex flex-wrap items-center gap-3' }, estadoChip(r),
      r.origen === 'panel' ? h('span', { class: 'text-[0.8rem] font-bold uppercase tracking-[0.08em] text-maiz-hondo' }, 'Registrada por el personal') : null),
    h('p', { class: 'mt-3 text-[1.25rem] font-extrabold' }, formatoLargo(r.fecha)),
    h('p', { class: 'text-carbon-suave font-semibold tabular-nums' }, `${r.hora} a ${r.horaFin}`),
    h('dl', { class: 'boleto-datos mt-5' },
      dato('Personas', plural(r.personas, 'persona', 'personas')),
      dato(r.mesas.length > 1 ? 'Mesas' : 'Mesa', r.mesas.join(' + ')),
      dato('A nombre de', r.nombre),
      dato('Correo o teléfono', h('a', { class: 'underline', href: r.contacto.includes('@') ? `mailto:${r.contacto}` : `tel:${r.contacto.replace(/[^\d+]/g, '')}` }, r.contacto)),
      dato('Comentarios', r.comentarios || h('span', { class: 'font-normal text-carbon-suave' }, 'Sin comentarios'), true),
      dato('Creada', fmtMomento.format(new Date(r.creada)), true)),
    acciones,
    h('h3', { class: 'mt-7 text-[0.8rem] font-extrabold tracking-[0.1em] uppercase text-aji' }, 'Historial'),
    h('ol', { class: 'historial-admin mt-2' }, ...historial.map((c) => h('li', {},
      h('p', { class: 'font-bold' }, c.desde ? `${ESTADO_ADMIN[c.desde]} → ${ESTADO_ADMIN[c.hacia]}` : ESTADO_ADMIN[c.hacia]),
      h('p', { class: 'text-[0.88rem] text-carbon-suave' }, `${fmtMomento.format(new Date(c.momento))} · ${c.usuario}`),
      c.detalle ? h('p', { class: 'text-[0.9rem]' }, c.detalle) : null))),
    h('h3', { class: 'mt-7 text-[0.8rem] font-extrabold tracking-[0.1em] uppercase text-aji' }, 'Avisos al cliente ', h('span', { class: 'normal-case tracking-normal font-semibold text-carbon-suave' }, '(simulados: no se envían)')),
    avisos.length
      ? h('ul', { class: 'mt-2 grid gap-2' }, ...avisos.map((a) => h('li', { class: 'aviso-simulado' },
        h('p', { class: 'text-[0.82rem] text-carbon-suave' }, `${fmtMomento.format(new Date(a.creado))} · ${a.motivo} · para ${a.destino}`),
        h('p', { class: 'text-[0.92rem]' }, a.mensaje))))
      : h('p', { class: 'mt-2 text-carbon-suave' }, 'Sin avisos.'),
  );
  if (cancelar && accionesDe(r).includes('cancelar')) pedirMotivo();
  else pintarAcciones();
}

// ---------- Reserva registrada por el personal ----------

const formNueva = $('[data-form-nueva]');
$$('[data-nueva-reserva]').forEach((b) => b.addEventListener('click', () => abrirNueva()));

/** Abre el formulario; desde el plano llega con fecha, hora, mesa y personas ya elegidas. */
async function abrirNueva(previo = {}) {
  formNueva.reset();
  $$('[data-error]', formNueva).forEach((p) => { p.textContent = ''; });
  $('[data-error-nueva]').textContent = '';
  const fecha = previo.fecha ?? (estado.vista === 'dia' ? estado.fecha : hoy());
  formNueva.fecha.value = fecha >= hoy() ? fecha : hoy();
  formNueva.fecha.min = hoy();
  $('[data-nueva-hora]').replaceChildren(...RESERVAS.turnos.map((t) =>
    h('optgroup', { label: t.nombre }, ...horariosDelTurno(t).map((hora) => h('option', { value: hora, selected: hora === previo.hora }, hora)))));
  if (previo.personas) formNueva.personas.value = String(previo.personas);
  abrirDialogo($('[data-nueva]'));
  formNueva.nombre.focus();
  await cargarMesas();
  if (previo.mesa) $(`input[name="mesas"][value="${previo.mesa}"]:not([disabled])`, formNueva)?.click();
}

// El error de un campo desaparece en cuanto la persona lo corrige (no hace falta volver a enviar).
formNueva.addEventListener('input', (e) => {
  const campo = e.target.name;
  const error = campo && $(`[data-error="${campo}"]`, formNueva);
  if (error) error.textContent = '';
});
formNueva.fecha.addEventListener('change', cargarMesas);
formNueva.hora.addEventListener('change', cargarMesas);
formNueva.personas.addEventListener('input', pintarAsientos);

let pedidoMesas = 0;
async function cargarMesas() {
  const pedido = ++pedidoMesas;
  const caja = $('[data-nueva-mesas]');
  if (!formNueva.fecha.value || !formNueva.hora.value) return;
  let mesas;
  try {
    mesas = await api.mesas(formNueva.fecha.value, formNueva.hora.value);
  } catch (e) {
    caja.replaceChildren(h('p', { class: 'col-span-full font-semibold error-msg' }, e.message));
    return;
  }
  if (pedido !== pedidoMesas) return;
  caja.replaceChildren(...mesas.map((m) => h('label', { class: `mesa-admin${m.libre ? '' : ' ocupada'}` },
    h('input', { type: 'checkbox', name: 'mesas', value: m.id, 'data-asientos': m.asientos, disabled: !m.libre, onchange: pintarAsientos }),
    h('span', { class: 'font-extrabold' }, m.id),
    h('span', { class: 'text-[0.8rem]' }, m.libre ? `${m.asientos} asientos` : 'Ocupada'))));
  pintarAsientos();
}

function pintarAsientos() {
  const elegidas = $$('input[name="mesas"]:checked', formNueva);
  const asientos = elegidas.reduce((n, c) => n + Number(c.dataset.asientos), 0);
  const personas = Number(formNueva.personas.value) || 0;
  const nota = $('[data-nueva-asientos]');
  if (!elegidas.length) {
    nota.textContent = personas > RESERVAS.maxPersonasEnLinea ? `Para ${personas} personas elige las mesas que se juntan.` : '';
    return;
  }
  nota.textContent = asientos >= personas
    ? `${asientos} asientos para ${personas} personas.`
    : `${asientos} asientos: faltan ${personas - asientos} para ${personas} personas.`;
  nota.classList.toggle('error-msg', asientos < personas);
}

formNueva.addEventListener('submit', async (e) => {
  e.preventDefault();
  const boton = $('[data-guardar-nueva]');
  $$('[data-error]', formNueva).forEach((p) => { p.textContent = ''; });
  const general = $('[data-error-nueva]');
  general.textContent = '';
  boton.disabled = true;
  boton.textContent = 'Registrando…';
  try {
    const { reserva } = await api.crear({
      nombre: formNueva.nombre.value, contacto: formNueva.contacto.value, fecha: formNueva.fecha.value,
      hora: formNueva.hora.value, personas: Number(formNueva.personas.value) || null, comentarios: formNueva.comentarios.value,
      mesas: $$('input[name="mesas"]:checked', formNueva).map((c) => c.value),
    });
    cerrarDialogo($('[data-nueva]'));
    avisar(`Reserva ${reserva.codigo} registrada y confirmada (${mesasTexto(reserva)}).`);
    estado.fecha = reserva.fecha;
    refrescar();
  } catch (err) {
    let ubicado = false;
    for (const [campo, mensaje] of Object.entries(err.errores ?? {})) {
      const destino = $(`[data-error="${campo}"]`, formNueva);
      if (destino) {
        destino.textContent = mensaje;
        ubicado = true;
      }
    }
    if (!ubicado || err.codigo === 'HORARIO_LLENO') general.textContent = err.message;
    if (err.codigo === 'HORARIO_LLENO' || err.codigo === 'MESA_INVALIDA') cargarMesas();
  } finally {
    boton.disabled = false;
    boton.textContent = 'Registrar reserva';
  }
});

const entorno = { avisar, abrirDialogo, cerrarDialogo, usuario: () => estado.usuario, hoy };
const ajustes = iniciarAjustes(entorno);
iniciarMiCuenta(entorno);

iniciar();
