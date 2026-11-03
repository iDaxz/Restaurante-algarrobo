package pe.algarrobo.reservas;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;

import pe.algarrobo.motor.EstadoReserva;

/** Una fila de la tabla reservas. */
public record ReservaFila(
        String codigo,
        LocalDate fecha,
        LocalTime hora,
        int duracionMinutos,
        int personas,
        String mesaId,
        String turnoId,
        EstadoReserva estado,
        String nombre,
        String contacto,
        String contactoNormalizado,
        String comentarios,
        OffsetDateTime creada,
        String origen,              // 'web' o 'panel'
        String codigoPrincipal) {   // solo en las mesas anexas de un grupo grande

    /** Reserva hecha desde el sitio, sin mesas anexas. */
    public ReservaFila(String codigo, LocalDate fecha, LocalTime hora, int duracionMinutos, int personas, String mesaId,
                       String turnoId, EstadoReserva estado, String nombre, String contacto, String contactoNormalizado,
                       String comentarios, OffsetDateTime creada) {
        this(codigo, fecha, hora, duracionMinutos, personas, mesaId, turnoId, estado, nombre, contacto,
                contactoNormalizado, comentarios, creada, "web", null);
    }

    public ReservaFila conEstado(EstadoReserva nuevo) {
        return new ReservaFila(codigo, fecha, hora, duracionMinutos, personas, mesaId, turnoId, nuevo,
                nombre, contacto, contactoNormalizado, comentarios, creada, origen, codigoPrincipal);
    }
}
