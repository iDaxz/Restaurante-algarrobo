package pe.algarrobo.motor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Function;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/**
 * Mismos casos que tests/disponibilidad.test.js y tests/estados.test.js: el motor de Java y el
 * del navegador tienen que dar las mismas respuestas.
 * Fechas de referencia (2026): martes 3 de noviembre; el lunes 9 el local está cerrado.
 */
class MotorTest {

    static final Reglas REGLAS = new Reglas(
            List.of(new Reglas.Turno("almuerzo", "Almuerzo", LocalTime.of(12, 0), LocalTime.of(16, 30)),
                    new Reglas.Turno("cena", "Cena", LocalTime.of(19, 0), LocalTime.of(23, 0))),
            List.of(new Reglas.Mesa("M1", 2, null), new Reglas.Mesa("M2", 2, null), new Reglas.Mesa("M3", 2, null),
                    new Reglas.Mesa("M4", 2, null), new Reglas.Mesa("M5", 2, null), new Reglas.Mesa("M6", 2, null),
                    new Reglas.Mesa("M7", 4, null), new Reglas.Mesa("M8", 4, null), new Reglas.Mesa("M9", 4, null),
                    new Reglas.Mesa("M10", 4, null), new Reglas.Mesa("M11", 4, null),
                    new Reglas.Mesa("M12", 6, null), new Reglas.Mesa("M13", 6, null),
                    new Reglas.Mesa("M14", 8, "Mesa larga")),
            Set.of(1), 90, 30, 60, 1, 8, 2, 3, 15, 0.3, 3, 5, Set.of(LocalDate.of(2026, 11, 12)));

    static final LocalDate MARTES = LocalDate.of(2026, 11, 3);
    static final LocalDate MIERCOLES = LocalDate.of(2026, 11, 4);
    static final LocalDate LUNES = LocalDate.of(2026, 11, 9);
    static final Ahora AHORA = new Ahora(MARTES, 10 * 60);

    final Motor motor = new Motor(REGLAS);
    int n = 0;

    Ocupacion ocupa(String mesa, String hora) {
        return new Ocupacion("T-" + (++n), mesa, LocalTime.parse(hora));
    }

    static Solicitud solicitud(String fecha, String hora, Integer personas) {
        return new Solicitud("Ana Quispe", "987654321", fecha, hora, personas, "");
    }

    static Function<LocalDate, List<Ocupacion>> dia(List<Ocupacion> ocupadas) {
        return f -> ocupadas;
    }

    @Nested
    @DisplayName("Turnos y horarios")
    class Turnos {
        @Test
        void elAlmuerzoOfreceLlegadasCada30MinutosHasta90AntesDelCierre() {
            assertThat(motor.horariosDelTurno(REGLAS.turnos().get(0)))
                    .containsExactly("12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00");
        }

        @Test
        void laCenaTerminaSuUltimaLlegadaALas2130() {
            assertThat(motor.horariosDelTurno(REGLAS.turnos().get(1))).last().isEqualTo("21:30");
        }

        @Test
        void unaHoraFueraDeTurnoNoPerteneceANinguno() {
            assertThat(motor.turnoDeHora("15:30")).isEmpty();
            assertThat(motor.turnoDeHora("16:00")).isEmpty();
            assertThat(motor.turnoDeHora("15:00")).get().extracting(Reglas.Turno::id).isEqualTo("almuerzo");
        }

        @Test
        void elLunesNoHayHorarios() {
            assertThat(motor.horariosDelDia(LUNES, 2, List.of(), AHORA, null)).isEmpty();
        }

        @Test
        void hoyLasHorasPasadasSeMarcanComoPasadas() {
            var horarios = motor.horariosDelDia(MARTES, 2, List.of(), new Ahora(MARTES, 13 * 60 + 10), null);
            assertThat(horarios.stream().filter(h -> h.estado().equals("pasado")).map(Horario::hora))
                    .containsExactly("12:00", "12:30", "13:00");
        }
    }

