package pe.algarrobo.motor;

import java.util.List;

/** Propuestas cuando un horario está lleno: horas cercanas ese día y el mismo horario en otros días. */
public record Alternativas(List<Horario> mismoDia, List<OtroDia> otrosDias) {

    public record OtroDia(String fecha, String hora) {
    }
}
