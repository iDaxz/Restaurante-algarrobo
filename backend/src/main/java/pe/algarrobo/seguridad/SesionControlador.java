package pe.algarrobo.seguridad;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

/**
 * Inicio y cierre de sesión del panel (JSON).
 * GET devuelve quién está conectado (o null) y deja lista la cookie CSRF para el siguiente POST.
 */
@RestController
@RequestMapping("/api/v1/admin/sesion")
public class SesionControlador {

    private final AccesoServicio acceso;
    private final SecurityContextRepository contextos;
    private final CsrfTokenRepository csrf;
    private final UsuariosServicio usuarios;

    public SesionControlador(AccesoServicio acceso, SecurityContextRepository contextos, CsrfTokenRepository csrf, UsuariosServicio usuarios) {
        this.acceso = acceso;
        this.contextos = contextos;
        this.csrf = csrf;
        this.usuarios = usuarios;
    }

    @GetMapping
    public Map<String, Object> actual(Authentication auth, CsrfToken token) {
        token.getToken(); // fuerza a que la cookie XSRF-TOKEN se escriba en la respuesta
        Map<String, Object> respuesta = new LinkedHashMap<>();
        respuesta.put("usuario", auth != null && auth.getPrincipal() instanceof UsuarioAdmin.Publico u ? u : null);
        return respuesta;
    }

    public record Credenciales(String correo, String clave) {
    }

    @PostMapping
    public Map<String, Object> entrar(@RequestBody Credenciales c, HttpServletRequest req, HttpServletResponse res) {
        Authentication auth = acceso.autenticar(c.correo(), c.clave());
        // Sesión nueva al entrar: un identificador fijado antes del acceso no sirve después.
        HttpSession anterior = req.getSession(false);
        if (anterior != null) anterior.invalidate();
        req.getSession(true);
        SecurityContext ctx = SecurityContextHolder.createEmptyContext();
        ctx.setAuthentication(auth);
        SecurityContextHolder.setContext(ctx);
        contextos.saveContext(ctx, req, res);
        // Token CSRF nuevo tras autenticarse.
        csrf.saveToken(csrf.generateToken(req), req, res);
        return Map.of("usuario", auth.getPrincipal());
    }

    public record CambioClave(String actual, String nueva) {
    }

    /** Cada persona cambia su propia contraseña (requiere sesión: esta ruta no es pública). */
    @org.springframework.web.bind.annotation.PutMapping("/clave")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cambiarClave(@RequestBody CambioClave c, @org.springframework.security.core.annotation.AuthenticationPrincipal UsuarioAdmin.Publico usuario) {
        usuarios.cambiarPropia(usuario, c.actual(), c.nueva());
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void salir(HttpServletRequest req, HttpServletResponse res) {
        HttpSession sesion = req.getSession(false);
        if (sesion != null) sesion.invalidate();
        SecurityContextHolder.clearContext();
        csrf.saveToken(null, req, res);
    }
}
