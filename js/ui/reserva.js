// Flujo de reserva en cinco pasos: personas → día → hora → mesa (opcional, en el plano) → datos.

import { RESERVAS } from '../config/restaurante.js';
import { esContactoValido, mesasCompatibles } from '../core/disponibilidad.js';
import { CODIGOS } from '../core/errores.js';
import { aHora, aMinutos, diaSemana, diferenciaDias, diasEnMes, formatoCorto, formatoLargo, formatoMes, primerDiaMes, sumarDias, sumarMeses } from '../core/fechas.js';
import { ubicacionDe } from '../data/plano.js';
import { accionesComprobante, TEXTO_ESTADO_RESERVA } from './comprobante.js';
import { crearPlano } from './plano-mesas.js';
import { $, $$, h, ICONOS, plural } from './dom.js';

const TEXTO_ESTADO_DIA = {
  disponible: 'hay mesas',
  limitado: 'pocas mesas',
  completo: 'completo',
  cerrado: 'cerrado',
  pasado: 'fecha pasada',
  fuera: 'fuera del plazo de reservas',
};
const MARCA_DIA = { limitado: 'pocas', completo: 'lleno', cerrado: 'cerrado' };
const SELECCIONABLE = ['disponible', 'limitado', 'completo'];

export { TEXTO_ESTADO_RESERVA };

