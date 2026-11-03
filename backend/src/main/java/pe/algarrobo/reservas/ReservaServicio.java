package pe.algarrobo.reservas;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import java.util.function.Function;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import pe.algarrobo.config.ReglasProveedor;
import pe.algarrobo.motor.Ahora;
import pe.algarrobo.motor.Alternativas;
import pe.algarrobo.motor.CodigoError;
import pe.algarrobo.motor.ErrorReserva;
import pe.algarrobo.motor.EstadoReserva;
import pe.algarrobo.motor.Horario;
import pe.algarrobo.motor.Motor;
import pe.algarrobo.motor.Ocupacion;
import pe.algarrobo.motor.Reglas;
import pe.algarrobo.motor.Solicitud;

/**
 * Casos de uso de la persona que reserva. Cada operación que escribe va en una transacción y
 * bloquea el día (y el contacto) antes de validar: así dos peticiones simultáneas no pueden
 * llevarse la misma mesa ni saltarse el límite de reservas por contacto.
 */
@Service
public class ReservaServicio {

    private static final Logger log = LoggerFactory.getLogger(ReservaServicio.class);
    private static final String ALFABETO = "ACDEFGHJKMNPQRTUVWXY34679";
    private static final SecureRandom AZAR = new SecureRandom();

    private final ReservaRepositorio repo;
    private final ReglasProveedor reglas;
    private final Clock reloj;

    public ReservaServicio(ReservaRepositorio repo, ReglasProveedor reglas, Clock reloj) {
        this.repo = repo;
        this.reglas = reglas;
        this.reloj = reloj;
    }

    private Ahora ahora() {
        return Ahora.de(reloj);
    }

    private Function<LocalDate, List<Ocupacion>> ocupacion(String sesion) {
        Instant instante = reloj.instant();
        Map<LocalDate, List<Ocupacion>> cache = new HashMap<>();
        return fecha -> cache.computeIfAbsent(fecha, f -> repo.ocupacionDe(f, sesion, instante));
    }

    // ---------- Disponibilidad (solo lectura) ----------

    @Transactional(readOnly = true)
    public Map<String, String> consultarMes(YearMonth mes, int personas, String excluir, String sesion) {
        Motor motor = reglas.motor();
        Ahora ahora = ahora();
        LocalDate inicio = mes.atDay(1);
        LocalDate fin = mes.atEndOfMonth();
        Map<LocalDate, List<Ocupacion>> porDia = new HashMap<>();
        repo.ocupacionEntre(inicio, fin, sesion, reloj.instant())
                .forEach(o -> porDia.computeIfAbsent(o.fecha(), f -> new ArrayList<>()).add(o.ocupacion()));
        Map<String, String> estados = new LinkedHashMap<>();
        for (LocalDate f = inicio; !f.isAfter(fin); f = f.plusDays(1)) {
            estados.put(f.toString(), motor.estadoDelDia(f, personas, porDia.getOrDefault(f, List.of()), ahora, excluir));
        }
        return estados;
    }

    @Transactional(readOnly = true)
    public List<Horario> consultarHorarios(LocalDate fecha, int personas, String excluir, String sesion) {
        return reglas.motor().horariosDelDia(fecha, personas, repo.ocupacionDe(fecha, sesion, reloj.instant()), ahora(), excluir);
    }

    @Transactional(readOnly = true)
    public Alternativas alternativas(LocalDate fecha, String hora, int personas, String excluir, String sesion) {
        return reglas.motor().buscarAlternativas(fecha, hora, personas, ocupacion(sesion), ahora(), excluir);
    }

