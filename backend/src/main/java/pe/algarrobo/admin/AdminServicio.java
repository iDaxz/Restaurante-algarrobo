package pe.algarrobo.admin;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import pe.algarrobo.config.ReglasProveedor;
import pe.algarrobo.motor.Ahora;
import pe.algarrobo.motor.CodigoError;
import pe.algarrobo.motor.ErrorReserva;
import pe.algarrobo.motor.EstadoReserva;
import pe.algarrobo.motor.Motor;
import pe.algarrobo.motor.Ocupacion;
import pe.algarrobo.motor.Reglas;
import pe.algarrobo.motor.Solicitud;
import pe.algarrobo.reservas.ReservaFila;
import pe.algarrobo.reservas.ReservaRepositorio;
import pe.algarrobo.reservas.ReservaServicio;
import pe.algarrobo.seguridad.UsuarioAdmin;

/**
 * Lo que hace el personal: ver reservas, cambiar su estado (con historial de quién y cuándo) y
 * registrar reservas que llegan por teléfono, incluidos grupos grandes que juntan varias mesas.
 */
@Service
public class AdminServicio {

    /** Máximo de personas que el personal puede registrar en una reserva (varias mesas juntas). */
    static final int MAX_PERSONAS_PANEL = 60;
    /** Rango máximo de un listado (una semana o un mes, con margen). */
    static final int MAX_DIAS_LISTADO = 62;
    /** Al buscar por texto (código, nombre o contacto) se puede abarcar un año: los resultados son pocos. */
    static final int MAX_DIAS_BUSQUEDA = 366;

    private final AdminRepositorio consultas;
    private final ReservaRepositorio repo;
    private final ReservaServicio reservas;
    private final ReglasProveedor reglas;
    private final Clock reloj;

    public AdminServicio(AdminRepositorio consultas, ReservaRepositorio repo, ReservaServicio reservas,
                         ReglasProveedor reglas, Clock reloj) {
        this.consultas = consultas;
        this.repo = repo;
        this.reservas = reservas;
        this.reglas = reglas;
        this.reloj = reloj;
    }

    private Ahora ahora() {
        return Ahora.de(reloj);
    }

    // ---------- Consultas ----------

    @Transactional(readOnly = true)
    public List<AdminRepositorio.ReservaAdmin> listar(AdminRepositorio.Filtro f) {
        boolean buscando = f.texto() != null && f.texto().strip().length() >= 2;
        int maximo = buscando ? MAX_DIAS_BUSQUEDA : MAX_DIAS_LISTADO;
        if (f.desde() == null || f.hasta() == null || f.hasta().isBefore(f.desde())
                || ChronoUnit.DAYS.between(f.desde(), f.hasta()) > maximo) {
            throw new ErrorReserva(CodigoError.DATOS_INVALIDOS, "Elige un rango de fechas de hasta %d días.".formatted(maximo));
        }
        Ahora a = ahora();
        return consultas.listar(f, a.fecha(), a.minutos());
    }

    public record Detalle(AdminRepositorio.ReservaAdmin reserva, List<AdminRepositorio.Cambio> historial, List<AdminRepositorio.Aviso> avisos) {
    }

    @Transactional(readOnly = true)
    public Detalle detalle(String codigo) {
        Ahora a = ahora();
        var r = consultas.buscar(limpiar(codigo), a.fecha(), a.minutos()).orElseThrow(AdminServicio::noEncontrada);
        return new Detalle(r, consultas.historial(r.codigo()), consultas.avisos(r.codigo()));
    }

    public record MesaDisponible(String id, int asientos, String nombre, boolean libre) {
    }

    /** Todas las mesas activas y si están libres a esa hora (para elegirlas en la reserva manual). */
    @Transactional(readOnly = true)
    public List<MesaDisponible> mesas(LocalDate fecha, String hora) {
        Motor motor = reglas.motor();
        LocalTime h = LocalTime.parse(hora);
        List<Ocupacion> ocupadas = repo.ocupacionDe(fecha, null, reloj.instant());
        return motor.reglas().mesas().stream()
                .map(m -> new MesaDisponible(m.id(), m.asientos(), m.nombre(), motor.mesaLibre(ocupadas, m.id(), h, null)))
                .toList();
    }

