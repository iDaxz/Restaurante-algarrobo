package pe.algarrobo.reservas;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

import pe.algarrobo.BaseDePrueba;
import pe.algarrobo.motor.CodigoError;
import pe.algarrobo.motor.ErrorReserva;
import pe.algarrobo.motor.Solicitud;

/** Varias personas a la vez por la misma mesa: nunca se crean dos reservas cruzadas. */
class ConcurrenciaTest extends BaseDePrueba {

    @Autowired
    ReservaServicio servicio;

    /** Lanza todas las tareas a la vez y devuelve cuántas tuvieron éxito y qué errores dieron las demás. */
    private List<Object> aLaVez(List<Callable<ReservaPublica>> tareas) throws Exception {
        ExecutorService hilos = Executors.newFixedThreadPool(tareas.size());
        CountDownLatch salida = new CountDownLatch(1);
        List<Future<Object>> futuros = new ArrayList<>();
        for (Callable<ReservaPublica> t : tareas) {
            futuros.add(hilos.submit(() -> {
                salida.await();
                try {
                    return t.call();
                } catch (ErrorReserva e) {
                    return e.codigo();
                }
            }));
        }
        salida.countDown();
        List<Object> resultados = new ArrayList<>();
        for (Future<Object> f : futuros) resultados.add(f.get());
        hilos.shutdown();
        return resultados;
    }

    @Test
    void diezPersonasPorLaUnicaMesaLargaSoloUnaLaConsigue() throws Exception {
        List<Callable<ReservaPublica>> tareas = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            String telefono = "9%08d".formatted(i);
            String sesion = "sesion-" + i;
            tareas.add(() -> servicio.crearReserva(new Solicitud("Persona " + telefono, telefono, "2026-11-04", "20:00", 8, ""), sesion));
        }
        List<Object> resultados = aLaVez(tareas);

        assertThat(resultados.stream().filter(ReservaPublica.class::isInstance)).hasSize(1);
        assertThat(resultados.stream().filter(r -> r == CodigoError.HORARIO_LLENO)).hasSize(9);
        assertThat(jdbc.sql("SELECT count(*) FROM reservas WHERE mesa_id = 'M14'").query(Long.class).single()).isEqualTo(1);
    }

    @Test
    void elMismoContactoEnviandoCincoVecesAlMismoTiempoNoDuplica() throws Exception {
        List<Callable<ReservaPublica>> tareas = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            String sesion = "doble-clic-" + i;
            tareas.add(() -> servicio.crearReserva(new Solicitud("Ana Quispe", "987654321", "2026-11-04", "20:00", 2, ""), sesion));
        }
        List<Object> resultados = aLaVez(tareas);

        assertThat(resultados.stream().filter(ReservaPublica.class::isInstance)).hasSize(1);
        assertThat(resultados.stream().filter(r -> r == CodigoError.CONTACTO_DUPLICADO)).hasSize(4);
    }

    @Test
    void laBaseDeDatosImpideDosReservasCruzadasAunqueSeSaltenLasValidaciones() {
        String insertar = """
                INSERT INTO reservas (codigo, fecha, hora, duracion_minutos, personas, mesa_id, turno_id, nombre, contacto, contacto_normalizado)
                VALUES (?, '2026-11-04', CAST(? AS time), 90, 8, 'M14', 'cena', 'Prueba', '900000000', '900000000')
                """;
        jdbc.sql(insertar).params("ALG-AAAAA", "20:00").update();
        assertThatThrownBy(() -> jdbc.sql(insertar).params("ALG-CCCCC", "21:00").update())
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("sin_choques_por_mesa");
        // a 90 minutos exactos sí cabe, y una cancelada no ocupa
        jdbc.sql(insertar).params("ALG-DDDDD", "21:30").update();
        jdbc.sql("UPDATE reservas SET estado = 'cancelada' WHERE codigo = 'ALG-AAAAA'").update();
        jdbc.sql(insertar).params("ALG-EEEEE", "19:30").update();
    }
}
