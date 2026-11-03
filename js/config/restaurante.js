// Configuración de demostración del restaurante.
// Todos los valores son ficticios y se reemplazarán por los que entregue la API (etapa 3).

export const RESTAURANTE = {
  nombre: 'Algarrobo',
  nombreLargo: 'Algarrobo · Cocina Norteña',
  zonaHoraria: 'America/Lima',
  direccion: 'Jr. Algarrobal 214, Barranco, Lima',
  telefono: '+51 900 000 000',
  telefonoHref: 'tel:+51900000000',
  correo: 'reservas@algarrobo.demo',
  mapaUrl: 'https://www.google.com/maps/search/?api=1&query=Barranco%2C+Lima%2C+Per%C3%BA',
  redes: [
    { nombre: 'Instagram', usuario: '@algarrobo.demo' },
    { nombre: 'Facebook', usuario: 'Algarrobo Cocina Norteña (demo)' },
    { nombre: 'TikTok', usuario: '@algarrobo.demo' },
  ],
};

/**
 * De dónde salen las reservas:
 * - 'auto': si la página la sirve el backend (responde /api/v1/configuracion), se usa la API; si no
 *   (por ejemplo, en un hosting estático como GitHub Pages), la demostración en este navegador.
 * - 'demo': siempre la demostración (localStorage).
 * - 'api':  la API; si no responde, se usa la demostración y se avisa en la consola.
 * Para probar, la URL acepta ?modo=demo o ?modo=api.
 */
export const MODO_RESERVAS = 'auto';

export const RESERVAS = {
  // 0 = domingo … 6 = sábado. Los lunes se descansa.
  diasCerrados: [1],
  turnos: [
    { id: 'almuerzo', nombre: 'Almuerzo', inicio: '12:00', fin: '16:30' },
    { id: 'cena', nombre: 'Cena', inicio: '19:00', fin: '23:00' },
  ],
  duracionMinutos: 90,
  intervaloMinutos: 30,
  ventanaDias: 60,
  minPersonas: 1,
  maxPersonasEnLinea: 8,
  // Un grupo puede ocupar una mesa con, como mucho, este número de asientos libres.
  holguraAsientos: 2,
  // Horas mínimas de anticipación para modificar o cancelar.
  horasParaCambios: 3,
  toleranciaMinutos: 15,
  // Por debajo de este porcentaje de mesas libres el día se marca como "pocas mesas".
  umbralLimitado: 0.3,
  // Reglas contra duplicados y abuso: un mismo contacto no puede tener reservas que se crucen,
  // ni más de este número de reservas activas (pendientes o confirmadas) a futuro.
  maxReservasActivasPorContacto: 3,
  // "Mis reservas": las anteriores y canceladas se quitan solas este número de días después de su fecha.
  diasHistorialCliente: 30,
  // Minutos que la mesa queda apartada mientras el cliente completa sus datos.
  retencionMinutos: 5,
  // Solo en la demo: segundos tras los que una reserva pendiente pasa a confirmada (simulando al personal).
  confirmacionSimuladaSegundos: 8,
  mesas: [
    { id: 'M1', asientos: 2 }, { id: 'M2', asientos: 2 }, { id: 'M3', asientos: 2 },
    { id: 'M4', asientos: 2 }, { id: 'M5', asientos: 2 }, { id: 'M6', asientos: 2 },
    { id: 'M7', asientos: 4 }, { id: 'M8', asientos: 4 }, { id: 'M9', asientos: 4 },
    { id: 'M10', asientos: 4 }, { id: 'M11', asientos: 4 },
    { id: 'M12', asientos: 6 }, { id: 'M13', asientos: 6 },
    { id: 'M14', asientos: 8, nombre: 'Mesa larga' },
  ],
  // Feriados con demanda alta (MM-DD). El restaurante abre, pero se llena antes.
  feriados: ['01-01', '05-01', '06-29', '07-28', '07-29', '08-30', '10-08', '11-01', '12-08', '12-25'],
};
