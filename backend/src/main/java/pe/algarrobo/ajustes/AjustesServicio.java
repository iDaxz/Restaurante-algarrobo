package pe.algarrobo.ajustes;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import pe.algarrobo.config.ReglasProveedor;
import pe.algarrobo.motor.Ahora;
import pe.algarrobo.motor.CodigoError;
import pe.algarrobo.motor.ErrorReserva;
import pe.algarrobo.motor.EstadoReserva;
import pe.algarrobo.motor.Motor;
import pe.algarrobo.motor.Reglas;
import pe.algarrobo.reservas.ReservaFila;
import pe.algarrobo.reservas.ReservaRepositorio;
import pe.algarrobo.reservas.ReservaServicio;
import pe.algarrobo.seguridad.UsuarioAdmin;

/**
 * Ajustes del restaurante desde el panel (solo administradores): políticas, turnos, mesas y días
 * especiales. Antes de guardar se comprueba con las reglas nuevas que ninguna reserva futura quede
 * fuera (un horario que deja de existir, una mesa desactivada…); si alguna queda, no se guarda y se
 * dice cuáles son. Cada cambio queda en cambios_config y el motor se recarga al instante.
 */
@Service
public class AjustesServicio {

    private final JdbcClient jdbc;
    private final ReglasProveedor reglas;
    private final ReservaRepositorio repo;
    private final ReservaServicio reservas;
    private final Clock reloj;

    public AjustesServicio(JdbcClient jdbc, ReglasProveedor reglas, ReservaRepositorio repo, ReservaServicio reservas, Clock reloj) {
        this.jdbc = jdbc;
        this.reglas = reglas;
        this.repo = repo;
        this.reservas = reservas;
        this.reloj = reloj;
    }

    // ---------- Lectura ----------

    public record Politicas(Integer duracionMinutos, Integer intervaloMinutos, Integer ventanaDias, Integer maxPersonasEnLinea,
                            Integer holguraAsientos, Integer horasParaCambios, Integer toleranciaMinutos,
                            Integer maxReservasActivasPorContacto, Integer retencionMinutos, List<Integer> diasCerrados) {
    }

    public record Turno(String id, String nombre, String inicio, String fin) {
    }

    public record Mesa(String id, Integer asientos, String nombre, Boolean activa) {
    }

    public record DiaEspecial(String fecha, String motivo, int reservasActivas) {
    }

    public record Cambio(String area, String descripcion, String usuario, String momento) {
    }

    public record Ajustes(Politicas politicas, List<Turno> turnos, List<Mesa> mesas, List<DiaEspecial> diasEspeciales, List<Cambio> cambios) {
    }

    @Transactional(readOnly = true)
    public Ajustes leer() {
        Reglas r = reglas.reglas();
        Politicas politicas = new Politicas(r.duracionMinutos(), r.intervaloMinutos(), r.ventanaDias(), r.maxPersonasEnLinea(),
                r.holguraAsientos(), r.horasParaCambios(), r.toleranciaMinutos(), r.maxReservasActivasPorContacto(),
                r.retencionMinutos(), new ArrayList<>(new TreeSet<>(r.diasCerrados())));
        List<Turno> turnos = r.turnos().stream()
                .map(t -> new Turno(t.id(), t.nombre(), hhmm(t.inicio()), hhmm(t.fin()))).toList();
        List<Mesa> mesas = jdbc.sql("SELECT id, asientos, nombre, activa FROM mesas ORDER BY orden")
                .query((rs, i) -> new Mesa(rs.getString(1), rs.getInt(2), rs.getString(3), rs.getBoolean(4))).list();
        List<DiaEspecial> dias = jdbc.sql("""
                SELECT d.fecha, d.motivo,
                       (SELECT count(*) FROM reservas r WHERE r.fecha = d.fecha AND r.codigo_principal IS NULL
                          AND r.estado IN ('pendiente', 'confirmada')) AS activas
                  FROM dias_especiales d WHERE d.fecha >= ? ORDER BY d.fecha
                """).param(hoy())
                .query((rs, i) -> new DiaEspecial(rs.getObject(1, LocalDate.class).toString(), rs.getString(2), rs.getInt(3))).list();
        List<Cambio> cambios = jdbc.sql("""
                SELECT c.area, c.descripcion, coalesce(u.nombre, '—'), c.momento
                  FROM cambios_config c LEFT JOIN usuarios_admin u ON u.id = c.usuario_id
                 ORDER BY c.momento DESC, c.id DESC LIMIT 15
                """).query((rs, i) -> new Cambio(rs.getString(1), rs.getString(2), rs.getString(3),
                        rs.getObject(4, OffsetDateTime.class).toInstant().toString())).list();
        return new Ajustes(politicas, turnos, mesas, dias, cambios);
    }

