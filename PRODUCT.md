# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

- **Frontend:** HTML5 semántico + Tailwind CSS v4 (compilado con la Tailwind CLI) + JavaScript vanilla. Es el stack habitual del autor. React queda como posible evolución para formularios, calendario y panel administrativo, pero no es parte de la primera etapa.
- **Backend (etapa 3):** Java con Spring Boot, API REST para reservas, disponibilidad, usuarios y platos; validación en servidor; autenticación y autorización del panel.
- **Base de datos (etapa 3):** PostgreSQL. Entidades: clientes, reservas, mesas o recursos, horarios de atención, platos y categorías, usuarios administrativos.
- **Despliegue:** una demo funcional en la etapa 4; el proveedor aún no está decidido.

## Users

- **Audiencia real:** quienes revisan el portafolio del autor (reclutadores, clientes potenciales, otros desarrolladores). Evalúan que el proyecto sea una solución completa, no solo una página informativa, y que el código sea mantenible.
- **Comensales (simulados):** consultan la carta y los precios desde casa y reservan una mesa para una fecha y hora concretas, sobre todo desde el teléfono, para no hacer cola al llegar.
- **Personal del restaurante (simulado):** gestiona las reservas del día, confirma, cancela o completa visitas, y configura horarios, capacidad, duración de las reservas y el catálogo.

## Product Purpose

Sitio web de **Algarrobo · Cocina Norteña**, restaurante ficticio de comida norteña peruana, con un sistema de reservas como funcionalidad principal. El objetivo es organizar la llegada de clientes, reducir colas y esperas en horas punta, fines de semana y feriados, y controlar la disponibilidad real de mesas.

Problemas que resuelve: esperas largas al llegar, colas por falta de planificación, ninguna visibilidad de la disponibilidad, reservas manuales por teléfono o mensajes difíciles de organizar, no saber cuántas reservas hay en un día, y conflictos cuando varios clientes piden el mismo horario.

El éxito es que el sitio demuestre una solución digital que organiza la atención, no solo una vitrina, con código organizado y preparado para crecer.

## Positioning

Cocina norteña peruana (cabrito a la norteña, arroz con pato, seco, ceviches del norte) unida a reservas basadas en la capacidad real: la disponibilidad se calcula por mesas o asientos, la duración de cada reserva y las reservas ya registradas, no con un "día ocupado" binario.

## Operating Context

**Recorrido del cliente:** entrar → explorar platos y precios → ir a reservas → elegir fecha → ver horarios disponibles → elegir hora y número de personas → ingresar sus datos → recibir confirmación. Si no hay disponibilidad, se le ofrecen horarios o fechas cercanas.

**Secciones públicas:** Inicio, Carta, Reservas, Nosotros, Contacto. Navegación horizontal en escritorio y menú compacto en móvil. Reservar es la acción más visible de todo el sitio.

**Panel administrativo (privado, con autenticación):** resumen del día; conteo de pendientes, confirmadas y canceladas; vista por día, semana y mes; calendario de disponibilidad; listado de clientes con sus reservas; filtros por fecha, hora y estado; acciones para confirmar, cancelar y completar; configuración de horario, capacidad y duración; gestión básica de platos (precio, foto, disponibilidad). Los clientes nunca acceden a funciones administrativas.

## Capabilities and Constraints

**Carta digital.** Cada plato tiene foto, nombre, descripción breve, precio en soles (S/), categoría y una etiqueta opcional ("Más vendido", "Nuevo", "Recomendado"). Categorías: Entradas, Platos principales, Especialidades de la casa, Postres, Bebidas. Filtros por categoría. Tarjetas uniformes y legibles en móvil. Productos y precios ficticios.

**Formulario de reserva.** Nombre; correo o teléfono; fecha; hora de llegada; número de personas; comentarios opcionales (ubicación preferida, ocasión especial). Al elegir una fecha se muestran los horarios disponibles de ese día.

**Calendario de disponibilidad.** Distingue cuatro estados: disponible, disponibilidad limitada, completo o no disponible, y fecha pasada (no seleccionable).

**Reglas de reserva:**
1. No se permiten reservas en fechas pasadas.
2. Horario de atención configurable.
3. Capacidad máxima configurable.
4. Las reservas confirmadas nunca superan la capacidad.
5. Dos reservas no ocupan la misma mesa o recurso en horarios que se cruzan.
6. Todos los campos obligatorios se validan.
7. Mensajes claros cuando un horario está completo.
8. El cliente puede modificar o cancelar según la política del restaurante.
9. La confirmación muestra código de reserva, fecha, hora y número de personas.
10. Estados de reserva: pendiente, confirmada, cancelada, completada.
- Duración de reserva configurable (p. ej. 90 min) que determina cuándo vuelve a quedar libre una mesa.
- Disponibilidad y confirmación se validan en el backend con transacciones para evitar reservas duplicadas simultáneas.

**Estados de interfaz:** carga, errores comprensibles y confirmaciones visibles en cada acción importante.

