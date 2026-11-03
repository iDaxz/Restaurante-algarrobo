package pe.algarrobo.seguridad;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class UsuariosRepositorio {

    private final JdbcClient jdbc;

    public UsuariosRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public long contar() {
        return jdbc.sql("SELECT count(*) FROM usuarios_admin").query(Long.class).single();
    }

    public Optional<UsuarioAdmin> porCorreo(String correo) {
        return jdbc.sql("SELECT * FROM usuarios_admin WHERE correo = ?").param(correo).query(this::fila).optional();
    }

    public Optional<UsuarioAdmin> porId(long id) {
        return jdbc.sql("SELECT * FROM usuarios_admin WHERE id = ?").param(id).query(this::fila).optional();
    }

    public long crear(String correo, String nombre, String hashClave, String rol) {
        return jdbc.sql("INSERT INTO usuarios_admin (correo, nombre, hash_clave, rol) VALUES (?, ?, ?, ?) RETURNING id")
                .params(correo, nombre, hashClave, rol)
                .query(Long.class).single();
    }

    /** Suma un intento fallido y, al llegar al máximo, bloquea la cuenta hasta "hasta". */
    public void registrarFallo(long id, int maximo, Instant hasta) {
        jdbc.sql("""
                UPDATE usuarios_admin
                   SET intentos_fallidos = intentos_fallidos + 1,
                       bloqueado_hasta = CASE WHEN intentos_fallidos + 1 >= ? THEN ? ELSE bloqueado_hasta END
                 WHERE id = ?
                """)
                .params(maximo, OffsetDateTime.ofInstant(hasta, ZoneOffset.UTC), id)
                .update();
    }

    public void registrarAcceso(long id, Instant momento) {
        jdbc.sql("UPDATE usuarios_admin SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_acceso = ? WHERE id = ?")
                .params(OffsetDateTime.ofInstant(momento, ZoneOffset.UTC), id)
                .update();
    }

    private UsuarioAdmin fila(java.sql.ResultSet rs, int i) throws java.sql.SQLException {
        return new UsuarioAdmin(rs.getLong("id"), rs.getString("correo"), rs.getString("nombre"), rs.getString("hash_clave"),
                rs.getString("rol"), rs.getBoolean("activo"), rs.getInt("intentos_fallidos"),
                rs.getObject("bloqueado_hasta", OffsetDateTime.class));
    }
}
