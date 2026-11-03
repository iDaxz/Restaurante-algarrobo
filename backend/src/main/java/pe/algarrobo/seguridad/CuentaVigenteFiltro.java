package pe.algarrobo.seguridad;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

/**
 * En cada petición del panel comprueba que la cuenta siga activa y con el mismo rol que cuando
 * inició sesión. Si un administrador la desactivó o le cambió el rol, la sesión se cierra en ese
 * momento (y no al caducar 8 horas después).
 */
public class CuentaVigenteFiltro extends OncePerRequestFilter {

    private final UsuariosRepositorio usuarios;

    public CuentaVigenteFiltro(UsuariosRepositorio usuarios) {
        this.usuarios = usuarios;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest req) {
        return !req.getRequestURI().startsWith("/api/v1/admin/") || req.getRequestURI().equals("/api/v1/admin/sesion");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain cadena) throws ServletException, IOException {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UsuarioAdmin.Publico p) {
            boolean vigente = usuarios.porId(p.id()).filter(UsuarioAdmin::activo).filter(u -> u.rol().equals(p.rol())).isPresent();
            if (!vigente) {
                HttpSession sesion = req.getSession(false);
                if (sesion != null) sesion.invalidate();
                SecurityContextHolder.clearContext();
                res.setStatus(401);
                res.setContentType(MediaType.APPLICATION_JSON_VALUE);
                res.setCharacterEncoding(StandardCharsets.UTF_8.name());
                res.getWriter().write("{\"codigo\":\"NO_AUTORIZADO\",\"mensaje\":\"Tu cuenta cambió o fue desactivada. Vuelve a iniciar sesión.\",\"errores\":{}}");
                return;
            }
        }
        cadena.doFilter(req, res);
    }
}
