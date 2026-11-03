package pe.algarrobo.seguridad;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

/** El límite por IP, sin base de datos: cupos pequeños (reservar 3, apartar 5, consultar 4). */
class LimitePorIpFiltroTest {

    final Clock reloj = Clock.fixed(Instant.parse("2026-11-03T15:00:10Z"), ZoneOffset.UTC);
    final LimitePorIpFiltro filtro = new LimitePorIpFiltro(3, 5, 4, 2, reloj);

    int pedir(String metodo, String ruta, String ip) throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest(metodo, ruta);
        req.setRemoteAddr(ip);
        MockHttpServletResponse res = new MockHttpServletResponse();
        filtro.doFilter(req, res, new MockFilterChain());
        return res.getStatus();
    }

    @Test
    void alPasarElCupoResponde429SoloAEsaIpYSoloEnEseGrupo() throws Exception {
        for (int i = 0; i < 3; i++) assertThat(pedir("POST", "/api/v1/reservas", "10.0.0.1")).isEqualTo(200);
        assertThat(pedir("POST", "/api/v1/reservas/ALG-AAAAA/cancelar", "10.0.0.1")).isEqualTo(429);
        assertThat(pedir("PATCH", "/api/v1/reservas/ALG-AAAAA", "10.0.0.1")).isEqualTo(429);
        // Otra IP, u otro tipo de acción de la misma IP, tienen su propio cupo
        assertThat(pedir("POST", "/api/v1/reservas", "10.0.0.2")).isEqualTo(200);
        assertThat(pedir("POST", "/api/v1/reservas/consultar", "10.0.0.1")).isEqualTo(200);
        assertThat(pedir("POST", "/api/v1/retenciones", "10.0.0.1")).isEqualTo(200);
    }

    @Test
    void consultarCodigosTieneSuPropioCupo() throws Exception {
        for (int i = 0; i < 4; i++) assertThat(pedir("POST", "/api/v1/reservas/consultar-varias", "10.0.0.4")).isEqualTo(200);
        assertThat(pedir("POST", "/api/v1/reservas/consultar", "10.0.0.4")).isEqualTo(429);
    }

    @Test
    void iniciarSesionEnElPanelTieneUnCupoPequeno() throws Exception {
        assertThat(pedir("POST", "/api/v1/admin/sesion", "10.0.0.5")).isEqualTo(200);
        assertThat(pedir("POST", "/api/v1/admin/sesion", "10.0.0.5")).isEqualTo(200);
        assertThat(pedir("POST", "/api/v1/admin/sesion", "10.0.0.5")).isEqualTo(429);
        assertThat(pedir("GET", "/api/v1/admin/sesion", "10.0.0.5")).isEqualTo(200);
    }

    @Test
    void consultarDisponibilidadYLiberarMesasNoSeLimitan() throws Exception {
        for (int i = 0; i < 10; i++) {
            assertThat(pedir("GET", "/api/v1/disponibilidad/dia", "10.0.0.3")).isEqualTo(200);
            assertThat(pedir("DELETE", "/api/v1/retenciones", "10.0.0.3")).isEqualTo(200);
        }
    }
}
