-- Entrega 3c: personal del restaurante, estado "no asistió" y reservas registradas desde el panel.

-- Quien reservó confirmada y no llegó (confirmada → no_asistio).
ALTER TYPE estado_reserva ADD VALUE IF NOT EXISTS 'no_asistio';

-- Origen de la reserva y grupos que ocupan varias mesas.
-- Un grupo grande (registrado por el personal) es una reserva principal más una fila "anexa" por
-- cada mesa adicional, con codigo_principal apuntando a la principal. Las anexas son reservas
-- normales para la restricción sin_choques_por_mesa: así ninguna mesa se cruza, sea cual sea el grupo.
ALTER TABLE reservas
  ADD COLUMN origen            TEXT NOT NULL DEFAULT 'web' CHECK (origen IN ('web', 'panel')),
  ADD COLUMN codigo_principal  TEXT REFERENCES reservas(codigo) ON DELETE CASCADE,
  DROP CONSTRAINT reservas_personas_check,
  ADD CONSTRAINT reservas_personas_check CHECK (personas BETWEEN 1 AND 60);
CREATE INDEX reservas_anexas ON reservas (codigo_principal) WHERE codigo_principal IS NOT NULL;

-- Personal con acceso al panel. Las contraseñas se guardan con bcrypt; nunca en texto.
CREATE TABLE usuarios_admin (
  id                 BIGSERIAL PRIMARY KEY,
  correo             TEXT NOT NULL UNIQUE CHECK (correo = lower(correo)),
  nombre             TEXT NOT NULL,
  hash_clave         TEXT NOT NULL,
  rol                TEXT NOT NULL DEFAULT 'personal' CHECK (rol IN ('personal', 'administrador')),
  activo             BOOLEAN NOT NULL DEFAULT TRUE,
  intentos_fallidos  SMALLINT NOT NULL DEFAULT 0,
  bloqueado_hasta    TIMESTAMPTZ,
  ultimo_acceso      TIMESTAMPTZ,
  creado             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE reservas_historial
  ADD CONSTRAINT historial_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios_admin(id) ON DELETE SET NULL;