    // ---------- Cambios de estado ----------

    @Transactional
    public Detalle cambiarEstado(String codigo, EstadoReserva hacia, String motivo, UsuarioAdmin.Publico usuario) {
        Ahora a = ahora();
        ReservaFila r = repo.buscarParaActualizar(limpiar(codigo))
                .filter(x -> x.codigoPrincipal() == null)
                .orElseThrow(AdminServicio::noEncontrada);
        r.estado().exigirTransicion(hacia);
        boolean llego = Motor.minutosHastaLlegada(r.fecha(), r.hora(), a) <= 0;
        if ((hacia == EstadoReserva.COMPLETADA || hacia == EstadoReserva.NO_ASISTIO) && !llego) {
            throw new ErrorReserva(CodigoError.TRANSICION_INVALIDA,
                    "Todavía no es la hora de llegada (%s del %s): se podrá marcar después.".formatted(Motor.aHora(Motor.aMinutos(r.hora())), r.fecha()));
        }
        String detalle = (motivo == null || motivo.isBlank()) ? null : motivo.strip();
        if (detalle != null && detalle.length() > 200) throw new ErrorReserva(CodigoError.DATOS_INVALIDOS, "El motivo admite hasta 200 caracteres.");

        repo.actualizar(r.conEstado(hacia));
        repo.cambiarEstadoAnexas(r.codigo(), hacia);
        repo.registrarHistorial(r.codigo(), r.estado(), hacia, detalle, usuario.id());
        switch (hacia) {
            case CONFIRMADA -> reservas.avisar(r, "confirmada", "Tu reserva %s para el %s a las %s está confirmada. ¡Te esperamos!");
            case CANCELADA -> reservas.avisar(r, "cancelada",
                    "El restaurante canceló tu reserva %s del %s a las %s." + (detalle == null ? "" : " Motivo: " + detalle.replace("%", "%%")));
            default -> { }
        }
        return detalle(r.codigo());
    }

    // ---------- Reserva registrada por el personal ----------

    public record ReservaManual(String nombre, String contacto, String fecha, String hora, Integer personas,
                                String comentarios, List<String> mesas) {
    }

    /**
     * Reserva tomada por teléfono: queda confirmada. Usa las reglas de fechas, horarios y mesas libres,
     * pero no el límite de personas en línea ni el de reservas por contacto. Para grupos grandes, el
     * personal elige las mesas que se juntan; si no elige, se asigna la mesa libre más pequeña que sirva.
     */
    @Transactional
    public Detalle crearManual(ReservaManual m, UsuarioAdmin.Publico usuario) {
        Reglas base = reglas.reglas();
        // Mismas reglas, pero sin tope de personas en línea, con ventana de un año y sin límite de holgura.
        Motor flexible = new Motor(new Reglas(base.turnos(), base.mesas(), base.diasCerrados(), base.duracionMinutos(),
                base.intervaloMinutos(), 365, base.minPersonas(), MAX_PERSONAS_PANEL, 100, base.horasParaCambios(),
                base.toleranciaMinutos(), base.umbralLimitado(), Integer.MAX_VALUE, base.retencionMinutos(), base.fechasCerradas()));
        Ahora a = ahora();
        Solicitud s = new Solicitud(m.nombre(), m.contacto(), m.fecha(), m.hora(), m.personas(), m.comentarios());

        Motor.Validacion v = flexible.validarSolicitud(s, f -> List.of(), a, null);
        if (!v.ok() && v.codigo() != CodigoError.HORARIO_LLENO) {
            throw new ErrorReserva(v.codigo(), "No pudimos registrar la reserva.", v.errores(), null);
        }
        repo.bloquear("dia:" + v.fecha());
        List<Ocupacion> ocupadas = repo.ocupacionDe(v.fecha(), null, reloj.instant());
        List<Reglas.Mesa> elegidas = elegirMesas(flexible, m, s.personas(), v.hora(), ocupadas);

        String normalizado = Motor.normalizarContacto(s.contacto());
        String turno = flexible.turnoDeHora(s.hora()).orElseThrow().id();
        String comentarios = s.comentarios() == null ? "" : s.comentarios().strip();
        String codigo = reservas.nuevoCodigo();
        ReservaFila principal = new ReservaFila(codigo, v.fecha(), v.hora(), base.duracionMinutos(), s.personas(),
                elegidas.getFirst().id(), turno, EstadoReserva.CONFIRMADA, s.nombre().strip(), s.contacto().strip(),
                normalizado, comentarios, null, "panel", null);
        try {
            repo.insertar(principal);
            for (Reglas.Mesa extra : elegidas.subList(1, elegidas.size())) {
                repo.insertar(new ReservaFila(reservas.nuevoCodigo(), v.fecha(), v.hora(), base.duracionMinutos(), extra.asientos(),
                        extra.id(), turno, EstadoReserva.CONFIRMADA, s.nombre().strip(), s.contacto().strip(), normalizado,
                        "Mesa anexa de " + codigo, null, "panel", codigo));
            }
        } catch (DataIntegrityViolationException e) {
            throw new ErrorReserva(CodigoError.HORARIO_LLENO, "Una de las mesas se ocupó mientras registrabas la reserva. Vuelve a elegir.");
        }
        repo.registrarHistorial(codigo, null, EstadoReserva.CONFIRMADA, "Registrada por el personal", usuario.id());
        reservas.avisar(principal, "confirmada", "Registramos y confirmamos tu reserva %s para el %s a las %s.");
        return detalle(codigo);
    }