    @Nested
    @DisplayName("Mesas y capacidad")
    class Mesas {
        @Test
        void cadaGrupoRecibeMesasDeSuTamanoSinDesperdiciarMasDeDosAsientos() {
            assertThat(motor.mesasCompatibles(1)).allMatch(m -> m.asientos() == 2);
            assertThat(motor.mesasCompatibles(3)).allMatch(m -> m.asientos() == 4);
            assertThat(motor.mesasCompatibles(5)).allMatch(m -> m.asientos() == 6);
            assertThat(motor.mesasCompatibles(7)).extracting(Reglas.Mesa::id).containsExactly("M14");
        }

        @Test
        void seAsignaLaMesaMasPequenaQueSirve() {
            assertThat(motor.asignarMesa(List.of(), 4, LocalTime.of(20, 0), null)).get()
                    .extracting(Reglas.Mesa::asientos).isEqualTo(4);
        }

        @Test
        void dosReservasEnLaMismaMesaChocanAMenosDe90MinutosYA90No() {
            var ocupadas = List.of(ocupa("M14", "20:00"));
            assertThat(motor.mesaLibre(ocupadas, "M14", LocalTime.of(21, 0), null)).isFalse();
            assertThat(motor.mesaLibre(ocupadas, "M14", LocalTime.of(19, 0), null)).isFalse();
            assertThat(motor.mesaLibre(ocupadas, "M14", LocalTime.of(21, 30), null)).isTrue();
            assertThat(motor.mesaLibre(ocupadas, "M14", LocalTime.of(18, 30), null)).isTrue();
        }

        @Test
        void nuncaSeSuperaLaCapacidadALas2000CabenOnceParejas() {
            List<Ocupacion> ocupadas = new ArrayList<>();
            Set<String> usadas = new HashSet<>();
            for (int i = 0; i < 20; i++) {
                var mesa = motor.asignarMesa(ocupadas, 2, LocalTime.of(20, 0), null);
                if (mesa.isEmpty()) break;
                assertThat(usadas.add(mesa.get().id())).isTrue();
                ocupadas.add(new Ocupacion("P" + i, mesa.get().id(), LocalTime.of(20, 0)));
            }
            assertThat(ocupadas).hasSize(11); // 6 mesas de 2 + 5 de 4
        }
    }

    @Nested
    @DisplayName("Estado de cada día")
    class Dias {
        @Test
        void pasadoFueraDePlazoYCerrado() {
            assertThat(motor.estadoDelDia(MARTES.minusDays(1), 2, List.of(), AHORA, null)).isEqualTo("pasado");
            assertThat(motor.estadoDelDia(MARTES.plusDays(61), 2, List.of(), AHORA, null)).isEqualTo("fuera");
            assertThat(motor.estadoDelDia(LUNES, 2, List.of(), AHORA, null)).isEqualTo("cerrado");
        }

        @Test
        void unDiaEspecialCerradoNoOfreceHorarios() {
            assertThat(motor.estadoDelDia(LocalDate.of(2026, 11, 12), 2, List.of(), AHORA, null)).isEqualTo("cerrado");
            assertThat(motor.validarSolicitud(solicitud("2026-11-12", "20:00", 2), dia(List.of()), AHORA, null).codigo())
                    .isEqualTo(CodigoError.DIA_CERRADO);
        }

        @Test
        void sinReservasHayMesasYUnaSolaNoLlenaElDia() {
            assertThat(motor.estadoDelDia(MIERCOLES, 8, List.of(), AHORA, null)).isEqualTo("disponible");
            assertThat(motor.estadoDelDia(MIERCOLES, 8, List.of(ocupa("M14", "20:00")), AHORA, null)).isEqualTo("disponible");
        }

        @Test
        void conPocasCombinacionesLibresQuedaLimitadoYSinNingunaCompleto() {
            List<Ocupacion> casiLleno = new ArrayList<>();
            for (String h : List.of("12:00", "13:30", "19:00", "20:30")) casiLleno.add(ocupa("M14", h));
            // solo queda libre las 15:00: 1 de 10 horarios, menos del 30 %
            assertThat(motor.estadoDelDia(MIERCOLES, 8, casiLleno, AHORA, null)).isEqualTo("limitado");

            List<Ocupacion> lleno = new ArrayList<>();
            for (String h : List.of("12:00", "13:00", "14:00", "15:00", "19:00", "20:00", "21:00")) lleno.add(ocupa("M14", h));
            assertThat(motor.estadoDelDia(MIERCOLES, 8, lleno, AHORA, null)).isEqualTo("completo");
        }
    }

