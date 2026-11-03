package pe.algarrobo.motor;

/** Un horario del día para un grupo: estado 'libre' | 'completo' | 'pasado'. */
public record Horario(String hora, String turno, String estado, int mesasLibres) {
}