    // ---------- Políticas ----------

    @Transactional
    public Ajustes guardarPoliticas(Politicas p, UsuarioAdmin.Publico usuario) {
        Map<String, String> errores = new LinkedHashMap<>();
        rango(errores, "duracionMinutos", p.duracionMinutos(), 30, 300, "La duración de una mesa va de 30 a 300 minutos.");
        if (p.intervaloMinutos() == null || !List.of(15, 30, 60).contains(p.intervaloMinutos())) {
            errores.put("intervaloMinutos", "Los horarios pueden ser cada 15, 30 o 60 minutos.");
        }
        rango(errores, "ventanaDias", p.ventanaDias(), 1, 365, "Se puede reservar con 1 a 365 días de anticipación.");
        rango(errores, "maxPersonasEnLinea", p.maxPersonasEnLinea(), 1, 20, "El máximo de personas en línea va de 1 a 20.");
        rango(errores, "holguraAsientos", p.holguraAsientos(), 0, 10, "La holgura va de 0 a 10 asientos.");
        rango(errores, "horasParaCambios", p.horasParaCambios(), 0, 72, "El plazo para cambios va de 0 a 72 horas.");
        rango(errores, "toleranciaMinutos", p.toleranciaMinutos(), 0, 60, "La tolerancia va de 0 a 60 minutos.");
        rango(errores, "maxReservasActivasPorContacto", p.maxReservasActivasPorContacto(), 1, 20, "El límite por contacto va de 1 a 20 reservas.");
        rango(errores, "retencionMinutos", p.retencionMinutos(), 1, 30, "La mesa se aparta de 1 a 30 minutos.");
        List<Integer> dias = p.diasCerrados() == null ? List.of() : p.diasCerrados();
        if (dias.stream().anyMatch(d -> d == null || d < 0 || d > 6)) errores.put("diasCerrados", "Los días de descanso van de domingo (0) a sábado (6).");
        if (dias.size() >= 7) errores.put("diasCerrados", "El restaurante tiene que abrir al menos un día a la semana.");
        if (!errores.isEmpty()) throw new ErrorReserva(CodigoError.DATOS_INVALIDOS, "Revisa los valores marcados.", errores, null);

        Reglas actual = reglas.reglas();
        boolean sinCambios = actual.duracionMinutos() == p.duracionMinutos() && actual.intervaloMinutos() == p.intervaloMinutos()
                && actual.ventanaDias() == p.ventanaDias() && actual.maxPersonasEnLinea() == p.maxPersonasEnLinea()
                && actual.holguraAsientos() == p.holguraAsientos() && actual.horasParaCambios() == p.horasParaCambios()
                && actual.toleranciaMinutos() == p.toleranciaMinutos()
                && actual.maxReservasActivasPorContacto() == p.maxReservasActivasPorContacto()
                && actual.retencionMinutos() == p.retencionMinutos() && actual.diasCerrados().equals(Set.copyOf(dias));
        if (sinCambios) return leer(); // nada que guardar ni que anotar en el historial
        exigirSinConflictos(new Motor(actual.con(actual.turnos(), actual.mesas(), Set.copyOf(dias), p.duracionMinutos(), p.intervaloMinutos())),
                "Con estos cambios algunas reservas futuras quedarían fuera de horario o en un día de descanso");
        jdbc.sql("""
                UPDATE configuracion SET duracion_minutos = :duracion, intervalo_minutos = :intervalo, ventana_dias = :ventana,
                       max_personas_en_linea = :maxPersonas, holgura_asientos = :holgura, horas_para_cambios = :horas,
                       tolerancia_minutos = :tolerancia, max_reservas_activas_contacto = :maxActivas,
                       retencion_minutos = :retencion, dias_cerrados = CAST(:dias AS smallint[])
                 WHERE id = 1
                """)
                .param("duracion", p.duracionMinutos()).param("intervalo", p.intervaloMinutos()).param("ventana", p.ventanaDias())
                .param("maxPersonas", p.maxPersonasEnLinea()).param("holgura", p.holguraAsientos()).param("horas", p.horasParaCambios())
                .param("tolerancia", p.toleranciaMinutos()).param("maxActivas", p.maxReservasActivasPorContacto())
                .param("retencion", p.retencionMinutos()).param("dias", "{" + String.join(",", dias.stream().map(String::valueOf).toList()) + "}")
                .update();
        registrar("politicas", "Actualizó las políticas de reserva", usuario);
        reglas.recargar();
        return leer();
    }