    /** Para "Hoy en la cocina": mesas libres en el mejor horario restante de cada turno de hoy. */
    @Transactional(readOnly = true)
    public Map<String, Object> resumenDeHoy() {
        Motor motor = reglas.motor();
        Ahora ahora = ahora();
        Map<String, Object> resumen = new LinkedHashMap<>();
        resumen.put("fecha", ahora.fecha().toString());
        if (motor.estaCerrado(ahora.fecha())) {
            resumen.put("cerrado", true);
            resumen.put("turnos", List.of());
            return resumen;
        }
        List<Ocupacion> ocupadas = repo.ocupacionDe(ahora.fecha(), null, reloj.instant());
        List<Map<String, Object>> turnos = new ArrayList<>();
        for (Reglas.Turno turno : motor.reglas().turnos()) {
            List<String> horas = motor.horariosDelTurno(turno);
            Map<String, Object> t = new LinkedHashMap<>();
            t.put("id", turno.id());
            t.put("nombre", turno.nombre());
            t.put("inicio", Motor.aHora(Motor.aMinutos(turno.inicio())));
            t.put("fin", Motor.aHora(Motor.aMinutos(turno.fin())));
            List<String> restantes = motor.horariosDelDia(ahora.fecha(), 2, ocupadas, ahora, null).stream()
                    .filter(h -> h.turno().equals(turno.id()) && !h.estado().equals("pasado"))
                    .map(Horario::hora).toList();
            if (restantes.isEmpty()) {
                t.put("terminado", true);
                t.put("mesasLibres", 0);
                t.put("ultimaHora", horas.getLast());
            } else {
                String mejor = null;
                String proxima = null;
                int maximo = -1;
                for (String hora : restantes) {
                    LocalTime h = LocalTime.parse(hora);
                    int libres = (int) motor.reglas().mesas().stream().filter(m -> motor.mesaLibre(ocupadas, m.id(), h, null)).count();
                    if (libres > maximo) {
                        maximo = libres;
                        mejor = hora;
                    }
                    if (proxima == null && libres > 0) proxima = hora;
                }
                t.put("terminado", false);
                t.put("mesasLibres", maximo);
                t.put("mejorHora", mejor);
                t.put("proximaHora", proxima);
            }
            turnos.add(t);
        }
        resumen.put("cerrado", false);
        resumen.put("turnos", turnos);
        return resumen;
    }

    /** Estado de cada mesa a esa hora para el plano (lo que aparta esta misma sesión cuenta como libre). */
    @Transactional(readOnly = true)
    public List<Motor.EstadoMesa> mesasALaHora(LocalDate fecha, String hora, int personas, String excluir, String sesion) {
        Motor motor = reglas.motor();
        Motor.Validacion previa = motor.validarSolicitud(new Solicitud("Reserva", "999999999", fecha.toString(), hora, personas, "", null),
                f -> List.of(), ahora(), excluir);
        if (!previa.ok()) throw new ErrorReserva(previa.codigo(), "No podemos mostrar las mesas de ese horario.", previa.errores(), null);
        return motor.estadoDeMesas(repo.ocupacionDe(fecha, sesion, reloj.instant()), personas, previa.hora(), excluir);
    }

    // ---------- Retenciones ----------

    public record Retencion(String id, String mesa, long expira) {
    }

    /** Aparta una mesa unos minutos para esta sesión (reemplaza su retención anterior). */
    @Transactional
    public Retencion retenerMesa(Solicitud s, String excluir, String sesion) {
        Motor motor = reglas.motor();
        exigirSesion(sesion);
        // Se validan fecha, hora y personas con las reglas de siempre (nombre y contacto aún no hacen falta).
        Solicitud parcial = new Solicitud("Reserva", "999999999", s.fecha(), s.hora(), s.personas(), "", null);
        Motor.Validacion previa = motor.validarSolicitud(parcial, f -> List.of(), ahora(), excluir);
        if (!previa.ok()) throw new ErrorReserva(previa.codigo(), "No pudimos apartar la mesa.", previa.errores(), null);

        repo.bloquear("dia:" + previa.fecha());
        repo.borrarRetencionDeSesion(sesion);
        var ocupacion = repo.ocupacionDe(previa.fecha(), sesion, reloj.instant());
        java.util.Optional<pe.algarrobo.motor.Reglas.Mesa> mesa;
        if (s.mesaElegida() != null) {
            // La mesa que la persona tocó en el plano: mismas reglas que al reservar.
            Motor.Validacion elegida = motor.validarSolicitud(new Solicitud("Reserva", "999999999", s.fecha(), s.hora(), s.personas(), "", s.mesa()),
                    f -> ocupacion, ahora(), excluir);
            if (!elegida.ok()) throw new ErrorReserva(elegida.codigo(), elegida.errores().getOrDefault("mesa", "No pudimos apartar esa mesa."), elegida.errores(), null);
            mesa = java.util.Optional.of(elegida.mesa());
        } else {
            mesa = motor.asignarMesa(ocupacion, s.personas(), previa.hora(), excluir);
        }
        if (mesa.isEmpty()) {
            throw new ErrorReserva(CodigoError.HORARIO_LLENO,
                    "A las %s ya no quedan mesas para %d %s.".formatted(s.hora(), s.personas(), s.personas() == 1 ? "persona" : "personas"));
        }
        String id = "H-" + codigo(8).toLowerCase();
        Instant expira = reloj.instant().plusSeconds(motor.reglas().retencionMinutos() * 60L);
        repo.insertarRetencion(id, sesion, previa.fecha(), previa.hora(), s.personas(), mesa.get().id(), expira);
        return new Retencion(id, mesa.get().id(), expira.toEpochMilli());
    }

