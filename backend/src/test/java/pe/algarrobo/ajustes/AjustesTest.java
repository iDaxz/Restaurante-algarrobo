package pe.algarrobo.ajustes;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;

import javax.imageio.ImageIO;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.AbstractMockHttpServletRequestBuilder;

import com.jayway.jsonpath.JsonPath;

import jakarta.servlet.http.Cookie;
import pe.algarrobo.BaseDePrueba;
import pe.algarrobo.config.ReglasProveedor;

/**
 * Ajustes del panel: solo administradores; ningún cambio deja reservas futuras fuera de horario o
 * sin mesa; la carta y las fotos; las cuentas del personal. Al terminar cada prueba se restaura la
 * configuración inicial (V2) para no afectar a las demás.
 */
@AutoConfigureMockMvc
class AjustesTest extends BaseDePrueba {

    @Autowired
    MockMvc mvc;

    @Autowired
    ReglasProveedor reglas;

    /** Una sesión del panel: cookie de sesión y token CSRF. */
    record Sesion(MockHttpSession http, Cookie xsrf) {
        <B extends AbstractMockHttpServletRequestBuilder<B>> B con(B req) {
            return req.session(http).cookie(xsrf).header("X-XSRF-TOKEN", xsrf.getValue());
        }
    }

    Sesion entrar(String correo, String clave) throws Exception {
        MockHttpSession http = new MockHttpSession();
        Cookie xsrf = mvc.perform(get("/api/v1/admin/sesion").session(http)).andReturn().getResponse().getCookie("XSRF-TOKEN");
        MvcResult r = mvc.perform(post("/api/v1/admin/sesion").session(http).cookie(xsrf).header("X-XSRF-TOKEN", xsrf.getValue())
                .contentType(MediaType.APPLICATION_JSON).content("{\"correo\":\"%s\",\"clave\":\"%s\"}".formatted(correo, clave))).andReturn();
        assertThat(r.getResponse().getStatus()).as("acceso de " + correo).isEqualTo(200);
        MockHttpSession nueva = (MockHttpSession) r.getRequest().getSession(false);
        Cookie nuevo = r.getResponse().getCookie("XSRF-TOKEN");
        return new Sesion(nueva, nuevo != null && !nuevo.getValue().isEmpty() ? nuevo : xsrf);
    }

    Sesion admin() throws Exception {
        return entrar("admin@prueba.test", "clave-de-prueba-larga");
    }

    String reservar(String fecha, String hora, int personas, String telefono) throws Exception {
        MvcResult r = mvc.perform(post("/api/v1/reservas").header("X-Sesion", "sesion-ajustes").contentType(MediaType.APPLICATION_JSON)
                .content("{\"nombre\":\"Ana Quispe\",\"contacto\":\"%s\",\"fecha\":\"%s\",\"hora\":\"%s\",\"personas\":%d}".formatted(telefono, fecha, hora, personas)))
                .andExpect(status().isCreated()).andReturn();
        return JsonPath.read(r.getResponse().getContentAsString(), "$.codigo");
    }

    static final String POLITICAS = """
            {"duracionMinutos":90,"intervaloMinutos":30,"ventanaDias":60,"maxPersonasEnLinea":8,"holguraAsientos":2,
             "horasParaCambios":3,"toleranciaMinutos":15,"maxReservasActivasPorContacto":3,"retencionMinutos":5,"diasCerrados":%s}
            """;