    // ---------- Turnos ----------

    @Transactional
    public Ajustes guardarTurnos(List<Turno> turnos, UsuarioAdmin.Publico usuario) {
        Reglas actual = reglas.reglas();
        Map<String, Reglas.Turno> existentes = new LinkedHashMap<>();
        actual.turnos().forEach(t -> existentes.put(t.id(), t));
        if (turnos == null || turnos.size() != existentes.size() || !turnos.stream().allMatch(t -> existentes.containsKey(t.id()))) {
            throw new ErrorReserva(CodigoError.DATOS_INVALIDOS, "Se editan los turnos existentes: " + String.join(", ", existentes.keySet()) + ".");
        }
        Map<String, String> errores = new LinkedHashMap<>();
        List<Reglas.Turno> nuevos = new ArrayList<>();
        for (Turno t : turnos) {
            LocalTime inicio = hora(t.inicio());
            LocalTime fin = hora(t.fin());
            if (t.nombre() == null || t.nombre().isBlank() || t.nombre().strip().length() > 30) errores.put(t.id() + ".nombre", "Escribe un nombre de hasta 30 caracteres.");
            if (inicio == null || fin == null) errores.put(t.id() + ".horas", "Escribe las horas como HH:MM.");
            else if (Motor.aMinutos(fin) - Motor.aMinutos(inicio) < actual.duracionMinutos()) {
                errores.put(t.id() + ".horas", "El turno debe durar al menos una mesa completa (%d minutos).".formatted(actual.duracionMinutos()));
            } else nuevos.add(new Reglas.Turno(t.id(), t.nombre().strip(), inicio, fin));
        }
        for (int i = 0; i < nuevos.size(); i++) {
            for (int j = i + 1; j < nuevos.size(); j++) {
                Reglas.Turno a = nuevos.get(i);
                Reglas.Turno b = nuevos.get(j);
                if (a.inicio().isBefore(b.fin()) && b.inicio().isBefore(a.fin())) {
                    errores.put(b.id() + ".horas", "Se cruza con el turno " + a.nombre() + ".");
                }
            }
        }
        if (!errores.isEmpty()) throw new ErrorReserva(CodigoError.DATOS_INVALIDOS, "Revisa los turnos marcados.", errores, null);
        if (nuevos.equals(actual.turnos())) return leer(); // nada que guardar ni que anotar en el historial

        exigirSinConflictos(new Motor(actual.con(nuevos, actual.mesas(), actual.diasCerrados(), actual.duracionMinutos(), actual.intervaloMinutos())),
                "Con estos horarios algunas reservas futuras quedarían fuera de turno");
        for (Reglas.Turno t : nuevos) {
            jdbc.sql("UPDATE turnos SET nombre = ?, inicio = ?, fin = ? WHERE id = ?").params(t.nombre(), t.inicio(), t.fin(), t.id()).update();
        }
        registrar("turnos", "Cambió los turnos: " + String.join(", ", nuevos.stream()
                .map(t -> "%s %s–%s".formatted(t.nombre(), hhmm(t.inicio()), hhmm(t.fin()))).toList()), usuario);
        reglas.recargar();
        return leer();
    }

