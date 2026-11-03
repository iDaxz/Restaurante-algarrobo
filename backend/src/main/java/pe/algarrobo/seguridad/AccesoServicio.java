package pe.algarrobo.seguridad;

import java.time.Clock;
import java.time.Duration;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import pe.algarrobo.motor.CodigoError;
import pe.algarrobo.motor.ErrorReserva;

/**
 * Comprueba correo y contraseña del personal. Tras MAX_FALLOS intentos seguidos la cuenta queda
 * bloqueada BLOQUEO. El mensaje de error es el mismo exista o no el correo, y se compara siempre
 * contra un hash bcrypt para que el tiempo de respuesta no lo delate.
 */
@Service
public class AccesoServicio {

    static final int MAX_FALLOS = 5;
    static final Duration BLOQUEO = Duration.ofMinutes(15);
    private static final Logger log = LoggerFactory.getLogger(AccesoServicio.class);

    private final UsuariosRepositorio usuarios;
    private final PasswordEncoder cifrado;
    private final Clock reloj;
    private final String hashFalso;

    public AccesoServicio(UsuariosRepositorio usuarios, PasswordEncoder cifrado, Clock reloj) {
        this.usuarios = usuarios;
        this.cifrado = cifrado;
        this.reloj = reloj;
        this.hashFalso = cifrado.encode("contraseña que no corresponde a nadie");
    }

    /** Usuario autenticado con su rol, listo para guardar en la sesión. */
    @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = ErrorReserva.class)
    public Authentication autenticar(String correo, String clave) {
        String limpio = correo == null ? "" : correo.strip().toLowerCase();
        var usuario = usuarios.porCorreo(limpio).filter(UsuarioAdmin::activo);
        if (usuario.isEmpty()) {
            cifrado.matches(clave == null ? "" : clave, hashFalso);
            throw incorrecto();
        }
        UsuarioAdmin u = usuario.get();
        if (u.bloqueadoHasta() != null && u.bloqueadoHasta().toInstant().isAfter(reloj.instant())) {
            throw new ErrorReserva(CodigoError.CUENTA_BLOQUEADA,
                    "Por seguridad, la cuenta quedó bloqueada unos minutos tras varios intentos fallidos. Vuelve a intentarlo más tarde.");
        }
        if (clave == null || !cifrado.matches(clave, u.hashClave())) {
            usuarios.registrarFallo(u.id(), MAX_FALLOS, reloj.instant().plus(BLOQUEO));
            log.warn("Intento de acceso fallido para el usuario {}", u.id());
            throw incorrecto();
        }
        usuarios.registrarAcceso(u.id(), reloj.instant());
        var rol = new SimpleGrantedAuthority("ROLE_" + u.rol().toUpperCase());
        return UsernamePasswordAuthenticationToken.authenticated(u.publico(), null, List.of(rol));
    }

    private static ErrorReserva incorrecto() {
        return new ErrorReserva(CodigoError.NO_AUTORIZADO, "Correo o contraseña incorrectos.");
    }
}