export function iniciarReserva(servicio, { alVerGestion } = {}) {
  const raiz = $('[data-reserva]');
  const pasos = Object.fromEntries($$('[data-paso]', raiz).map((p) => [p.dataset.paso, p]));
  const form = $('[data-form-reserva]', raiz);
  const resultado = $('[data-resultado]', raiz);
  const lista = $('ol', raiz);

  const hoy = () => servicio.ahora().fecha;

  // Textos que cambian si la reserva queda solo en este navegador (demo) o llega al servidor (API).
  const TEXTO = servicio.esDemo
    ? {
      enviar: 'Confirmar reserva de demostración',
      guardar: 'Guardar cambios (demostración)',
      registrada: 'Reserva de demostración registrada',
      cambiada: 'Cambios guardados (demostración)',
      pendiente: 'El restaurante la revisa. En esta demo se confirma sola en unos segundos.',
      explicacion: (contacto) => 'Esto es una demostración: la reserva se guardó solo en este navegador y nadie la va a recibir. ' +
        `En la versión con servidor, el restaurante la confirmaría y te avisaría a ${contacto}.`,
    }
    : {
      enviar: 'Confirmar reserva',
      guardar: 'Guardar cambios',
      registrada: 'Reserva registrada',
      cambiada: 'Cambios guardados',
      pendiente: 'El restaurante la revisará y la confirmará. Puedes ver su estado en "Mis reservas".',
      explicacion: (contacto) => 'Tu reserva quedó guardada en el servidor de este restaurante ficticio. ' +
        `El aviso a ${contacto} está simulado: no se envía ningún correo ni mensaje.`,
    };
  const estado = {
    personas: 2,
    mes: primerDiaMes(hoy()),
    fecha: null,
    hora: null,
    estadosMes: {},
    edicion: null, // { codigo, contacto }
    retencion: null, // { id, mesa, expira } mientras la mesa está apartada
    mesaElegida: null, // la que la persona tocó en el plano; null = la elige la casa
    enviando: false,
    pidiendoMes: 0,
    pidiendoHoras: 0,
  };

  /* ---------- Mesa apartada mientras se completan los datos ---------- */
  const avisoRetencion = $('[data-retencion]', raiz);
  let cuentaAtras = null;

  function soltarRetencion() {
    clearInterval(cuentaAtras);
    cuentaAtras = null;
    estado.retencion = null;
    estado.mesaElegida = null;
    avisoRetencion.replaceChildren();
    servicio.liberarRetencion();
  }

  async function retener(hora, mesa = null) {
    clearInterval(cuentaAtras);
    avisoRetencion.replaceChildren(h('span', { class: 'cargando' }, 'Apartando la mesa'));
    try {
      const retencion = await servicio.retenerMesa(estado.fecha, hora, estado.personas, { excluir: estado.edicion?.codigo, mesa });
      if (estado.hora !== hora) return; // eligió otra hora mientras tanto
      estado.retencion = retencion;
      estado.mesaElegida = mesa;
      pintarCuentaAtras();
      actualizarPasoDatos();
      cargarPlano();
    } catch (error) {
      if (estado.hora !== hora) return;
      avisoRetencion.replaceChildren();
      if (error.codigo === CODIGOS.MESA_OCUPADA || error.codigo === CODIGOS.MESA_INVALIDA) {
        // La mesa del plano ya no está: se vuelve a la que tenía apartada (o a la que elija la casa).
        await cargarPlano();
        plano.aviso(error.errores?.mesa ?? error.message);
        if (!estado.retencion) retener(hora);
        return;
      }
      if (error.codigo === CODIGOS.HORARIO_LLENO) {
        estado.hora = null;
        await cargarHorarios();
        contenedorHoras.prepend(h('p', { class: 'mb-4 font-semibold error-msg', role: 'alert' },
          `Alguien acaba de tomar la última mesa de las ${hora}. Elige otro horario.`));
      }
    }
  }

  function pintarCuentaAtras() {
    const tiempo = h('span', { class: 'retencion-tiempo tabular-nums', 'aria-hidden': 'true' });
    avisoRetencion.replaceChildren(
      h('span', { class: 'retencion-icono', 'aria-hidden': 'true', html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/></svg>' }),
      h('span', {}, `Te guardamos la mesa ${RESERVAS.retencionMinutos} minutos mientras completas tus datos. `),
      tiempo,
    );
    const pintar = () => {
      const restante = Math.max(0, estado.retencion.expira - Date.now());
      const s = Math.ceil(restante / 1000);
      tiempo.textContent = `Quedan ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      if (restante <= 0) vencida();
    };
    pintar();
    cuentaAtras = setInterval(pintar, 1000);
  }

  function vencida() {
    clearInterval(cuentaAtras);
    estado.retencion = null;
    const hora = estado.hora;
    avisoRetencion.replaceChildren(
      h('span', {}, 'Pasaron los minutos de reserva y liberamos la mesa. Puedes confirmar igual si sigue libre, o apartarla otra vez. '),
      h('button', { type: 'button', class: 'underline font-bold', onclick: () => hora && retener(hora, estado.mesaElegida) }, 'Apartarla de nuevo'),
    );
  }

  // Al cerrar o salir de la página se libera la mesa apartada.
  window.addEventListener('pagehide', () => servicio.liberarRetencion());

  /* ---------- Cambios hechos en otras pestañas ---------- */
  let refresco = null;
  servicio.escuchar(({ motivo }) => {
    // Solo interesa lo que cambia otra pestaña, y no mientras se envía o se muestra la confirmación.
    if (motivo !== 'otra-pestana' || estado.enviando || lista.hidden) return;
    clearTimeout(refresco);
    refresco = setTimeout(() => {
      cargarMes();
      if (estado.fecha) cargarHorarios({ avisarSiSePerdio: true });
    }, 250);
  });

  /* ---------- Paso 1: personas ---------- */
  const btnMenos = $('[data-personas-menos]', raiz);
  const btnMas = $('[data-personas-mas]', raiz);
  btnMenos.addEventListener('click', () => cambiarPersonas(estado.personas - 1));
  btnMas.addEventListener('click', () => cambiarPersonas(estado.personas + 1));

  function cambiarPersonas(n) {
    const valor = Math.min(RESERVAS.maxPersonasEnLinea, Math.max(RESERVAS.minPersonas, n));
    if (valor === estado.personas) return;
    estado.personas = valor;
    if (estado.retencion) soltarRetencion();
    pintarPersonas();
    cargarMes();
    if (estado.fecha) cargarHorarios();
  }

  function pintarPersonas() {
    const n = estado.personas;
    $('[data-personas-num]', raiz).textContent = n;
    $('[data-personas-texto]', raiz).textContent = n === 1 ? 'persona' : 'personas';
    btnMenos.disabled = n <= RESERVAS.minPersonas;
    btnMas.disabled = n >= RESERVAS.maxPersonasEnLinea;
    const tamanos = [...new Set(mesasCompatibles(n).map((m) => m.asientos))];
    const nota = n >= RESERVAS.maxPersonasEnLinea
      ? `Te asignaremos la mesa larga de 8. ¿Son más? Llámanos al ${'+51 900 000 000'} (demo).`
      : `Te asignaremos una mesa de ${tamanos.join(' o ')}.`;
    $('[data-personas-nota]', raiz).textContent = nota;
  }

  /* ---------- Paso 2: calendario ---------- */
  const calendario = $('[data-calendario]', raiz);

  async function cargarMes() {
    const pedido = ++estado.pidiendoMes;
    pintarCalendario(true);
    try {
      const estados = await servicio.consultarMes(estado.mes, estado.personas, { excluir: estado.edicion?.codigo });
      if (pedido !== estado.pidiendoMes) return;
      estado.estadosMes = estados;
      pintarCalendario(false);
    } catch {
      if (pedido !== estado.pidiendoMes) return;
      calendario.replaceChildren(h('p', { class: 'font-semibold error-msg', role: 'alert' }, 'No pudimos consultar el calendario. Vuelve a intentarlo en un momento.'),
        h('button', { type: 'button', class: 'btn btn-linea mt-3', onclick: cargarMes }, 'Reintentar'));
    }
  }

  function pintarCalendario(cargando) {
    const mes = estado.mes;
    const limite = sumarDias(hoy(), RESERVAS.ventanaDias);
    const puedeAtras = mes > primerDiaMes(hoy());
    const puedeAdelante = sumarMeses(mes, 1) <= limite;

    const cabecera = h('div', { class: 'flex items-center justify-between gap-3 mb-4' },
      h('button', { type: 'button', class: 'contador-btn', disabled: !puedeAtras, 'aria-label': 'Mes anterior', html: ICONOS.flechaIzq, onclick: () => moverMes(-1) }),
      h('p', { class: 'text-[1.15rem] font-bold', 'aria-live': 'polite' }, formatoMes(mes)),
      h('button', { type: 'button', class: 'contador-btn', disabled: !puedeAdelante, 'aria-label': 'Mes siguiente', html: ICONOS.flechaDer, onclick: () => moverMes(1) }),
    );

    const nombres = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    const largos = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
    const semana = h('div', { class: 'grid grid-cols-7 gap-1.5 mb-1.5 text-center text-[0.8rem] font-bold text-carbon-suave', 'aria-hidden': 'true' },
      nombres.map((n, i) => h('span', { title: largos[i] }, n)));

    const desfase = (diaSemana(mes) + 6) % 7; // lunes primero
    // En el mes actual se omiten las semanas que ya pasaron completas.
    const inicioSemanaHoy = sumarDias(hoy(), -((diaSemana(hoy()) + 6) % 7));
    const primerDia = mes === primerDiaMes(hoy()) && inicioSemanaHoy > mes ? diferenciaDias(mes, inicioSemanaHoy) : 0;
    const celdas = [];
    if (!primerDia) for (let i = 0; i < desfase; i++) celdas.push(h('span', { 'aria-hidden': 'true' }));
    for (let d = primerDia; d < diasEnMes(mes); d++) {
      const fecha = sumarDias(mes, d);
      const est = cargando ? (estado.estadosMes[fecha] ?? 'disponible') : estado.estadosMes[fecha];
      const seleccionable = SELECCIONABLE.includes(est);
      celdas.push(h('button', {
        type: 'button',
        class: `dia dia--${est} ${fecha === hoy() ? 'dia--hoy' : ''}`,
        'data-fecha': fecha,
        'aria-pressed': String(fecha === estado.fecha),
        'aria-label': `${formatoLargo(fecha)}${fecha === hoy() ? ' (hoy)' : ''}: ${TEXTO_ESTADO_DIA[est]}`,
        disabled: !seleccionable || cargando,
        tabindex: fecha === (estado.fecha ?? primeraElegible()) ? '0' : '-1',
        onclick: () => elegirFecha(fecha),
      },
      h('span', { class: 'num' }, d + 1),
      MARCA_DIA[est] && h('span', { class: 'marca', 'aria-hidden': 'true' }, MARCA_DIA[est])));
    }
    const rejilla = h('div', {
      class: `grid grid-cols-7 gap-1.5 transition-opacity ${cargando ? 'opacity-50' : ''}`,
      role: 'group', 'aria-label': `Días de ${formatoMes(mes)}`, 'aria-busy': String(cargando),
      onkeydown: navegarConTeclado,
    }, celdas);

    const leyenda = h('ul', { class: 'mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[0.88rem] text-carbon-suave' },
      [['disponible', 'Hay mesas'], ['limitado', 'Pocas mesas'], ['completo', 'Completo'], ['pasado', 'Ya pasó']].map(([clase, texto]) =>
        h('li', { class: 'flex items-center gap-2' },
          h('span', { class: `dia dia--${clase} !min-h-0 !aspect-auto w-6 h-6 !p-0 text-[0.7rem]`, 'aria-hidden': 'true' }, clase === 'pasado' ? h('span', { class: 'num' }, '9') : ''),
          texto)));

    const aviso = cargando ? h('p', { class: 'mt-3 text-sm font-semibold text-carbon-suave cargando' }, 'Consultando mesas libres') : null;
    calendario.replaceChildren(cabecera, semana, rejilla, leyenda, aviso ?? '');
  }

  function primeraElegible() {
    return Object.entries(estado.estadosMes).find(([, e]) => e === 'disponible' || e === 'limitado')?.[0];
  }

  function moverMes(delta) {
    estado.mes = sumarMeses(estado.mes, delta);
    cargarMes();
  }

  function navegarConTeclado(evento) {
    const pasos = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(evento.key in pasos)) return;
    const actual = evento.target.closest('[data-fecha]');
    if (!actual) return;
    evento.preventDefault();
    let destino = sumarDias(actual.dataset.fecha, pasos[evento.key]);
    for (let intentos = 0; intentos < 14; intentos++) {
      const boton = calendario.querySelector(`[data-fecha="${destino}"]:not([disabled])`);
      if (boton) {
        $$('[data-fecha]', calendario).forEach((b) => b.setAttribute('tabindex', '-1'));
        boton.setAttribute('tabindex', '0');
        boton.focus();
        return;
      }
      if (!calendario.querySelector(`[data-fecha="${destino}"]`)) return;
      destino = sumarDias(destino, Math.sign(pasos[evento.key]));
    }
  }

  function elegirFecha(fecha, hora = null) {
    if (estado.retencion) soltarRetencion();
    estado.fecha = fecha;
    estado.hora = hora;
    $$('[data-fecha]', calendario).forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.fecha === fecha));
      b.setAttribute('tabindex', b.dataset.fecha === fecha ? '0' : '-1');
    });
    $('[data-resumen-fecha]', raiz).textContent = formatoCorto(fecha);
    pasos.fecha.dataset.estado = 'hecho';
    pasos.hora.dataset.estado = 'activo';
    $('[data-paso-aviso="hora"]', raiz).textContent = '';
    actualizarPasoDatos();
    cargarHorarios().then(() => {
      // Si llegó con una hora ya elegida (desde "Hoy" o al cambiar una reserva), se aparta la mesa.
      if (hora && estado.hora === hora && !estado.retencion) retener(hora);
    });
  }

  /* ---------- Paso 3: horarios ---------- */
  const contenedorHoras = $('[data-horarios]', raiz);

  async function cargarHorarios({ avisarSiSePerdio = false } = {}) {
    const pedido = ++estado.pidiendoHoras;
    contenedorHoras.replaceChildren(h('p', { class: 'font-semibold text-carbon-suave cargando' }, `Buscando mesas para ${plural(estado.personas, 'persona', 'personas')}`));
    try {
      const horarios = await servicio.consultarHorarios(estado.fecha, estado.personas, { excluir: estado.edicion?.codigo });
      if (pedido !== estado.pidiendoHoras) return;
      const perdida = estado.hora && !horarios.some((x) => x.hora === estado.hora && x.estado === 'libre') ? estado.hora : null;
      if (perdida) {
        estado.hora = null;
        if (estado.retencion) soltarRetencion();
      }
      await pintarHorarios(horarios);
      if (perdida && avisarSiSePerdio) {
        contenedorHoras.prepend(h('p', { class: 'mb-4 font-semibold error-msg', role: 'alert' },
          `Otra reserva acaba de ocupar la última mesa de las ${perdida}. Elige otro horario.`));
      }
      actualizarPasoDatos();
    } catch {
      if (pedido !== estado.pidiendoHoras) return;
      contenedorHoras.replaceChildren(h('p', { class: 'font-semibold error-msg', role: 'alert' }, 'No pudimos consultar los horarios.'),
        h('button', { type: 'button', class: 'btn btn-linea mt-3', onclick: cargarHorarios }, 'Reintentar'));
    }
  }

  async function pintarHorarios(horarios) {
    const bloques = RESERVAS.turnos.map((turno) => {
      const delTurno = horarios.filter((x) => x.turno === turno.id && x.estado !== 'pasado');
      const libres = delTurno.filter((x) => x.estado === 'libre').length;
      const titulo = h('div', { class: 'flex items-baseline justify-between gap-3 mb-3' },
        h('p', { class: 'font-bold text-[1.05rem]' }, turno.nombre, h('span', { class: 'ml-2 font-normal text-[0.9rem] text-carbon-suave tabular-nums' }, `${turno.inicio} – ${turno.fin}`)),
        h('p', { class: 'text-[0.88rem] font-semibold text-carbon-suave' }, delTurno.length ? (libres ? plural(libres, 'horario libre', 'horarios libres') : 'Completo') : ''));
      if (!delTurno.length) return h('div', {}, titulo, h('p', { class: 'text-carbon-suave' }, 'Este turno ya pasó.'));
      return h('div', {}, titulo, h('div', { class: 'grid grid-cols-3 sm:grid-cols-4 gap-2' }, delTurno.map(botonHora)));
    });

    const hayLibres = horarios.some((x) => x.estado === 'libre');
    const nodos = [h('div', { class: 'grid gap-7' }, bloques)];
    if (!hayLibres) nodos.unshift(await bloqueAlternativas());
    contenedorHoras.replaceChildren(...nodos);
  }

  function botonHora(slot) {
    const libre = slot.estado === 'libre';
    const detalle = libre ? (slot.mesasLibres === 1 ? 'última mesa' : `${slot.mesasLibres} mesas`) : 'lleno';
    return h('button', {
      type: 'button',
      class: 'horario',
      disabled: !libre,
      'aria-pressed': String(slot.hora === estado.hora),
      'data-hora': slot.hora,
      onclick: () => elegirHora(slot.hora),
    }, h('span', { class: 'hora block text-[1.08rem]' }, slot.hora), ' ', h('span', { class: 'block text-[0.75rem] font-semibold opacity-80' }, detalle));
  }

  async function bloqueAlternativas(horaPreferida) {
    const referencia = horaPreferida ?? estado.hora ?? '20:00';
    const caja = h('div', { class: 'mb-7 rounded-[10px] bg-marfil px-4 py-3', role: 'status' },
      h('p', { class: 'font-bold' }, `No queda ninguna mesa para ${plural(estado.personas, 'persona', 'personas')} el ${formatoLargo(estado.fecha).toLowerCase()}.`),
      h('p', { class: 'mt-1 text-carbon-suave cargando' }, 'Buscando días cercanos con mesa'));
    try {
      const { otrosDias } = await servicio.alternativas(estado.fecha, referencia, estado.personas, { excluir: estado.edicion?.codigo });
      caja.lastChild.remove();
      if (otrosDias.length) {
        caja.append(
          h('p', { class: 'mt-1 text-carbon-suave' }, `A las ${referencia} sí hay mesa estos días:`),
          h('div', { class: 'mt-3 flex flex-wrap gap-2' }, otrosDias.map((alt) =>
            h('button', { type: 'button', class: 'btn btn-linea', onclick: () => irA(alt) }, `${formatoCorto(alt.fecha)} · ${alt.hora}`))),
        );
      } else {
        caja.append(h('p', { class: 'mt-1 text-carbon-suave' }, 'Prueba con otro día del calendario o llámanos.'));
      }
    } catch {
      caja.lastChild.textContent = 'Prueba con otro día del calendario.';
    }
    return caja;
  }

  function elegirHora(hora) {
    estado.hora = hora;
    estado.mesaElegida = null;
    $$('[data-hora]', contenedorHoras).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.hora === hora)));
    actualizarPasoDatos();
    retener(hora);
    if (window.matchMedia('(max-width: 1023px)').matches) pasos.mesa.scrollIntoView({ block: 'start' });
  }

  /* ---------- Paso 4: mesa en el plano (opcional) ---------- */
  const plano = crearPlano({
    alElegir: (id) => estado.hora && retener(estado.hora, id),
    alDejarALaCasa: () => estado.hora && retener(estado.hora),
  });
  $('[data-plano]', raiz).append(plano.el);
  let pidiendoPlano = 0;

  async function cargarPlano() {
    if (!estado.fecha || !estado.hora) return;
    const pedido = ++pidiendoPlano;
    plano.cargando();
    try {
      const mesas = await servicio.consultarMesas(estado.fecha, estado.hora, estado.personas, { excluir: estado.edicion?.codigo });
      if (pedido !== pidiendoPlano) return;
      plano.pintar({
        mesas,
        elegida: estado.retencion?.mesa ?? null,
        porLaCasa: !estado.mesaElegida,
        personas: estado.personas,
      });
    } catch {
      if (pedido === pidiendoPlano) plano.aviso('No pudimos cargar el plano. La casa te asignará una mesa.');
    }
  }

  /* ---------- Paso 5: datos ---------- */
  function actualizarPasoDatos() {
    const listo = Boolean(estado.fecha && estado.hora);
    pasos.hora.dataset.estado = estado.fecha ? (estado.hora ? 'hecho' : 'activo') : 'bloqueado';
    pasos.mesa.dataset.estado = listo ? 'activo' : 'bloqueado';
    $('[data-paso-aviso="mesa"]', raiz).textContent = listo ? 'Opcional' : 'Primero elige la hora';
    pasos.datos.dataset.estado = listo ? 'activo' : 'bloqueado';
    $('[data-paso-aviso="datos"]', raiz).textContent = listo ? '' : estado.fecha ? 'Primero elige la hora' : 'Primero elige un día';
    if (!estado.fecha) $('[data-paso-aviso="hora"]', raiz).textContent = 'Primero elige un día';
    if (listo) {
      const salida = aHora(aMinutos(estado.hora) + RESERVAS.duracionMinutos);
      $('[data-resumen-reserva]', raiz).replaceChildren(
        h('p', { class: 'font-bold' }, `Mesa para ${plural(estado.personas, 'persona', 'personas')}`),
        h('p', {}, `${formatoLargo(estado.fecha)}, llegada a las ${estado.hora}. La mesa es suya hasta las ${salida}.`),
        estado.retencion ? h('p', {}, `Mesa ${estado.retencion.mesa}${ubicacionDe(estado.retencion.mesa) ? ` · ${ubicacionDe(estado.retencion.mesa).texto}` : ''}`) : null,
      );
    }
  }

  const campos = { nombre: form.elements.nombre, contacto: form.elements.contacto, comentarios: form.elements.comentarios };
  const errorGeneral = $('[data-error-general]', form);
  const botonEnviar = $('[data-enviar]', form);

  campos.contacto.addEventListener('input', () => {
    const pareceTelefono = /^[\d\s()+-]+$/.test(campos.contacto.value) && campos.contacto.value.trim() !== '';
    campos.contacto.setAttribute('inputmode', pareceTelefono ? 'tel' : 'email');
  });
  for (const campo of [campos.nombre, campos.contacto]) {
    campo.addEventListener('blur', () => validarCampo(campo.name));
    campo.addEventListener('input', () => campo.getAttribute('aria-invalid') === 'true' && validarCampo(campo.name));
  }

  function validarCampo(nombre) {
    const valor = campos[nombre].value.trim();
    let mensaje = '';
    if (nombre === 'nombre' && valor.length < 2) mensaje = 'Escribe el nombre de quien reserva.';
    if (nombre === 'contacto') {
      if (!valor) mensaje = 'Necesitamos un correo o un teléfono para avisarte.';
      else if (!esContactoValido(valor)) mensaje = 'Revisa el dato: escribe un correo (nombre@correo.com) o un teléfono de 9 dígitos.';
    }
    mostrarError(nombre, mensaje);
    return !mensaje;
  }

  function mostrarError(nombre, mensaje) {
    const destino = $(`[data-error="${nombre}"]`, form);
    if (destino) destino.textContent = mensaje;
    campos[nombre]?.setAttribute('aria-invalid', String(Boolean(mensaje)));
  }

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    errorGeneral.textContent = '';
    const validos = ['nombre', 'contacto'].map(validarCampo);
    if (validos.includes(false)) {
      campos[validos[0] ? 'contacto' : 'nombre'].focus();
      return;
    }
    const solicitud = {
      nombre: campos.nombre.value,
      contacto: campos.contacto.value,
      comentarios: campos.comentarios.value,
      fecha: estado.fecha,
      hora: estado.hora,
      personas: estado.personas,
      mesa: estado.mesaElegida ?? undefined,
    };
    botonEnviar.disabled = true;
    estado.enviando = true;
    const textoOriginal = botonEnviar.textContent;
    botonEnviar.textContent = estado.edicion ? 'Guardando cambios…' : 'Reservando…';
    try {
      const reserva = estado.edicion
        ? await servicio.modificarReserva(estado.edicion.codigo, estado.edicion.contacto, solicitud)
        : await servicio.crearReserva(solicitud);
      clearInterval(cuentaAtras);
      estado.retencion = null;
      avisoRetencion.replaceChildren();
      mostrarResultado(reserva, Boolean(estado.edicion));
    } catch (error) {
      mostrarFallo(error);
    } finally {
      estado.enviando = false;
      botonEnviar.disabled = false;
      botonEnviar.textContent = textoOriginal;
    }
  });

  /** Cada código de error tiene su lugar y su salida. */
  async function mostrarFallo(error) {
    const errores = error.errores ?? {};
    for (const nombre of ['nombre', 'contacto']) if (errores[nombre]) mostrarError(nombre, errores[nombre]);

    switch (error.codigo) {
      case CODIGOS.MESA_OCUPADA:
      case CODIGOS.MESA_INVALIDA: {
        // La mesa del plano se ocupó mientras llenaba sus datos: se vuelve al plano con otra apartada.
        errorGeneral.textContent = '';
        estado.retencion = null;
        estado.mesaElegida = null;
        await retener(estado.hora);
        plano.aviso(`${errores.mesa ?? error.message} Mientras tanto te apartamos otra.`);
        pasos.mesa.scrollIntoView({ block: 'start' });
        return;
      }
      case CODIGOS.CONTACTO_DUPLICADO:
      case CODIGOS.LIMITE_RESERVAS: {
        // El motivo ya se muestra bajo el campo de contacto; aquí solo el atajo para resolverlo.
        errorGeneral.replaceChildren(h('a', { href: '#mis-reservas', class: 'underline font-bold' }, 'Ver mis reservas'));
        campos.contacto.focus();
        return;
      }
      case CODIGOS.HORARIO_LLENO: {
        const referencia = estado.hora;
        errorGeneral.textContent = '';
        estado.hora = null;
        if (estado.retencion) soltarRetencion();
        await cargarHorarios();
        contenedorHoras.prepend(h('p', { class: 'mb-4 font-semibold error-msg', role: 'alert' },
          `Mientras completabas los datos se ocupó la mesa de las ${referencia}. Elige otro horario.`));
        pasos.hora.scrollIntoView({ block: 'start' });
        return;
      }
      case CODIGOS.HORARIO_PASADO:
      case CODIGOS.FECHA_PASADA:
      case CODIGOS.DIA_CERRADO:
      case CODIGOS.FECHA_FUERA_DE_PLAZO: {
        errorGeneral.textContent = Object.values(errores).join(' ') || error.message;
        estado.hora = null;
        if (estado.retencion) soltarRetencion();
        await cargarMes();
        if (estado.fecha) await cargarHorarios();
        return;
      }
      default: {
        const otros = Object.entries(errores).filter(([k]) => !['nombre', 'contacto'].includes(k)).map(([, v]) => v);
        errorGeneral.textContent = otros.join(' ') || (errores.nombre || errores.contacto ? '' : error.message);
      }
    }
  }

  /* ---------- Resultado ---------- */
  function mostrarResultado(reserva, fueEdicion) {
    lista.hidden = true;
    $('[data-modo-edicion]', raiz).classList.add('hidden');
    $('[data-modo-edicion]', raiz).classList.remove('flex');
    const mesa = RESERVAS.mesas.find((m) => m.id === reserva.mesa);
    const salida = aHora(aMinutos(reserva.hora) + RESERVAS.duracionMinutos);
    const estadoTexto = h('dd', { class: 'font-bold', 'aria-live': 'polite' }, TEXTO_ESTADO_RESERVA[reserva.estado]);
    const notaEstado = h('p', { class: 'mt-1 text-[0.9rem] text-carbon-suave' },
      reserva.estado === 'pendiente'
        ? TEXTO.pendiente
        : '');
    esperarConfirmacion(reserva, estadoTexto, notaEstado);
    const comprobante = accionesComprobante(() => servicio.buscarReserva(reserva.codigo, reserva.contacto).catch(() => reserva), { clase: 'btn btn-linea !min-h-[3.25rem]' });
    resultado.replaceChildren(
      h('div', { class: 'flex items-center gap-3 text-hierbas font-bold' },
        h('span', { class: 'grid place-items-center w-9 h-9 rounded-full bg-hierbas text-blanco', html: ICONOS.check }),
        fueEdicion ? TEXTO.cambiada : TEXTO.registrada),
      h('div', { class: 'ticket mt-6 py-6' },
        h('p', { class: 'text-[0.9rem] font-semibold text-carbon-suave' }, 'Código de reserva'),
        h('p', { class: 'display text-[clamp(2rem,6vw,2.75rem)] text-aji tracking-[0.02em] tabular-nums' }, reserva.codigo),
        h('dl', { class: 'mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2 text-[1.02rem]' },
          fila('Fecha', formatoLargo(reserva.fecha)),
          fila('Hora de llegada', `${reserva.hora} (mesa hasta las ${salida})`),
          fila('Personas', plural(reserva.personas, 'persona', 'personas')),
          fila('Mesa', `${mesa?.nombre ?? reserva.mesa} · ${mesa?.asientos} asientos${ubicacionDe(reserva.mesa) ? ` · ${ubicacionDe(reserva.mesa).texto}` : ''}`),
          fila('A nombre de', reserva.nombre),
          h('div', {}, h('dt', { class: 'text-[0.88rem] font-semibold text-carbon-suave' }, 'Estado'), estadoTexto, notaEstado),
        ),
      ),
      h('p', { class: 'mt-5 max-w-2xl text-carbon-suave' },
        TEXTO.explicacion(reserva.contacto), ` Llega dentro de los ${RESERVAS.toleranciaMinutos} minutos de tolerancia.`),
      h('div', { class: 'mt-6 flex flex-wrap gap-3' },
        h('button', { type: 'button', class: 'btn btn-primario', onclick: reiniciar }, 'Hacer otra reserva'),
        ...comprobante.botones,
        h('button', { type: 'button', class: 'btn btn-linea !min-h-[3.25rem]', onclick: () => alVerGestion?.(reserva.codigo, reserva.contacto) }, 'Modificar o cancelar'),
      ),
      comprobante.opciones,
    );
    resultado.classList.remove('hidden');
    resultado.focus({ preventScroll: true });
    resultado.scrollIntoView({ block: 'start' });
  }

  /** Confirmación simulada: cuando llega el momento, se vuelve a leer la reserva y se actualiza el estado. */
  let esperaConfirmacion = null;
  function esperarConfirmacion(reserva, estadoTexto, notaEstado) {
    clearTimeout(esperaConfirmacion);
    if (reserva.estado !== 'pendiente' || !reserva.confirmarEn) return;
    esperaConfirmacion = setTimeout(async () => {
      try {
        const actual = await servicio.buscarReserva(reserva.codigo, reserva.contacto);
        estadoTexto.textContent = TEXTO_ESTADO_RESERVA[actual.estado];
        if (actual.estado === 'confirmada') {
          estadoTexto.classList.add('text-hierbas');
          notaEstado.textContent = 'Confirmación simulada: en la versión real la confirma el personal del restaurante.';
        }
      } catch {
        // si ya no existe (por ejemplo, se canceló), se deja el texto como estaba
      }
    }, Math.max(0, reserva.confirmarEn - Date.now()) + 300);
  }

  const fila = (titulo, valor) => h('div', {}, h('dt', { class: 'text-[0.88rem] font-semibold text-carbon-suave' }, titulo), h('dd', { class: 'font-bold' }, valor));

  function reiniciar() {
    clearTimeout(esperaConfirmacion);
    if (estado.retencion) soltarRetencion();
    estado.fecha = null;
    estado.hora = null;
    estado.edicion = null;
    form.reset();
    ['nombre', 'contacto'].forEach((n) => mostrarError(n, ''));
    errorGeneral.textContent = '';
    botonEnviar.textContent = TEXTO.enviar;
    $('[data-resumen-fecha]', raiz).textContent = '';
    $('[data-modo-edicion]', raiz).classList.add('hidden');
    $('[data-modo-edicion]', raiz).classList.remove('flex');
    pasos.fecha.dataset.estado = 'activo';
    contenedorHoras.replaceChildren();
    actualizarPasoDatos();
    resultado.classList.add('hidden');
    lista.hidden = false;
    cargarMes();
  }

  $('[data-cancelar-edicion]', raiz).addEventListener('click', reiniciar);

  /* ---------- API para otras secciones ---------- */
  function irA({ fecha, hora = null, personas }) {
    if (personas && personas !== estado.personas) {
      estado.personas = Math.min(RESERVAS.maxPersonasEnLinea, Math.max(RESERVAS.minPersonas, personas));
      pintarPersonas();
      estado.estadosMes = {};
    }
    lista.hidden = false;
    resultado.classList.add('hidden');
    const mes = primerDiaMes(fecha);
    if (mes !== estado.mes || !Object.keys(estado.estadosMes).length) {
      estado.mes = mes;
      cargarMes().then(() => elegirFecha(fecha, hora));
    } else {
      elegirFecha(fecha, hora);
    }
    document.getElementById('reservas').scrollIntoView({ block: 'start' });
  }

  function editar(reserva, contacto) {
    estado.edicion = { codigo: reserva.codigo, contacto };
    estado.personas = reserva.personas;
    pintarPersonas();
    campos.nombre.value = reserva.nombre ?? '';
    campos.contacto.value = reserva.contacto ?? contacto;
    campos.comentarios.value = reserva.comentarios ?? '';
    botonEnviar.textContent = TEXTO.guardar;
    const banda = $('[data-modo-edicion]', raiz);
    $('[data-modo-edicion-texto]', raiz).textContent = `Modificando la reserva ${reserva.codigo}`;
    banda.classList.remove('hidden');
    banda.classList.add('flex');
    irA({ fecha: reserva.fecha, hora: reserva.hora });
  }

  botonEnviar.textContent = TEXTO.enviar;
  pintarPersonas();
  cargarMes();
  return { irA, editar, diasHasta: (f) => diferenciaDias(hoy(), f) };
}