    private List<Reglas.Mesa> elegirMesas(Motor motor, ReservaManual m, int personas, LocalTime hora, List<Ocupacion> ocupadas) {
        List<Reglas.Mesa> todas = motor.reglas().mesas();
        if (m.mesas() == null || m.mesas().isEmpty()) {
            Optional<Reglas.Mesa> una = todas.stream()
                    .filter(x -> x.asientos() >= personas && motor.mesaLibre(ocupadas, x.id(), hora, null))
                    .min(Comparator.comparingInt(Reglas.Mesa::asientos));
            if (una.isEmpty()) {
                throw new ErrorReserva(CodigoError.HORARIO_LLENO,
                        "No hay una mesa libre para %d personas a las %s. Elige varias mesas para juntarlas.".formatted(personas, Motor.aHora(Motor.aMinutos(hora))),
                        Map.of("mesas", "Elige las mesas que se juntan."), null);
            }
            return List.of(una.get());
        }
        Set<String> pedidas = new LinkedHashSet<>(m.mesas());
        List<Reglas.Mesa> elegidas = new ArrayList<>();
        for (String id : pedidas) {
            Reglas.Mesa mesa = todas.stream().filter(x -> x.id().equals(id)).findFirst()
                    .orElseThrow(() -> new ErrorReserva(CodigoError.MESA_INVALIDA, "La mesa " + id + " no existe o no está activa.",
                            Map.of("mesas", "Revisa las mesas elegidas."), null));
            if (!motor.mesaLibre(ocupadas, id, hora, null)) {
                throw new ErrorReserva(CodigoError.HORARIO_LLENO, "La mesa %s ya está ocupada a esa hora.".formatted(id),
                        Map.of("mesas", "La mesa %s ya está ocupada a esa hora.".formatted(id)), null);
            }
            elegidas.add(mesa);
        }
        int asientos = elegidas.stream().mapToInt(Reglas.Mesa::asientos).sum();
        if (asientos < personas) {
            throw new ErrorReserva(CodigoError.MESA_INVALIDA,
                    "Las mesas elegidas suman %d asientos y vienen %d personas.".formatted(asientos, personas),
                    Map.of("mesas", "Faltan %d asientos.".formatted(personas - asientos)), null);
        }
        // La mesa principal es la más grande; las demás quedan como anexas.
        elegidas.sort(Comparator.comparingInt(Reglas.Mesa::asientos).reversed());
        return elegidas;
    }

    private static String limpiar(String codigo) {
        return codigo == null ? "" : codigo.strip().toUpperCase();
    }

    private static ErrorReserva noEncontrada() {
        return new ErrorReserva(CodigoError.NO_ENCONTRADA, "No existe una reserva con ese código.");
    }
}
