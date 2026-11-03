package pe.algarrobo.web;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingRequestValueException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import pe.algarrobo.motor.Alternativas;
import pe.algarrobo.motor.CodigoError;
import pe.algarrobo.motor.ErrorReserva;

/** Todas las respuestas de error tienen la forma de ErrorReserva.toJSON() del frontend. */
@RestControllerAdvice
public class ManejadorErrores {

    private static final Logger log = LoggerFactory.getLogger(ManejadorErrores.class);

    public record CuerpoError(String codigo, String mensaje, Map<String, String> errores, Alternativas alternativas) {
    }

    public static ResponseEntity<CuerpoError> respuesta(CodigoError codigo, String mensaje, Map<String, String> errores, Alternativas alternativas) {
        return ResponseEntity.status(codigo.http()).body(new CuerpoError(codigo.name(), mensaje, errores, alternativas));
    }

    @ExceptionHandler(ErrorReserva.class)
    ResponseEntity<CuerpoError> negocio(ErrorReserva e) {
        return respuesta(e.codigo(), e.getMessage(), e.errores(), e.alternativas());
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MissingRequestValueException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<CuerpoError> peticionMalFormada(Exception e) {
        return respuesta(CodigoError.DATOS_INVALIDOS, "Revisa los datos enviados: faltan valores o tienen un formato incorrecto.", Map.of(), null);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<CuerpoError> metodo(HttpRequestMethodNotSupportedException e) {
        return ResponseEntity.status(405).body(new CuerpoError("METODO_NO_PERMITIDO", "Esta ruta no admite " + e.getMethod() + ".", Map.of(), null));
    }

    @ExceptionHandler({NoResourceFoundException.class, NoHandlerFoundException.class})
    ResponseEntity<CuerpoError> noExiste(Exception e) {
        return ResponseEntity.status(404).body(new CuerpoError("NO_EXISTE", "Esta dirección no existe.", Map.of(), null));
    }

    @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
    ResponseEntity<CuerpoError> archivoGrande(Exception e) {
        String mensaje = "La imagen pesa más de 3 MB. Redúcela e inténtalo de nuevo.";
        return respuesta(CodigoError.ARCHIVO_INVALIDO, mensaje, Map.of("archivo", mensaje), null);
    }

    @ExceptionHandler({org.springframework.web.multipart.support.MissingServletRequestPartException.class,
            org.springframework.web.multipart.MultipartException.class})
    ResponseEntity<CuerpoError> sinArchivo(Exception e) {
        return respuesta(CodigoError.ARCHIVO_INVALIDO, "Elige una imagen.", Map.of("archivo", "Elige una imagen."), null);
    }

    /** Cualquier otro fallo: se registra completo en el log, pero al cliente no se le dan detalles internos. */
    @ExceptionHandler(Exception.class)
    ResponseEntity<CuerpoError> inesperado(Exception e) {
        log.error("Error inesperado", e);
        return respuesta(CodigoError.ERROR_INTERNO, "Tuvimos un problema al procesar la solicitud. Vuelve a intentarlo en un momento.", Map.of(), null);
    }
}
