package pe.algarrobo.motor;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

/** El momento actual en hora de Lima, como lo usa el motor: fecha y minutos desde medianoche. */
public record Ahora(LocalDate fecha, int minutos) {

    public static final ZoneId LIMA = ZoneId.of("America/Lima");

    public static Ahora de(Clock reloj) {
        LocalDateTime local = LocalDateTime.now(reloj.withZone(LIMA));
        return new Ahora(local.toLocalDate(), local.getHour() * 60 + local.getMinute());
    }
}