**Etapas:**
1. Diseño y frontend: inicio, carta, formulario de reserva, calendario, responsive, datos ficticios.
2. Lógica de reservas: disponibilidad, validación de horario y capacidad, registro, confirmación, cancelación, prevención de duplicados.
3. Backend y base de datos: API Spring Boot, PostgreSQL, autenticación del administrador, panel funcional.
4. Pruebas y despliegue: fechas, horarios y grupos variados, reservas simultáneas, pruebas en móvil, variables de entorno, demo desplegada.

**Seguridad:** validar en frontend y backend; proteger rutas administrativas; ninguna credencial en el frontend; limitar solicitudes abusivas; guardar solo los datos de cliente necesarios.

**Honestidad de la demo:** toda función que no esté conectada a un backend real se identifica como demostración. Antes de la etapa 3 no se simulan confirmaciones de reservas reales.

**Valores de demostración (ficticios, elegidos por Claude por delegación del autor; se reescribirán más adelante y deben vivir en un único archivo de configuración):**
- Ubicación: Barranco, Lima. Dirección y teléfono ficticios.
- Horario: martes a domingo; almuerzo 12:00–16:30, cena 19:00–23:00. Lunes cerrado.
- Mesas: 14 (6 de 2, 5 de 4, 2 de 6 y una mesa larga de 8) = 52 asientos. Un grupo usa una mesa con, como mucho, 2 asientos libres de sobra.
- Duración estimada de una reserva: 90 min. Intervalo entre horarios ofrecidos: 30 min. Última llegada aceptada: 90 min antes del cierre de cada turno.
- Grupos de 1 a 8 personas en línea; más de 8, por teléfono.
- Reservas con hasta 60 días de anticipación.
- Modificar o cancelar: hasta 3 horas antes de la hora reservada. Tolerancia de llegada: 15 min.
- "Disponibilidad limitada": queda menos del 30 % de la capacidad del día.

## Brand Commitments

- Nombre: **Algarrobo** (forma larga: "Algarrobo · Cocina Norteña"). Lo eligió Claude por delegación del autor, en lugar de "Sabor Huarochirano", porque Huarochirí no es del norte. El algarrobo es el árbol de la costa norte (Piura, Lambayeque, La Libertad): de él salen la algarrobina y la leña de los fogones norteños. El sitio necesita un logotipo, que aún no existe.
- Idioma: español (Perú).
- Carácter pedido por el autor (rediseño de identidad): restaurante de comida norteña peruana, gastronómico, cálido, robusto y contemporáneo. No debe parecer una cafetería de especialidad, una pastelería ni una marca de cosmética: nada de beige como fondo dominante, ni todas las secciones blancas, ni títulos finos, espacios exagerados o detalles delicados. Rojo ají, carbón y maíz dorado con presencia clara.
- Paleta fijada por el autor (obligatoria; reemplaza a las anteriores):
  - Rojo ají `#8F211E`: color principal de marca.
  - Maíz dorado `#E0AA2F`: acento destacado.
  - Carbón `#211E1A`: fondos oscuros, navegación y textos de alto contraste.
  - Terracota `#C35F32`: detalles complementarios.
  - Marfil cálido `#F6E7CF`: fondos claros de apoyo.
  - Verde hierbas `#4A5A32`: acento secundario de uso limitado.
- Coherencia obligatoria en encabezado, botones, catálogo, calendario, formularios y el futuro panel administrativo; contraste AA y estados accesibles.
- Ejemplo de titular dado por el autor: "Sabores auténticos, momentos especiales". Es un ejemplo, no un texto fijado.
- Botones del inicio: "Reservar una mesa" (principal) y "Explorar nuestra carta" (secundario).

## Evidence on Hand

Ninguna. No hay fotos, carta, logotipo, reseñas ni prensa. Platos, precios, dirección, teléfono y redes son ficticios y de demostración. No usar datos personales ni de negocios reales sin autorización. No inventar reseñas, premios ni menciones de prensa presentadas como reales. Las imágenes serán fotografía de stock con licencia o generadas, y se tratan como ilustrativas.

## Product Principles

1. Reservar primero: cada sección acerca al comensal a una reserva y nada compite con esa acción.
2. Disponibilidad honesta: se calcula sobre la capacidad real, y cuando no hay lugar se ofrece una alternativa en vez de un callejón sin salida.
3. El teléfono es el caso principal: reservar desde un móvil debe ser lo más sencillo.
4. Demo honesta: lo que no está conectado se presenta como demostración; nada finge una confirmación real ni pruebas sociales falsas.
5. Crecer por etapas: la primera etapa en HTML/Tailwind/JS se estructura para conectarse más tarde a la API Spring Boot sin rehacerse.

## Accessibility & Inclusion

Botones con área táctil cómoda y un formulario de reserva fácil de completar en móvil. Los estados del calendario no pueden depender solo del color. No se ha fijado un estándar formal; se asume WCAG 2.2 AA como referencia hasta que el autor diga otra cosa.
