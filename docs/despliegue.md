# Despliegue

Arquitectura: **Vercel** sirve la web (`index.html`, `admin.html`, `js/`, `assets/`) y reenvía `/api/*` a **Render**, donde corre la API (Docker). La base de datos está en **Neon** (PostgreSQL). El navegador ve un solo dominio, así la sesión del panel y la protección CSRF funcionan sin cambios.

Las cuentas y las contraseñas las crea y escribe la persona dueña del proyecto en cada panel; nunca van en el repositorio.

## 1. GitHub

1. Crea un repositorio **público** vacío (sin README ni licencia), por ejemplo `restaurante-algarrobo`.
2. Desde la carpeta del proyecto:

   ```bash
   git remote add origin https://github.com/TU_USUARIO/restaurante-algarrobo.git
   git push -u origin main
   ```

## 2. Neon (base de datos)

1. Crea un proyecto. Región sugerida: la más cercana a Render (por ejemplo, AWS US East si la API va en Virginia; Oregon si va en Oregon).
2. En **Connection details** copia el host, el usuario, la contraseña y el nombre de la base (`neondb`).
3. La URL para la API tiene esta forma:

   ```
   jdbc:postgresql://HOST-DE-NEON/neondb?sslmode=require
   ```

   Flyway crea las tablas, la extensión `btree_gist` y los datos de ejemplo al primer arranque.

## 3. Render (API)

1. **New → Web Service** → conecta el repositorio de GitHub.
2. **Runtime:** Docker (usa el `Dockerfile` de la raíz). **Plan:** Free. Región: la misma zona que Neon.
3. **Health check path:** `/api/v1/configuracion`.
4. **Environment variables** (ver `.env.example`):

   | Variable | Valor |
   |---|---|
   | `ALGARROBO_DB_URL` | la URL JDBC del paso 2 |
   | `ALGARROBO_DB_USUARIO` | usuario de Neon |
   | `ALGARROBO_DB_CLAVE` | contraseña de Neon |
   | `ALGARROBO_ADMIN_CORREO` | tu correo para el panel |
   | `ALGARROBO_ADMIN_CLAVE` | una contraseña **nueva**, de 12 caracteres o más |

   El administrador se crea solo la primera vez (si la base no tiene usuarios).
5. Al terminar, Render da una dirección como `https://algarrobo-api.onrender.com`. Comprueba que `…/api/v1/configuracion` responde.

## 4. Vercel (web)

1. En `vercel.json` cambia `ALGARROBO-API` por el nombre real del servicio de Render, y sube el cambio:

   ```bash
   git commit -am "Apunta /api a Render"
   git push
   ```

2. **Add New → Project** → importa el repositorio. **Framework Preset:** Other. Sin comando de build; directorio de salida: la raíz. Deploy.
3. Abre la dirección de Vercel: la web debe decir que está conectada (modo API) y el panel estar en `/admin`.

## 5. Mantener la API despierta (opcional)

El plan gratuito de Render apaga la API tras 15 minutos sin visitas. En GitHub → **Settings → Secrets and variables → Actions → Variables**, crea `API_URL` con la dirección de Render: la tarea `.github/workflows/despertar-api.yml` la consultará cada 10 minutos.

## Después de desplegar

- Entra al panel con la contraseña nueva. Si en algún momento compartiste otra contraseña, cámbiala en **Mi cuenta**.
- Quita `ALGARROBO_ADMIN_CLAVE` de Render una vez creada la cuenta (ya no hace falta).