    @Transactional
    public void liberarRetencion(String id, String sesion) {
        exigirSesion(sesion);
        if (id == null) repo.borrarRetencionDeSesion(sesion);
        else repo.borrarRetencion(id, sesion);
    }

    @Scheduled(fixedDelay = 60_000, initialDelay = 60_000)
    @Transactional
    public void limpiarRetencionesVencidas() {
        int borradas = repo.borrarRetencionesVencidas(reloj.instant());
        if (borradas > 0) log.debug("Retenciones vencidas borradas: {}", borradas);
    }

    // ---------- Reservas ----------

    @Transactional
    public ReservaPublica crearReserva(Solicitud s, String sesion) {
        Motor motor = reglas.motor();
        Ahora ahora = ahora();
        String normalizado = Motor.normalizarContacto(s.contacto());
        // Primero el contacto y luego el día, siempre en este orden para no bloquearse entre sí.
        repo.bloquear("contacto:" + normalizado);
        Motor.Validacion v = motor.validarSolicitud(s, f -> {
            repo.bloquear("dia:" + f);
            return repo.ocupacionDe(f, sesion, reloj.instant());
        }, ahora, null);
        if (!v.ok()) fallarValidacion(v, s, null, sesion, "No pudimos registrar la reserva.");

        motor.validarReglasDeContacto(v.fecha(), v.hora(), repo.activasDelContacto(normalizado, ahora.fecha().minusDays(1)), ahora, null);

        ReservaFila nueva = new ReservaFila(nuevoCodigo(), v.fecha(), v.hora(), motor.reglas().duracionMinutos(),
                s.personas(), v.mesa().id(), motor.turnoDeHora(s.hora()).orElseThrow().id(), EstadoReserva.PENDIENTE,
                s.nombre().strip(), s.contacto().strip(), normalizado, comentarios(s), null);
        guardar(() -> repo.insertar(nueva), s);
        repo.registrarHistorial(nueva.codigo(), null, EstadoReserva.PENDIENTE, "Creada por la persona", null);
        avisar(nueva, "recibida", "Recibimos tu reserva %s para el %s a las %s. Te avisaremos cuando el restaurante la confirme.");
        if (sesion != null) repo.borrarRetencionDeSesion(sesion);
        return publica(repo.buscar(nueva.codigo()).orElseThrow());
    }

    @Transactional(readOnly = true)
    public ReservaPublica buscarReserva(String codigo, String contacto) {
        return publica(propia(codigo, contacto, false));
    }