    @AfterEach
    void restaurar() {
        jdbc.sql("""
                UPDATE configuracion SET duracion_minutos = 90, intervalo_minutos = 30, ventana_dias = 60, max_personas_en_linea = 8,
                       holgura_asientos = 2, horas_para_cambios = 3, tolerancia_minutos = 15, max_reservas_activas_contacto = 3,
                       retencion_minutos = 5, dias_cerrados = '{1}'
                """).update();
        jdbc.sql("UPDATE turnos SET nombre = 'Almuerzo', inicio = '12:00', fin = '16:30' WHERE id = 'almuerzo'").update();
        jdbc.sql("UPDATE turnos SET nombre = 'Cena', inicio = '19:00', fin = '23:00' WHERE id = 'cena'").update();
        jdbc.sql("DELETE FROM reservas WHERE mesa_id ~ '^M(1[5-9]|[2-9][0-9])$'").update();
        jdbc.sql("DELETE FROM mesas WHERE id ~ '^M(1[5-9]|[2-9][0-9])$'").update();
        jdbc.sql("UPDATE mesas SET activa = TRUE, nombre = CASE WHEN id = 'M14' THEN 'Mesa larga' ELSE NULL END, asientos = CASE id "
                + "WHEN 'M7' THEN 4 WHEN 'M8' THEN 4 WHEN 'M9' THEN 4 WHEN 'M10' THEN 4 WHEN 'M11' THEN 4 WHEN 'M12' THEN 6 WHEN 'M13' THEN 6 "
                + "WHEN 'M14' THEN 8 ELSE 2 END").update();
        jdbc.sql("DELETE FROM dias_especiales").update();
        jdbc.sql("DELETE FROM platos WHERE id = 'tacu-tacu' OR id LIKE 'tacu-tacu-%'").update();
        jdbc.sql("UPDATE platos SET disponible = TRUE").update();
        jdbc.sql("DELETE FROM fotos").update();
        jdbc.sql("DELETE FROM usuarios_admin WHERE correo <> 'admin@prueba.test'").update();
        jdbc.sql("UPDATE usuarios_admin SET intentos_fallidos = 0, bloqueado_hasta = NULL").update();
        reglas.recargar();
    }

