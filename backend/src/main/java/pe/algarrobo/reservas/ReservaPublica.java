package pe.algarrobo.reservas;

/**
 * Lo que la API devuelve de una reserva: la misma forma que publica() en js/services/reservas-demo.js,
 * para que el frontend funcione igual con la demo o con el servidor.
 */
public record ReservaPublica(
        String codigo,
        String fecha,
        String hora,
        int personas,
        String mesa,
        Integer mesaAsientos,
        String mesaNombre,
        String turno,
        String estado,
        String nombre,
        String contacto,
        String comentarios,
        String creada,
        boolean confirmadaSimulada,
        boolean modificable) {
}