    @Transactional
    public ReservaPublica modificarReserva(String codigo, String contacto, Solicitud cambios, String sesion) {
        Motor motor = reglas.motor();
        Ahora ahora = ahora();
        ReservaFila actual = propia(codigo, contacto, true);
        exigirCambiable(actual, ahora, "modificar");
        if (repo.tieneAnexas(actual.codigo())) {
            throw new ErrorReserva(CodigoError.TRANSICION_INVALIDA,
                    "Esta reserva de grupo la gestiona el restaurante. Llámanos para cambiarla.");
        }

        Solicitud s = new Solicitud(
                cambios.nombre() != null ? cambios.nombre() : actual.nombre(),
                cambios.contacto() != null ? cambios.contacto() : actual.contacto(),
                cambios.fecha() != null ? cambios.fecha() : actual.fecha().toString(),
                cambios.hora() != null ? cambios.hora() : Motor.aHora(Motor.aMinutos(actual.hora())),
                cambios.personas() != null ? cambios.personas() : actual.personas(),
                cambios.comentarios() != null ? cambios.comentarios() : actual.comentarios(),
                cambios.mesa());
        String normalizado = Motor.normalizarContacto(s.contacto());

        // Contactos y días en orden fijo para evitar bloqueos cruzados.
        new TreeSet<>(List.of(actual.contactoNormalizado(), normalizado)).forEach(c -> repo.bloquear("contacto:" + c));
        Motor.Validacion v = motor.validarSolicitud(s, f -> {
            repo.bloquear("dia:" + f);
            return repo.ocupacionDe(f, sesion, reloj.instant());
        }, ahora, actual.codigo());
        if (!v.ok()) fallarValidacion(v, s, actual.codigo(), sesion, "No pudimos cambiar la reserva.");

        motor.validarReglasDeContacto(v.fecha(), v.hora(), repo.activasDelContacto(normalizado, ahora.fecha().minusDays(1)), ahora, actual.codigo());

        // Modificar no es una transición: es una nueva solicitud sobre la misma reserva y vuelve a pendiente.
        ReservaFila cambiada = new ReservaFila(actual.codigo(), v.fecha(), v.hora(), motor.reglas().duracionMinutos(),
                s.personas(), v.mesa().id(), motor.turnoDeHora(s.hora()).orElseThrow().id(), EstadoReserva.PENDIENTE,
                s.nombre().strip(), s.contacto().strip(), normalizado, comentarios(s), actual.creada(), actual.origen(), null);
        guardar(() -> repo.actualizar(cambiada), s);
        repo.registrarHistorial(actual.codigo(), actual.estado(), EstadoReserva.PENDIENTE, "Modificada por la persona", null);
        avisar(cambiada, "modificada", "Tu reserva %s ahora es para el %s a las %s. El restaurante la revisará de nuevo.");
        if (sesion != null) repo.borrarRetencionDeSesion(sesion);
        return publica(repo.buscar(actual.codigo()).orElseThrow());
    }

    @Transactional
    public ReservaPublica cancelarReserva(String codigo, String contacto) {
        Ahora ahora = ahora();
        ReservaFila actual = propia(codigo, contacto, true);
        exigirCambiable(actual, ahora, "cancelar");
        actual.estado().exigirTransicion(EstadoReserva.CANCELADA);
        ReservaFila cancelada = actual.conEstado(EstadoReserva.CANCELADA);
        repo.actualizar(cancelada);
        repo.cambiarEstadoAnexas(codigo, EstadoReserva.CANCELADA);
        repo.registrarHistorial(codigo, actual.estado(), EstadoReserva.CANCELADA, "Cancelada por la persona", null);
        avisar(cancelada, "cancelada", "Cancelaste tu reserva %s del %s a las %s.");
        return publica(cancelada);
    }

    // ---------- Ayudas ----------

    /** La reserva solo se entrega si el contacto coincide (el código solo no basta). */
    private ReservaFila propia(String codigo, String contacto, boolean bloquear) {
        String limpio = codigo == null ? "" : codigo.strip().toUpperCase();
        var fila = bloquear ? repo.buscarParaActualizar(limpio) : repo.buscar(limpio);
        return fila.filter(r -> r.codigoPrincipal() == null)
                .filter(r -> r.contactoNormalizado().equals(Motor.normalizarContacto(contacto)))
                .orElseThrow(() -> new ErrorReserva(CodigoError.NO_ENCONTRADA,
                        "No encontramos una reserva con ese código y ese contacto. Revisa ambos datos."));
    }

