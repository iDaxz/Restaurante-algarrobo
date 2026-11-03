// Cliente de la API del panel. Usa la cookie de sesión (HttpOnly, la pone el servidor) y devuelve en
// cada petición que modifica datos el token CSRF que el servidor deja en la cookie XSRF-TOKEN.

const BASE = '/api/v1';

export class ErrorPanel extends Error {
  constructor(estado, cuerpo) {
    super(cuerpo?.mensaje ?? 'Tuvimos un problema al procesar la solicitud.');
    this.estado = estado;
    this.codigo = cuerpo?.codigo ?? 'ERROR_INTERNO';
    this.errores = cuerpo?.errores ?? {};
  }
}

const tokenCsrf = () => document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN='))?.slice(11) ?? '';

/** Si la sesión caduca, el panel vuelve a la pantalla de acceso. */
let alPerderSesion = () => {};
export const siSePierdeLaSesion = (fn) => { alPerderSesion = fn; };

export async function llamar(metodo, ruta, cuerpo) {
  let respuesta;
  // Un FormData (subida de fotos) se envía tal cual: el navegador pone el tipo multipart y su separador.
  const esArchivo = cuerpo instanceof FormData;
  try {
    respuesta = await fetch(BASE + ruta, {
      method: metodo,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(cuerpo !== undefined && !esArchivo ? { 'Content-Type': 'application/json' } : {}),
        ...(metodo !== 'GET' ? { 'X-XSRF-TOKEN': decodeURIComponent(tokenCsrf()) } : {}),
      },
      body: cuerpo === undefined ? undefined : esArchivo ? cuerpo : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorPanel(0, { codigo: 'SIN_CONEXION', mensaje: 'No hay conexión con el servidor. Revisa la red y vuelve a intentarlo.' });
  }
  if (respuesta.status === 204) return null;
  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    const error = new ErrorPanel(respuesta.status, datos);
    if (respuesta.status === 401 && !ruta.startsWith('/admin/sesion')) alPerderSesion();
    throw error;
  }
  return datos;
}

const q = (params) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') u.set(k, v);
  return u.toString();
};

export const api = {
  configuracion: () => llamar('GET', '/configuracion'),
  sesion: () => llamar('GET', '/admin/sesion'),
  entrar: (correo, clave) => llamar('POST', '/admin/sesion', { correo, clave }),
  salir: () => llamar('DELETE', '/admin/sesion'),
  reservas: (filtro) => llamar('GET', `/admin/reservas?${q(filtro)}`),
  detalle: (codigo) => llamar('GET', `/admin/reservas/${encodeURIComponent(codigo)}`),
  accion: (codigo, accion, motivo) => llamar('POST', `/admin/reservas/${encodeURIComponent(codigo)}/${accion}`, motivo ? { motivo } : {}),
  crear: (datos) => llamar('POST', '/admin/reservas', datos),
  mesas: (fecha, hora) => llamar('GET', `/admin/mesas?${q({ fecha, hora })}`),
  cambiarMiClave: (actual, nueva) => llamar('PUT', '/admin/sesion/clave', { actual, nueva }),

  // Ajustes (solo administradores)
  ajustes: () => llamar('GET', '/admin/ajustes'),
  guardarPoliticas: (p) => llamar('PUT', '/admin/ajustes/politicas', p),
  guardarTurnos: (t) => llamar('PUT', '/admin/ajustes/turnos', t),
  crearMesa: (m) => llamar('POST', '/admin/ajustes/mesas', m),
  editarMesa: (id, m) => llamar('PUT', `/admin/ajustes/mesas/${encodeURIComponent(id)}`, m),
  cerrarDia: (d) => llamar('POST', '/admin/ajustes/dias', d),
  abrirDia: (fecha) => llamar('DELETE', `/admin/ajustes/dias/${encodeURIComponent(fecha)}`),
  carta: () => llamar('GET', '/admin/carta'),
  crearPlato: (p) => llamar('POST', '/admin/carta/platos', p),
  editarPlato: (id, p) => llamar('PUT', `/admin/carta/platos/${encodeURIComponent(id)}`, p),
  platoDisponible: (id, disponible) => llamar('PATCH', `/admin/carta/platos/${encodeURIComponent(id)}`, { disponible }),
  borrarPlato: (id) => llamar('DELETE', `/admin/carta/platos/${encodeURIComponent(id)}`),
  fotos: () => llamar('GET', '/admin/fotos'),
  subirFoto: (archivo) => {
    const datos = new FormData();
    datos.append('archivo', archivo);
    return llamar('POST', '/admin/fotos', datos);
  },
  borrarFoto: (id) => llamar('DELETE', `/admin/fotos/${id}`),
  cuentas: () => llamar('GET', '/admin/usuarios'),
  crearCuenta: (c) => llamar('POST', '/admin/usuarios', c),
  editarCuenta: (id, c) => llamar('PATCH', `/admin/usuarios/${id}`, c),
  reiniciarClave: (id, clave) => llamar('POST', `/admin/usuarios/${id}/clave`, { clave }),
};
