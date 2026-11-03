package pe.algarrobo.motor;

/** Códigos de error compartidos con el frontend (js/core/errores.js) y su estado HTTP. */
public enum CodigoError {
    DATOS_INVALIDOS(400),
    GRUPO_GRANDE(422),
    FECHA_PASADA(422),
    FECHA_FUERA_DE_PLAZO(422),
    DIA_CERRADO(422),
    HORARIO_INVALIDO(422),
    HORARIO_PASADO(422),
    HORARIO_LLENO(409),
    CONTACTO_DUPLICADO(409),
    LIMITE_RESERVAS(429),
    NO_ENCONTRADA(404),
    FUERA_DE_PLAZO_CAMBIOS(422),
    TRANSICION_INVALIDA(409),
    RETENCION_VENCIDA(410),
    DEMASIADAS_PETICIONES(429),
    NO_AUTORIZADO(401),
    CUENTA_BLOQUEADA(423),
    MESA_INVALIDA(422),
    MESA_OCUPADA(409),
    CONFLICTO_RESERVAS(409),
    ARCHIVO_INVALIDO(422),
    ERROR_INTERNO(500);

    private final int http;

    CodigoError(int http) {
        this.http = http;
    }

    public int http() {
        return http;
    }
}
