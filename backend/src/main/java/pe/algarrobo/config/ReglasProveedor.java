package pe.algarrobo.config;

import java.math.BigDecimal;
import java.sql.Array;
import java.sql.SQLException;
import java.time.LocalTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import pe.algarrobo.motor.Motor;
import pe.algarrobo.motor.Reglas;

/**
 * Lee la configuración del restaurante (tablas configuracion, turnos y mesas) y la mantiene en
 * memoria. El panel llamará a recargar() cuando el personal la cambie (etapa 3d).
 */
@Component
public class ReglasProveedor {

    private final JdbcClient jdbc;
    private final AtomicReference<Motor> motor = new AtomicReference<>();

    public ReglasProveedor(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Motor motor() {
        Motor actual = motor.get();
        if (actual == null) {
            actual = new Motor(leer());
            motor.compareAndSet(null, actual);
        }
        return actual;
    }

    public Reglas reglas() {
        return motor().reglas();
    }

    public void recargar() {
        motor.set(new Motor(leer()));
    }

    private Reglas leer() {
        List<Reglas.Turno> turnos = jdbc.sql("SELECT id, nombre, inicio, fin FROM turnos ORDER BY orden")
                .query((rs, i) -> new Reglas.Turno(rs.getString("id"), rs.getString("nombre"),
                        rs.getObject("inicio", LocalTime.class), rs.getObject("fin", LocalTime.class)))
                .list();
        List<Reglas.Mesa> mesas = jdbc.sql("SELECT id, asientos, nombre FROM mesas WHERE activa ORDER BY orden")
                .query((rs, i) -> new Reglas.Mesa(rs.getString("id"), rs.getInt("asientos"), rs.getString("nombre")))
                .list();
        // Solo los días especiales desde ayer en adelante: los pasados ya no influyen en nada.
        Set<java.time.LocalDate> fechasCerradas = new HashSet<>(jdbc.sql("SELECT fecha FROM dias_especiales WHERE fecha >= current_date - 1")
                .query(java.time.LocalDate.class).list());
        return jdbc.sql("SELECT * FROM configuracion WHERE id = 1")
                .query((rs, i) -> new Reglas(turnos, mesas, dias(rs.getArray("dias_cerrados")),
                        rs.getInt("duracion_minutos"), rs.getInt("intervalo_minutos"), rs.getInt("ventana_dias"),
                        rs.getInt("min_personas"), rs.getInt("max_personas_en_linea"), rs.getInt("holgura_asientos"),
                        rs.getInt("horas_para_cambios"), rs.getInt("tolerancia_minutos"),
                        rs.getObject("umbral_limitado", BigDecimal.class).doubleValue(),
                        rs.getInt("max_reservas_activas_contacto"), rs.getInt("retencion_minutos"), fechasCerradas))
                .single();
    }

    private static Set<Integer> dias(Array arreglo) throws SQLException {
        Set<Integer> dias = new HashSet<>();
        for (Object d : (Object[]) arreglo.getArray()) dias.add(((Number) d).intValue());
        return dias;
    }
}
