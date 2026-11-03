-- Esquema de reservas de Algarrobo (restaurante ficticio).
-- Las fechas y horas se guardan en hora de Lima (America/Lima, UTC−5 todo el año): así cada
-- reserva se lee igual que en el sitio y no hay conversiones al consultar un día.

-- Combina "=" (misma mesa) y "&&" (rangos que se cruzan) en una sola restricción.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------- Configuración (la edita el panel en la etapa 3d) ----------

-- Políticas: una sola fila.
CREATE TABLE configuracion (
  id                             SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  duracion_minutos               SMALLINT NOT NULL CHECK (duracion_minutos BETWEEN 30 AND 300),
  intervalo_minutos              SMALLINT NOT NULL CHECK (intervalo_minutos IN (15, 30, 60)),
  ventana_dias                   SMALLINT NOT NULL CHECK (ventana_dias BETWEEN 1 AND 365),
  min_personas                   SMALLINT NOT NULL CHECK (min_personas >= 1),
  max_personas_en_linea          SMALLINT NOT NULL CHECK (max_personas_en_linea >= min_personas),
  holgura_asientos               SMALLINT NOT NULL CHECK (holgura_asientos >= 0),
  horas_para_cambios             SMALLINT NOT NULL CHECK (horas_para_cambios >= 0),
  tolerancia_minutos             SMALLINT NOT NULL CHECK (tolerancia_minutos >= 0),
  umbral_limitado                NUMERIC(3,2) NOT NULL CHECK (umbral_limitado BETWEEN 0 AND 1),
  max_reservas_activas_contacto  SMALLINT NOT NULL CHECK (max_reservas_activas_contacto >= 1),
  retencion_minutos              SMALLINT NOT NULL CHECK (retencion_minutos BETWEEN 1 AND 30),
  -- 0 = domingo … 6 = sábado
  dias_cerrados                  SMALLINT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE turnos (
  id      TEXT PRIMARY KEY,                    -- 'almuerzo', 'cena'
  nombre  TEXT NOT NULL,
  inicio  TIME NOT NULL,
  fin     TIME NOT NULL CHECK (fin > inicio),
  orden   SMALLINT NOT NULL
);

CREATE TABLE mesas (
  id        TEXT PRIMARY KEY,                  -- 'M1' … 'M14'
  asientos  SMALLINT NOT NULL CHECK (asientos BETWEEN 1 AND 20),
  nombre    TEXT,                              -- 'Mesa larga'
  activa    BOOLEAN NOT NULL DEFAULT TRUE,
  orden     SMALLINT NOT NULL
);

-- ---------- Reservas ----------

CREATE TYPE estado_reserva AS ENUM ('pendiente', 'confirmada', 'cancelada', 'completada');

-- Solo los datos necesarios del cliente: nombre, un contacto y comentarios.
CREATE TABLE reservas (
  codigo                 TEXT PRIMARY KEY CHECK (codigo ~ '^ALG-[A-Z0-9]{5}$'),
  fecha                  DATE NOT NULL,
  hora                   TIME NOT NULL,
  duracion_minutos       SMALLINT NOT NULL,
  personas               SMALLINT NOT NULL CHECK (personas BETWEEN 1 AND 20),
  mesa_id                TEXT NOT NULL REFERENCES mesas(id),
  turno_id               TEXT NOT NULL REFERENCES turnos(id),
  estado                 estado_reserva NOT NULL DEFAULT 'pendiente',
  nombre                 VARCHAR(80) NOT NULL CHECK (length(trim(nombre)) >= 2),
  contacto               VARCHAR(120) NOT NULL,
  contacto_normalizado   VARCHAR(120) NOT NULL,   -- correo en minúsculas o 9 dígitos
  comentarios            VARCHAR(280) NOT NULL DEFAULT '',
  creada                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizada            TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Rango que ocupa la mesa: [llegada, llegada + duración)
  periodo                TSRANGE GENERATED ALWAYS AS (
                           tsrange(fecha + hora, fecha + hora + make_interval(mins => duracion_minutos), '[)')
                         ) STORED,

  -- Garantía final contra reservas duplicadas: en una misma mesa no puede haber dos reservas
  -- activas cuyos rangos se crucen. Si dos transacciones compiten, una falla y la API responde
  -- 409 HORARIO_LLENO con alternativas.
  CONSTRAINT sin_choques_por_mesa EXCLUDE USING gist (mesa_id WITH =, periodo WITH &&)
    WHERE (estado IN ('pendiente', 'confirmada'))
);

CREATE INDEX reservas_por_fecha ON reservas (fecha) WHERE estado IN ('pendiente', 'confirmada');
CREATE INDEX reservas_por_contacto ON reservas (contacto_normalizado, fecha) WHERE estado IN ('pendiente', 'confirmada');

-- Mesas apartadas mientras alguien completa sus datos. Caducan solas (las borra una tarea programada
-- y además no se cuentan al consultar si ya vencieron).
CREATE TABLE retenciones (
  id        TEXT PRIMARY KEY,                  -- 'H-8f2k1qa9'
  sesion    TEXT NOT NULL UNIQUE,              -- una retención por pestaña del navegador
  fecha     DATE NOT NULL,
  hora      TIME NOT NULL,
  personas  SMALLINT NOT NULL,
  mesa_id   TEXT NOT NULL REFERENCES mesas(id),
  expira    TIMESTAMPTZ NOT NULL
);
CREATE INDEX retenciones_por_fecha ON retenciones (fecha, expira);

-- Cambios de estado: quién y cuándo (usuario_id NULL = la persona que reservó).
CREATE TABLE reservas_historial (
  id          BIGSERIAL PRIMARY KEY,
  codigo      TEXT NOT NULL REFERENCES reservas(codigo) ON DELETE CASCADE,
  desde       estado_reserva,
  hacia       estado_reserva NOT NULL,
  detalle     TEXT,
  usuario_id  BIGINT,
  momento     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX historial_por_codigo ON reservas_historial (codigo, momento);

-- Avisos al cliente. En esta versión son SIMULADOS: se registran aquí y en el log, sin enviarse.
-- Cuando se conecte un proveedor de correo (SMTP), un proceso enviará los que tengan enviado = false.
CREATE TABLE avisos (
  id        BIGSERIAL PRIMARY KEY,
  codigo    TEXT NOT NULL REFERENCES reservas(codigo) ON DELETE CASCADE,
  motivo    TEXT NOT NULL,                     -- 'recibida', 'confirmada', 'cancelada', 'modificada'
  destino   TEXT NOT NULL,
  mensaje   TEXT NOT NULL,
  enviado   BOOLEAN NOT NULL DEFAULT FALSE,
  creado    TIMESTAMPTZ NOT NULL DEFAULT now()
);
