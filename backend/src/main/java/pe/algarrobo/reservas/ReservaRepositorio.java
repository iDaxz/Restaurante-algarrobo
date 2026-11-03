package pe.algarrobo.reservas;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import pe.algarrobo.motor.EstadoReserva;
import pe.algarrobo.motor.Ocupacion;
import pe.algarrobo.motor.ReservaActiva;

/** Acceso a reservas y retenciones con SQL explícito (JdbcClient). */
@Repository
public class ReservaRepositorio {

    private final JdbcClient jdbc;

    public ReservaRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    // ---------- Bloqueos ----------

    /**
     * Bloqueo exclusivo hasta el final de la transacción para un día (o un contacto). Quien quiera
     * reservar o apartar mesa ese día espera su turno: así validar y guardar no se mezclan con otra
     * petición simultánea. La restricción sin_choques_por_mesa sigue siendo la garantía final.
     */
    public void bloquear(String clave) {
        jdbc.sql("SELECT pg_advisory_xact_lock(hashtext(?))::text").param(clave).query(String.class).optional();
    }

    // ---------- Ocupación ----------

    /** Reservas activas de un día y mesas retenidas vigentes de otras sesiones. */
    public List<Ocupacion> ocupacionDe(LocalDate fecha, String sesionPropia, Instant ahora) {
        return jdbc.sql("""
                SELECT codigo, mesa_id, hora FROM reservas
                 WHERE fecha = :fecha AND estado IN ('pendiente', 'confirmada')
                UNION ALL
                SELECT id, mesa_id, hora FROM retenciones
                 WHERE fecha = :fecha AND expira > :ahora AND sesion IS DISTINCT FROM CAST(:sesion AS text)
                """)
                .param("fecha", fecha)
                .param("ahora", OffsetDateTime.ofInstant(ahora, ZoneOffset.UTC))
                .param("sesion", sesionPropia)
                .query((rs, i) -> new Ocupacion(rs.getString(1), rs.getString(2), rs.getObject(3, LocalTime.class)))
                .list();
    }

    /** Ocupación de varios días de una vez (para el calendario de un mes). */
    public List<OcupacionDelDia> ocupacionEntre(LocalDate desde, LocalDate hasta, String sesionPropia, Instant ahora) {
        return jdbc.sql("""
                SELECT fecha, codigo, mesa_id, hora FROM reservas
                 WHERE fecha BETWEEN :desde AND :hasta AND estado IN ('pendiente', 'confirmada')
                UNION ALL
                SELECT fecha, id, mesa_id, hora FROM retenciones
                 WHERE fecha BETWEEN :desde AND :hasta AND expira > :ahora AND sesion IS DISTINCT FROM CAST(:sesion AS text)
                """)
                .param("desde", desde).param("hasta", hasta)
                .param("ahora", OffsetDateTime.ofInstant(ahora, ZoneOffset.UTC))
                .param("sesion", sesionPropia)
                .query((rs, i) -> new OcupacionDelDia(rs.getObject(1, LocalDate.class),
                        new Ocupacion(rs.getString(2), rs.getString(3), rs.getObject(4, LocalTime.class))))
                .list();
    }

    public record OcupacionDelDia(LocalDate fecha, Ocupacion ocupacion) {
    }

    /** Reservas activas de un contacto desde ayer (las más antiguas ya no cuentan para las reglas). */
    public List<ReservaActiva> activasDelContacto(String contactoNormalizado, LocalDate desde) {
        return jdbc.sql("""
                SELECT codigo, fecha, hora, estado FROM reservas
                 WHERE contacto_normalizado = ? AND fecha >= ? AND estado IN ('pendiente', 'confirmada')
                   AND codigo_principal IS NULL
                """)
                .params(contactoNormalizado, desde)
                .query((rs, i) -> new ReservaActiva(rs.getString(1), rs.getObject(2, LocalDate.class),
                        rs.getObject(3, LocalTime.class), EstadoReserva.de(rs.getString(4))))
                .list();
    }

    // ---------- Reservas ----------

