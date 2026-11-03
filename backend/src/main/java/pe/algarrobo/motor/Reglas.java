package pe.algarrobo.motor;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;

/** Configuración del restaurante que usa el motor (en la base: configuracion, turnos y mesas). */
public record Reglas(
        List<Turno> turnos,
        List<Mesa> mesas,
        Set<Integer> diasCerrados,          // 0 = domingo … 6 = sábado
        int duracionMinutos,
        int intervaloMinutos,
        int ventanaDias,
        int minPersonas,
        int maxPersonasEnLinea,
        int holguraAsientos,
        int horasParaCambios,
        int toleranciaMinutos,
        double umbralLimitado,
        int maxReservasActivasPorContacto,
        int retencionMinutos,
        Set<LocalDate> fechasCerradas) {     // días especiales: fechas concretas sin atención

    public Reglas {
        turnos = List.copyOf(turnos);
        mesas = List.copyOf(mesas);
        diasCerrados = Set.copyOf(diasCerrados);
        fechasCerradas = fechasCerradas == null ? Set.of() : Set.copyOf(fechasCerradas);
    }

    /** Las mismas reglas con otras políticas, turnos o mesas (para comprobar un cambio antes de guardarlo). */
    public Reglas con(List<Turno> nuevosTurnos, List<Mesa> nuevasMesas, Set<Integer> nuevosDiasCerrados, int duracion, int intervalo) {
        return new Reglas(nuevosTurnos, nuevasMesas, nuevosDiasCerrados, duracion, intervalo, ventanaDias, minPersonas,
                maxPersonasEnLinea, holguraAsientos, horasParaCambios, toleranciaMinutos, umbralLimitado,
                maxReservasActivasPorContacto, retencionMinutos, fechasCerradas);
    }

    public record Turno(String id, String nombre, LocalTime inicio, LocalTime fin) {
    }

    public record Mesa(String id, int asientos, String nombre) {
    }
}
