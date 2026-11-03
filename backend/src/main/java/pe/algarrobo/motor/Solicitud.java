package pe.algarrobo.motor;

/**
 * Datos que envía la persona al reservar o modificar. Todo puede venir vacío o mal escrito.
 * "mesa" es opcional: la que eligió en el plano; si no viene, la casa asigna una.
 */
public record Solicitud(String nombre, String contacto, String fecha, String hora, Integer personas, String comentarios, String mesa) {

    public Solicitud(String nombre, String contacto, String fecha, String hora, Integer personas, String comentarios) {
        this(nombre, contacto, fecha, hora, personas, comentarios, null);
    }

    /** La mesa elegida, sin espacios, o null si la persona dejó que la casa elija. */
    public String mesaElegida() {
        return mesa == null || mesa.isBlank() ? null : mesa.strip().toUpperCase();
    }
}
