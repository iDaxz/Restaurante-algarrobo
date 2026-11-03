// Errores de reserva con código estable. El backend (etapa 3) responderá con estos mismos códigos,
// así la interfaz no cambia al pasar del servicio de demostración a la API real.

export const CODIGOS = Object.freeze({
  DATOS_INVALIDOS: 'DATOS_INVALIDOS',           // nombre, contacto o personas mal escritos
  GRUPO_GRANDE: 'GRUPO_GRANDE',                 // más personas de las que se aceptan en línea
  FECHA_PASADA: 'FECHA_PASADA',
  FECHA_FUERA_DE_PLAZO: 'FECHA_FUERA_DE_PLAZO', // más allá de la ventana de reservas
  DIA_CERRADO: 'DIA_CERRADO',
  HORARIO_INVALIDO: 'HORARIO_INVALIDO',         // fuera de los turnos
  HORARIO_PASADO: 'HORARIO_PASADO',
  HORARIO_LLENO: 'HORARIO_LLENO',               // no queda mesa compatible a esa hora
  CONTACTO_DUPLICADO: 'CONTACTO_DUPLICADO',     // el mismo contacto ya tiene una reserva que se cruza
  LIMITE_RESERVAS: 'LIMITE_RESERVAS',           // demasiadas reservas activas para un contacto
  NO_ENCONTRADA: 'NO_ENCONTRADA',
  FUERA_DE_PLAZO_CAMBIOS: 'FUERA_DE_PLAZO_CAMBIOS', // faltan menos horas de las permitidas para cambiar
  TRANSICION_INVALIDA: 'TRANSICION_INVALIDA',   // cambio de estado no permitido
  RETENCION_VENCIDA: 'RETENCION_VENCIDA',       // la mesa apartada se liberó por tiempo
  MESA_INVALIDA: 'MESA_INVALIDA',               // la mesa elegida en el plano no es del tamaño del grupo
  MESA_OCUPADA: 'MESA_OCUPADA',                 // alguien tomó la mesa elegida en el plano
  ALMACENAMIENTO: 'ALMACENAMIENTO',             // el navegador no deja guardar (solo demo)
  DEMASIADAS_PETICIONES: 'DEMASIADAS_PETICIONES', // límite por IP del servidor
  SIN_CONEXION: 'SIN_CONEXION',                 // no se pudo hablar con el servidor (solo API)
  ERROR_INTERNO: 'ERROR_INTERNO',               // fallo inesperado del servidor
});

export class ErrorReserva extends Error {
  /**
   * @param {string} codigo uno de CODIGOS
   * @param {string} mensaje texto para la persona
   * @param {{ errores?: Record<string,string>, alternativas?: object|null }} extra
   */
  constructor(codigo, mensaje, { errores = {}, alternativas = null } = {}) {
    super(mensaje);
    this.name = 'ErrorReserva';
    this.codigo = codigo;
    this.errores = errores;
    this.alternativas = alternativas;
  }

  /** Forma JSON que devolverá la API: { codigo, mensaje, errores, alternativas } */
  toJSON() {
    return { codigo: this.codigo, mensaje: this.message, errores: this.errores, alternativas: this.alternativas };
  }
}
