package pe.algarrobo.web;

import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.jayway.jsonpath.JsonPath;

import pe.algarrobo.BaseDePrueba;

/** La API de punta a punta contra PostgreSQL: mismas respuestas que espera el frontend. */
@AutoConfigureMockMvc
class ApiReservasTest extends BaseDePrueba {

    @Autowired
    MockMvc mvc;

    static String reserva(String contacto, String fecha, String hora, int personas) {
        return """
                {"nombre":"Ana Quispe","contacto":"%s","fecha":"%s","hora":"%s","personas":%d,"comentarios":"Cumpleaños"}
                """.formatted(contacto, fecha, hora, personas);
    }

    ResultActions crear(String cuerpo, String sesion) throws Exception {
        return mvc.perform(post("/api/v1/reservas").header("X-Sesion", sesion).contentType(MediaType.APPLICATION_JSON).content(cuerpo));
    }

    String codigoDe(ResultActions r) throws Exception {
        return JsonPath.read(r.andReturn().getResponse().getContentAsString(), "$.codigo");
    }

    @Test
    void crearUnaReservaLaDejaPendienteConMesaAsignada() throws Exception {
        crear(reserva("987654321", "2026-11-04", "20:00", 4), "sesion-a1")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.codigo").value(org.hamcrest.Matchers.matchesPattern("ALG-[A-Z0-9]{5}")))
                .andExpect(jsonPath("$.estado").value("pendiente"))
                .andExpect(jsonPath("$.mesaAsientos").value(4))
                .andExpect(jsonPath("$.turno").value("cena"))
                .andExpect(jsonPath("$.modificable").value(true));
    }

    @Test
    void losErroresDeValidacionTraenCodigoYCampo() throws Exception {
        crear(reserva("123", "2026-11-09", "20:00", 2), "sesion-a1")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("DATOS_INVALIDOS"))
                .andExpect(jsonPath("$.errores.contacto").exists())
                .andExpect(jsonPath("$.errores.fecha").exists());

        crear(reserva("987654321", "2026-11-04", "20:00", 12), "sesion-a1")
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.codigo").value("GRUPO_GRANDE"));

        mvc.perform(post("/api/v1/reservas").contentType(MediaType.APPLICATION_JSON).content("{no es json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("DATOS_INVALIDOS"));
    }

    @Test
    void unHorarioLlenoResponde409ConAlternativas() throws Exception {
        crear(reserva("987654321", "2026-11-04", "20:00", 8), "sesion-a1").andExpect(status().isCreated());
        crear(reserva("911111111", "2026-11-04", "20:00", 8), "sesion-b1")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("HORARIO_LLENO"))
                .andExpect(jsonPath("$.alternativas.otrosDias[0].fecha").value("2026-11-05"));
    }

    @Test
    void reglasDeContactoSinCrucesYMaximoTresActivas() throws Exception {
        crear(reserva("987654321", "2026-11-04", "20:00", 2), "s-contacto").andExpect(status().isCreated());
        crear(reserva("+51 987 654 321", "2026-11-04", "20:30", 2), "s-contacto")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("CONTACTO_DUPLICADO"))
                .andExpect(jsonPath("$.errores.contacto").exists());

