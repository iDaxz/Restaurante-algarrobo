package pe.algarrobo.motor;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.regex.Pattern;

/**
 * Motor de disponibilidad: las mismas reglas que js/core/disponibilidad.js, sin acceso a datos.
 * Recibe lo que ocupa mesa en un día y devuelve resultados; el servicio lo llama dentro de una
 * transacción. Las pruebas de MotorTest repiten los casos de tests/disponibilidad.test.js.
 */
public final class Motor {

    private static final Pattern CORREO = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$");
    private static final Pattern NUEVE_DIGITOS = Pattern.compile("^\\d{9}$");

    private final Reglas reglas;

    public Motor(Reglas reglas) {
        this.reglas = reglas;
    }

    public Reglas reglas() {
        return reglas;
    }

    // ---------- Horarios y mesas ----------

    public static String aHora(int minutos) {
        return "%02d:%02d".formatted(minutos / 60, minutos % 60);
    }

    public static int aMinutos(LocalTime hora) {
        return hora.getHour() * 60 + hora.getMinute();
    }

    public List<String> horariosDelTurno(Reglas.Turno turno) {
        List<String> horas = new ArrayList<>();
        int ultimo = aMinutos(turno.fin()) - reglas.duracionMinutos();
        for (int m = aMinutos(turno.inicio()); m <= ultimo; m += reglas.intervaloMinutos()) {
            horas.add(aHora(m));
        }
        return horas;
    }

    public Optional<Reglas.Turno> turnoDeHora(String hora) {
        return reglas.turnos().stream().filter(t -> horariosDelTurno(t).contains(hora)).findFirst();
    }

    /** 0 = domingo … 6 = sábado, como getUTCDay() en el frontend. */
    public static int diaSemana(LocalDate fecha) {
        return fecha.getDayOfWeek().getValue() % 7;
    }

    /** Cerrado por descanso semanal o por ser un día especial (evento privado, feriado…). */
    public boolean estaCerrado(LocalDate fecha) {
        return reglas.diasCerrados().contains(diaSemana(fecha)) || reglas.fechasCerradas().contains(fecha);
    }

    /** Mesas donde cabe el grupo sin desperdiciar más asientos de la holgura permitida, de menor a mayor. */
    public List<Reglas.Mesa> mesasCompatibles(int personas) {
        return reglas.mesas().stream()
                .filter(m -> m.asientos() >= personas && m.asientos() - personas <= reglas.holguraAsientos())
                .sorted(Comparator.comparingInt(Reglas.Mesa::asientos))
                .toList();
    }

    /** Libre si nada que ocupe esa mesa empieza a menos de la duración de una reserva. */
    public boolean mesaLibre(List<Ocupacion> ocupadas, String mesaId, LocalTime hora, String excluirCodigo) {
        int inicio = aMinutos(hora);
        return ocupadas.stream().noneMatch(o ->
                o.mesaId().equals(mesaId)
                        && !o.codigo().equals(excluirCodigo)
                        && Math.abs(aMinutos(o.hora()) - inicio) < reglas.duracionMinutos());
    }

    public List<Reglas.Mesa> mesasLibres(List<Ocupacion> ocupadas, int personas, LocalTime hora, String excluirCodigo) {
        return mesasCompatibles(personas).stream()
                .filter(m -> mesaLibre(ocupadas, m.id(), hora, excluirCodigo))
                .toList();
    }

    public Optional<Reglas.Mesa> asignarMesa(List<Ocupacion> ocupadas, int personas, LocalTime hora, String excluirCodigo) {
        return mesasLibres(ocupadas, personas, hora, excluirCodigo).stream().findFirst();
    }

    public record EstadoMesa(String id, int asientos, String nombre, String estado) {
    }

    /** Cada mesa a esa hora para el plano: "libre", "ocupada" o "no-sirve" (no es del tamaño del grupo). */
    public List<EstadoMesa> estadoDeMesas(List<Ocupacion> ocupadas, int personas, LocalTime hora, String excluirCodigo) {
        Set<String> sirven = new java.util.HashSet<>(mesasCompatibles(personas).stream().map(Reglas.Mesa::id).toList());
        return reglas.mesas().stream().map(m -> new EstadoMesa(m.id(), m.asientos(), m.nombre(),
                        !sirven.contains(m.id()) ? "no-sirve" : mesaLibre(ocupadas, m.id(), hora, excluirCodigo) ? "libre" : "ocupada"))
                .toList();
    }