    // ---------- Mesas ----------

    @Transactional
    public Ajustes crearMesa(Mesa m, UsuarioAdmin.Publico usuario) {
        validarMesa(m);
        int siguiente = jdbc.sql("SELECT coalesce(max(substring(id from 2)::int), 0) + 1 FROM mesas WHERE id ~ '^M[0-9]+$'").query(Integer.class).single();
        String id = "M" + siguiente;
        jdbc.sql("INSERT INTO mesas (id, asientos, nombre, activa, orden) VALUES (?, ?, ?, TRUE, (SELECT coalesce(max(orden), 0) + 1 FROM mesas))")
                .params(id, m.asientos(), limpio(m.nombre())).update();
        registrar("mesas", "Agregó la mesa %s (%d asientos)".formatted(id, m.asientos()), usuario);
        reglas.recargar();
        return leer();
    }

    @Transactional
    public Ajustes editarMesa(String id, Mesa m, UsuarioAdmin.Publico usuario) {
        validarMesa(m);
        Mesa actual = jdbc.sql("SELECT id, asientos, nombre, activa FROM mesas WHERE id = ?").param(id)
                .query((rs, i) -> new Mesa(rs.getString(1), rs.getInt(2), rs.getString(3), rs.getBoolean(4))).optional()
                .orElseThrow(() -> new ErrorReserva(CodigoError.NO_ENCONTRADA, "No existe la mesa " + id + "."));
        boolean activa = m.activa() == null || m.activa();
        // Reservas futuras en esta mesa que ya no cabrían: mesa desactivada, o con menos asientos que personas.
        List<String> afectadas = jdbc.sql("""
                SELECT codigo, fecha, hora, nombre, personas FROM reservas
                 WHERE mesa_id = :mesa AND estado IN ('pendiente', 'confirmada') AND fecha >= :hoy
                   AND (:inactiva OR (codigo_principal IS NULL AND personas > :asientos AND
                        NOT EXISTS (SELECT 1 FROM reservas a WHERE a.codigo_principal = reservas.codigo)))
                 ORDER BY fecha, hora
                """).param("mesa", id).param("hoy", hoy()).param("inactiva", !activa).param("asientos", m.asientos())
                .query((rs, i) -> describir(rs.getString(1), rs.getObject(2, LocalDate.class), rs.getObject(3, LocalTime.class), rs.getString(4)))
                .list();
        if (!afectadas.isEmpty()) {
            throw conflicto("La mesa %s tiene reservas futuras que dejarían de caber".formatted(id), afectadas);
        }
        if (!activa && jdbc.sql("SELECT count(*) FROM mesas WHERE activa AND id <> ?").param(id).query(Integer.class).single() == 0) {
            throw new ErrorReserva(CodigoError.DATOS_INVALIDOS, "Tiene que quedar al menos una mesa activa.");
        }
        jdbc.sql("UPDATE mesas SET asientos = ?, nombre = ?, activa = ? WHERE id = ?").params(m.asientos(), limpio(m.nombre()), activa, id).update();
        List<String> cambios = new ArrayList<>();
        if (actual.asientos().intValue() != m.asientos()) cambios.add("asientos %d → %d".formatted(actual.asientos(), m.asientos()));
        if (actual.activa() != activa) cambios.add(activa ? "activada" : "desactivada");
        if (!java.util.Objects.equals(limpio(actual.nombre()), limpio(m.nombre()))) cambios.add("nombre «%s»".formatted(limpio(m.nombre()) == null ? "sin nombre" : limpio(m.nombre())));
        registrar("mesas", "Mesa %s: %s".formatted(id, cambios.isEmpty() ? "sin cambios" : String.join(", ", cambios)), usuario);
        reglas.recargar();
        return leer();
    }

