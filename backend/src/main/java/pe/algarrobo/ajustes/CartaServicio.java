package pe.algarrobo.ajustes;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import pe.algarrobo.motor.CodigoError;
import pe.algarrobo.motor.ErrorReserva;
import pe.algarrobo.seguridad.UsuarioAdmin;

/**
 * La carta: la web pública la lee completa (los agotados se muestran con la etiqueta "Agotado", como en
 * el diseño de la carta); el administrador crea, edita, marca como agotados o borra platos. La foto es una de la galería del sitio (assets/img/platos) o una subida (/api/v1/fotos/{id}).
 */
@Service
public class CartaServicio {

    private static final Set<String> ETIQUETAS = Set.of("mas-vendido", "nuevo", "recomendado");

    private final JdbcClient jdbc;
    private final FotosServicio fotos;

    public CartaServicio(JdbcClient jdbc, FotosServicio fotos) {
        this.jdbc = jdbc;
        this.fotos = fotos;
    }

    public record Categoria(String id, String nombre) {
    }

    /** Misma forma que los platos de js/data/carta.js, para que la web los use sin cambios. */
    public record Plato(String id, String categoria, String nombre, String descripcion, String origen, String historia,
                        BigDecimal precio, String etiqueta, String foto, Boolean disponible) {
    }

    public record Carta(List<Categoria> categorias, List<Plato> platos) {
    }

    @Transactional(readOnly = true)
    public Carta publica() {
        return completa();
    }

    @Transactional(readOnly = true)
    public Carta completa() {
        List<Categoria> categorias = jdbc.sql("SELECT id, nombre FROM categorias ORDER BY orden")
                .query((rs, i) -> new Categoria(rs.getString(1), rs.getString(2))).list();
        List<Plato> platos = jdbc.sql("""
                SELECT p.* FROM platos p JOIN categorias c ON c.id = p.categoria_id ORDER BY c.orden, p.orden, p.nombre
                """)
                .query((rs, i) -> new Plato(rs.getString("id"), rs.getString("categoria_id"), rs.getString("nombre"),
                        rs.getString("descripcion"), rs.getString("origen"), rs.getString("historia"),
                        rs.getBigDecimal("precio").stripTrailingZeros(), rs.getString("etiqueta"), rs.getString("foto"),
                        rs.getBoolean("disponible")))
                .list();
        return new Carta(categorias, platos);
    }

    @Transactional
    public Carta crear(Plato p, UsuarioAdmin.Publico usuario) {
        Plato limpio = validar(p);
        String id = idDisponible(slug(limpio.nombre()));
        jdbc.sql("""
                INSERT INTO platos (id, categoria_id, nombre, descripcion, origen, historia, precio, etiqueta, foto, disponible, orden)
                VALUES (:id, :categoria, :nombre, :descripcion, :origen, :historia, :precio, :etiqueta, :foto, :disponible,
                        (SELECT coalesce(max(orden), 0) + 1 FROM platos WHERE categoria_id = :categoria))
                """).params(parametros(id, limpio)).update();
        registrar("Agregó el plato «%s» (S/ %s)".formatted(limpio.nombre(), limpio.precio().setScale(2, java.math.RoundingMode.UNNECESSARY).toPlainString()), usuario);
        return completa();
    }

    @Transactional
    public Carta editar(String id, Plato p, UsuarioAdmin.Publico usuario) {
        existe(id);
        Plato limpio = validar(p);
        jdbc.sql("""
                UPDATE platos SET categoria_id = :categoria, nombre = :nombre, descripcion = :descripcion, origen = :origen,
                       historia = :historia, precio = :precio, etiqueta = :etiqueta, foto = :foto, disponible = :disponible,
                       actualizado = now()
                 WHERE id = :id
                """).params(parametros(id, limpio)).update();
        registrar("Editó el plato «%s»".formatted(limpio.nombre()), usuario);
        return completa();
    }

    @Transactional
    public Carta cambiarDisponible(String id, boolean disponible, UsuarioAdmin.Publico usuario) {
        String nombre = existe(id);
        jdbc.sql("UPDATE platos SET disponible = ?, actualizado = now() WHERE id = ?").params(disponible, id).update();
        registrar("%s «%s»".formatted(disponible ? "Volvió a ofrecer" : "Marcó como agotado", nombre), usuario);
        return completa();
    }