    // ---------- Días ----------

    private static boolean horaPasada(LocalDate fecha, String hora, Ahora ahora) {
        return fecha.isBefore(ahora.fecha())
                || (fecha.equals(ahora.fecha()) && aMinutos(LocalTime.parse(hora)) <= ahora.minutos());
    }

    public boolean fechaFueraDeVentana(LocalDate fecha, Ahora ahora) {
        return fecha.isBefore(ahora.fecha()) || ChronoUnit.DAYS.between(ahora.fecha(), fecha) > reglas.ventanaDias();
    }

    public List<Horario> horariosDelDia(LocalDate fecha, int personas, List<Ocupacion> ocupadas, Ahora ahora, String excluirCodigo) {
        if (estaCerrado(fecha)) return List.of();
        List<Horario> horarios = new ArrayList<>();
        for (Reglas.Turno turno : reglas.turnos()) {
            for (String hora : horariosDelTurno(turno)) {
                if (horaPasada(fecha, hora, ahora)) {
                    horarios.add(new Horario(hora, turno.id(), "pasado", 0));
                    continue;
                }
                int libres = mesasLibres(ocupadas, personas, LocalTime.parse(hora), excluirCodigo).size();
                horarios.add(new Horario(hora, turno.id(), libres > 0 ? "libre" : "completo", libres));
            }
        }
        return horarios;
    }

    /** 'pasado' | 'fuera' | 'cerrado' | 'completo' | 'limitado' | 'disponible' */
    public String estadoDelDia(LocalDate fecha, int personas, List<Ocupacion> ocupadas, Ahora ahora, String excluirCodigo) {
        if (fecha.isBefore(ahora.fecha())) return "pasado";
        if (fechaFueraDeVentana(fecha, ahora)) return "fuera";
        if (estaCerrado(fecha)) return "cerrado";
        List<Horario> horarios = horariosDelDia(fecha, personas, ocupadas, ahora, excluirCodigo).stream()
                .filter(h -> !h.estado().equals("pasado")).toList();
        if (horarios.isEmpty()) return "pasado";
        int posibles = horarios.size() * mesasCompatibles(personas).size();
        int libres = horarios.stream().mapToInt(Horario::mesasLibres).sum();
        if (libres == 0) return "completo";
        return (double) libres / posibles < reglas.umbralLimitado() ? "limitado" : "disponible";
    }

    // ---------- Validación ----------

    /** Resultado de validar: el primer código de error, los mensajes por campo y la mesa asignada. */
    public record Validacion(CodigoError codigo, Map<String, String> errores, Reglas.Mesa mesa, LocalDate fecha, LocalTime hora) {
        public boolean ok() {
            return codigo == null;
        }
    }

