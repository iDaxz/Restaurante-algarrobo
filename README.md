# Algarrobo · Cocina Norteña

Sitio de un **restaurante ficticio** de comida peruana del norte, en Barranco (Lima), con reservas por turnos y un panel para el personal. Es un proyecto de portafolio: el nombre, la dirección, el teléfono, la historia y los precios son inventados.

- **Web pública** (`index.html`): portada, carta con filtros, búsqueda y ventana de historia de cada plato, sugerencias según el antojo, reservas en tres pasos con comprobante (imprimir, imagen o compartir), "Mis reservas" para cambiar o cancelar, Nosotros y Contacto.
- **Panel del personal** (`admin.html`): reservas del día con plano de mesas, búsqueda, reservas por teléfono (también grupos que juntan mesas) y, para administradores, ajustes de turnos, reglas, mesas, días cerrados, carta con fotos y cuentas.
- **API REST** (`backend/`): Java 21, Spring Boot 4, PostgreSQL y Flyway.

## Arquitectura

```
Navegador ──► index.html, admin.html, js/, assets/   (HTML, CSS y JavaScript sin framework)
          └─► /api/v1/…  ──► Spring Boot ──► PostgreSQL
```

El frontend no se arma en el servidor: es HTML estático y el JavaScript pide los datos a la API. Por eso puede servirlo el propio Spring Boot (en desarrollo) o un hosting estático que reenvíe `/api` al backend (en producción). Si no hay backend, la web pasa sola a un **modo demostración** que guarda las reservas en el navegador; el panel sí necesita el backend.

## Cómo verlo en tu computadora

Solo la web, en modo demostración:

```bash
npm install
npm run build
npm run serve
```

Abre http://localhost:5173. `npm run dev` recompila el CSS al guardar. Si el backend está encendido, este servidor reenvía `/api` a http://localhost:8080 y la web usa los datos reales.

### Con el backend

Requisitos: Java 21 o superior y PostgreSQL (el proyecto se desarrolló con la versión 18).

1. Crea la base y el usuario, una sola vez:

   ```bash
   psql -U postgres -f backend/db/crear-base.sql
   ```

2. Copia `backend/config/local.properties.example` como `backend/config/local.properties` y escribe ahí la contraseña de la base y el primer administrador del panel (`algarrobo.admin.correo` y `algarrobo.admin.clave`, de al menos 12 caracteres). Ese archivo no se versiona.

3. Arranca:

   ```bash
   cd backend && ./mvnw spring-boot:run
   ```

La web queda en http://localhost:8080 y el panel en http://localhost:8080/admin. Flyway crea las tablas y los datos de ejemplo al arrancar.

## Pruebas

```bash
npm test                     # 106 pruebas del frontend (node:test, sin dependencias)
cd backend && ./mvnw test    # 74 pruebas del backend; usan la base aparte algarrobo_test
```

El motor de disponibilidad existe dos veces, en `js/core/disponibilidad.js` (modo demostración) y en `backend/…/motor/Motor.java` (servidor), y ambas pruebas recorren los mismos casos para que respondan igual. El backend prueba además la concurrencia: diez personas a la vez por la única mesa de 8, o el mismo contacto enviando cinco veces al mismo tiempo, y la base de datos impide dos reservas cruzadas aunque se salten las validaciones.

## Reglas de reserva

- **Turnos:** almuerzo de 12:00 a 16:30 y cena de 19:00 a 23:00; los lunes se descansa. Se ofrece una hora de llegada cada 30 minutos y la última es 90 minutos antes del cierre.
- **Mesas:** 14 (6 de 2, 5 de 4, 2 de 6 y una mesa larga de 8). Cada reserva ocupa su mesa 90 minutos, y a un grupo le pueden sobrar como mucho 2 asientos. En línea se reserva hasta 8 personas; los grupos más grandes llaman y el personal junta mesas en el panel.
- **Estados:** pendiente → confirmada → completada o no asistió; pendiente o confirmada → cancelada. En el modo demostración la confirmación es simulada (8 segundos); con el backend, la confirma el personal.
- **Mesa apartada:** al elegir hora, la mesa queda guardada unos minutos (5 en la demostración; en el servidor se ajusta en el panel) mientras se completan los datos, y nadie más puede tomarla.
- **Sin duplicados:** un mismo correo o teléfono, aunque se escriba distinto, no puede tener dos reservas que se crucen ni más de 3 activas a futuro.
- **Cambios:** se puede cambiar o cancelar hasta 3 horas antes de llegar.
- **Privacidad:** el contacto nunca viaja en la URL, y pasados 12 meses de la fecha de una reserva se borran el nombre, el contacto y los comentarios.

Todos los valores se cambian en `js/config/restaurante.js` (demostración) o en Ajustes del panel (servidor).

## Seguridad

- Sesión del panel con cookie `HttpOnly`, `SameSite=Strict` y `Secure` en producción; protección CSRF; bloqueo de la cuenta tras cinco intentos fallidos; roles de personal y administrador.
- Límite de peticiones por IP para reservar, apartar mesa, consultar códigos e iniciar sesión.
- Las fotos subidas se aceptan solo si su contenido es de verdad JPEG, PNG o WebP (hasta 3 MB) y se guardan en la base de datos.
- El servidor publica solo `index.html`, `admin.html`, `js/` y `assets/`: nunca el resto de la carpeta, como `backend/config/local.properties`.
- Credenciales solo en `backend/config/local.properties` (local) o en variables de entorno (producción).

## Estructura

```
index.html, admin.html      Web pública y panel del personal
src/styles.css              Entrada de Tailwind v4: tokens de la paleta y componentes
assets/css/styles.css       CSS compilado (se versiona)
assets/fonts/               Calistoga y Archivo
assets/img/platos/          Fotos de los platos (+ m/: versión liviana en WebP de 640 px) y meta.json con licencias
assets/img/norte/           Fotos de Nosotros y "Lo que llega del norte" (+ m/) y meta.json
assets/img/portada/         Platos y bebidas de la portada (PNG sin fondo, generados con IA) (+ m/)
js/config/restaurante.js    Turnos, mesas y reglas del modo demostración
js/data/                    Carta y créditos de las fotos
js/core/                    Lógica sin DOM: disponibilidad, estados, errores, fechas, páginas de la carta
js/services/                Servicio de demostración (localStorage) y cliente de la API, con la misma interfaz
js/ui/                      Interfaz de la web pública
js/admin/                   Interfaz del panel
tests/                      Pruebas del frontend
scripts/serve.mjs           Servidor de desarrollo (reenvía /api al backend)
backend/                    API en Spring Boot; migraciones en src/main/resources/db/migration
docs/api-reservas.md        Contrato de la API
docs/modelo-datos.md        Modelo de datos en PostgreSQL
DESIGN.md, PRODUCT.md       Sistema visual y propósito del producto
```

## Despliegue

La web en Vercel, la API en Render (Docker) y PostgreSQL en Neon. Pasos en `docs/despliegue.md`. Vercel reenvía `/api` a Render, así el navegador ve un solo dominio y la sesión y la protección CSRF funcionan sin cambios.

## Créditos

Fotografías de Wikimedia Commons; el autor y la licencia de cada una están en el pie de la página y en los `meta.json` de `assets/img/`. Los platos y bebidas de la portada (y la foto del frozen de maracuyá) son imágenes generadas con IA. Tipografías Calistoga y Archivo (SIL Open Font License).