        crear(reserva("987654321", "2026-11-05", "20:00", 2), "s-contacto").andExpect(status().isCreated());
        crear(reserva("987654321", "2026-11-06", "20:00", 2), "s-contacto").andExpect(status().isCreated());
        crear(reserva("987654321", "2026-11-07", "20:00", 2), "s-contacto")
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.codigo").value("LIMITE_RESERVAS"));
    }

    @Test
    void consultarExigeCodigoYContactoQueCoincidan() throws Exception {
        String codigo = codigoDe(crear(reserva("ana@correo.pe", "2026-11-04", "13:00", 2), "s-consulta"));

        mvc.perform(post("/api/v1/reservas/consultar").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"codigo\":\"%s\",\"contacto\":\"ANA@correo.pe \"}".formatted(codigo.toLowerCase())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.codigo").value(codigo));

        mvc.perform(post("/api/v1/reservas/consultar").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"codigo\":\"%s\",\"contacto\":\"otra@correo.pe\"}".formatted(codigo)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.codigo").value("NO_ENCONTRADA"));
    }

    @Test
    void misReservasSeConsultanEnUnaSolaPeticion() throws Exception {
        String uno = codigoDe(crear(reserva("987654321", "2026-11-04", "13:00", 2), "s-varias"));
        String dos = codigoDe(crear(reserva("987654321", "2026-11-05", "13:00", 2), "s-varias"));
        mvc.perform(post("/api/v1/reservas/consultar-varias").contentType(MediaType.APPLICATION_JSON).content("""
                        {"reservas":[{"codigo":"%s","contacto":"987654321"},{"codigo":"%s","contacto":"987654321"},
                                     {"codigo":"%s","contacto":"otro@correo.pe"},{"codigo":"ALG-ZZZZZ","contacto":"987654321"}]}
                        """.formatted(uno, dos, uno)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reservas.length()").value(2))
                .andExpect(jsonPath("$.noEncontradas.length()").value(2));
    }

    @Test
    void modificarVuelveAPendienteYCancelarDosVecesSeRechaza() throws Exception {
        String codigo = codigoDe(crear(reserva("987654321", "2026-11-04", "20:00", 2), "s-cambios"));
        jdbc.sql("UPDATE reservas SET estado = 'confirmada' WHERE codigo = ?").param(codigo).update();

        mvc.perform(patch("/api/v1/reservas/" + codigo).header("X-Sesion", "s-cambios").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"contacto\":\"987654321\",\"cambios\":{\"hora\":\"21:00\",\"personas\":4}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hora").value("21:00"))
                .andExpect(jsonPath("$.mesaAsientos").value(4))
                .andExpect(jsonPath("$.estado").value("pendiente"));

        mvc.perform(post("/api/v1/reservas/" + codigo + "/cancelar").contentType(MediaType.APPLICATION_JSON).content("{\"contacto\":\"987654321\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("cancelada"));
        mvc.perform(post("/api/v1/reservas/" + codigo + "/cancelar").contentType(MediaType.APPLICATION_JSON).content("{\"contacto\":\"987654321\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("TRANSICION_INVALIDA"));

        Long cambios = jdbc.sql("SELECT count(*) FROM reservas_historial WHERE codigo = ?").param(codigo).query(Long.class).single();
        Long avisos = jdbc.sql("SELECT count(*) FROM avisos WHERE codigo = ? AND NOT enviado").param(codigo).query(Long.class).single();
        org.assertj.core.api.Assertions.assertThat(cambios).isEqualTo(3); // creada, modificada, cancelada
        org.assertj.core.api.Assertions.assertThat(avisos).isEqualTo(3);  // simulados: no se envían
    }

    @Test
    void menosDeTresHorasAntesNoSePuedeCambiar() throws Exception {
        // Hoy martes a las 12:30, y son las 10:00
        String codigo = codigoDe(crear(reserva("987654321", "2026-11-03", "12:30", 2), "s-plazo"));
        mvc.perform(post("/api/v1/reservas/" + codigo + "/cancelar").contentType(MediaType.APPLICATION_JSON).content("{\"contacto\":\"987654321\"}"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.codigo").value("FUERA_DE_PLAZO_CAMBIOS"));
    }

    @Test
    void unaMesaApartadaBloqueaAOtrasSesionesPeroNoASuDueno() throws Exception {
        String pedido = "{\"fecha\":\"2026-11-04\",\"hora\":\"20:00\",\"personas\":8}";
        mvc.perform(post("/api/v1/retenciones").header("X-Sesion", "sesion-duena").contentType(MediaType.APPLICATION_JSON).content(pedido))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.mesa").value("M14"))
                .andExpect(jsonPath("$.expira").value(AHORA.plusSeconds(300).toEpochMilli()));

        mvc.perform(get("/api/v1/disponibilidad/dia?fecha=2026-11-04&personas=8").header("X-Sesion", "otra-sesion"))
                .andExpect(jsonPath("$[?(@.hora=='20:00')].estado").value("completo"));
        mvc.perform(get("/api/v1/disponibilidad/dia?fecha=2026-11-04&personas=8").header("X-Sesion", "sesion-duena"))
                .andExpect(jsonPath("$[?(@.hora=='20:00')].estado").value("libre"));

        crear(reserva("911111111", "2026-11-04", "20:00", 8), "otra-sesion").andExpect(status().isConflict());
        crear(reserva("987654321", "2026-11-04", "20:00", 8), "sesion-duena").andExpect(status().isCreated());
        // al reservar, la retención de esa sesión se libera
        org.assertj.core.api.Assertions.assertThat(jdbc.sql("SELECT count(*) FROM retenciones").query(Long.class).single()).isZero();
    }

    @Test
    void elegirMesaEnElPlanoLaApartaYLaReservaEsaMesa() throws Exception {
        mvc.perform(get("/api/v1/disponibilidad/mesas?fecha=2026-11-04&hora=20:00&personas=4").header("X-Sesion", "sesion-plano"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id=='M9')].estado").value("libre"))
                .andExpect(jsonPath("$[?(@.id=='M1')].estado").value("no-sirve"));
        mvc.perform(post("/api/v1/retenciones").header("X-Sesion", "sesion-plano").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fecha\":\"2026-11-04\",\"hora\":\"20:00\",\"personas\":4,\"mesa\":\"M9\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.mesa").value("M9"));
        // Para otra sesión esa mesa está ocupada y no puede apartarla.
        mvc.perform(get("/api/v1/disponibilidad/mesas?fecha=2026-11-04&hora=20:00&personas=4").header("X-Sesion", "otra-sesion"))
                .andExpect(jsonPath("$[?(@.id=='M9')].estado").value("ocupada"));
        mvc.perform(post("/api/v1/retenciones").header("X-Sesion", "otra-sesion").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fecha\":\"2026-11-04\",\"hora\":\"20:00\",\"personas\":4,\"mesa\":\"M9\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.codigo").value("MESA_OCUPADA"));
        String cuerpo = reserva("987654321", "2026-11-04", "20:00", 4).replace("}", ",\"mesa\":\"M9\"}");
        crear(cuerpo, "sesion-plano").andExpect(status().isCreated()).andExpect(jsonPath("$.mesa").value("M9"));
    }

    @Test
    void liberarLaRetencionDevuelveLaMesa() throws Exception {
        mvc.perform(post("/api/v1/retenciones").header("X-Sesion", "sesion-libera").contentType(MediaType.APPLICATION_JSON)
                .content("{\"fecha\":\"2026-11-04\",\"hora\":\"20:00\",\"personas\":8}")).andExpect(status().isCreated());
        mvc.perform(delete("/api/v1/retenciones").header("X-Sesion", "sesion-libera")).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/disponibilidad/dia?fecha=2026-11-04&personas=8").header("X-Sesion", "otra-sesion"))
                .andExpect(jsonPath("$[?(@.hora=='20:00')].estado").value("libre"));
    }

    @Test
    void disponibilidadDelMesYResumenDeHoy() throws Exception {
        mvc.perform(get("/api/v1/disponibilidad/mes?mes=2026-11&personas=2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$['2026-11-02']").value("pasado"))
                .andExpect(jsonPath("$['2026-11-09']").value("cerrado"))
                .andExpect(jsonPath("$['2026-11-04']").value("disponible"));
        mvc.perform(get("/api/v1/disponibilidad/hoy"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fecha").value("2026-11-03"))
                .andExpect(jsonPath("$.turnos[0].id").value("almuerzo"))
                .andExpect(jsonPath("$.turnos[0].mesasLibres").value(14));
    }

    @Test
    void elPanelEstaCerradoHastaLaEntrega3c() throws Exception {
        mvc.perform(get("/api/v1/admin/reservas")).andExpect(status().is4xxClientError());
    }

    @Test
    void soloSePublicaLaPaginaNuncaElRestoDeLaCarpeta() throws Exception {
        mvc.perform(get("/")).andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.forwardedUrl("/index.html"));
        mvc.perform(get("/index.html")).andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("Algarrobo")));
        mvc.perform(get("/js/main.js")).andExpect(status().isOk());
        for (String privado : new String[] {"/backend/config/local.properties.example", "/docs/api-reservas.md",
                "/package.json", "/backend/pom.xml"}) {
            mvc.perform(get(privado)).andExpect(status().isNotFound());
        }
        // Salir de la carpeta con ../ lo rechaza el cortafuegos de Spring Security antes de llegar a los archivos.
        mvc.perform(get("/js/../backend/pom.xml")).andExpect(status().isBadRequest());
    }

    @Test
    void laConfiguracionPublicaNoExponeNadaInterno() throws Exception {
        mvc.perform(get("/api/v1/configuracion"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.duracionMinutos").value(90))
                .andExpect(jsonPath("$.mesas.length()").value(14))
                .andExpect(jsonPath("$", not(hasKey("clave"))));
    }
}
