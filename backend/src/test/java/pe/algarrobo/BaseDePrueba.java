package pe.algarrobo;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.flyway.autoconfigure.FlywayMigrationStrategy;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;

/**
 * Base de las pruebas de integración: PostgreSQL real (algarrobo_test), esquema recreado al
 * arrancar y reloj fijo en el martes 3 de noviembre de 2026 a las 10:00 de Lima.
 */
@SpringBootTest
@ActiveProfiles("test")
@Import(BaseDePrueba.Ajustes.class)
public abstract class BaseDePrueba {

    /** Martes 3 de noviembre de 2026, 10:00 en Lima (15:00 UTC). */
    public static final Instant AHORA = Instant.parse("2026-11-03T15:00:00Z");

    private static boolean esquemaLimpio = false;

    @Autowired
    protected JdbcClient jdbc;

    @TestConfiguration
    static class Ajustes {
        @Bean
        @Primary
        Clock relojFijo() {
            return Clock.fixed(AHORA, ZoneOffset.UTC);
        }

        /**
         * Esquema limpio UNA vez por ejecución: así las pruebas no dependen de datos anteriores. Si cada
         * contexto de Spring limpiara al arrancar, las conexiones abiertas por otro contexto quedarían
         * apuntando a tipos que ya no existen.
         */
        @Bean
        FlywayMigrationStrategy limpiarYMigrar() {
            return flyway -> {
                synchronized (BaseDePrueba.class) {
                    if (!esquemaLimpio) {
                        flyway.clean();
                        esquemaLimpio = true;
                    }
                }
                flyway.migrate();
            };
        }
    }

    @BeforeEach
    void vaciarReservas() {
        jdbc.sql("TRUNCATE reservas, retenciones, reservas_historial, avisos RESTART IDENTITY CASCADE").update();
    }
}