    public Validacion validarSolicitud(Solicitud s, Function<LocalDate, List<Ocupacion>> ocupacionDe, Ahora ahora, String excluirCodigo) {
        Map<String, String> errores = new LinkedHashMap<>();
        CodigoError[] codigo = {null};
        var fallar = (Fallo) (campo, cod, mensaje) -> {
            errores.put(campo, mensaje);
            if (codigo[0] == null) codigo[0] = cod;
        };
        String nombre = s.nombre() == null ? "" : s.nombre();
        String contacto = s.contacto() == null ? "" : s.contacto();

        if (nombre.strip().length() < 2) fallar.en("nombre", CodigoError.DATOS_INVALIDOS, "Escribe el nombre de quien reserva.");
        else if (nombre.strip().length() > 80) fallar.en("nombre", CodigoError.DATOS_INVALIDOS, "El nombre es demasiado largo.");
        if (contacto.isBlank()) fallar.en("contacto", CodigoError.DATOS_INVALIDOS, "Necesitamos un correo o un teléfono para avisarte.");
        else if (!esContactoValido(contacto)) fallar.en("contacto", CodigoError.DATOS_INVALIDOS, "Revisa el dato: escribe un correo (nombre@correo.com) o un teléfono de 9 dígitos.");
        if (s.comentarios() != null && s.comentarios().strip().length() > 280) fallar.en("comentarios", CodigoError.DATOS_INVALIDOS, "Los comentarios admiten hasta 280 caracteres.");

        Integer personas = s.personas();
        if (personas == null || personas < reglas.minPersonas()) fallar.en("personas", CodigoError.DATOS_INVALIDOS, "Indica cuántas personas vienen.");
        else if (personas > reglas.maxPersonasEnLinea()) fallar.en("personas", CodigoError.GRUPO_GRANDE,
                "Para grupos de más de %d personas, llámanos y armamos la mesa.".formatted(reglas.maxPersonasEnLinea()));

        LocalDate fecha = leerFecha(s.fecha());
        if (fecha == null) fallar.en("fecha", CodigoError.DATOS_INVALIDOS, "Elige una fecha en el calendario.");
        else if (fecha.isBefore(ahora.fecha())) fallar.en("fecha", CodigoError.FECHA_PASADA, "Esa fecha ya pasó. Elige hoy o un día posterior.");
        else if (fechaFueraDeVentana(fecha, ahora)) fallar.en("fecha", CodigoError.FECHA_FUERA_DE_PLAZO,
                "Aceptamos reservas hasta con %d días de anticipación.".formatted(reglas.ventanaDias()));
        else if (estaCerrado(fecha)) fallar.en("fecha", CodigoError.DIA_CERRADO, "Ese día descansamos. Elige otra fecha.");

        LocalTime hora = leerHora(s.hora());
        if (hora == null) fallar.en("hora", CodigoError.DATOS_INVALIDOS, "Elige un horario de llegada.");
        else if (turnoDeHora(s.hora()).isEmpty()) fallar.en("hora", CodigoError.HORARIO_INVALIDO, "Ese horario no está dentro de nuestros turnos.");
        else if (fecha != null && horaPasada(fecha, s.hora(), ahora)) fallar.en("hora", CodigoError.HORARIO_PASADO, "Ese horario ya pasó. Elige uno más tarde.");

        if (codigo[0] != null) return new Validacion(codigo[0], errores, null, fecha, hora);

        List<Ocupacion> ocupacion = ocupacionDe.apply(fecha);
        String elegida = s.mesaElegida();
        if (elegida != null) {
            // La persona eligió su mesa en el plano: tiene que servir para su grupo y seguir libre.
            Optional<Reglas.Mesa> pedida = mesasCompatibles(personas).stream().filter(m -> m.id().equals(elegida)).findFirst();
            if (pedida.isEmpty()) {
                return new Validacion(CodigoError.MESA_INVALIDA,
                        Map.of("mesa", "Esa mesa no es para %d %s. Elige otra en el plano.".formatted(personas, personas == 1 ? "persona" : "personas")),
                        null, fecha, hora);
            }
            if (!mesaLibre(ocupacion, elegida, hora, excluirCodigo)) {
                return new Validacion(CodigoError.MESA_OCUPADA,
                        Map.of("mesa", "Alguien acaba de tomar esa mesa a las %s. Elige otra en el plano.".formatted(s.hora())),
                        null, fecha, hora);
            }
            return new Validacion(null, Map.of(), pedida.get(), fecha, hora);
        }
        Optional<Reglas.Mesa> mesa = asignarMesa(ocupacion, personas, hora, excluirCodigo);
        if (mesa.isEmpty()) {
            return new Validacion(CodigoError.HORARIO_LLENO,
                    Map.of("hora", "A las %s ya no quedan mesas para %d %s.".formatted(s.hora(), personas, personas == 1 ? "persona" : "personas")),
                    null, fecha, hora);
        }
        return new Validacion(null, Map.of(), mesa.get(), fecha, hora);
    }

    @FunctionalInterface
    private interface Fallo {
        void en(String campo, CodigoError codigo, String mensaje);
    }

