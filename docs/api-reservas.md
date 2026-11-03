# API de reservas — contrato para la etapa 3

Este documento describe la API REST del backend (Java 21 + Spring Boot 4, carpeta `backend/`). Es **el mismo contrato** que cumple el servicio de demostración `js/services/reservas-demo.js`: el cliente `js/services/reservas-api.js` (entrega 3b) tendrá los mismos métodos usando `fetch()`.

- Base: `/api/v1`
- Formato: JSON en UTF-8. Fechas como `AAAA-MM-DD` y horas como `HH:MM`, siempre en hora de Lima (`America/Lima`, UTC−5 sin horario de verano).
- Los errores siempre tienen la misma forma (ver [Errores](#errores)).
- Cabecera **`X-Sesion`**: identificador aleatorio de la pestaña del navegador (6–64 caracteres `A-Z a-z 0-9 -`). Sus propias mesas apartadas no la bloquean a ella. Es obligatoria al apartar o liberar mesas.
- **El contacto nunca viaja en la URL** (quedaría en registros y en el historial): las consultas de una reserva concreta van por `POST` con el contacto en el cuerpo.

## Métodos del servicio y su ruta

| Método en el frontend | Ruta | Descripción |
|---|---|---|
| `consultarMes(fechaDelMes, personas, { excluir })` | `GET /disponibilidad/mes?mes=2026-11&personas=4&excluir=ALG-K7Q3M` | Estado de cada día del mes para un grupo |
| `consultarHorarios(fecha, personas, { excluir })` | `GET /disponibilidad/dia?fecha=2026-11-04&personas=4&excluir=…` | Horarios del día con sus mesas libres |
| `resumenDeHoy()` | `GET /disponibilidad/hoy` | Mesas libres por turno para "Hoy en la cocina" |
| `alternativas(fecha, hora, personas, { excluir })` | `GET /disponibilidad/alternativas?fecha=…&hora=20:00&personas=4` | Horas cercanas y días próximos con mesa |
| `consultarMesas(fecha, hora, personas, { excluir })` | `GET /disponibilidad/mesas` | Estado de cada mesa a esa hora para el plano: `[{ id, asientos, nombre, estado: libre \| ocupada \| no-sirve }]` (lo que aparta esta sesión cuenta como libre) |
| `retenerMesa(fecha, hora, personas, { excluir, mesa })` | `POST /retenciones` | Aparta una mesa unos minutos; con `mesa`, la elegida en el plano (`MESA_INVALIDA` si no es del tamaño del grupo, `MESA_OCUPADA` si ya no está libre) |
| `liberarRetencion()` | `DELETE /retenciones` (o `/retenciones/{id}`) | Libera la mesa apartada por esta sesión |
| `crearReserva(solicitud)` | `POST /reservas` | Crea una reserva (queda **pendiente**). `mesa` es opcional: la elegida en el plano; sin ella, la casa asigna |
| `buscarReserva(codigo, contacto)` | `POST /reservas/consultar` | Consulta una reserva propia (`{ codigo, contacto }`) |
| `modificarReserva(codigo, contacto, cambios)` | `PATCH /reservas/{codigo}` | `{ contacto, cambios: { fecha?, hora?, personas?, nombre?, contacto?, comentarios? } }` |
| `cancelarReserva(codigo, contacto)` | `POST /reservas/{codigo}/cancelar` | `{ contacto }`; transición a **cancelada** |
| `listarMisReservas()` | `POST /reservas/consultar-varias` | `{ reservas: [{ codigo, contacto }…] }` (hasta 20) → `{ reservas, noEncontradas }`. El navegador guarda los códigos propios |
| — | `GET /configuracion` | Turnos, mesas y políticas para pintar el formulario |

> **Nota de seguridad:** no existe una ruta para listar reservas por contacto: cualquiera podría ver las de otra persona sabiendo su teléfono. Cada reserva se consulta con su código **y** su contacto. Si en el futuro se quiere listar, habrá que verificar el contacto (enlace mágico o código por correo/SMS).

## Ejemplos

### `GET /disponibilidad/mes?mes=2026-11&personas=4` → `200`
```json
{ "2026-11-03": "disponible", "2026-11-04": "limitado", "2026-11-09": "cerrado", "2026-11-14": "completo" }
```
Estados posibles: `disponible`, `limitado` (queda menos del 30 % de combinaciones horario–mesa), `completo`, `cerrado`, `pasado` y `fuera` (más allá de 60 días).

### `GET /disponibilidad/dia?fecha=2026-11-04&personas=4` → `200`
```json
[
  { "hora": "12:00", "turno": "almuerzo", "estado": "libre", "mesasLibres": 3 },
  { "hora": "12:30", "turno": "almuerzo", "estado": "completo", "mesasLibres": 0 },
  { "hora": "13:00", "turno": "almuerzo", "estado": "pasado", "mesasLibres": 0 }
]
```

### `POST /retenciones` → `201` (con cabecera `X-Sesion`)
```json
// petición
{ "fecha": "2026-11-04", "hora": "20:00", "personas": 4, "excluir": null }
// respuesta: expira en milisegundos (epoch), como Date.now()
{ "id": "h-8f2k1qa9", "mesa": "M8", "expira": 1793754300000 }
```
Cada sesión tiene como máximo una retención: crear otra reemplaza la anterior. Las retenciones ocupan mesa para los demás, pero no para su dueño.

### `POST /reservas` → `201`
```json
// petición
{ "nombre": "Ana Quispe", "contacto": "987654321", "fecha": "2026-11-04", "hora": "20:00",
  "personas": 4, "comentarios": "Es un cumpleaños", "retencion": "H-8f2k1qa" }
// respuesta
{ "codigo": "ALG-K7Q3M", "fecha": "2026-11-04", "hora": "20:00", "personas": 4,
  "mesa": "M8", "mesaAsientos": 4, "turno": "cena", "estado": "pendiente",
  "nombre": "Ana Quispe", "contacto": "987654321", "comentarios": "Es un cumpleaños",
  "creada": "2026-11-03T10:15:00-05:00", "modificable": true }
```

### `PATCH /reservas/ALG-K7Q3M` → `200`
```json
{ "contacto": "987654321", "cambios": { "hora": "20:30", "personas": 5 } }
```
Modificar no es una transición de estado: es una nueva solicitud sobre la misma reserva, que vuelve a **pendiente** hasta que el restaurante la confirme.

## Errores

Todas las respuestas de error usan esta forma. Es la misma que produce `ErrorReserva.toJSON()` (`js/core/errores.js`):

```json
{
  "codigo": "HORARIO_LLENO",
  "mensaje": "No pudimos registrar la reserva.",
  "errores": { "hora": "A las 20:00 ya no quedan mesas para 4 personas." },
  "alternativas": { "mismoDia": [{ "hora": "19:30", "mesasLibres": 1 }], "otrosDias": [{ "fecha": "2026-11-05", "hora": "20:00" }] }
}
```

| Código | HTTP | Cuándo |
|---|---|---|
| `DATOS_INVALIDOS` | 400 | Nombre, contacto, personas, fecha u hora vacíos o mal escritos |
| `GRUPO_GRANDE` | 422 | Más de 8 personas: se reserva por teléfono |
| `FECHA_PASADA` | 422 | La fecha ya pasó |
| `FECHA_FUERA_DE_PLAZO` | 422 | Más de 60 días de anticipación |
| `DIA_CERRADO` | 422 | Lunes |
| `HORARIO_INVALIDO` | 422 | Hora fuera de los turnos |
| `HORARIO_PASADO` | 422 | Hora de hoy que ya pasó |
| `HORARIO_LLENO` | 409 | No queda mesa compatible; incluye `alternativas` |
| `CONTACTO_DUPLICADO` | 409 | El mismo contacto ya tiene una reserva que se cruza (menos de 90 min) |
| `LIMITE_RESERVAS` | 429 | El contacto ya tiene 3 reservas activas a futuro |
| `NO_ENCONTRADA` | 404 | El código y el contacto no coinciden |
| `FUERA_DE_PLAZO_CAMBIOS` | 422 | Faltan menos de 3 horas para la llegada |
| `TRANSICION_INVALIDA` | 409 | Cambio de estado no permitido (por ejemplo, cancelar una cancelada) |
| `NO_AUTORIZADO` / `ACCESO_DENEGADO` | 401 / 403 | Panel sin sesión, o sin token CSRF / sin permiso |
| `CUENTA_BLOQUEADA` | 423 | Demasiados intentos fallidos de acceso al panel |
| `MESA_INVALIDA` | 422 | Reserva del panel: mesa inexistente o asientos insuficientes |
| `CONFLICTO_RESERVAS` | 409 | Un ajuste dejaría reservas futuras sin horario o sin mesa (incluye la lista) |
| `ARCHIVO_INVALIDO` | 422 | Foto que no es JPG, PNG o WebP, dañada o de más de 3 MB |
| `RETENCION_VENCIDA` | 410 | La retención expiró (el cliente puede reintentar sin ella) |
| `DEMASIADAS_PETICIONES` | 429 | Límite por IP y minuto: 10 al crear, modificar o cancelar; 30 al apartar mesa; 30 al consultar reservas |
| `NO_EXISTE` / `METODO_NO_PERMITIDO` | 404 / 405 | Ruta o método inexistente |
| `ERROR_INTERNO` | 500 | Fallo inesperado (el detalle solo queda en el log del servidor) |
| `ALMACENAMIENTO` | — | Solo en la demo: el navegador no deja guardar |

## Reglas que el servidor debe aplicar (las mismas del motor)

Están implementadas como funciones puras en `js/core/` y cubiertas por `npm test`:

1. Horarios cada 30 minutos; última llegada 90 minutos antes del cierre de cada turno. Lunes cerrado.
2. Reservas desde hoy (horas aún no pasadas) hasta 60 días adelante.
3. Grupos de 1 a 8 en línea. Cada grupo usa una mesa con, como mucho, 2 asientos de holgura, y se asigna la más pequeña que sirva.
4. Dos reservas que ocupan (pendiente, confirmada o retenida) en la misma mesa no pueden estar a menos de 90 minutos.
5. Un contacto no puede tener reservas activas que se crucen, ni más de 3 activas a futuro.
6. Se puede modificar o cancelar hasta 3 horas antes de la llegada.
7. Estados: pendiente → confirmada → completada o no_asistio; pendiente o confirmada → cancelada. Cualquier otra transición se rechaza.

**Concurrencia:** validar y guardar van en **una misma transacción**, que primero toma un bloqueo del contacto y luego del día (`pg_advisory_xact_lock`), siempre en ese orden. La garantía final la da la base de datos (restricción `sin_choques_por_mesa` en `backend/src/main/resources/db/migration/V1__esquema.sql`). Si dos peticiones compiten por la última mesa, una gana y la otra recibe `409 HORARIO_LLENO` con alternativas.

**Avisos al cliente:** por ahora son **simulados**: cada reserva recibida, modificada o cancelada guarda su aviso en la tabla `avisos` (con `enviado = false`) y lo escribe en el log. Para enviarlos de verdad se añadirá un proceso SMTP que lea esa tabla.

**Protección contra abuso:** limitar peticiones por IP en `POST /reservas` y `POST /retenciones` (por ejemplo, 10 por minuto). Validar todo en el servidor aunque el navegador ya lo haya validado. Guardar solo los datos necesarios: nombre, un contacto y comentarios de hasta 280 caracteres.

## Panel del personal (`/admin.html`, solo personal autenticado)

**Acceso.** Sesión con cookie `ALGARROBO_SESION` (HttpOnly, SameSite=Strict; `Secure` en producción con `ALGARROBO_COOKIE_SEGURA=true`) que caduca tras 8 horas sin actividad. Toda petición que modifica datos lleva el token CSRF: el servidor lo deja en la cookie `XSRF-TOKEN` y el panel lo devuelve en la cabecera `X-XSRF-TOKEN`. Contraseñas con bcrypt. Tras 5 intentos fallidos la cuenta se bloquea 15 minutos (`423 CUENTA_BLOQUEADA`), y cada IP puede intentar entrar 5 veces por minuto. El primer administrador se crea al arrancar con `algarrobo.admin.correo` y `algarrobo.admin.clave` (en `backend/config/local.properties` o en `ALGARROBO_ADMIN_CORREO` / `ALGARROBO_ADMIN_CLAVE`), solo si no existe ningún usuario.

| Ruta | Descripción |
|---|---|
| `GET /admin/sesion` | Usuario conectado (o `null`); deja lista la cookie CSRF |
| `POST /admin/sesion` | `{ correo, clave }` → inicia sesión (renueva el identificador de sesión) |
| `DELETE /admin/sesion` | Cierra la sesión |
| `GET /admin/reservas?desde=…&hasta=…&estado=…&turno=…&q=…` | Listado (máx. 62 días; hasta 366 al buscar con `q`) con estado real, todas las mesas y si ya pasó |
| `GET /admin/reservas/{codigo}` | `{ reserva, historial, avisos }` |
| `POST /admin/reservas/{codigo}/confirmar` | pendiente → confirmada (aviso simulado) |
| `POST /admin/reservas/{codigo}/completar` | confirmada → completada (solo desde la hora de llegada) |
| `POST /admin/reservas/{codigo}/no-asistio` | confirmada → no_asistio (solo desde la hora de llegada) |
| `POST /admin/reservas/{codigo}/cancelar` | `{ motivo? }` → cancelada (aviso simulado con el motivo) |
| `POST /admin/reservas` | Reserva por teléfono: `{ nombre, contacto, fecha, hora, personas, comentarios, mesas? }`. Queda confirmada. Hasta 60 personas; para grupos grandes se eligen las mesas que se juntan (cada mesa extra es una fila "anexa" ligada a la principal, protegida por `sin_choques_por_mesa`) |
| `GET /admin/mesas?fecha=…&hora=…` | Mesas activas y si están libres a esa hora |

Cada cambio de estado queda en `reservas_historial` con el usuario que lo hizo. El personal puede actuar aunque falten menos de 3 horas.

### Ajustes (solo rol `administrador`; el personal recibe 403)

| Ruta | Descripción |
|---|---|
| `GET /admin/ajustes` | Políticas, turnos, mesas (también las inactivas), días especiales próximos y últimos cambios |
| `PUT /admin/ajustes/politicas` | Tiempo de mesa, intervalo, anticipación, máximo en línea, holgura, plazo de cambios, tolerancia, límite por contacto, minutos de retención y días de descanso |
| `PUT /admin/ajustes/turnos` | Nombre y horas de los turnos existentes |
| `POST /admin/ajustes/mesas` · `PUT /admin/ajustes/mesas/{id}` | Agregar mesa (recibe el siguiente número) · cambiar asientos, nombre o activarla/desactivarla |
| `POST /admin/ajustes/dias` · `DELETE /admin/ajustes/dias/{fecha}` | Cerrar una fecha `{ fecha, motivo, cancelarReservas }` · volver a abrirla |
| `GET /admin/carta` · `POST /admin/carta/platos` · `PUT/PATCH/DELETE /admin/carta/platos/{id}` | Carta completa · crear, editar, marcar agotado (`{ disponible }`) o borrar |
| `GET /admin/fotos` · `POST /admin/fotos` (multipart `archivo`) · `DELETE /admin/fotos/{id}` | Galería (fotos del sitio y subidas) · subir JPG/PNG/WebP de hasta 3 MB · borrar una que no use ningún plato |
| `GET/POST /admin/usuarios` · `PATCH /admin/usuarios/{id}` · `POST /admin/usuarios/{id}/clave` | Cuentas: listar, crear, cambiar rol o desactivar, reiniciar contraseña |
| `PUT /admin/sesion/clave` | Cualquier cuenta: `{ actual, nueva }` para cambiar la propia contraseña |

**Protección de reservas:** antes de guardar políticas, turnos o mesas, el servidor comprueba con las reglas nuevas cada reserva futura. Si alguna quedaría fuera de horario, en un día de descanso o sin mesa, responde `409 CONFLICTO_RESERVAS` con la lista y no guarda nada. Al cerrar un día con reservas, responde 409 salvo que se pida `cancelarReservas: true`: entonces las cancela con su aviso (simulado) y el motivo en el historial.

**Fotos subidas:** se aceptan por la firma del archivo (no por el nombre ni el tipo declarado), se guardan en la base y se sirven en `GET /api/v1/fotos/{id}` con su tipo real, `X-Content-Type-Options: nosniff` y `Content-Security-Policy: sandbox`. SVG y otros formatos se rechazan (`422 ARCHIVO_INVALIDO`).

**Cuentas:** nadie puede desactivarse ni cambiarse el rol a sí mismo, y siempre queda al menos un administrador activo. Si una cuenta se desactiva o cambia de rol, su sesión abierta se cierra en la siguiente petición.

Cada cambio queda en `cambios_config` con quién lo hizo.

### Público

| Ruta | Descripción |
|---|---|
| `GET /carta` | Categorías y platos (los agotados con `disponible: false`; la web los marca "Agotado") |
| `GET /fotos/{id}` | Foto subida desde el panel |
| `GET /configuracion` | Incluye `fechasCerradas` (días especiales) |
