# Modelo de datos (PostgreSQL)

> **Estado:** el esquema vigente es el de las migraciones Flyway en `backend/src/main/resources/db/migration/` (`V1__esquema.sql`, `V2__datos_iniciales.sql`). Cambios respecto a la propuesta de abajo: no hay tabla `clientes` (nombre y contacto van en la reserva, con `contacto_normalizado` para las reglas), las reservas guardan `fecha` y `hora` de Lima con un rango `periodo` calculado, hay una tabla `avisos` para los avisos simulados, `V3__panel.sql` añade `usuarios_admin`, el estado `no_asistio`, el origen de la reserva (`web`/`panel`) y `codigo_principal` para los grupos que juntan varias mesas.

## Propuesta original

Las tablas reflejan lo que hoy vive en `js/config/restaurante.js`, `js/data/carta.js` y las reservas de demostración. La pieza clave es la restricción **`sin_choques_por_mesa`**: hace que la base de datos sea la que garantiza que nunca haya dos reservas cruzadas en la misma mesa, aunque lleguen dos peticiones exactamente a la vez.

```sql
-- Necesaria para combinar "=" (misma mesa) y "&&" (rangos que se cruzan) en una restricción.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE estado_reserva AS ENUM ('pendiente', 'confirmada', 'cancelada', 'completada');

-- Mesas del comedor
CREATE TABLE mesas (
  id          TEXT PRIMARY KEY,                 -- 'M1' … 'M14'
  asientos    SMALLINT NOT NULL CHECK (asientos BETWEEN 1 AND 20),
  nombre      TEXT,                             -- 'Mesa larga'
  activa      BOOLEAN NOT NULL DEFAULT TRUE
);

-- Turnos de atención (el lunes no tiene filas = cerrado)
CREATE TABLE horarios_atencion (
  id          SERIAL PRIMARY KEY,
  dia_semana  SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),  -- 0 = domingo
  turno       TEXT NOT NULL,                    -- 'almuerzo' | 'cena'
  inicio      TIME NOT NULL,
  fin         TIME NOT NULL CHECK (fin > inicio),
  UNIQUE (dia_semana, turno)
);

-- Políticas (una sola fila): duración, ventana, límites…
CREATE TABLE configuracion (
  id                            SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  duracion_minutos              SMALLINT NOT NULL DEFAULT 90,
  intervalo_minutos             SMALLINT NOT NULL DEFAULT 30,
  ventana_dias                  SMALLINT NOT NULL DEFAULT 60,
  max_personas_en_linea         SMALLINT NOT NULL DEFAULT 8,
  holgura_asientos              SMALLINT NOT NULL DEFAULT 2,
  horas_para_cambios            SMALLINT NOT NULL DEFAULT 3,
  max_reservas_activas_contacto SMALLINT NOT NULL DEFAULT 3,
  retencion_minutos             SMALLINT NOT NULL DEFAULT 5
);

-- Clientes: solo lo necesario (nombre y un contacto normalizado)
CREATE TABLE clientes (
  id          BIGSERIAL PRIMARY KEY,
  nombre      TEXT NOT NULL CHECK (length(trim(nombre)) >= 2),
  contacto    TEXT NOT NULL,                    -- normalizado: correo en minúsculas o 9 dígitos
  creado      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contacto)
);

CREATE TABLE reservas (
  codigo      TEXT PRIMARY KEY,                 -- 'ALG-K7Q3M'
  cliente_id  BIGINT NOT NULL REFERENCES clientes(id),
  mesa_id     TEXT NOT NULL REFERENCES mesas(id),
  personas    SMALLINT NOT NULL CHECK (personas BETWEEN 1 AND 20),
  inicio      TIMESTAMPTZ NOT NULL,             -- llegada (se guarda en UTC; se muestra en America/Lima)
  fin         TIMESTAMPTZ NOT NULL,             -- inicio + duración
  estado      estado_reserva NOT NULL DEFAULT 'pendiente',
  comentarios VARCHAR(280),
  creada      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizada TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fin > inicio),

  -- Garantía final contra reservas duplicadas: en una misma mesa no puede haber dos reservas
  -- activas cuyos rangos [inicio, fin) se crucen. Si dos transacciones compiten, una falla y la
  -- API responde 409 HORARIO_LLENO.
  CONSTRAINT sin_choques_por_mesa EXCLUDE USING gist (
    mesa_id WITH =,
    tstzrange(inicio, fin, '[)') WITH &&
  ) WHERE (estado IN ('pendiente', 'confirmada'))
);

CREATE INDEX reservas_por_fecha   ON reservas (inicio);
CREATE INDEX reservas_por_cliente ON reservas (cliente_id, estado);

-- Mesas apartadas mientras alguien completa sus datos (caducan solas)
CREATE TABLE retenciones (
  id          TEXT PRIMARY KEY,                 -- 'H-8f2k1qa'
  sesion      TEXT NOT NULL,                    -- una retención por sesión
  mesa_id     TEXT NOT NULL REFERENCES mesas(id),
  inicio      TIMESTAMPTZ NOT NULL,
  fin         TIMESTAMPTZ NOT NULL,
  expira      TIMESTAMPTZ NOT NULL,
  UNIQUE (sesion)
);
-- Las retenciones vencidas se borran con un job programado (o al consultar). La verificación
-- "mesa libre" de la API considera reservas activas + retenciones vigentes de otras sesiones.

-- Historial de cambios de estado (quién y cuándo), útil para el panel
CREATE TABLE reservas_historial (
  id          BIGSERIAL PRIMARY KEY,
  codigo      TEXT NOT NULL REFERENCES reservas(codigo),
  desde       estado_reserva,
  hacia       estado_reserva NOT NULL,
  usuario_id  BIGINT,                           -- NULL si lo hizo el cliente
  momento     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Carta
CREATE TABLE categorias (
  id          TEXT PRIMARY KEY,                 -- 'entradas', 'principales'…
  nombre      TEXT NOT NULL,
  orden       SMALLINT NOT NULL
);

CREATE TABLE platos (
  id          TEXT PRIMARY KEY,                 -- 'seco-de-cabrito'
  categoria_id TEXT NOT NULL REFERENCES categorias(id),
  nombre      TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  origen      TEXT,
  historia    TEXT,
  precio      NUMERIC(8,2) NOT NULL CHECK (precio >= 0),  -- soles
  etiqueta    TEXT CHECK (etiqueta IN ('mas-vendido', 'nuevo', 'recomendado')),
  foto        TEXT NOT NULL,
  disponible  BOOLEAN NOT NULL DEFAULT TRUE
);

-- Personal del restaurante (panel administrativo)
CREATE TABLE usuarios_admin (
  id            BIGSERIAL PRIMARY KEY,
  correo        TEXT NOT NULL UNIQUE,
  hash_clave    TEXT NOT NULL,                  -- bcrypt/argon2; nunca la clave en texto
  rol           TEXT NOT NULL DEFAULT 'personal' CHECK (rol IN ('personal', 'administrador')),
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  creado        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Cómo encaja con la lógica actual

| Hoy (navegador) | Etapa 3 (servidor) |
|---|---|
| `mesaLibre()` en `js/core/disponibilidad.js` | Consulta de disponibilidad + restricción `sin_choques_por_mesa` |
| `validarReglasDeContacto()` | Consulta por `cliente_id` dentro de la misma transacción |
| `transicionar()` en `js/core/estados.js` | Servicio de dominio en Spring Boot + fila en `reservas_historial` |
| `localStorage` (`algarrobo.reservas.v1`) | Tablas `reservas` y `clientes` |
| `algarrobo.retenciones.v1` | Tabla `retenciones` |
| Confirmación simulada a los 8 s | El personal confirma desde el panel |
| `js/config/restaurante.js` | Tablas `configuracion`, `horarios_atencion` y `mesas` |

## Notas de privacidad

- Guardar solo nombre, un contacto y comentarios. No se piden documentos ni pagos.
- Credenciales de la base de datos y secretos en variables de entorno, nunca en el código ni en el frontend.
- **Plazo de conservación (implementado):** cada madrugada `PrivacidadServicio` borra nombre, contacto y comentarios de las reservas con más de 12 meses (`algarrobo.privacidad.meses-conservacion`), también en sus avisos y en los motivos del historial. Se conservan fecha, hora, personas, mesa y estado para las estadísticas.
