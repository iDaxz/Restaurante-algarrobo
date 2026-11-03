package pe.algarrobo.seguridad;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import pe.algarrobo.motor.CodigoError;
import pe.algarrobo.motor.ErrorReserva;

/**
 * Cuentas del panel: el administrador crea cuentas de personal, las desactiva y reinicia contraseñas;
 * cada persona cambia la suya. Nunca se queda el restaurante sin un administrador activo.
 */
@Service
public class UsuariosServicio {

    private static final Set<String> ROLES = Set.of("personal", "administrador");

    private final JdbcClient jdbc;
    private final UsuariosRepositorio usuarios;
    private final PasswordEncoder cifrado;

    public UsuariosServicio(JdbcClient jdbc, UsuariosRepositorio usuarios, PasswordEncoder cifrado) {
        this.jdbc = jdbc;
        this.usuarios = usuarios;
        this.cifrado = cifrado;
    }

    public record Cuenta(long id, String correo, String nombre, String rol, boolean activo, String ultimoAcceso) {
    }

    @Transactional(readOnly = true)
    public List<Cuenta> listar() {
        return jdbc.sql("SELECT id, correo, nombre, rol, activo, ultimo_acceso FROM usuarios_admin ORDER BY activo DESC, nombre")
                .query((rs, i) -> {
                    OffsetDateTime acceso = rs.getObject(6, OffsetDateTime.class);
                    return new Cuenta(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getBoolean(5),
                            acceso == null ? null : acceso.toInstant().toString());
                }).list();
    }

    public record NuevaCuenta(String correo, String nombre, String rol, String clave) {
    }

    @Transactional
    public List<Cuenta> crear(NuevaCuenta c, UsuarioAdmin.Publico actor) {
        Map<String, String> errores = new LinkedHashMap<>();
        String correo = c.correo() == null ? "" : c.correo().strip().toLowerCase();
        String nombre = c.nombre() == null ? "" : c.nombre().strip();
        if (!correo.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$")) errores.put("correo", "Escribe un correo válido.");
        else if (usuarios.porCorreo(correo).isPresent()) errores.put("correo", "Ya existe una cuenta con ese correo.");
        if (nombre.length() < 2 || nombre.length() > 60) errores.put("nombre", "Escribe el nombre (de 2 a 60 caracteres).");
        if (!ROLES.contains(c.rol())) errores.put("rol", "Elige personal o administrador.");
        validarClave(c.clave(), "clave", errores);
        if (!errores.isEmpty()) throw new ErrorReserva(CodigoError.DATOS_INVALIDOS, "Revisa los datos de la cuenta.", errores, null);
        usuarios.crear(correo, nombre, cifrado.encode(c.clave()), c.rol());
        registrar("Creó la cuenta de %s (%s)".formatted(nombre, c.rol()), actor);
        return listar();
    }

    public record Cambios(String nombre, String rol, Boolean activo) {
    }

    @Transactional
    public List<Cuenta> editar(long id, Cambios c, UsuarioAdmin.Publico actor) {
        UsuarioAdmin u = usuarios.porId(id).orElseThrow(() -> new ErrorReserva(CodigoError.NO_ENCONTRADA, "Esa cuenta no existe."));
        String nombre = c.nombre() == null ? u.nombre() : c.nombre().strip();
        String rol = c.rol() == null ? u.rol() : c.rol();
        boolean activo = c.activo() == null ? u.activo() : c.activo();
        if (nombre.length() < 2 || nombre.length() > 60) throw new ErrorReserva(CodigoError.DATOS_INVALIDOS, "Escribe el nombre (de 2 a 60 caracteres).");
        if (!ROLES.contains(rol)) throw new ErrorReserva(CodigoError.DATOS_INVALIDOS, "Elige personal o administrador.");
        if (id == actor.id() && (!activo || !rol.equals(u.rol()))) {
            throw new ErrorReserva(CodigoError.DATOS_INVALIDOS, "No puedes desactivar tu propia cuenta ni cambiar tu propio rol.");
        }
        boolean dejaDeSerAdminActivo = "administrador".equals(u.rol()) && u.activo() && (!activo || !"administrador".equals(rol));
        if (dejaDeSerAdminActivo && jdbc.sql("SELECT count(*) FROM usuarios_admin WHERE rol = 'administrador' AND activo AND id <> ?")
                .param(id).query(Integer.class).single() == 0) {
            throw new ErrorReserva(CodigoError.DATOS_INVALIDOS, "Tiene que quedar al menos un administrador activo.");
        }
        jdbc.sql("UPDATE usuarios_admin SET nombre = ?, rol = ?, activo = ? WHERE id = ?").params(nombre, rol, activo, id).update();
        registrar("Cuenta de %s: %s".formatted(nombre, activo ? "rol " + rol : "desactivada"), actor);
        return listar();
    }

    @Transactional
    public List<Cuenta> reiniciarClave(long id, String clave, UsuarioAdmin.Publico actor) {
        UsuarioAdmin u = usuarios.porId(id).orElseThrow(() -> new ErrorReserva(CodigoError.NO_ENCONTRADA, "Esa cuenta no existe."));
        Map<String, String> errores = new LinkedHashMap<>();
        validarClave(clave, "clave", errores);
        if (!errores.isEmpty()) throw new ErrorReserva(CodigoError.DATOS_INVALIDOS, errores.get("clave"), errores, null);
        jdbc.sql("UPDATE usuarios_admin SET hash_clave = ?, intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?")
                .params(cifrado.encode(clave), id).update();
        registrar("Reinició la contraseña de " + u.nombre(), actor);
        return listar();
    }

    /** Cada persona cambia su propia contraseña sabiendo la actual. */
    @Transactional
    public void cambiarPropia(UsuarioAdmin.Publico actor, String actual, String nueva) {
        UsuarioAdmin u = usuarios.porId(actor.id()).orElseThrow();
        Map<String, String> errores = new LinkedHashMap<>();
        if (actual == null || !cifrado.matches(actual, u.hashClave())) errores.put("actual", "La contraseña actual no es correcta.");
        validarClave(nueva, "nueva", errores);
        if (errores.isEmpty() && nueva.equals(actual)) errores.put("nueva", "La nueva contraseña debe ser distinta de la actual.");
        if (!errores.isEmpty()) throw new ErrorReserva(CodigoError.DATOS_INVALIDOS, "No se cambió la contraseña.", errores, null);
        jdbc.sql("UPDATE usuarios_admin SET hash_clave = ? WHERE id = ?").params(cifrado.encode(nueva), u.id()).update();
    }

    private static void validarClave(String clave, String campo, Map<String, String> errores) {
        if (clave == null || clave.length() < PrimerAdministrador.LARGO_MINIMO) {
            errores.put(campo, "La contraseña debe tener al menos %d caracteres.".formatted(PrimerAdministrador.LARGO_MINIMO));
        } else if (clave.length() > 128) {
            errores.put(campo, "La contraseña admite hasta 128 caracteres.");
        }
    }

    private void registrar(String descripcion, UsuarioAdmin.Publico actor) {
        jdbc.sql("INSERT INTO cambios_config (area, descripcion, usuario_id) VALUES ('usuarios', ?, ?)").params(descripcion, actor.id()).update();
    }
}
