package pe.algarrobo.ajustes;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

import javax.imageio.ImageIO;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import pe.algarrobo.motor.CodigoError;
import pe.algarrobo.motor.ErrorReserva;
import pe.algarrobo.seguridad.UsuarioAdmin;

/**
 * Fotos de la carta: la galería del sitio (assets/img/platos/*.jpg) y las que sube el administrador.
 * Una subida se acepta solo si su contenido es de verdad JPEG, PNG o WebP (se mira la firma del archivo,
 * no el nombre ni el tipo que dice el navegador), pesa hasta 3 MB y, si es JPEG o PNG, se puede decodificar.
 * SVG y cualquier otro formato se rechazan: podrían llevar código.
 */
@Service
public class FotosServicio {

    static final int MAXIMO_BYTES = 3 * 1024 * 1024;
    static final int MAXIMO_LADO = 6000;
    private static final String PREFIJO_GALERIA = "assets/img/platos/";
    private static final String PREFIJO_SUBIDA = "/api/v1/fotos/";

    private final JdbcClient jdbc;
    private final Path carpetaGaleria;

    public FotosServicio(JdbcClient jdbc, @Value("${algarrobo.sitio.carpeta}") String carpetaSitio) {
        this.jdbc = jdbc;
        this.carpetaGaleria = Path.of(carpetaSitio).toAbsolutePath().normalize().resolve(PREFIJO_GALERIA);
    }

    public record Subida(long id, String url, String nombre, Integer ancho, Integer alto, String creada) {
    }

    public record Galeria(List<String> predeterminadas, List<Subida> subidas) {
    }

    @Transactional(readOnly = true)
    public Galeria galeria() {
        return new Galeria(predeterminadas(), jdbc.sql("SELECT id, nombre, ancho, alto, creada FROM fotos ORDER BY creada DESC")
                .query((rs, i) -> new Subida(rs.getLong(1), PREFIJO_SUBIDA + rs.getLong(1), rs.getString(2),
                        (Integer) rs.getObject(3), (Integer) rs.getObject(4), rs.getObject(5, OffsetDateTime.class).toInstant().toString()))
                .list());
    }

    /** Fotos que ya trae el sitio. */
    public List<String> predeterminadas() {
        if (!Files.isDirectory(carpetaGaleria)) return List.of();
        try (Stream<Path> archivos = Files.list(carpetaGaleria)) {
            return archivos.map(p -> p.getFileName().toString())
                    .filter(n -> n.matches("[a-z0-9-]+\\.jpg"))
                    .sorted()
                    .map(n -> PREFIJO_GALERIA + n)
                    .toList();
        } catch (IOException e) {
            return List.of();
        }
    }

    /** Una foto de plato válida es de la galería o una subida que existe. */
    public boolean esValida(String foto) {
        if (foto.startsWith(PREFIJO_GALERIA)) return predeterminadas().contains(foto);
        if (foto.matches("^/api/v1/fotos/\\d{1,18}$")) {
            return jdbc.sql("SELECT EXISTS (SELECT 1 FROM fotos WHERE id = ?)").param(Long.parseLong(foto.substring(PREFIJO_SUBIDA.length())))
                    .query(Boolean.class).single();
        }
        return false;
    }

