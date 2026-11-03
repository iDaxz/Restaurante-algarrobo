package pe.algarrobo.admin;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import pe.algarrobo.motor.CodigoError;
import pe.algarrobo.motor.ErrorReserva;
import pe.algarrobo.motor.EstadoReserva;
import pe.algarrobo.seguridad.UsuarioAdmin;

/** API del panel. Todas las rutas exigen sesión del personal (SeguridadConfig) y token CSRF al modificar. */
@RestController
@RequestMapping("/api/v1/admin")
public class AdminControlador {

    private static final Map<String, EstadoReserva> ACCIONES = Map.of(
            "confirmar", EstadoReserva.CONFIRMADA,
            "completar", EstadoReserva.COMPLETADA,
            "no-asistio", EstadoReserva.NO_ASISTIO,
            "cancelar", EstadoReserva.CANCELADA);

    private final AdminServicio servicio;

    public AdminControlador(AdminServicio servicio) {
        this.servicio = servicio;
    }

    @GetMapping("/reservas")
    public List<AdminRepositorio.ReservaAdmin> listar(@RequestParam LocalDate desde, @RequestParam LocalDate hasta,
                                                      @RequestParam(required = false) List<String> estado,
                                                      @RequestParam(required = false) String turno,
                                                      @RequestParam(required = false) String q) {
        List<EstadoReserva> estados = estado == null ? List.of() : estado.stream().map(e -> {
            try {
                return EstadoReserva.de(e);
            } catch (IllegalArgumentException ex) {
                throw new ErrorReserva(CodigoError.DATOS_INVALIDOS, "Estado desconocido: " + e);
            }
        }).toList();
        return servicio.listar(new AdminRepositorio.Filtro(desde, hasta, estados, turno, q));
    }

    @GetMapping("/reservas/{codigo}")
    public AdminServicio.Detalle detalle(@PathVariable String codigo) {
        return servicio.detalle(codigo);
    }

    public record Motivo(String motivo) {
    }

    @PostMapping("/reservas/{codigo}/{accion}")
    public AdminServicio.Detalle accion(@PathVariable String codigo, @PathVariable String accion,
                                        @RequestBody(required = false) Motivo m,
                                        @AuthenticationPrincipal UsuarioAdmin.Publico usuario) {
        EstadoReserva hacia = ACCIONES.get(accion);
        if (hacia == null) throw new ErrorReserva(CodigoError.DATOS_INVALIDOS, "Acción desconocida: " + accion);
        return servicio.cambiarEstado(codigo, hacia, m == null ? null : m.motivo(), usuario);
    }

    @PostMapping("/reservas")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminServicio.Detalle crear(@RequestBody AdminServicio.ReservaManual m, @AuthenticationPrincipal UsuarioAdmin.Publico usuario) {
        return servicio.crearManual(m, usuario);
    }

    @GetMapping("/mesas")
    public List<AdminServicio.MesaDisponible> mesas(@RequestParam LocalDate fecha, @RequestParam String hora) {
        return servicio.mesas(fecha, hora);
    }
}
