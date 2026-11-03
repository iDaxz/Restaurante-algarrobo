package pe.algarrobo.ajustes;

import java.time.Duration;
import java.util.List;

import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import pe.algarrobo.motor.CodigoError;
import pe.algarrobo.motor.ErrorReserva;
import pe.algarrobo.seguridad.UsuarioAdmin;
import pe.algarrobo.seguridad.UsuariosServicio;

/**
 * Ajustes del panel (solo rol administrador: ver SeguridadConfig) y la carta pública.
 * Rutas públicas: GET /api/v1/carta y GET /api/v1/fotos/{id}.
 */
@RestController
public class AjustesControlador {

    private final AjustesServicio ajustes;
    private final CartaServicio carta;
    private final FotosServicio fotos;
    private final UsuariosServicio usuarios;

    public AjustesControlador(AjustesServicio ajustes, CartaServicio carta, FotosServicio fotos, UsuariosServicio usuarios) {
        this.ajustes = ajustes;
        this.carta = carta;
        this.fotos = fotos;
        this.usuarios = usuarios;
    }

    // ---------- Público ----------

    @GetMapping("/api/v1/carta")
    public CartaServicio.Carta cartaPublica() {
        return carta.publica();
    }

    @GetMapping("/api/v1/fotos/{id}")
    public ResponseEntity<byte[]> foto(@PathVariable long id) {
        FotosServicio.Archivo a = fotos.leer(id).orElseThrow(() -> new ErrorReserva(CodigoError.NO_ENCONTRADA, "Esa foto no existe."));
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(a.tipo()))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(7)).cachePublic())
                .header("Content-Disposition", ContentDisposition.inline().build().toString())
                .header("Content-Security-Policy", "default-src 'none'; sandbox")
                .body(a.bytes());
    }

    // ---------- Horarios, políticas, mesas y días especiales ----------

    @GetMapping("/api/v1/admin/ajustes")
    public AjustesServicio.Ajustes leer() {
        return ajustes.leer();
    }

    @PutMapping("/api/v1/admin/ajustes/politicas")
    public AjustesServicio.Ajustes politicas(@RequestBody AjustesServicio.Politicas p, @AuthenticationPrincipal UsuarioAdmin.Publico u) {
        return ajustes.guardarPoliticas(p, u);
    }

    @PutMapping("/api/v1/admin/ajustes/turnos")
    public AjustesServicio.Ajustes turnos(@RequestBody List<AjustesServicio.Turno> t, @AuthenticationPrincipal UsuarioAdmin.Publico u) {
        return ajustes.guardarTurnos(t, u);
    }

    @PostMapping("/api/v1/admin/ajustes/mesas")
    @ResponseStatus(HttpStatus.CREATED)
    public AjustesServicio.Ajustes crearMesa(@RequestBody AjustesServicio.Mesa m, @AuthenticationPrincipal UsuarioAdmin.Publico u) {
        return ajustes.crearMesa(m, u);
    }

    @PutMapping("/api/v1/admin/ajustes/mesas/{id}")
    public AjustesServicio.Ajustes editarMesa(@PathVariable String id, @RequestBody AjustesServicio.Mesa m, @AuthenticationPrincipal UsuarioAdmin.Publico u) {
        return ajustes.editarMesa(id, m, u);
    }

    @PostMapping("/api/v1/admin/ajustes/dias")
    @ResponseStatus(HttpStatus.CREATED)
    public AjustesServicio.Ajustes cerrarDia(@RequestBody AjustesServicio.NuevoDia d, @AuthenticationPrincipal UsuarioAdmin.Publico u) {
        return ajustes.cerrarDia(d, u);
    }

    @DeleteMapping("/api/v1/admin/ajustes/dias/{fecha}")
    public AjustesServicio.Ajustes abrirDia(@PathVariable String fecha, @AuthenticationPrincipal UsuarioAdmin.Publico u) {
        return ajustes.abrirDia(fecha, u);
    }

    // ---------- Carta y fotos ----------

    @GetMapping("/api/v1/admin/carta")
    public CartaServicio.Carta cartaCompleta() {
        return carta.completa();
    }

    @PostMapping("/api/v1/admin/carta/platos")
    @ResponseStatus(HttpStatus.CREATED)
    public CartaServicio.Carta crearPlato(@RequestBody CartaServicio.Plato p, @AuthenticationPrincipal UsuarioAdmin.Publico u) {
        return carta.crear(p, u);
    }

    @PutMapping("/api/v1/admin/carta/platos/{id}")
    public CartaServicio.Carta editarPlato(@PathVariable String id, @RequestBody CartaServicio.Plato p, @AuthenticationPrincipal UsuarioAdmin.Publico u) {
        return carta.editar(id, p, u);
    }

    public record Disponible(Boolean disponible) {
    }

    @PatchMapping("/api/v1/admin/carta/platos/{id}")
    public CartaServicio.Carta disponible(@PathVariable String id, @RequestBody Disponible d, @AuthenticationPrincipal UsuarioAdmin.Publico u) {
        return carta.cambiarDisponible(id, d.disponible() == null || d.disponible(), u);
    }

    @DeleteMapping("/api/v1/admin/carta/platos/{id}")
    public CartaServicio.Carta borrarPlato(@PathVariable String id, @AuthenticationPrincipal UsuarioAdmin.Publico u) {
        return carta.borrar(id, u);
    }

    @GetMapping("/api/v1/admin/fotos")
    public FotosServicio.Galeria galeria() {
        return fotos.galeria();
    }

    @PostMapping(path = "/api/v1/admin/fotos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public FotosServicio.Subida subir(@RequestParam("archivo") MultipartFile archivo, @AuthenticationPrincipal UsuarioAdmin.Publico u) {
        return fotos.subir(archivo, u);
    }

    @DeleteMapping("/api/v1/admin/fotos/{id}")
    public FotosServicio.Galeria borrarFoto(@PathVariable long id, @AuthenticationPrincipal UsuarioAdmin.Publico u) {
        return fotos.borrar(id, u);
    }

    // ---------- Cuentas del panel ----------

    @GetMapping("/api/v1/admin/usuarios")
    public List<UsuariosServicio.Cuenta> cuentas() {
        return usuarios.listar();
    }

    @PostMapping("/api/v1/admin/usuarios")
    @ResponseStatus(HttpStatus.CREATED)
    public List<UsuariosServicio.Cuenta> crearCuenta(@RequestBody UsuariosServicio.NuevaCuenta c, @AuthenticationPrincipal UsuarioAdmin.Publico u) {
        return usuarios.crear(c, u);
    }

    @PatchMapping("/api/v1/admin/usuarios/{id}")
    public List<UsuariosServicio.Cuenta> editarCuenta(@PathVariable long id, @RequestBody UsuariosServicio.Cambios c, @AuthenticationPrincipal UsuarioAdmin.Publico u) {
        return usuarios.editar(id, c, u);
    }

    public record Clave(String clave) {
    }

    @PostMapping("/api/v1/admin/usuarios/{id}/clave")
    public List<UsuariosServicio.Cuenta> reiniciarClave(@PathVariable long id, @RequestBody Clave c, @AuthenticationPrincipal UsuarioAdmin.Publico u) {
        return usuarios.reiniciarClave(id, c.clave(), u);
    }
}
