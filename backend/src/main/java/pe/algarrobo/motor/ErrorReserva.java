package pe.algarrobo.motor;

import java.util.Map;

/**
 * Error de negocio con la misma forma que ErrorReserva del frontend:
 * { codigo, mensaje, errores: {campo: mensaje}, alternativas }.
 */
public class ErrorReserva extends RuntimeException {

    private final CodigoError codigo;
    private final Map<String, String> errores;
    private final Alternativas alternativas;

    public ErrorReserva(CodigoError codigo, String mensaje) {
        this(codigo, mensaje, Map.of(), null);
    }

    public ErrorReserva(CodigoError codigo, String mensaje, Map<String, String> errores, Alternativas alternativas) {
        super(mensaje);
        this.codigo = codigo;
        this.errores = errores == null ? Map.of() : Map.copyOf(errores);
        this.alternativas = alternativas;
    }

    public CodigoError codigo() {
        return codigo;
    }

    public Map<String, String> errores() {
        return errores;
    }

    public Alternativas alternativas() {
        return alternativas;
    }
}