    @Nested
    @DisplayName("Validación de una solicitud")
    class Validacion {
        @ParameterizedTest(name = "{0}")
        @CsvSource(delimiter = '|', nullValues = "NULO", emptyValue = "", value = {
                "nombre vacío        | ''         | 987654321 | 2026-11-04 | 20:00 | 2    | DATOS_INVALIDOS      | nombre",
                "contacto inválido   | Ana Quispe | 1234      | 2026-11-04 | 20:00 | 2    | DATOS_INVALIDOS      | contacto",
                "grupo grande        | Ana Quispe | 987654321 | 2026-11-04 | 20:00 | 9    | GRUPO_GRANDE         | personas",
                "fecha pasada        | Ana Quispe | 987654321 | 2026-11-02 | 20:00 | 2    | FECHA_PASADA         | fecha",
                "fuera de plazo      | Ana Quispe | 987654321 | 2027-03-01 | 20:00 | 2    | FECHA_FUERA_DE_PLAZO | fecha",
                "día cerrado         | Ana Quispe | 987654321 | 2026-11-09 | 20:00 | 2    | DIA_CERRADO          | fecha",
                "hora fuera de turno | Ana Quispe | 987654321 | 2026-11-04 | 17:00 | 2    | HORARIO_INVALIDO     | hora",
                "fecha mal escrita   | Ana Quispe | 987654321 | 04/11/2026 | 20:00 | 2    | DATOS_INVALIDOS      | fecha",
                "sin personas        | Ana Quispe | 987654321 | 2026-11-04 | 20:00 | NULO | DATOS_INVALIDOS      | personas",
        })
        void cadaProblemaTieneSuCodigoYSuCampo(String caso, String nombre, String contacto, String fecha, String hora,
                                               Integer personas, CodigoError codigo, String campo) {
            var v = motor.validarSolicitud(new Solicitud(nombre, contacto, fecha, hora, personas, ""), dia(List.of()), AHORA, null);
            assertThat(v.codigo()).isEqualTo(codigo);
            assertThat(v.errores()).containsKey(campo);
        }

        @Test
        void unaHoraDeHoyQueYaPasoNoSeAcepta() {
            var v = motor.validarSolicitud(solicitud("2026-11-03", "12:00", 2), dia(List.of()), new Ahora(MARTES, 13 * 60 + 10), null);
            assertThat(v.codigo()).isEqualTo(CodigoError.HORARIO_PASADO);
        }

        @Test
        void laMesaElegidaEnElPlanoSeRespetaSiSirveYEstaLibre() {
            Solicitud conMesa = new Solicitud("Ana Quispe", "987654321", "2026-11-04", "20:00", 4, "", "m9");
            var v = motor.validarSolicitud(conMesa, dia(List.of()), AHORA, null);
            assertThat(v.ok()).isTrue();
            assertThat(v.mesa().id()).isEqualTo("M9");
        }

        @Test
        void unaMesaElegidaDeOtroTamanoOOcupadaSeRechazaEnElCampoMesa() {
            var chica = motor.validarSolicitud(new Solicitud("Ana Quispe", "987654321", "2026-11-04", "20:00", 4, "", "M1"), dia(List.of()), AHORA, null);
            assertThat(chica.codigo()).isEqualTo(CodigoError.MESA_INVALIDA);
            assertThat(chica.errores()).containsKey("mesa");
            var ocupada = motor.validarSolicitud(new Solicitud("Ana Quispe", "987654321", "2026-11-04", "20:00", 4, "", "M9"),
                    dia(List.of(ocupa("M9", "19:30"))), AHORA, null);
            assertThat(ocupada.codigo()).isEqualTo(CodigoError.MESA_OCUPADA);
        }