    @Transactional
    public Subida subir(MultipartFile archivo, UsuarioAdmin.Publico usuario) {
        if (archivo == null || archivo.isEmpty()) throw invalido("Elige una imagen.");
        if (archivo.getSize() > MAXIMO_BYTES) throw invalido("La imagen pesa más de 3 MB. Redúcela e inténtalo de nuevo.");
        byte[] bytes;
        try {
            bytes = archivo.getBytes();
        } catch (IOException e) {
            throw invalido("No se pudo leer la imagen.");
        }
        String tipo = tipoReal(bytes).orElseThrow(() -> invalido("Solo se aceptan imágenes JPG, PNG o WebP."));
        Integer ancho = null;
        Integer alto = null;
        if (!tipo.equals("image/webp")) {
            try {
                BufferedImage imagen = ImageIO.read(new ByteArrayInputStream(bytes));
                if (imagen == null) throw invalido("La imagen está dañada o no se puede abrir.");
                ancho = imagen.getWidth();
                alto = imagen.getHeight();
            } catch (IOException e) {
                throw invalido("La imagen está dañada o no se puede abrir.");
            }
            if (ancho > MAXIMO_LADO || alto > MAXIMO_LADO) throw invalido("La imagen es demasiado grande (máximo 6000 píxeles por lado).");
        }
        String nombre = nombreSeguro(archivo.getOriginalFilename());
        long id = jdbc.sql("INSERT INTO fotos (nombre, tipo, bytes, ancho, alto, usuario_id) VALUES (?, ?, ?, ?, ?, ?) RETURNING id")
                .params(nombre, tipo, bytes, ancho, alto, usuario.id()).query(Long.class).single();
        jdbc.sql("INSERT INTO cambios_config (area, descripcion, usuario_id) VALUES ('carta', ?, ?)")
                .params("Subió la foto «%s»".formatted(nombre), usuario.id()).update();
        return new Subida(id, PREFIJO_SUBIDA + id, nombre, ancho, alto, OffsetDateTime.now().toInstant().toString());
    }

    public record Archivo(String tipo, byte[] bytes, String nombre) {
    }

    @Transactional(readOnly = true)
    public Optional<Archivo> leer(long id) {
        return jdbc.sql("SELECT tipo, bytes, nombre FROM fotos WHERE id = ?").param(id)
                .query((rs, i) -> new Archivo(rs.getString(1), rs.getBytes(2), rs.getString(3))).optional();
    }

    @Transactional
    public Galeria borrar(long id, UsuarioAdmin.Publico usuario) {
        String url = PREFIJO_SUBIDA + id;
        List<String> usan = jdbc.sql("SELECT nombre FROM platos WHERE foto = ?").param(url).query(String.class).list();
        if (!usan.isEmpty()) {
            throw new ErrorReserva(CodigoError.CONFLICTO_RESERVAS, "Esta foto la usa: " + String.join(", ", usan) + ". Cámbiala en esos platos primero.");
        }
        if (jdbc.sql("DELETE FROM fotos WHERE id = ?").param(id).update() == 0) {
            throw new ErrorReserva(CodigoError.NO_ENCONTRADA, "Esa foto no existe.");
        }
        jdbc.sql("INSERT INTO cambios_config (area, descripcion, usuario_id) VALUES ('carta', ?, ?)")
                .params("Borró una foto subida (#%d)".formatted(id), usuario.id()).update();
        return galeria();
    }

    /** Tipo según la firma del archivo (los primeros bytes), no según el nombre. */
    static Optional<String> tipoReal(byte[] b) {
        if (b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) return Optional.of("image/jpeg");
        byte[] png = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};
        if (b.length >= 8 && Arrays.equals(Arrays.copyOf(b, 8), png)) return Optional.of("image/png");
        if (b.length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') return Optional.of("image/webp");
        return Optional.empty();
    }

    /** Solo el nombre (sin carpetas), con caracteres simples; se usa para mostrarlo, nunca como ruta. */
    static String nombreSeguro(String original) {
        String base = original == null ? "" : original.replace('\\', '/');
        base = base.substring(base.lastIndexOf('/') + 1).replaceAll("[^\\p{L}\\p{N} ._-]", "").strip();
        if (base.isEmpty()) base = "foto";
        return base.length() > 120 ? base.substring(0, 120) : base;
    }

    private static ErrorReserva invalido(String mensaje) {
        return new ErrorReserva(CodigoError.ARCHIVO_INVALIDO, mensaje, java.util.Map.of("archivo", mensaje), null);
    }
}
