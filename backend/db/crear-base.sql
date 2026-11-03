-- Prepara PostgreSQL para el backend de Algarrobo. Se ejecuta como superusuario (postgres):
--
--   "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -f backend/db/crear-base.sql
--
-- Se puede ejecutar más de una vez: crea lo que falte y, si las bases ya existen (por ejemplo,
-- algarrobo_test creada a mano), solo las pasa al usuario de la aplicación.
-- psql pedirá la contraseña de "postgres" y luego la que quieras para el usuario algarrobo_app.
-- Esa contraseña solo se escribe en backend/config/local.properties (que no se versiona).

\prompt 'Contraseña para el usuario algarrobo_app: ' clave

-- Usuario de la aplicación (si ya existe, se actualiza su contraseña)
SELECT format('CREATE ROLE algarrobo_app LOGIN PASSWORD %L', :'clave')
 WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'algarrobo_app')
\gexec
SELECT format('ALTER ROLE algarrobo_app LOGIN PASSWORD %L', :'clave')
\gexec

-- Base de la aplicación y base aparte para las pruebas automáticas (se vacía en cada ejecución)
SELECT 'CREATE DATABASE algarrobo OWNER algarrobo_app ENCODING ''UTF8'''
 WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'algarrobo')
\gexec
SELECT 'CREATE DATABASE algarrobo_test OWNER algarrobo_app ENCODING ''UTF8'''
 WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'algarrobo_test')
\gexec
ALTER DATABASE algarrobo OWNER TO algarrobo_app;
ALTER DATABASE algarrobo_test OWNER TO algarrobo_app;

-- btree_gist permite la restricción que impide dos reservas cruzadas en la misma mesa.
-- El esquema public pasa al usuario de la aplicación para que pueda crear y limpiar sus tablas.
\c algarrobo
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER SCHEMA public OWNER TO algarrobo_app;
\c algarrobo_test
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER SCHEMA public OWNER TO algarrobo_app;

\echo 'Listo: usuario algarrobo_app y bases algarrobo y algarrobo_test preparadas.'