    private void exigirCambiable(ReservaFila r, Ahora ahora, String accion) {
        Motor motor = reglas.motor();
        EstadoReserva visible = motor.estadoVisible(r.estado(), r.fecha(), r.hora(), ahora);
        if (!visible.esActivo()) {
            throw new ErrorReserva(CodigoError.TRANSICION_INVALIDA, "Esta reserva ya está %s; no se puede %s.".formatted(visible.texto(), accion));
        }
        if (!motor.puedeCambiar(visible, r.fecha(), r.hora(), ahora)) {
            throw new ErrorReserva(CodigoError.FUERA_DE_PLAZO_CAMBIOS,
                    "Solo se puede %s hasta %d horas antes de la llegada.".formatted(accion, motor.reglas().horasParaCambios()));
        }
    }

    private void fallarValidacion(Motor.Validacion v, Solicitud s, String excluir, String sesion, String mensaje) {
        Alternativas alternativas = v.errores().containsKey("hora") && v.fecha() != null && v.hora() != null
                ? reglas.motor().buscarAlternativas(v.fecha(), s.hora(), s.personas(), ocupacion(sesion), ahora(), excluir)
                : null;
        throw new ErrorReserva(v.codigo(), mensaje, v.errores(), alternativas);
    }

    /**
     * Si aun así otra transacción ganó la mesa, la base lo impide (sin_choques_por_mesa) y se responde
     * HORARIO_LLENO. Tras ese error PostgreSQL anula la transacción, así que aquí no se calculan alternativas.
     */
    private void guardar(Runnable escritura, Solicitud s) {
        try {
            escritura.run();
        } catch (DataIntegrityViolationException e) {
            log.warn("Choque de mesa evitado por la base de datos: {}", e.getMostSpecificCause().getMessage());
            throw new ErrorReserva(CodigoError.HORARIO_LLENO, "No pudimos registrar la reserva.",
                    Map.of("hora", "A las %s ya no quedan mesas para %d personas.".formatted(s.hora(), s.personas())), null);
        }
    }

    private static String comentarios(Solicitud s) {
        return s.comentarios() == null ? "" : s.comentarios().strip();
    }

    public String nuevoCodigo() {
        String codigo;
        do {
            codigo = "ALG-" + codigo(5);
        } while (repo.existe(codigo));
        return codigo;
    }

    private static String codigo(int largo) {
        StringBuilder sb = new StringBuilder(largo);
        for (int i = 0; i < largo; i++) sb.append(ALFABETO.charAt(AZAR.nextInt(ALFABETO.length())));
        return sb.toString();
    }

    private static void exigirSesion(String sesion) {
        if (sesion == null || !sesion.matches("[A-Za-z0-9-]{6,64}")) {
            throw new ErrorReserva(CodigoError.DATOS_INVALIDOS, "Falta identificar la sesión del navegador (cabecera X-Sesion).");
        }
    }

    /** Avisos SIMULADOS: se guardan y se escriben en el log, pero no se envían (ver tabla avisos). */
    public void avisar(ReservaFila r, String motivo, String plantilla) {
        String mensaje = plantilla.formatted(r.codigo(), r.fecha(), Motor.aHora(Motor.aMinutos(r.hora())));
        repo.registrarAviso(r.codigo(), motivo, r.contacto(), mensaje);
        log.info("[aviso simulado] {} → {}: {}", motivo, r.codigo(), mensaje);
    }

    ReservaPublica publica(ReservaFila r) {
        Motor motor = reglas.motor();
        Ahora ahora = ahora();
        EstadoReserva visible = motor.estadoVisible(r.estado(), r.fecha(), r.hora(), ahora);
        Reglas.Mesa mesa = motor.reglas().mesas().stream().filter(m -> m.id().equals(r.mesaId())).findFirst().orElse(null);
        return new ReservaPublica(r.codigo(), r.fecha().toString(), Motor.aHora(Motor.aMinutos(r.hora())), r.personas(),
                r.mesaId(), mesa == null ? null : mesa.asientos(), mesa == null ? null : mesa.nombre(), r.turnoId(),
                visible.texto(), r.nombre(), r.contacto(), r.comentarios(),
                r.creada() == null ? null : r.creada().toInstant().toString(), false,
                motor.puedeCambiar(visible, r.fecha(), r.hora(), ahora));
    }
}
