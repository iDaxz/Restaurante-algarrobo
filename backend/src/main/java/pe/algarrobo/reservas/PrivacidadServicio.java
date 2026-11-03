package pe.algarrobo.reservas;

import java.time.Clock;
import java.time.LocalDate;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import pe.algarrobo.motor.Ahora;

/**
 * Plazo de conservación de datos personales: pasados algarrobo.privacidad.meses-conservacion meses
 * desde la fecha de una reserva, se borran el nombre, el contacto y los comentarios (también en sus
 * avisos y en los motivos del historial). Quedan fecha, hora, personas, mesa y estado, que bastan
 * para las estadísticas del restaurante. Se ejecuta cada madrugada.
 */
@Service
public class PrivacidadServicio {

    public static final String ANONIMO = "anonimizado";
    private static final Logger log = LoggerFactory.getLogger(PrivacidadServicio.class);

    private final JdbcClient jdbc;
    private final Clock reloj;
    private final int meses;

    public PrivacidadServicio(JdbcClient jdbc, Clock reloj, @Value("${algarrobo.privacidad.meses-conservacion:12}") int meses) {
        this.jdbc = jdbc;
        this.reloj = reloj;
        this.meses = meses;
    }

    /** Fecha a partir de la cual se conservan los datos: las reservas anteriores se anonimizan. */
    public LocalDate limite() {
        return Ahora.de(reloj).fecha().minusMonths(meses);
    }

    @Scheduled(cron = "0 30 3 * * *", zone = "America/Lima")
    @Transactional
    public int anonimizarAntiguas() {
        LocalDate limite = limite();
        int reservas = jdbc.sql("""
                UPDATE reservas
                   SET nombre = 'Cliente anónimo', contacto = :anonimo, contacto_normalizado = :anonimo || '-' || codigo,
                       comentarios = '', actualizada = now()
                 WHERE fecha < :limite AND contacto <> :anonimo
                """).param("anonimo", ANONIMO).param("limite", limite).update();
        jdbc.sql("""
                UPDATE avisos SET destino = :anonimo, mensaje = '(mensaje eliminado por antigüedad)'
                 WHERE destino <> :anonimo AND codigo IN (SELECT codigo FROM reservas WHERE fecha < :limite)
                """).param("anonimo", ANONIMO).param("limite", limite).update();
        jdbc.sql("""
                UPDATE reservas_historial SET detalle = NULL
                 WHERE detalle IS NOT NULL AND codigo IN (SELECT codigo FROM reservas WHERE fecha < :limite)
                """).param("limite", limite).update();
        if (reservas > 0) log.info("Datos personales eliminados de {} reservas anteriores al {}", reservas, limite);
        return reservas;
    }
}