    private static LocalDate leerFecha(String texto) {
        if (texto == null || !texto.matches("\\d{4}-\\d{2}-\\d{2}")) return null;
        try {
            return LocalDate.parse(texto);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static LocalTime leerHora(String texto) {
        if (texto == null || !texto.matches("\\d{2}:\\d{2}")) return null;
        try {
            return LocalTime.parse(texto);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    // ---------- Contacto ----------

    /** Forma comparable: correo en minúsculas o teléfono de 9 dígitos sin prefijo 51. */
    public static String normalizarContacto(String contacto) {
        String limpio = contacto == null ? "" : contacto.strip().toLowerCase().replaceAll("[\\s()+-]", "");
        return limpio.matches("^51\\d{9}$") ? limpio.substring(2) : limpio;
    }

    public static boolean esContactoValido(String contacto) {
        String texto = contacto.strip();
        if (texto.contains("@")) return CORREO.matcher(texto).matches();
        String digitos = texto.replaceAll("[\\s()+-]", "").replaceFirst("^51", "");
        return NUEVE_DIGITOS.matcher(digitos).matches();
    }

    public static long minutosHastaLlegada(LocalDate fecha, LocalTime hora, Ahora ahora) {
        return ChronoUnit.DAYS.between(ahora.fecha(), fecha) * 1440 + aMinutos(hora) - ahora.minutos();
    }

    /**
     * Reglas contra duplicados y abuso: el contacto no puede tener reservas activas que se crucen
     * (mismo día, a menos de la duración) ni más de maxReservasActivasPorContacto a futuro.
     * Lanza CONTACTO_DUPLICADO o LIMITE_RESERVAS.
     */
    public void validarReglasDeContacto(LocalDate fecha, LocalTime hora, List<ReservaActiva> delContacto, Ahora ahora, String excluirCodigo) {
        List<ReservaActiva> vigentes = delContacto.stream()
                .filter(r -> !r.codigo().equals(excluirCodigo))
                .filter(r -> r.estado().esActivo())
                .filter(r -> minutosHastaLlegada(r.fecha(), r.hora(), ahora) + reglas.duracionMinutos() > 0)
                .toList();
        Optional<ReservaActiva> choque = vigentes.stream()
                .filter(r -> r.fecha().equals(fecha) && Math.abs(aMinutos(r.hora()) - aMinutos(hora)) < reglas.duracionMinutos())
                .findFirst();
        if (choque.isPresent()) {
            String mensaje = "Ya tienes una reserva (%s) ese día a las %s. Modifícala en lugar de crear otra."
                    .formatted(choque.get().codigo(), choque.get().hora());
            throw new ErrorReserva(CodigoError.CONTACTO_DUPLICADO, mensaje, Map.of("contacto", mensaje), null);
        }
        if (vigentes.size() >= reglas.maxReservasActivasPorContacto()) {
            String mensaje = "Ya tienes %d reservas activas. Cancela alguna o llámanos para reservar otra.".formatted(vigentes.size());
            throw new ErrorReserva(CodigoError.LIMITE_RESERVAS, mensaje, Map.of("contacto", mensaje), null);
        }
    }

    // ---------- Alternativas y cambios ----------

    public Alternativas buscarAlternativas(LocalDate fecha, String hora, int personas,
                                           Function<LocalDate, List<Ocupacion>> ocupacionDe, Ahora ahora, String excluirCodigo) {
        int objetivo = aMinutos(LocalTime.parse(hora));
        List<Horario> mismoDia = horariosDelDia(fecha, personas, ocupacionDe.apply(fecha), ahora, excluirCodigo).stream()
                .filter(h -> h.estado().equals("libre"))
                .sorted(Comparator.comparingInt(h -> Math.abs(aMinutos(LocalTime.parse(h.hora())) - objetivo)))
                .limit(3)
                .sorted(Comparator.comparing(Horario::hora))
                .toList();

        List<Alternativas.OtroDia> otrosDias = new ArrayList<>();
        for (int i = 1; i <= 21 && otrosDias.size() < 3; i++) {
            LocalDate otra = fecha.plusDays(i);
            if (fechaFueraDeVentana(otra, ahora) || estaCerrado(otra)) continue;
            if (asignarMesa(ocupacionDe.apply(otra), personas, LocalTime.parse(hora), excluirCodigo).isPresent()) {
                otrosDias.add(new Alternativas.OtroDia(otra.toString(), hora));
            }
        }
        return new Alternativas(mismoDia, otrosDias);
    }

    /** Se puede modificar o cancelar hasta horasParaCambios antes de la llegada. */
    public boolean puedeCambiar(EstadoReserva estado, LocalDate fecha, LocalTime hora, Ahora ahora) {
        return estado.esActivo() && minutosHastaLlegada(fecha, hora, ahora) >= reglas.horasParaCambios() * 60L;
    }

    /** Estado a mostrar: una reserva activa cuya mesa ya terminó se ve como completada. */
    public EstadoReserva estadoVisible(EstadoReserva estado, LocalDate fecha, LocalTime hora, Ahora ahora) {
        if (!estado.esActivo()) return estado;
        return minutosHastaLlegada(fecha, hora, ahora) + reglas.duracionMinutos() <= 0 ? EstadoReserva.COMPLETADA : estado;
    }
}
