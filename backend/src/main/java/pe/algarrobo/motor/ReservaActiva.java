package pe.algarrobo.motor;

import java.time.LocalDate;
import java.time.LocalTime;

/** Lo que el motor necesita de una reserva existente del mismo contacto. */
public record ReservaActiva(String codigo, LocalDate fecha, LocalTime hora, EstadoReserva estado) {
}
