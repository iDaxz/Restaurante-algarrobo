package pe.algarrobo.seguridad;

import java.nio.charset.StandardCharsets;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;

import jakarta.servlet.http.HttpServletResponse;

/**
 * - API pública (/api/v1/**): abierta, sin cookies ni sesión, con límite por IP. No necesita CSRF.
 * - Panel (/api/v1/admin/**): sesión con cookie HttpOnly + SameSite=Strict y token CSRF (cookie
 *   XSRF-TOKEN que el panel devuelve en la cabecera X-XSRF-TOKEN). Solo /admin/sesion es abierta.
 */
@Configuration
public class SeguridadConfig {

    /** Los estilos en línea son atributos style="--i: …" del HTML; los scripts, solo archivos propios. */
    static final String CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; "
            + "font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

    @Bean
    PasswordEncoder cifrado() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    CsrfTokenRepository repositorioCsrf() {
        CookieCsrfTokenRepository repo = CookieCsrfTokenRepository.withHttpOnlyFalse();
        repo.setCookieCustomizer(c -> c.sameSite("Strict").path("/"));
        return repo;
    }

    @Bean
    SecurityContextRepository repositorioContexto() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    SecurityFilterChain cadena(HttpSecurity http, LimitePorIpFiltro limite, CsrfTokenRepository csrf,
                               SecurityContextRepository contexto, UsuariosRepositorio usuarios) throws Exception {
        http
                .authorizeHttpRequests(a -> a
                        .requestMatchers("/api/v1/admin/sesion").permitAll()
                        // Ajustes, carta, fotos y cuentas: solo administradores.
                        .requestMatchers("/api/v1/admin/ajustes/**", "/api/v1/admin/carta/**", "/api/v1/admin/fotos/**",
                                "/api/v1/admin/usuarios/**").hasRole("ADMINISTRADOR")
                        .requestMatchers("/api/v1/admin/**").hasAnyRole("PERSONAL", "ADMINISTRADOR")
                        .anyRequest().permitAll())
                .csrf(c -> c
                        .csrfTokenRepository(csrf)
                        .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler())
                        .ignoringRequestMatchers(req -> {
                            String ruta = req.getRequestURI();
                            return ruta.startsWith("/api/v1/") && !ruta.startsWith("/api/v1/admin/");
                        }))
                .securityContext(s -> s.securityContextRepository(contexto))
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((req, res, ex) -> json(res, 401, "NO_AUTORIZADO", "Inicia sesión para usar el panel."))
                        .accessDeniedHandler((req, res, ex) -> json(res, 403, "ACCESO_DENEGADO",
                                "No tienes permiso para esta acción o la sesión caducó. Recarga la página.")))
                .httpBasic(b -> b.disable())
                .formLogin(f -> f.disable())
                .logout(l -> l.disable())
                .headers(h -> h
                        .referrerPolicy(r -> r.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
                        .frameOptions(f -> f.deny())
                        // Misma política que vercel.json: nada de scripts en línea ni de otros orígenes.
                        .contentSecurityPolicy(c -> c.policyDirectives(CSP)))
                .addFilterBefore(limite, UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(new CuentaVigenteFiltro(usuarios), org.springframework.security.web.access.ExceptionTranslationFilter.class);
        return http.build();
    }

    private static void json(HttpServletResponse res, int estado, String codigo, String mensaje) throws java.io.IOException {
        res.setStatus(estado);
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        res.setCharacterEncoding(StandardCharsets.UTF_8.name());
        res.getWriter().write("{\"codigo\":\"%s\",\"mensaje\":\"%s\",\"errores\":{}}".formatted(codigo, mensaje));
    }
}