    @Test
    void elPersonalNoEntraAAjustesPeroSiAReservas() throws Exception {
        Sesion a = admin();
        mvc.perform(a.con(post("/api/v1/admin/usuarios")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"correo\":\"mozo@prueba.test\",\"nombre\":\"Mozo Uno\",\"rol\":\"personal\",\"clave\":\"clave-del-mozo-123\"}"))
                .andExpect(status().isCreated());
        Sesion mozo = entrar("mozo@prueba.test", "clave-del-mozo-123");
        mvc.perform(get("/api/v1/admin/ajustes").session(mozo.http())).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/admin/usuarios").session(mozo.http())).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/admin/reservas?desde=2026-11-03&hasta=2026-11-03").session(mozo.http())).andExpect(status().isOk());
    }

    @Test
    void lasPoliticasSeValidanYNoDejanReservasEnUnDiaDeDescanso() throws Exception {
        Sesion a = admin();
        mvc.perform(a.con(put("/api/v1/admin/ajustes/politicas")).contentType(MediaType.APPLICATION_JSON)
                        .content(POLITICAS.formatted("[1]").replace("\"duracionMinutos\":90", "\"duracionMinutos\":10")))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errores.duracionMinutos").exists());

        String codigo = reservar("2026-11-04", "20:00", 2, "987654321"); // miércoles
        mvc.perform(a.con(put("/api/v1/admin/ajustes/politicas")).contentType(MediaType.APPLICATION_JSON).content(POLITICAS.formatted("[1,3]")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("CONFLICTO_RESERVAS"))
                .andExpect(jsonPath("$.mensaje").value(org.hamcrest.Matchers.containsString(codigo)));

        // Cerrar también los martes sí se puede (no hay reservas un martes): la web lo refleja al instante
        mvc.perform(a.con(put("/api/v1/admin/ajustes/politicas")).contentType(MediaType.APPLICATION_JSON).content(POLITICAS.formatted("[1,2]")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.politicas.diasCerrados.length()").value(2));
        mvc.perform(get("/api/v1/disponibilidad/mes?mes=2026-11&personas=2")).andExpect(jsonPath("$['2026-11-10']").value("cerrado"));
        assertThat(jdbc.sql("SELECT count(*) FROM cambios_config WHERE area = 'politicas'").query(Long.class).single()).isEqualTo(1);
        // Guardar otra vez lo mismo no deja una entrada falsa en el historial
        mvc.perform(a.con(put("/api/v1/admin/ajustes/politicas")).contentType(MediaType.APPLICATION_JSON).content(POLITICAS.formatted("[1,2]")))
                .andExpect(status().isOk());
        assertThat(jdbc.sql("SELECT count(*) FROM cambios_config WHERE area = 'politicas'").query(Long.class).single()).isEqualTo(1);
    }

    @Test
    void acortarUnTurnoConReservasFueraDelNuevoHorarioSeRechaza() throws Exception {
        Sesion a = admin();
        reservar("2026-11-04", "21:30", 2, "987654321");
        String turnos = "[{\"id\":\"almuerzo\",\"nombre\":\"Almuerzo\",\"inicio\":\"12:00\",\"fin\":\"16:30\"},{\"id\":\"cena\",\"nombre\":\"Cena\",\"inicio\":\"19:00\",\"fin\":\"%s\"}]";
        mvc.perform(a.con(put("/api/v1/admin/ajustes/turnos")).contentType(MediaType.APPLICATION_JSON).content(turnos.formatted("22:00")))
                .andExpect(status().isConflict());
        mvc.perform(a.con(put("/api/v1/admin/ajustes/turnos")).contentType(MediaType.APPLICATION_JSON).content(turnos.formatted("19:30")))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errores['cena.horas']").exists());
        mvc.perform(a.con(put("/api/v1/admin/ajustes/turnos")).contentType(MediaType.APPLICATION_JSON).content(turnos.formatted("23:30")))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/disponibilidad/dia?fecha=2026-11-05&personas=2"))
                .andExpect(jsonPath("$[-1:].hora").value("22:00")); // última llegada: 23:30 − 90 min
    }

    @Test
    void desactivarUnaMesaConReservasFuturasSeRechazaYUnaLibreSePuede() throws Exception {
        Sesion a = admin();
        reservar("2026-11-04", "20:00", 8, "987654321"); // ocupa M14, la única de 8
        mvc.perform(a.con(put("/api/v1/admin/ajustes/mesas/M14")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"asientos\":8,\"nombre\":\"Mesa larga\",\"activa\":false}"))
                .andExpect(status().isConflict());
        mvc.perform(a.con(put("/api/v1/admin/ajustes/mesas/M13")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"asientos\":6,\"nombre\":\"Terraza\",\"activa\":false}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/configuracion")).andExpect(jsonPath("$.mesas.length()").value(13));
        mvc.perform(a.con(post("/api/v1/admin/ajustes/mesas")).contentType(MediaType.APPLICATION_JSON).content("{\"asientos\":4}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.mesas[?(@.id=='M15')].asientos").value(4));
    }

    @Test
    void cerrarUnDiaConReservasPideConfirmarYLuegoLasCancelaConAviso() throws Exception {
        Sesion a = admin();
        String codigo = reservar("2026-11-04", "20:00", 2, "987654321");
        String dia = "{\"fecha\":\"2026-11-04\",\"motivo\":\"Evento privado al 100%%\",\"cancelarReservas\":%s}";
        mvc.perform(a.con(post("/api/v1/admin/ajustes/dias")).contentType(MediaType.APPLICATION_JSON).content(dia.formatted("false")))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.mensaje").value(org.hamcrest.Matchers.containsString(codigo)));
        mvc.perform(a.con(post("/api/v1/admin/ajustes/dias")).contentType(MediaType.APPLICATION_JSON).content(dia.formatted("true")))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.diasEspeciales[0].fecha").value("2026-11-04"));

        mvc.perform(post("/api/v1/reservas/consultar").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"codigo\":\"%s\",\"contacto\":\"987654321\"}".formatted(codigo)))
                .andExpect(jsonPath("$.estado").value("cancelada"));
        assertThat(jdbc.sql("SELECT mensaje FROM avisos WHERE codigo = ? AND motivo = 'cancelada'").param(codigo).query(String.class).single())
                .contains("Evento privado al 100%");
        mvc.perform(get("/api/v1/disponibilidad/mes?mes=2026-11&personas=2")).andExpect(jsonPath("$['2026-11-04']").value("cerrado"));
        mvc.perform(get("/api/v1/configuracion")).andExpect(jsonPath("$.fechasCerradas[0]").value("2026-11-04"));

        mvc.perform(a.con(delete("/api/v1/admin/ajustes/dias/2026-11-04"))).andExpect(status().isOk());
        mvc.perform(get("/api/v1/disponibilidad/mes?mes=2026-11&personas=2")).andExpect(jsonPath("$['2026-11-04']").value("disponible"));
    }

    @Test
    void laCartaSeEditaYUnPlatoAgotadoSeMarcaEnLaWeb() throws Exception {
        Sesion a = admin();
        mvc.perform(get("/api/v1/carta")).andExpect(jsonPath("$.platos.length()").value(29)).andExpect(jsonPath("$.categorias.length()").value(5));
        String plato = """
                {"categoria":"principales","nombre":"Tacu tacu","descripcion":"Frejoles y arroz dorados en sartén, con bistec y salsa criolla.",
                 "origen":"Lima","precio":%s,"etiqueta":"nuevo","foto":"%s"}
                """;
        mvc.perform(a.con(post("/api/v1/admin/carta/platos")).contentType(MediaType.APPLICATION_JSON).content(plato.formatted("-5", "/etc/passwd")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errores.precio").exists()).andExpect(jsonPath("$.errores.foto").exists());
        mvc.perform(a.con(post("/api/v1/admin/carta/platos")).contentType(MediaType.APPLICATION_JSON)
                        .content(plato.formatted("38.50", "assets/img/platos/espesado.jpg")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.platos[?(@.id=='tacu-tacu')].precio").value(38.5));
        mvc.perform(get("/api/v1/carta")).andExpect(jsonPath("$.platos.length()").value(30));

        mvc.perform(a.con(patch("/api/v1/admin/carta/platos/tacu-tacu")).contentType(MediaType.APPLICATION_JSON).content("{\"disponible\":false}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/carta")).andExpect(jsonPath("$.platos[?(@.id=='tacu-tacu')].disponible").value(false));
        mvc.perform(get("/api/v1/admin/carta").session(a.http())).andExpect(jsonPath("$.platos[?(@.id=='tacu-tacu')].disponible").value(false));

        mvc.perform(a.con(delete("/api/v1/admin/carta/platos/tacu-tacu"))).andExpect(status().isOk());
        mvc.perform(get("/api/v1/admin/carta").session(a.http())).andExpect(jsonPath("$.platos.length()").value(29));
    }

    static byte[] png() throws Exception {
        BufferedImage img = new BufferedImage(40, 30, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "png", out);
        return out.toByteArray();
    }

    @Test
    void lasFotosSeSubenSoloSiSonImagenesDeVerdad() throws Exception {
        Sesion a = admin();
        MvcResult r = mvc.perform(a.con(multipart("/api/v1/admin/fotos")
                        .file(new MockMultipartFile("archivo", "../../mi foto.png", "image/png", png()))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.nombre").value("mi foto.png"))
                .andExpect(jsonPath("$.ancho").value(40))
                .andReturn();
        String url = JsonPath.read(r.getResponse().getContentAsString(), "$.url");
        mvc.perform(get(url))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/png"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"));

        // Un texto con nombre .png, un SVG y un JPEG falso se rechazan por su contenido
        mvc.perform(a.con(multipart("/api/v1/admin/fotos").file(new MockMultipartFile("archivo", "foto.png", "image/png", "hola".getBytes()))))
                .andExpect(status().isUnprocessableContent()).andExpect(jsonPath("$.codigo").value("ARCHIVO_INVALIDO"));
        mvc.perform(a.con(multipart("/api/v1/admin/fotos").file(new MockMultipartFile("archivo", "x.svg", "image/svg+xml",
                        "<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>".getBytes()))))
                .andExpect(status().isUnprocessableContent());
        mvc.perform(a.con(multipart("/api/v1/admin/fotos").file(new MockMultipartFile("archivo", "x.jpg", "image/jpeg",
                        new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 1, 2, 3}))))
                .andExpect(status().isUnprocessableContent());

        // Un plato puede usar la foto subida; mientras la use, no se puede borrar
        mvc.perform(a.con(put("/api/v1/admin/carta/platos/espesado")).contentType(MediaType.APPLICATION_JSON).content("""
                        {"categoria":"principales","nombre":"Espesado","descripcion":"Guiso de choclo.","precio":38,"foto":"%s"}
                        """.formatted(url)))
                .andExpect(status().isOk());
        String id = url.substring(url.lastIndexOf('/') + 1);
        mvc.perform(a.con(delete("/api/v1/admin/fotos/" + id))).andExpect(status().isConflict());
        mvc.perform(a.con(put("/api/v1/admin/carta/platos/espesado")).contentType(MediaType.APPLICATION_JSON).content("""
                        {"categoria":"principales","nombre":"Espesado","descripcion":"Guiso de choclo.","precio":38,"foto":"assets/img/platos/espesado.jpg"}
                        """))
                .andExpect(status().isOk());
        mvc.perform(a.con(delete("/api/v1/admin/fotos/" + id))).andExpect(status().isOk());
    }

    @Test
    void cuentasDelPersonal() throws Exception {
        Sesion a = admin();
        MvcResult r = mvc.perform(a.con(post("/api/v1/admin/usuarios")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"correo\":\"Mozo@Prueba.test\",\"nombre\":\"Mozo Uno\",\"rol\":\"personal\",\"clave\":\"clave-del-mozo-123\"}"))
                .andExpect(status().isCreated()).andReturn();
        java.util.List<Number> mozos = JsonPath.read(r.getResponse().getContentAsString(), "$[?(@.correo=='mozo@prueba.test')].id");
        java.util.List<Number> admins = JsonPath.read(r.getResponse().getContentAsString(), "$[?(@.correo=='admin@prueba.test')].id");
        Number idMozo = mozos.getFirst();
        Number idAdmin = admins.getFirst();

        mvc.perform(a.con(post("/api/v1/admin/usuarios")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"correo\":\"otro@prueba.test\",\"nombre\":\"Otro\",\"rol\":\"personal\",\"clave\":\"corta\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errores.clave").exists());

        // Nadie se desactiva a sí mismo ni deja al restaurante sin administrador
        mvc.perform(a.con(patch("/api/v1/admin/usuarios/" + idAdmin)).contentType(MediaType.APPLICATION_JSON).content("{\"activo\":false}"))
                .andExpect(status().isBadRequest());

        // El mozo cambia su propia contraseña
        Sesion mozo = entrar("mozo@prueba.test", "clave-del-mozo-123");
        mvc.perform(mozo.con(put("/api/v1/admin/sesion/clave")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"actual\":\"equivocada-123\",\"nueva\":\"nueva-clave-del-mozo\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errores.actual").exists());
        mvc.perform(mozo.con(put("/api/v1/admin/sesion/clave")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"actual\":\"clave-del-mozo-123\",\"nueva\":\"nueva-clave-del-mozo\"}"))
                .andExpect(status().isNoContent());

        // Al desactivarlo, su sesión abierta deja de servir en la siguiente petición
        mvc.perform(a.con(patch("/api/v1/admin/usuarios/" + idMozo)).contentType(MediaType.APPLICATION_JSON).content("{\"activo\":false}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/admin/reservas?desde=2026-11-03&hasta=2026-11-03").session(mozo.http()))
                .andExpect(status().isUnauthorized());
    }
}
