package pe.algarrobo.reservas;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import pe.algarrobo.BaseDePrueba;

/** Plazo de conservación: a los 12 meses de su fecha, una reserva pierde nombre, contacto y comentarios. */
class PrivacidadTest extends BaseDePrueba {

    @Autowired
    PrivacidadServicio privacidad;

    void insertar(String codigo, String fecha) {
        jdbc.sql("""
                INSERT INTO reservas (codigo, fecha, hora, duracion_minutos, personas, mesa_id, turno_id, estado,
                                      nombre, contacto, contacto_normalizado, comentarios)
                VALUES (?, CAST(? AS date), '20:00', 90, 4, 'M7', 'cena', 'completada', 'Ana Quispe', '987654321', '987654321', 'Cumpleaños')
                """).params(codigo, fecha).update();
        jdbc.sql("INSERT INTO avisos (codigo, motivo, destino, mensaje) VALUES (?, 'confirmada', '987654321', 'Tu reserva está confirmada')")
                .param(codigo).update();
        jdbc.sql("INSERT INTO reservas_historial (codigo, desde, hacia, detalle) VALUES (?, 'confirmada', 'completada', 'Llegó con Ana')")
                .param(codigo).update();
    }

    Map<String, Object> fila(String codigo) {
        return jdbc.sql("SELECT nombre, contacto, contacto_normalizado, comentarios, personas, estado::text AS estado FROM reservas WHERE codigo = ?")
                .param(codigo).query().singleRow();
    }

    @Test
    void lasReservasDeHaceMasDeUnAnoPierdenSusDatosPersonalesYLasRecientesNo() {
        // Hoy, en las pruebas, es el 3 de noviembre de 2026: el límite es el 3 de noviembre de 2025.
        insertar("ALG-AAAAA", "2025-11-02");
        insertar("ALG-CCCCC", "2025-11-03");

        assertThat(privacidad.anonimizarAntiguas()).isEqualTo(1);

        Map<String, Object> vieja = fila("ALG-AAAAA");
        assertThat(vieja.get("nombre")).isEqualTo("Cliente anónimo");
        assertThat(vieja.get("contacto")).isEqualTo(PrivacidadServicio.ANONIMO);
        assertThat(vieja.get("comentarios")).isEqualTo("");
        assertThat(((Number) vieja.get("personas")).intValue()).isEqualTo(4); // lo útil para estadísticas se conserva
        assertThat(vieja.get("estado")).isEqualTo("completada");
        assertThat(jdbc.sql("SELECT destino FROM avisos WHERE codigo = 'ALG-AAAAA'").query(String.class).single()).isEqualTo(PrivacidadServicio.ANONIMO);
        assertThat(jdbc.sql("SELECT detalle FROM reservas_historial WHERE codigo = 'ALG-AAAAA'").query(String.class).optional()).isEmpty();

        assertThat(fila("ALG-CCCCC").get("nombre")).isEqualTo("Ana Quispe");

        // Volver a ejecutar no cambia nada más
        assertThat(privacidad.anonimizarAntiguas()).isZero();
    }
}