    @Transactional
    public Carta borrar(String id, UsuarioAdmin.Publico usuario) {
        String nombre = existe(id);
        jdbc.sql("DELETE FROM platos WHERE id = ?").param(id).update();
        registrar("Borró el plato «%s»".formatted(nombre), usuario);
        return completa();
    }

    // ---------- Validación ----------

    private Plato validar(Plato p) {
        Map<String, String> errores = new LinkedHashMap<>();
        String nombre = texto(p.nombre());
        String descripcion = texto(p.descripcion());
        String origen = texto(p.origen());
        String historia = texto(p.historia());
        String etiqueta = texto(p.etiqueta());
        String foto = texto(p.foto());
        if (nombre == null || nombre.length() < 2 || nombre.length() > 80) errores.put("nombre", "Escribe el nombre del plato (de 2 a 80 caracteres).");
        if (p.categoria() == null || !jdbc.sql("SELECT EXISTS (SELECT 1 FROM categorias WHERE id = ?)").param(p.categoria()).query(Boolean.class).single()) {
            errores.put("categoria", "Elige una categoría.");
        }
        if (descripcion == null || descripcion.length() > 300) errores.put("descripcion", "Escribe una descripción de hasta 300 caracteres.");
        if (origen != null && origen.length() > 60) errores.put("origen", "El origen admite hasta 60 caracteres.");
        if (historia != null && historia.length() > 900) errores.put("historia", "La historia admite hasta 900 caracteres.");
        if (p.precio() == null || p.precio().signum() < 0 || p.precio().compareTo(new BigDecimal("9999.99")) > 0 || p.precio().scale() > 2) {
            errores.put("precio", "Escribe un precio en soles, por ejemplo 42 o 18.50.");
        }
        if (etiqueta != null && !ETIQUETAS.contains(etiqueta)) errores.put("etiqueta", "Etiqueta desconocida.");
        if (foto == null || !fotos.esValida(foto)) errores.put("foto", "Elige una foto de la galería o sube una nueva.");
        if (!errores.isEmpty()) throw new ErrorReserva(CodigoError.DATOS_INVALIDOS, "Revisa los datos del plato.", errores, null);
        return new Plato(null, p.categoria(), nombre, descripcion, origen, historia, p.precio(), etiqueta, foto,
                p.disponible() == null || p.disponible());
    }

    private static Map<String, Object> parametros(String id, Plato p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("categoria", p.categoria());
        m.put("nombre", p.nombre());
        m.put("descripcion", p.descripcion());
        m.put("origen", p.origen());
        m.put("historia", p.historia());
        m.put("precio", p.precio());
        m.put("etiqueta", p.etiqueta());
        m.put("foto", p.foto());
        m.put("disponible", p.disponible());
        return m;
    }

    private String existe(String id) {
        return jdbc.sql("SELECT nombre FROM platos WHERE id = ?").param(id).query(String.class).optional()
                .orElseThrow(() -> new ErrorReserva(CodigoError.NO_ENCONTRADA, "Ese plato no existe."));
    }

    /** "Ají de gallina" → "aji-de-gallina"; si ya existe, "aji-de-gallina-2". */
    static String slug(String nombre) {
        String sinTildes = Normalizer.normalize(nombre, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        String s = sinTildes.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        return s.isEmpty() ? "plato" : s;
    }

    private String idDisponible(String base) {
        String id = base;
        for (int n = 2; jdbc.sql("SELECT EXISTS (SELECT 1 FROM platos WHERE id = ?)").param(id).query(Boolean.class).single(); n++) {
            id = base + "-" + n;
        }
        return id;
    }

    private static String texto(String t) {
        return t == null || t.isBlank() ? null : t.strip();
    }

    private void registrar(String descripcion, UsuarioAdmin.Publico usuario) {
        jdbc.sql("INSERT INTO cambios_config (area, descripcion, usuario_id) VALUES ('carta', ?, ?)").params(descripcion, usuario.id()).update();
    }
}
