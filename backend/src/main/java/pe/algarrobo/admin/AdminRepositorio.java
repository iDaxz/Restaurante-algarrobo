package pe.algarrobo.admin;

import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import pe.algarrobo.motor.EstadoReserva;
import pe.algarrobo.motor.Motor;

/** Consultas del panel: listados con filtros, historial y avisos. */
@Repository
public class AdminRepositorio {

    private final JdbcClient jdbc;

    public AdminRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Una reserva tal como la ve el personal: estado real (sin "completada" automática) y todas sus mesas. */
    public record ReservaAdmin(
            String codigo, String fecha, String hora, String horaFin, int personas, List<String> mesas,
            String turno, String estado, String nombre, String contacto, String comentarios, String origen,
            String creada, boolean pasada) {
    }

    public record Filtro(LocalDate desde, LocalDate hasta, List<EstadoReserva> estados, String turno, String texto) {
    }

    public List<ReservaAdmin> listar(Filtro f, LocalDate hoy, int minutosAhora) {
        StringBuilder sql = new StringBuilder("""
                SELECT r.*, (SELECT array_agg(a.mesa_id ORDER BY m.orden) FROM reservas a JOIN mesas m ON m.id = a.mesa_id WHERE a.codigo_principal = r.codigo) AS anexas
                  FROM reservas r
                 WHERE r.codigo_principal IS NULL AND r.fecha BETWEEN :desde AND :hasta
                """);
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("desde", f.desde());
        params.put("hasta", f.hasta());
        if (f.estados() != null && !f.estados().isEmpty()) {
            sql.append(" AND r.estado::text IN (:estados)");
            params.put("estados", f.estados().stream().map(EstadoReserva::texto).toList());
        }
        if (f.turno() != null && !f.turno().isBlank()) {
            sql.append(" AND r.turno_id = :turno");
            params.put("turno", f.turno());
        }
        if (f.texto() != null && !f.texto().isBlank()) {
            sql.append(" AND (r.codigo ILIKE :texto OR r.nombre ILIKE :texto OR r.contacto ILIKE :texto OR r.contacto_normalizado ILIKE :texto)");
            params.put("texto", "%" + f.texto().strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%");
        }
        sql.append(" ORDER BY r.fecha, r.hora, r.creada LIMIT 2000");
        return jdbc.sql(sql.toString()).params(params).query((rs, i) -> fila(rs, hoy, minutosAhora)).list();
    }

    public java.util.Optional<ReservaAdmin> buscar(String codigo, LocalDate hoy, int minutosAhora) {
        return jdbc.sql("""
                SELECT r.*, (SELECT array_agg(a.mesa_id ORDER BY m.orden) FROM reservas a JOIN mesas m ON m.id = a.mesa_id WHERE a.codigo_principal = r.codigo) AS anexas
                  FROM reservas r WHERE r.codigo = ? AND r.codigo_principal IS NULL
                """).param(codigo).query((rs, i) -> fila(rs, hoy, minutosAhora)).optional();
    }

    private static ReservaAdmin fila(ResultSet rs, LocalDate hoy, int minutosAhora) throws SQLException {
        LocalDate fecha = rs.getObject("fecha", LocalDate.class);
        LocalTime hora = rs.getObject("hora", LocalTime.class);
        int duracion = rs.getInt("duracion_minutos");
        List<String> mesas = new ArrayList<>();
        mesas.add(rs.getString("mesa_id"));
        Array anexas = rs.getArray("anexas");
        if (anexas != null) for (Object m : (Object[]) anexas.getArray()) mesas.add((String) m);
        long hasta = Motor.minutosHastaLlegada(fecha, hora, new pe.algarrobo.motor.Ahora(hoy, minutosAhora));
        return new ReservaAdmin(rs.getString("codigo"), fecha.toString(), Motor.aHora(Motor.aMinutos(hora)),
                Motor.aHora(Math.min(Motor.aMinutos(hora) + duracion, 24 * 60 - 1)), rs.getInt("personas"), mesas,
                rs.getString("turno_id"), rs.getString("estado"), rs.getString("nombre"), rs.getString("contacto"),
                rs.getString("comentarios"), rs.getString("origen"),
                rs.getObject("creada", OffsetDateTime.class).toInstant().toString(), hasta + duracion <= 0);
    }

    public record Cambio(String desde, String hacia, String detalle, String usuario, String momento) {
    }

    public List<Cambio> historial(String codigo) {
        return jdbc.sql("""
                SELECT h.desde::text, h.hacia::text, h.detalle, u.nombre, h.momento
                  FROM reservas_historial h LEFT JOIN usuarios_admin u ON u.id = h.usuario_id
                 WHERE h.codigo = ? ORDER BY h.momento, h.id
                """).param(codigo)
                .query((rs, i) -> new Cambio(rs.getString(1), rs.getString(2), rs.getString(3),
                        rs.getString(4) == null ? "Cliente" : rs.getString(4),
                        rs.getObject(5, OffsetDateTime.class).toInstant().toString()))
                .list();
    }

    public record Aviso(String motivo, String destino, String mensaje, boolean enviado, String creado) {
    }

    public List<Aviso> avisos(String codigo) {
        return jdbc.sql("SELECT motivo, destino, mensaje, enviado, creado FROM avisos WHERE codigo = ? ORDER BY creado, id")
                .param(codigo)
                .query((rs, i) -> new Aviso(rs.getString(1), rs.getString(2), rs.getString(3), rs.getBoolean(4),
                        rs.getObject(5, OffsetDateTime.class).toInstant().toString()))
                .list();
    }
}
