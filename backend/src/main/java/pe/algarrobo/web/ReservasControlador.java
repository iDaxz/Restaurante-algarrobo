package pe.algarrobo.web;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import pe.algarrobo.config.ReglasProveedor;
import pe.algarrobo.motor.Alternativas;
import pe.algarrobo.motor.CodigoError;
import pe.algarrobo.motor.ErrorReserva;
import pe.algarrobo.motor.Horario;
import pe.algarrobo.motor.Solicitud;
import pe.algarrobo.reservas.ReservaPublica;
import pe.algarrobo.reservas.ReservaServicio;

/**
 * API pública de reservas (docs/api-reservas.md). La cabecera X-Sesion identifica la pestaña del
 * navegador: sus propias mesas apartadas no la bloquean a ella.
 * El contacto nunca viaja en la URL: las consultas de una reserva van por POST con el contacto en el cuerpo.
 */
@RestController
@RequestMapping("/api/v1")
public class ReservasControlador {

    private static final String SESION = "X-Sesion";

    private final ReservaServicio servicio;
    private final ReglasProveedor reglas;

    public ReservasControlador(ReservaServicio servicio, ReglasProveedor reglas) {
        this.servicio = servicio;
        this.reglas = reglas;
    }

    // ---------- Configuración pública ----------

    /** Lo que el navegador necesita para pintar el formulario: turnos, mesas, límites y políticas. */
    @GetMapping("/configuracion")
    public Object configuracion() {
        return reglas.reglas();
    }

    // ---------- Disponibilidad ----------

    @GetMapping("/disponibilidad/mes")
    public Map<String, String> mes(@RequestParam YearMonth mes, @RequestParam int personas,
                                   @RequestParam(required = false) String excluir,
                                   @RequestHeader(value = SESION, required = false) String sesion) {
        return servicio.consultarMes(mes, personas, excluir, sesion);
    }

    @GetMapping("/disponibilidad/dia")
    public List<Horario> dia(@RequestParam LocalDate fecha, @RequestParam int personas,
                             @RequestParam(required = false) String excluir,
                             @RequestHeader(value = SESION, required = false) String sesion) {
        return servicio.consultarHorarios(fecha, personas, excluir, sesion);
    }

    @GetMapping("/disponibilidad/hoy")
    public Map<String, Object> hoy() {
        return servicio.resumenDeHoy();
    }

    @GetMapping("/disponibilidad/alternativas")
    public Alternativas alternativas(@RequestParam LocalDate fecha, @RequestParam String hora, @RequestParam int personas,
                                     @RequestParam(required = false) String excluir,
                                     @RequestHeader(value = SESION, required = false) String sesion) {
        return servicio.alternativas(fecha, hora, personas, excluir, sesion);
    }

    // ---------- Retenciones ----------

    @GetMapping("/disponibilidad/mesas")
    public List<pe.algarrobo.motor.Motor.EstadoMesa> mesas(@RequestParam LocalDate fecha, @RequestParam String hora, @RequestParam int personas,
                                                       @RequestParam(required = false) String excluir,
                                                       @RequestHeader(value = SESION, required = false) String sesion) {
        return servicio.mesasALaHora(fecha, hora, personas, excluir, sesion);
    }

    public record PedidoRetencion(String fecha, String hora, Integer personas, String excluir, String mesa) {
    }

    @PostMapping("/retenciones")
    @ResponseStatus(HttpStatus.CREATED)
    public ReservaServicio.Retencion retener(@RequestBody PedidoRetencion p, @RequestHeader(value = SESION, required = false) String sesion) {
        return servicio.retenerMesa(new Solicitud(null, null, p.fecha(), p.hora(), p.personas(), null, p.mesa()), p.excluir(), sesion);
    }

    @DeleteMapping("/retenciones/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void liberar(@PathVariable String id, @RequestHeader(value = SESION, required = false) String sesion) {
        servicio.liberarRetencion(id, sesion);
    }

    /** Libera la mesa apartada por esta sesión, sea cual sea (al salir de la página). */
    @DeleteMapping("/retenciones")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void liberarDeLaSesion(@RequestHeader(value = SESION, required = false) String sesion) {
        servicio.liberarRetencion(null, sesion);
    }

    // ---------- Reservas ----------

    @PostMapping("/reservas")
    @ResponseStatus(HttpStatus.CREATED)
    public ReservaPublica crear(@RequestBody Solicitud solicitud, @RequestHeader(value = SESION, required = false) String sesion) {
        return servicio.crearReserva(solicitud, sesion);
    }

    public record Consulta(String codigo, String contacto) {
    }

    @PostMapping("/reservas/consultar")
    public ReservaPublica consultar(@RequestBody Consulta c) {
        return servicio.buscarReserva(c.codigo(), c.contacto());
    }

    public record ConsultaVarias(List<Consulta> reservas) {
    }

    public record ResultadoVarias(List<ReservaPublica> reservas, List<String> noEncontradas) {
    }

    /**
     * "Mis reservas" en una sola petición: hasta 20 pares código + contacto. Las que no coinciden
     * se devuelven en noEncontradas (sin decir si el código existe con otro contacto).
     */
    @PostMapping("/reservas/consultar-varias")
    public ResultadoVarias consultarVarias(@RequestBody ConsultaVarias c) {
        List<Consulta> pedidas = c.reservas() == null ? List.of() : c.reservas();
        if (pedidas.size() > 20) {
            throw new ErrorReserva(CodigoError.DATOS_INVALIDOS, "Se pueden consultar hasta 20 reservas a la vez.");
        }
        List<ReservaPublica> encontradas = new ArrayList<>();
        List<String> noEncontradas = new ArrayList<>();
        for (Consulta x : pedidas) {
            try {
                encontradas.add(servicio.buscarReserva(x.codigo(), x.contacto()));
            } catch (ErrorReserva e) {
                if (e.codigo() != CodigoError.NO_ENCONTRADA) throw e;
                noEncontradas.add(x.codigo());
            }
        }
        return new ResultadoVarias(encontradas, noEncontradas);
    }

    public record Modificacion(String contacto, Solicitud cambios) {
    }

    @PatchMapping("/reservas/{codigo}")
    public ReservaPublica modificar(@PathVariable String codigo, @RequestBody Modificacion m,
                                    @RequestHeader(value = SESION, required = false) String sesion) {
        Solicitud cambios = m.cambios() == null ? new Solicitud(null, null, null, null, null, null) : m.cambios();
        return servicio.modificarReserva(codigo, m.contacto(), cambios, sesion);
    }

    public record Cancelacion(String contacto) {
    }

    @PostMapping("/reservas/{codigo}/cancelar")
    public ReservaPublica cancelar(@PathVariable String codigo, @RequestBody Cancelacion c) {
        return servicio.cancelarReserva(codigo, c.contacto());
    }
}