    public boolean existe(String codigo) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM reservas WHERE codigo = ?)").param(codigo).query(Boolean.class).single();
    }

    public Optional<ReservaFila> buscar(String codigo) {
        return jdbc.sql("SELECT * FROM reservas WHERE codigo = ?").param(codigo).query(ReservaRepositorio::fila).optional();
    }

    /** Igual que buscar, pero bloquea la fila hasta el final de la transacción. */
    public Optional<ReservaFila> buscarParaActualizar(String codigo) {
        return jdbc.sql("SELECT * FROM reservas WHERE codigo = ? FOR UPDATE").param(codigo).query(ReservaRepositorio::fila).optional();
    }

    public void insertar(ReservaFila r) {
        jdbc.sql("""
                INSERT INTO reservas (codigo, fecha, hora, duracion_minutos, personas, mesa_id, turno_id, estado,
                                      nombre, contacto, contacto_normalizado, comentarios, origen, codigo_principal)
                VALUES (:codigo, :fecha, :hora, :duracion, :personas, :mesa, :turno, CAST(:estado AS estado_reserva),
                        :nombre, :contacto, :normalizado, :comentarios, :origen, :principal)
                """)
                .param("origen", r.origen()).param("principal", r.codigoPrincipal())
                .param("codigo", r.codigo()).param("fecha", r.fecha()).param("hora", r.hora())
                .param("duracion", r.duracionMinutos()).param("personas", r.personas())
                .param("mesa", r.mesaId()).param("turno", r.turnoId()).param("estado", r.estado().texto())
                .param("nombre", r.nombre()).param("contacto", r.contacto())
                .param("normalizado", r.contactoNormalizado()).param("comentarios", r.comentarios())
                .update();
    }

    public void actualizar(ReservaFila r) {
        jdbc.sql("""
                UPDATE reservas SET fecha = :fecha, hora = :hora, duracion_minutos = :duracion, personas = :personas,
                       mesa_id = :mesa, turno_id = :turno, estado = CAST(:estado AS estado_reserva), nombre = :nombre,
                       contacto = :contacto, contacto_normalizado = :normalizado, comentarios = :comentarios,
                       actualizada = now()
                 WHERE codigo = :codigo
                """)
                .param("codigo", r.codigo()).param("fecha", r.fecha()).param("hora", r.hora())
                .param("duracion", r.duracionMinutos()).param("personas", r.personas())
                .param("mesa", r.mesaId()).param("turno", r.turnoId()).param("estado", r.estado().texto())
                .param("nombre", r.nombre()).param("contacto", r.contacto())
                .param("normalizado", r.contactoNormalizado()).param("comentarios", r.comentarios())
                .update();
    }

    // ---------- Grupos con varias mesas ----------

    public boolean tieneAnexas(String codigo) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM reservas WHERE codigo_principal = ?)").param(codigo).query(Boolean.class).single();
    }

    public List<String> mesasAnexas(String codigo) {
        return jdbc.sql("SELECT mesa_id FROM reservas WHERE codigo_principal = ? ORDER BY mesa_id").param(codigo).query(String.class).list();
    }

    /** Las mesas anexas siguen siempre el estado de su reserva principal. */
    public void cambiarEstadoAnexas(String codigo, EstadoReserva estado) {
        jdbc.sql("UPDATE reservas SET estado = CAST(? AS estado_reserva), actualizada = now() WHERE codigo_principal = ?")
                .params(estado.texto(), codigo)
                .update();
    }

    public void registrarHistorial(String codigo, EstadoReserva desde, EstadoReserva hacia, String detalle, Long usuarioId) {
        jdbc.sql("""
                INSERT INTO reservas_historial (codigo, desde, hacia, detalle, usuario_id)
                VALUES (?, CAST(? AS estado_reserva), CAST(? AS estado_reserva), ?, ?)
                """)
                .params(codigo, desde == null ? null : desde.texto(), hacia.texto(), detalle, usuarioId)
                .update();
    }

    public void registrarAviso(String codigo, String motivo, String destino, String mensaje) {
        jdbc.sql("INSERT INTO avisos (codigo, motivo, destino, mensaje) VALUES (?, ?, ?, ?)")
                .params(codigo, motivo, destino, mensaje)
                .update();
    }

    private static ReservaFila fila(ResultSet rs, int i) throws SQLException {
        return new ReservaFila(rs.getString("codigo"), rs.getObject("fecha", LocalDate.class),
                rs.getObject("hora", LocalTime.class), rs.getInt("duracion_minutos"), rs.getInt("personas"),
                rs.getString("mesa_id"), rs.getString("turno_id"), EstadoReserva.de(rs.getString("estado")),
                rs.getString("nombre"), rs.getString("contacto"), rs.getString("contacto_normalizado"),
                rs.getString("comentarios"), rs.getObject("creada", OffsetDateTime.class),
                rs.getString("origen"), rs.getString("codigo_principal"));
    }

    // ---------- Retenciones ----------

    public void borrarRetencionDeSesion(String sesion) {
        jdbc.sql("DELETE FROM retenciones WHERE sesion = ?").param(sesion).update();
    }

    public int borrarRetencion(String id, String sesion) {
        return jdbc.sql("DELETE FROM retenciones WHERE id = ? AND sesion = ?").params(id, sesion).update();
    }

    public void insertarRetencion(String id, String sesion, LocalDate fecha, LocalTime hora, int personas, String mesaId, Instant expira) {
        jdbc.sql("""
                INSERT INTO retenciones (id, sesion, fecha, hora, personas, mesa_id, expira)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """)
                .params(id, sesion, fecha, hora, personas, mesaId, OffsetDateTime.ofInstant(expira, ZoneOffset.UTC))
                .update();
    }

    public int borrarRetencionesVencidas(Instant ahora) {
        return jdbc.sql("DELETE FROM retenciones WHERE expira <= ?")
                .param(OffsetDateTime.ofInstant(ahora, ZoneOffset.UTC))
                .update();
    }
}