    private static void validarMesa(Mesa m) {
        Map<String, String> errores = new LinkedHashMap<>();
        rango(errores, "asientos", m.asientos(), 1, 20, "Una mesa tiene de 1 a 20 asientos.");
        if (m.nombre() != null && m.nombre().strip().length() > 30) errores.put("nombre", "El nombre admite hasta 30 caracteres.");
        if (!errores.isEmpty()) throw new ErrorReserva(CodigoError.DATOS_INVALIDOS, "Revisa los datos de la mesa.", errores, null);
    }

    // ---------- Días especiales ----------

    public record NuevoDia(String fecha, String motivo, Boolean cancelarReservas) {
    }

    /**
     * Cierra una fecha. Si ese día hay reservas activas, no se cierra a menos que se pida cancelarlas:
     * entonces se cancelan todas (con su aviso simulado y el motivo en el historial).
     */
    @Transactional
    public Ajustes cerrarDia(NuevoDia d, UsuarioAdmin.Publico usuario) {
        LocalDate fecha;
        try {
            fecha = LocalDate.parse(d.fecha() == null ? "" : d.fecha());
        } catch (java.time.format.DateTimeParseException e) {
            throw new ErrorReserva(CodigoError.DATOS_INVALIDOS, "Elige una fecha.", Map.of("fecha", "Elige una fecha."), null);
        }
        String motivo = d.motivo() == null ? "" : d.motivo().strip();
        Map<String, String> errores = new LinkedHashMap<>();
        if (fecha.isBefore(hoy())) errores.put("fecha", "Esa fecha ya pasó.");
        if (motivo.length() < 3 || motivo.length() > 120) errores.put("motivo", "Escribe el motivo (de 3 a 120 caracteres): el cliente lo verá en el aviso.");
        if (!errores.isEmpty()) throw new ErrorReserva(CodigoError.DATOS_INVALIDOS, "Revisa los datos del día especial.", errores, null);
        if (jdbc.sql("SELECT EXISTS (SELECT 1 FROM dias_especiales WHERE fecha = ?)").param(fecha).query(Boolean.class).single()) {
            throw new ErrorReserva(CodigoError.DATOS_INVALIDOS, "Ese día ya está cerrado.", Map.of("fecha", "Ese día ya está cerrado."), null);
        }

        repo.bloquear("dia:" + fecha);
        List<ReservaFila> activas = jdbc.sql("""
                SELECT codigo FROM reservas WHERE fecha = ? AND codigo_principal IS NULL AND estado IN ('pendiente', 'confirmada')
                 ORDER BY hora
                """).param(fecha).query(String.class).list().stream()
                .map(c -> repo.buscarParaActualizar(c).orElseThrow()).toList();
        if (!activas.isEmpty() && !Boolean.TRUE.equals(d.cancelarReservas())) {
            throw conflicto("Ese día hay %d %s".formatted(activas.size(), activas.size() == 1 ? "reserva activa" : "reservas activas"),
                    activas.stream().map(r -> describir(r.codigo(), r.fecha(), r.hora(), r.nombre())).toList());
        }
        for (ReservaFila r : activas) {
            repo.actualizar(r.conEstado(EstadoReserva.CANCELADA));
            repo.cambiarEstadoAnexas(r.codigo(), EstadoReserva.CANCELADA);
            repo.registrarHistorial(r.codigo(), r.estado(), EstadoReserva.CANCELADA, "Día cerrado: " + motivo, usuario.id());
            reservas.avisar(r, "cancelada", "Lo sentimos: el restaurante no atenderá el día de tu reserva %s (%s a las %s). Motivo: " + motivo.replace("%", "%%") + ".");
        }
        jdbc.sql("INSERT INTO dias_especiales (fecha, motivo, usuario_id) VALUES (?, ?, ?)").params(fecha, motivo, usuario.id()).update();
        registrar("dias", "Cerró el %s (%s)%s".formatted(fecha, motivo,
                activas.isEmpty() ? "" : " y canceló %d %s".formatted(activas.size(), activas.size() == 1 ? "reserva" : "reservas")), usuario);
        reglas.recargar();
        return leer();
    }