        @Test
        void elPlanoDiceDeCadaMesaSiEstaLibreOcupadaONoSirve() {
            var estados = motor.estadoDeMesas(List.of(ocupa("M7", "20:00")), 4, LocalTime.of(20, 0), null);
            assertThat(estados).hasSize(14);
            assertThat(estados).filteredOn(e -> e.id().equals("M7")).extracting(Motor.EstadoMesa::estado).containsExactly("ocupada");
            assertThat(estados).filteredOn(e -> e.id().equals("M8")).extracting(Motor.EstadoMesa::estado).containsExactly("libre");
            assertThat(estados).filteredOn(e -> e.id().equals("M1")).extracting(Motor.EstadoMesa::estado).containsExactly("no-sirve");
        }

        @Test
        void horarioLleno() {
            var v = motor.validarSolicitud(solicitud("2026-11-04", "20:00", 8), dia(List.of(ocupa("M14", "20:00"))), AHORA, null);
            assertThat(v.codigo()).isEqualTo(CodigoError.HORARIO_LLENO);
        }

        @Test
        void unaSolicitudCorrectaRecibeMesaYAlModificarNoSeCuentaASiMisma() {
            var v = motor.validarSolicitud(solicitud("2026-11-04", "20:00", 2), dia(List.of()), AHORA, null);
            assertThat(v.ok()).isTrue();
            assertThat(v.mesa().asientos()).isEqualTo(2);

            var propia = new Ocupacion("ALG-PROPI", "M14", LocalTime.of(20, 0));
            assertThat(motor.validarSolicitud(solicitud("2026-11-04", "20:00", 8), dia(List.of(propia)), AHORA, "ALG-PROPI").ok()).isTrue();
        }
    }

    @Nested
    @DisplayName("Contacto y reglas contra duplicados")
    class Contacto {
        final LocalDate fecha = MIERCOLES;

        ReservaActiva activa(String codigo, LocalDate f, String hora) {
            return new ReservaActiva(codigo, f, LocalTime.parse(hora), EstadoReserva.CONFIRMADA);
        }

        CodigoError codigoDe(Runnable accion) {
            try {
                accion.run();
                return null;
            } catch (ErrorReserva e) {
                return e.codigo();
            }
        }

        @Test
        void aceptaCorreosYTelefonosDeNueveDigitos() {
            assertThat(Motor.esContactoValido("ana@correo.pe")).isTrue();
            assertThat(Motor.esContactoValido("987 654 321")).isTrue();
            assertThat(Motor.esContactoValido("+51 987654321")).isTrue();
            assertThat(Motor.esContactoValido("98765")).isFalse();
            assertThat(Motor.esContactoValido("ana@correo")).isFalse();
        }

        @Test
        void elMismoTelefonoEscritoDistintoEsElMismoContacto() {
            assertThat(Motor.normalizarContacto("+51 987-654-321")).isEqualTo(Motor.normalizarContacto("987654321"));
            assertThat(Motor.normalizarContacto(" Ana@Correo.PE ")).isEqualTo("ana@correo.pe");
        }

        @Test
        void noPermiteDosReservasQueSeCrucen() {
            assertThat(codigoDe(() -> motor.validarReglasDeContacto(fecha, LocalTime.of(20, 30),
                    List.of(activa("A", fecha, "20:00")), AHORA, null))).isEqualTo(CodigoError.CONTACTO_DUPLICADO);
        }

        @Test
        void a90MinutosOEnOtroDiaSiSePermite() {
            var una = List.of(activa("A", fecha, "20:00"));
            assertThat(codigoDe(() -> motor.validarReglasDeContacto(fecha, LocalTime.of(21, 30), una, AHORA, null))).isNull();
            assertThat(codigoDe(() -> motor.validarReglasDeContacto(fecha.plusDays(1), LocalTime.of(20, 0), una, AHORA, null))).isNull();
        }

        @Test
        void lasCanceladasYLasPasadasNoCuentan() {
            var cancelada = new ReservaActiva("C", fecha, LocalTime.of(20, 0), EstadoReserva.CANCELADA);
            var pasada = activa("P", MARTES.minusDays(1), "20:00");
            assertThat(codigoDe(() -> motor.validarReglasDeContacto(fecha, LocalTime.of(20, 0), List.of(cancelada, pasada), AHORA, null))).isNull();
        }

