package pe.algarrobo.seguridad;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Límite de peticiones por IP, con un cupo distinto para cada tipo de acción (ventana fija de un minuto):
 * - reservar: crear, modificar y cancelar (lo más sensible, cupo bajo);
 * - apartar: apartar mesa, que ocurre cada vez que se elige una hora;
 * - consultar: buscar reservas por código y contacto (evita probar códigos a ciegas);
 * - acceso: iniciar sesión en el panel (contra el robo de contraseñas por fuerza bruta).
 * La disponibilidad (GET) y liberar mesas no se limitan. En memoria: suficiente para una instancia;
 * con varias, se movería a la base o a Redis. No usa X-Forwarded-For a propósito: detrás de un
 * proxy se configura server.forward-headers-strategy.
 */
@Component
public class LimitePorIpFiltro extends OncePerRequestFilter {

    private final Map<String, Integer> cupos;
    private final Clock reloj;
    private final Map<String, Ventana> ventanas = new ConcurrentHashMap<>();

    private record Ventana(long minuto, int cuenta) {
    }

    public LimitePorIpFiltro(@Value("${algarrobo.limite.reservar}") int reservar,
                             @Value("${algarrobo.limite.apartar}") int apartar,
                             @Value("${algarrobo.limite.consultar}") int consultar,
                             @Value("${algarrobo.limite.acceso}") int acceso,
                             Clock reloj) {
        this.cupos = Map.of("reservar", reservar, "apartar", apartar, "consultar", consultar, "acceso", acceso);
        this.reloj = reloj;
    }

    /** A qué cupo pertenece la petición, o null si no se limita. */
    static String grupo(String metodo, String ruta) {
        if (!ruta.startsWith("/api/v1/")) return null;
        if (metodo.equals("POST") && ruta.equals("/api/v1/admin/sesion")) return "acceso";
        if (metodo.equals("POST") && ruta.startsWith("/api/v1/retenciones")) return "apartar";
        if (metodo.equals("POST") && ruta.startsWith("/api/v1/reservas/consultar")) return "consultar";
        if ((metodo.equals("POST") || metodo.equals("PATCH")) && ruta.startsWith("/api/v1/reservas")) return "reservar";
        return null;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest req) {
        return grupo(req.getMethod(), req.getRequestURI()) == null;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain cadena) throws ServletException, IOException {
        String grupo = grupo(req.getMethod(), req.getRequestURI());
        long minuto = reloj.millis() / 60_000;
        Ventana v = ventanas.compute(grupo + "|" + req.getRemoteAddr(), (clave, actual) ->
                actual == null || actual.minuto() != minuto ? new Ventana(minuto, 1) : new Ventana(minuto, actual.cuenta() + 1));
        if (ventanas.size() > 10_000) ventanas.values().removeIf(x -> x.minuto() < minuto);

        if (v.cuenta() > cupos.get(grupo)) {
            res.setStatus(429);
            res.setHeader("Retry-After", String.valueOf(60 - (reloj.millis() / 1000) % 60));
            res.setContentType(MediaType.APPLICATION_JSON_VALUE);
            res.setCharacterEncoding(StandardCharsets.UTF_8.name());
            res.getWriter().write("{\"codigo\":\"DEMASIADAS_PETICIONES\",\"mensaje\":\"Hiciste muchos intentos seguidos. Espera un minuto y vuelve a intentarlo.\",\"errores\":{}}");
            return;
        }
        cadena.doFilter(req, res);
    }
}
