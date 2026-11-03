package pe.algarrobo.seguridad;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Crea el primer administrador al arrancar, SOLO si todavía no hay ningún usuario y se configuraron
 * algarrobo.admin.correo y algarrobo.admin.clave (en config/local.properties o en las variables de
 * entorno ALGARROBO_ADMIN_CORREO y ALGARROBO_ADMIN_CLAVE). La contraseña nunca está en el código.
 */
@Component
public class PrimerAdministrador implements ApplicationRunner {

    static final int LARGO_MINIMO = 12;
    private static final Logger log = LoggerFactory.getLogger(PrimerAdministrador.class);

    private final UsuariosRepositorio usuarios;
    private final PasswordEncoder cifrado;
    private final String correo;
    private final String clave;
    private final String nombre;

    public PrimerAdministrador(UsuariosRepositorio usuarios, PasswordEncoder cifrado,
                               @Value("${algarrobo.admin.correo:}") String correo,
                               @Value("${algarrobo.admin.clave:}") String clave,
                               @Value("${algarrobo.admin.nombre:Administración}") String nombre) {
        this.usuarios = usuarios;
        this.cifrado = cifrado;
        this.correo = correo.strip().toLowerCase();
        this.clave = clave;
        this.nombre = nombre;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (usuarios.contar() > 0) return;
        if (correo.isEmpty() || clave.isEmpty()) {
            log.warn("No hay usuarios del panel. Define algarrobo.admin.correo y algarrobo.admin.clave en config/local.properties y reinicia.");
            return;
        }
        if (clave.length() < LARGO_MINIMO || !correo.contains("@")) {
            log.error("No se creó el administrador: el correo debe ser válido y la contraseña tener al menos {} caracteres.", LARGO_MINIMO);
            return;
        }
        usuarios.crear(correo, nombre, cifrado.encode(clave), "administrador");
        log.info("Administrador inicial creado ({}). Ya puedes borrar algarrobo.admin.clave de la configuración.", correo);
    }
}
