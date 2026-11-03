package pe.algarrobo.motor;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/**
 * Ciclo de vida de una reserva (igual que js/core/estados.js).
 *
 *   pendiente ──► confirmada ──► completada
 *       │              │   └──► no_asistio
 *       └──► cancelada ◄┘
 */
public enum EstadoReserva {
    PENDIENTE, CONFIRMADA, CANCELADA, COMPLETADA, NO_ASISTIO;

    /** Estados que la persona todavía puede modificar o cancelar, y que ocupan mesa. */
    public static final Set<EstadoReserva> ACTIVOS = EnumSet.of(PENDIENTE, CONFIRMADA);

    private static final Map<EstadoReserva, Set<EstadoReserva>> TRANSICIONES = Map.of(
            PENDIENTE, EnumSet.of(CONFIRMADA, CANCELADA),
            CONFIRMADA, EnumSet.of(COMPLETADA, CANCELADA, NO_ASISTIO),
            CANCELADA, EnumSet.noneOf(EstadoReserva.class),
            COMPLETADA, EnumSet.noneOf(EstadoReserva.class),
            NO_ASISTIO, EnumSet.noneOf(EstadoReserva.class));

    public boolean esActivo() {
        return ACTIVOS.contains(this);
    }

    public boolean puedePasarA(EstadoReserva hacia) {
        return TRANSICIONES.get(this).contains(hacia);
    }

    /** Lanza TRANSICION_INVALIDA si el cambio no está permitido. */
    public void exigirTransicion(EstadoReserva hacia) {
        if (!puedePasarA(hacia)) {
            throw new ErrorReserva(CodigoError.TRANSICION_INVALIDA,
                    "Una reserva " + nombre() + " no puede pasar a " + hacia.nombre() + ".");
        }
    }

    /** Nombre en la API y en la base de datos: 'pendiente', 'confirmada'… */
    public String texto() {
        return name().toLowerCase();
    }

    /** Para los mensajes: 'no asistió' en lugar de 'no_asistio'. */
    public String nombre() {
        return this == NO_ASISTIO ? "no asistió" : texto();
    }

    public static EstadoReserva de(String texto) {
        return valueOf(texto.toUpperCase());
    }
}