    @Transactional
    public Ajustes abrirDia(String fecha, UsuarioAdmin.Publico usuario) {
        int borrados = jdbc.sql("DELETE FROM dias_especiales WHERE fecha = CAST(? AS date)").param(fecha).update();
        if (borrados == 0) throw new ErrorReserva(CodigoError.NO_ENCONTRADA, "Ese día no estaba cerrado.");
        registrar("dias", "Volvió a abrir el " + fecha, usuario);
        reglas.recargar();
        return leer();
    }

    // ---------- Ayudas ----------

    /** Comprueba con las reglas nuevas que cada reserva futura siga teniendo su horario y su día. */
    private void exigirSinConflictos(Motor nuevo, String mensaje) {
        List<ReservaFila> futuras = jdbc.sql("""
                SELECT codigo FROM reservas WHERE fecha >= ? AND codigo_principal IS NULL AND estado IN ('pendiente', 'confirmada')
                 ORDER BY fecha, hora
                """).param(hoy()).query(String.class).list().stream().map(c -> repo.buscar(c).orElseThrow()).toList();
        List<String> afectadas = futuras.stream()
                .filter(r -> nuevo.estaCerrado(r.fecha()) || nuevo.turnoDeHora(hhmm(r.hora())).isEmpty())
                .map(r -> describir(r.codigo(), r.fecha(), r.hora(), r.nombre()))
                .toList();
        if (!afectadas.isEmpty()) throw conflicto(mensaje, afectadas);
    }

    private static ErrorReserva conflicto(String mensaje, List<String> afectadas) {
        int n = afectadas.size();
        String lista = String.join("; ", afectadas.subList(0, Math.min(n, 10))) + (n > 10 ? "; y %d más".formatted(n - 10) : "");
        return new ErrorReserva(CodigoError.CONFLICTO_RESERVAS,
                "%s: %s. Cámbialas o cancélalas primero.".formatted(mensaje, lista), Map.of("reservas", lista), null);
    }

    private static String describir(String codigo, LocalDate fecha, LocalTime hora, String nombre) {
        return "%s (%s %s, %s)".formatted(codigo, fecha, hhmm(hora), nombre);
    }

    private void registrar(String area, String descripcion, UsuarioAdmin.Publico usuario) {
        jdbc.sql("INSERT INTO cambios_config (area, descripcion, usuario_id) VALUES (?, ?, ?)").params(area, descripcion, usuario.id()).update();
    }

    private LocalDate hoy() {
        return Ahora.de(reloj).fecha();
    }

    private static void rango(Map<String, String> errores, String campo, Integer valor, int min, int max, String mensaje) {
        if (valor == null || valor < min || valor > max) errores.put(campo, mensaje);
    }

    private static String hhmm(LocalTime hora) {
        return Motor.aHora(Motor.aMinutos(hora));
    }

    private static LocalTime hora(String texto) {
        if (texto == null || !texto.matches("\\d{2}:\\d{2}")) return null;
        try {
            return LocalTime.parse(texto);
        } catch (java.time.format.DateTimeParseException e) {
            return null;
        }
    }

    private static String limpio(String texto) {
        return texto == null || texto.isBlank() ? null : texto.strip();
    }
}
