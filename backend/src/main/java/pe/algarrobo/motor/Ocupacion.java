package pe.algarrobo.motor;

import java.time.LocalTime;

/**
 * Algo que ocupa una mesa en un horario: una reserva activa o una mesa retenida.
 * "codigo" sirve para excluir la propia reserva al modificarla.
 */
public record Ocupacion(String codigo, String mesaId, LocalTime hora) {
}