        @Test
        void comoMaximoTresReservasActivasYAlModificarLaPropiaNoCuenta() {
            var tres = List.of(activa("A", fecha, "12:00"), activa("B", fecha.plusDays(1), "12:00"), activa("C", fecha.plusDays(2), "12:00"));
            assertThat(codigoDe(() -> motor.validarReglasDeContacto(fecha.plusDays(3), LocalTime.of(12, 0), tres, AHORA, null)))
                    .isEqualTo(CodigoError.LIMITE_RESERVAS);
            assertThat(codigoDe(() -> motor.validarReglasDeContacto(fecha.plusDays(3), LocalTime.of(12, 0), tres, AHORA, "C"))).isNull();
        }
    }

    @Nested
    @DisplayName("Alternativas, cambios y estados")
    class Otros {
        @Test
        void sugiereHorasCercanasYOtrosDiasSinLunes() {
            List<Ocupacion> mesaLarga = List.of(ocupa("M14", "19:00"), ocupa("M14", "20:00"));
            Function<LocalDate, List<Ocupacion>> ocupacion = f -> f.equals(LocalDate.of(2026, 11, 7)) ? mesaLarga : List.of();
            var alt = motor.buscarAlternativas(LocalDate.of(2026, 11, 7), "20:00", 8, ocupacion, AHORA, null);
            assertThat(alt.mismoDia()).extracting(Horario::hora).doesNotContain("20:00").hasSizeLessThanOrEqualTo(3);
            assertThat(alt.otrosDias()).extracting(Alternativas.OtroDia::fecha)
                    .containsExactly("2026-11-08", "2026-11-10", "2026-11-11"); // salta el lunes 9
        }

        @Test
        void seCambiaHastaExactamente3HorasAntes() {
            assertThat(motor.puedeCambiar(EstadoReserva.CONFIRMADA, MARTES, LocalTime.of(13, 0), AHORA)).isTrue();
            assertThat(motor.puedeCambiar(EstadoReserva.CONFIRMADA, MARTES, LocalTime.of(12, 30), AHORA)).isFalse();
            assertThat(motor.puedeCambiar(EstadoReserva.CANCELADA, MIERCOLES, LocalTime.of(20, 0), AHORA)).isFalse();
        }

        @Test
        void transicionesPermitidasYProhibidas() {
            assertThat(EstadoReserva.PENDIENTE.puedePasarA(EstadoReserva.CONFIRMADA)).isTrue();
            assertThat(EstadoReserva.CONFIRMADA.puedePasarA(EstadoReserva.COMPLETADA)).isTrue();
            assertThat(EstadoReserva.PENDIENTE.puedePasarA(EstadoReserva.COMPLETADA)).isFalse();
            assertThat(EstadoReserva.CANCELADA.puedePasarA(EstadoReserva.CONFIRMADA)).isFalse();
            assertThatThrownBy(() -> EstadoReserva.CANCELADA.exigirTransicion(EstadoReserva.CANCELADA))
                    .isInstanceOf(ErrorReserva.class)
                    .hasMessageContaining("cancelada");
        }

        @Test
        void unaReservaCuyaMesaTerminoSeVeComoCompletada() {
            var durante = new Ahora(MARTES, 20 * 60 + 60);
            var despues = new Ahora(MARTES, 20 * 60 + 90);
            assertThat(motor.estadoVisible(EstadoReserva.CONFIRMADA, MARTES, LocalTime.of(20, 0), durante)).isEqualTo(EstadoReserva.CONFIRMADA);
            assertThat(motor.estadoVisible(EstadoReserva.CONFIRMADA, MARTES, LocalTime.of(20, 0), despues)).isEqualTo(EstadoReserva.COMPLETADA);
            assertThat(motor.estadoVisible(EstadoReserva.CANCELADA, MARTES, LocalTime.of(20, 0), despues)).isEqualTo(EstadoReserva.CANCELADA);
        }
    }
}
