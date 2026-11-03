package pe.algarrobo.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.jayway.jsonpath.JsonPath;

import jakarta.servlet.http.Cookie;
import pe.algarrobo.BaseDePrueba;

/**
 * Panel del personal contra PostgreSQL: acceso con sesión y CSRF, bloqueo por intentos, cambios de
 * estado con historial y reservas registradas por teléfono (también grupos de varias mesas).
 * El administrador de prueba lo crea PrimerAdministrador con los datos de application-test.properties.
 */
@AutoConfigureMockMvc
class PanelTest extends BaseDePrueba {

    static final String CORREO = "admin@prueba.test";
    static final String CLAVE = "clave-de-prueba-larga";

    @Autowired
    MockMvc mvc;

    MockHttpSession sesion;
    Cookie xsrf;

    /** Antes y después: la prueba de bloqueo no debe dejar la cuenta bloqueada para otras pruebas. */
    @BeforeEach
    @AfterEach
    void desbloquear() {
        jdbc.sql("UPDATE usuarios_admin SET intentos_fallidos = 0, bloqueado_hasta = NULL").update();
    }

    /** Pide la cookie CSRF como lo hace el panel al abrirse. */
    Cookie pedirCsrf(MockHttpSession s) throws Exception {
        MvcResult r = mvc.perform(get("/api/v1/admin/sesion").session(s)).andExpect(status().isOk()).andReturn();
        Cookie c = r.getResponse().getCookie("XSRF-TOKEN");
        return c != null ? c : xsrf;
    }

    MockHttpServletRequestBuilder conCsrf(MockHttpServletRequestBuilder req) {
        return req.session(sesion).cookie(xsrf).header("X-XSRF-TOKEN", xsrf.getValue());
    }

    ResultActions entrar(String correo, String clave) throws Exception {
        sesion = new MockHttpSession();
        xsrf = pedirCsrf(sesion);
        MvcResult r = mvc.perform(conCsrf(post("/api/v1/admin/sesion")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"correo\":\"%s\",\"clave\":\"%s\"}".formatted(correo, clave))).andReturn();
        // La sesión se renueva al entrar: se sigue con la nueva y con el token CSRF nuevo.
        if (r.getRequest().getSession(false) instanceof MockHttpSession nueva) sesion = nueva;
        Cookie nuevo = r.getResponse().getCookie("XSRF-TOKEN");
        if (nuevo != null && !nuevo.getValue().isEmpty()) xsrf = nuevo;
        return mvc.perform(get("/api/v1/admin/sesion").session(sesion)).andExpect(status().isOk())
                .andDo(x -> lastStatus = r.getResponse().getStatus());
    }

    int lastStatus;

    String reservaWeb(String fecha, String hora, int personas) throws Exception {
        MvcResult r = mvc.perform(post("/api/v1/reservas").header("X-Sesion", "sesion-panel").contentType(MediaType.APPLICATION_JSON)
                .content("{\"nombre\":\"Ana Quispe\",\"contacto\":\"987654321\",\"fecha\":\"%s\",\"hora\":\"%s\",\"personas\":%d}"
                        .formatted(fecha, hora, personas)))
                .andExpect(status().isCreated()).andReturn();
        return JsonPath.read(r.getResponse().getContentAsString(), "$.codigo");
    }

