package pe.algarrobo.seguridad;

import java.time.OffsetDateTime;

/** Una persona del restaurante con acceso al panel. hashClave es bcrypt; nunca sale de este paquete. */
public record UsuarioAdmin(
        long id,
        String correo,
        String nombre,
        String hashClave,
        String rol,                // 'personal' o 'administrador'
        boolean activo,
        int intentosFallidos,
        OffsetDateTime bloqueadoHasta) {

    /** Lo que se puede mostrar en el panel. */
    public record Publico(long id, String correo, String nombre, String rol) {
    }

    public Publico publico() {
        return new Publico(id, correo, nombre, rol);
    }
}