    @Test
    void sinSesionElPanelResponde401YSinCsrf403() throws Exception {
        mvc.perform(get("/api/v1/admin/reservas?desde=2026-11-03&hasta=2026-11-03"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("NO_AUTORIZADO"));
        entrar(CORREO, CLAVE);
        mvc.perform(post("/api/v1/admin/reservas/ALG-AAAAA/confirmar").session(sesion))
                .andExpect(status().isForbidden());
    }

    @Test
    void accesoCorrectoEIncorrecto() throws Exception {
        entrar(CORREO, "otra-clave-cualquiera").andExpect(jsonPath("$.usuario").doesNotExist());
        assertThat(lastStatus).isEqualTo(401);
        entrar("nadie@prueba.test", CLAVE);
        assertThat(lastStatus).isEqualTo(401);
        entrar(CORREO, CLAVE).andExpect(jsonPath("$.usuario.nombre").value("Admin de Prueba"))
                .andExpect(jsonPath("$.usuario.rol").value("administrador"))
                .andExpect(jsonPath("$.usuario.hashClave").doesNotExist());
        assertThat(lastStatus).isEqualTo(200);
    }

    @Test
    void cincoFallosSeguidosBloqueanLaCuentaAunConLaClaveCorrecta() throws Exception {
        for (int i = 0; i < 5; i++) entrar(CORREO, "clave-equivocada-" + i);
        entrar(CORREO, CLAVE);
        assertThat(lastStatus).isEqualTo(423);
        String hash = jdbc.sql("SELECT hash_clave FROM usuarios_admin WHERE correo = ?").param(CORREO).query(String.class).single();
        assertThat(hash).startsWith("$2").doesNotContain(CLAVE);
    }

    @Test
    void confirmarCancelarYElHistorialGuardaQuienLoHizo() throws Exception {
        String codigo = reservaWeb("2026-11-04", "20:00", 2);
        entrar(CORREO, CLAVE);

        mvc.perform(conCsrf(post("/api/v1/admin/reservas/" + codigo + "/confirmar")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reserva.estado").value("confirmada"))
                .andExpect(jsonPath("$.historial[1].usuario").value("Admin de Prueba"))
                .andExpect(jsonPath("$.avisos[1].motivo").value("confirmada"));

        // completar antes de la hora de llegada no tiene sentido
        mvc.perform(conCsrf(post("/api/v1/admin/reservas/" + codigo + "/completar")))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.codigo").value("TRANSICION_INVALIDA"));

        mvc.perform(conCsrf(post("/api/v1/admin/reservas/" + codigo + "/cancelar")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"motivo\":\"Cierre por evento privado\"}"))
                .andExpect(jsonPath("$.reserva.estado").value("cancelada"))
                .andExpect(jsonPath("$.historial[2].detalle").value("Cierre por evento privado"));

        // el cliente lo ve en su consulta
        mvc.perform(post("/api/v1/reservas/consultar").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"codigo\":\"%s\",\"contacto\":\"987654321\"}".formatted(codigo)))
                .andExpect(jsonPath("$.estado").value("cancelada"));
    }

    @Test
    void noAsistioYCompletadaSoloDespuesDeLaHora() throws Exception {
        // Una reserva de ayer, confirmada (insertada directamente: la web no deja reservar en el pasado)
        jdbc.sql("""
                INSERT INTO reservas (codigo, fecha, hora, duracion_minutos, personas, mesa_id, turno_id, estado, nombre, contacto, contacto_normalizado)
                VALUES ('ALG-PASAD', '2026-11-02', '20:00', 90, 2, 'M1', 'cena', 'confirmada', 'Luis', '911111111', '911111111')
                """).update();
        entrar(CORREO, CLAVE);
        mvc.perform(conCsrf(post("/api/v1/admin/reservas/ALG-PASAD/no-asistio")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.reserva.estado").value("no_asistio"));
        mvc.perform(conCsrf(post("/api/v1/admin/reservas/ALG-PASAD/completar")))
                .andExpect(status().isConflict());
    }

    @Test
    void listadoConFiltros() throws Exception {
        reservaWeb("2026-11-04", "13:00", 2);
        String otra = reservaWeb("2026-11-05", "20:00", 4);
        entrar(CORREO, CLAVE);
        mvc.perform(get("/api/v1/admin/reservas?desde=2026-11-03&hasta=2026-11-09").session(sesion))
                .andExpect(jsonPath("$.length()").value(2));
        mvc.perform(get("/api/v1/admin/reservas?desde=2026-11-03&hasta=2026-11-09&turno=cena").session(sesion))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].codigo").value(otra));
        mvc.perform(get("/api/v1/admin/reservas?desde=2026-11-03&hasta=2026-11-09&q=" + otra.substring(4)).session(sesion))
                .andExpect(jsonPath("$.length()").value(1));
        mvc.perform(get("/api/v1/admin/reservas?desde=2026-11-03&hasta=2026-11-09&estado=confirmada").session(sesion))
                .andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/v1/admin/reservas?desde=2026-11-01&hasta=2027-03-01").session(sesion))
                .andExpect(status().isBadRequest());
        // buscando por texto se permite hasta un año
        mvc.perform(get("/api/v1/admin/reservas?desde=2026-05-01&hasta=2027-04-30&q=Ana").session(sesion))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    void grupoDeDiecioochoJuntandoMesasQuedaConfirmadoYOcupaTodas() throws Exception {
        entrar(CORREO, CLAVE);
        mvc.perform(conCsrf(post("/api/v1/admin/reservas")).contentType(MediaType.APPLICATION_JSON).content("""
                        {"nombre":"Promoción 2006","contacto":"955555555","fecha":"2026-11-07","hora":"20:00","personas":18,
                         "comentarios":"Reunión de exalumnos","mesas":["M12","M13","M14"]}
                        """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.reserva.estado").value("confirmada"))
                .andExpect(jsonPath("$.reserva.origen").value("panel"))
                .andExpect(jsonPath("$.reserva.mesas.length()").value(3))
                .andExpect(jsonPath("$.reserva.mesas[0]").value("M14"));

        // esas mesas ya no se ofrecen en la web
        mvc.perform(get("/api/v1/disponibilidad/dia?fecha=2026-11-07&personas=8"))
                .andExpect(jsonPath("$[?(@.hora=='20:00')].estado").value("completo"));
        mvc.perform(get("/api/v1/admin/mesas?fecha=2026-11-07&hora=20:30").session(sesion))
                .andExpect(jsonPath("$[?(@.id=='M12')].libre").value(false))
                .andExpect(jsonPath("$[?(@.id=='M1')].libre").value(true));

        // las anexas no aparecen como reservas sueltas en el panel
        mvc.perform(get("/api/v1/admin/reservas?desde=2026-11-07&hasta=2026-11-07").session(sesion))
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void laReservaManualRechazaMesasOcupadasOInsuficientes() throws Exception {
        reservaWeb("2026-11-07", "20:00", 8); // ocupa M14
        entrar(CORREO, CLAVE);
        mvc.perform(conCsrf(post("/api/v1/admin/reservas")).contentType(MediaType.APPLICATION_JSON).content("""
                        {"nombre":"Grupo","contacto":"955555555","fecha":"2026-11-07","hora":"20:30","personas":12,"mesas":["M14","M12"]}
                        """))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.errores.mesas").exists());
        mvc.perform(conCsrf(post("/api/v1/admin/reservas")).contentType(MediaType.APPLICATION_JSON).content("""
                        {"nombre":"Grupo","contacto":"955555555","fecha":"2026-11-07","hora":"20:30","personas":12,"mesas":["M12"]}
                        """))
                .andExpect(status().isUnprocessableContent()).andExpect(jsonPath("$.codigo").value("MESA_INVALIDA"));
        // sin elegir mesas, para 4 personas se asigna una sola
        mvc.perform(conCsrf(post("/api/v1/admin/reservas")).contentType(MediaType.APPLICATION_JSON).content("""
                        {"nombre":"Pareja","contacto":"955555556","fecha":"2026-11-07","hora":"20:30","personas":4}
                        """))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.reserva.mesas.length()").value(1));
    }

    @Test
    void salirCierraLaSesion() throws Exception {
        entrar(CORREO, CLAVE);
        mvc.perform(conCsrf(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/v1/admin/sesion")))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/admin/reservas?desde=2026-11-03&hasta=2026-11-03").session(sesion))
                .andExpect(status().isUnauthorized());
    }
}
