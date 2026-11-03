---
name: Algarrobo · Cocina Norteña
description: Picantería norteña contemporánea servida como una mesa vista desde arriba, en bandas carbón y claras con un solo bloque grande de ají y el maíz marcando lo que importa sobre oscuro.
colors:
  aji: "#8f211e"
  aji-hondo: "#6f1816"
  maiz: "#e0aa2f"
  maiz-claro: "#ecbd52"
  maiz-hondo: "#7f5b0f"
  carbon: "#211e1a"
  carbon-suave: "#5a5047"
  terracota: "#c35f32"
  hierbas: "#4a5a32"
  marfil: "#f6e7cf"
  marfil-luz: "#fbf3e6"
  piedra: "#ead6b6"
  borde: "#d8c19c"
  blanco: "#ffffff"
typography:
  display:
    fontFamily: "Calistoga, Georgia, serif"
    fontSize: "clamp(2.6rem, 5.6vw, 4.8rem)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Calistoga, Georgia, serif"
    fontSize: "clamp(2.6rem, 5vw, 4rem)"
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Calistoga, Georgia, serif"
    fontSize: "clamp(2rem, 4vw, 2.75rem)"
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: "-0.01em"
  price:
    fontFamily: "Calistoga, Georgia, serif"
    fontSize: "1.7rem"
    fontWeight: 400
    lineHeight: 1
    fontFeature: "tnum"
  dish-name:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 800
    lineHeight: 1.375
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
  ui:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.08rem"
    fontWeight: 700
    lineHeight: 1.1
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.74rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.05em"
rounded:
  xs: "6px"
  sm: "8px"
  md: "10px"
  foto: "12px"
  lg: "14px"
  panel: "16px"
  full: "999px"
spacing:
  gutter-movil: "16px"
  gutter: "32px"
  tarjeta: "20px"
  panel: "36px"
  banda: "64px"
  banda-lg: "96px"
  contenedor: "80rem"
components:
  button-primario:
    backgroundColor: "{colors.aji}"
    textColor: "{colors.blanco}"
    typography: "{typography.ui}"
    rounded: "{rounded.md}"
    padding: "0.8rem 1.6rem"
    height: "3.25rem"
  button-primario-hover:
    backgroundColor: "{colors.aji-hondo}"
    textColor: "{colors.blanco}"
  button-maiz:
    backgroundColor: "{colors.maiz}"
    textColor: "{colors.carbon}"
    typography: "{typography.ui}"
    rounded: "{rounded.md}"
    padding: "0.8rem 1.6rem"
    height: "3.25rem"
  button-maiz-hover:
    backgroundColor: "{colors.maiz-claro}"
    textColor: "{colors.carbon}"
  button-secundario:
    backgroundColor: "{colors.carbon}"
    textColor: "{colors.blanco}"
    typography: "{typography.ui}"
    rounded: "{rounded.md}"
    padding: "0.8rem 1.6rem"
    height: "3.25rem"
  button-secundario-hover:
    backgroundColor: "{colors.carbon-suave}"
    textColor: "{colors.blanco}"
  button-linea:
    backgroundColor: "transparent"
    textColor: "{colors.carbon}"
    rounded: "{rounded.md}"
    padding: "0.55rem 1.2rem"
    height: "2.9rem"
  button-linea-hover:
    backgroundColor: "{colors.carbon}"
    textColor: "{colors.marfil}"
  button-linea-claro:
    backgroundColor: "transparent"
    textColor: "{colors.marfil}"
    rounded: "{rounded.md}"
    padding: "0.8rem 1.6rem"
    height: "3.25rem"
  button-linea-claro-hover:
    backgroundColor: "{colors.marfil}"
    textColor: "{colors.carbon}"
  filtro:
    backgroundColor: "{colors.blanco}"
    textColor: "{colors.carbon}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1.15rem"
    height: "2.9rem"
  filtro-activo:
    backgroundColor: "{colors.aji}"
    textColor: "{colors.blanco}"
  tarjeta:
    backgroundColor: "{colors.blanco}"
    textColor: "{colors.carbon}"
    rounded: "{rounded.lg}"
    padding: "{spacing.tarjeta}"
  etiqueta:
    backgroundColor: "{colors.maiz}"
    textColor: "{colors.carbon}"
    typography: "{typography.label}"
    rounded: "{rounded.xs}"
    padding: "0.3rem 0.7rem"
  etiqueta-nuevo:
    backgroundColor: "{colors.hierbas}"
    textColor: "{colors.blanco}"
  campo:
    backgroundColor: "{colors.blanco}"
    textColor: "{colors.carbon}"
    rounded: "{rounded.md}"
    padding: "0.7rem 0.95rem"
    height: "3.1rem"
  horario:
    backgroundColor: "{colors.blanco}"
    textColor: "{colors.carbon}"
    rounded: "{rounded.md}"
    padding: "0.4rem 0.5rem"
    height: "3.1rem"
  horario-elegido:
    backgroundColor: "{colors.aji}"
    textColor: "{colors.blanco}"
  dia-disponible:
    backgroundColor: "{colors.blanco}"
    textColor: "{colors.carbon}"
    rounded: "{rounded.md}"
    height: "3rem"
  dia-completo:
    backgroundColor: "{colors.piedra}"
    textColor: "{colors.carbon-suave}"
  dia-elegido:
    backgroundColor: "{colors.aji}"
    textColor: "{colors.blanco}"
  paso-num:
    backgroundColor: "{colors.aji}"
    textColor: "{colors.blanco}"
    rounded: "{rounded.full}"
    size: "2.4rem"
  plato-mesa:
    backgroundColor: "{colors.blanco}"
    rounded: "{rounded.full}"
  cabecera:
    backgroundColor: "{colors.marfil-luz}"
    textColor: "{colors.carbon}"
    height: "4.5rem"
  aviso:
    backgroundColor: "{colors.carbon}"
    textColor: "{colors.marfil}"
  panel-reserva:
    backgroundColor: "{colors.blanco}"
    textColor: "{colors.carbon}"
    rounded: "{rounded.panel}"
    padding: "{spacing.panel}"
---

# Design System: Algarrobo · Cocina Norteña

## Overview

**Creative North Star: "La mesa servida"**

Algarrobo se lee como una picantería norteña contemporánea vista desde arriba: la portada es una mesa marfil con los platos de la casa alrededor de los bordes, cortados por ellos, y el titular al centro bajo una luz cálida. El resto de la página está hecho de bandas sólidas a todo el ancho que alternan carbón con superficies claras (marfil y blanco). El ají, rojo de marca, se concentra en las cards de especialidades de la carta y es acento en todo lo demás: la segunda línea del titular, los botones de reservar sobre claro, los precios, lo elegido y el foco. El maíz señala sobre carbón y en las etiquetas. La comida se muestra grande y enmarcada, nunca como miniatura decorativa.

El equilibrio de color se suavizó a pedido del dueño ("los colores se ven muy bruscos"): la paleta es la misma, pero la cabecera es clara, el aviso y el pie son carbón y las grandes superficies rojas se redujeron a una. El carácter sigue siendo firme: formas de 10 a 14 px, bordes funcionales de 2 px, botones sólidos y pesos tipográficos altos.

La densidad es media y robusta: títulos en Calistoga, una serif pesada y cálida; interfaz en Archivo en pesos 600 a 800. Se rechaza de forma expresa el aire de cafetería de especialidad (beige dominante, todo blanco, títulos finos, espacios exagerados, detalles delicados), según los compromisos de marca de PRODUCT.md: la claridad nueva se compensa con bandas carbón enteras y tipografía pesada.

**Key Characteristics:**
- Orden de bandas: aviso carbón, cabecera clara, portada marfil (flyer "Recién del fogón"), "¿Qué se te antoja?" marfil luz, carta marfil (las especialidades en cards ají), reservas carbón, nosotros marfil (el camino de la receta), "Lo que llega del norte" blanco (la tira que se despliega), contacto y pie carbón con franja de créditos tras un filete fino.
- La portada es un afiche: banda diagonal carbón con platos y bebidas recortados.
- El ají es un único bloque grande (especialidades) más acentos; nunca dos superficies grandes de ají en la página.
- Calistoga para títulos y precios; Archivo para todo lo demás, con la interfaz en 700–800.
- Esquinas de 10 px en controles, 14 px en tarjetas, bordes de 2 px.
- Cada estado de calendario y horario se distingue por forma y palabra, no solo por color.

## Colors

Una paleta fijada por el autor, cálida y de buen contraste: carbón y los claros cargan la estructura, el ají da la voz en un bloque y en acentos, el maíz señala sobre oscuro, la terracota adorna.

### Primary
- **Rojo Ají** (aji): color de marca. Su única superficie de peso son las cards de especialidades de la carta. Como acento: segunda línea del titular ("a fuego de leña"), títulos "La carta" y "Nosotros", botón primario (cabecera, portada, confirmaciones), "Cocina norteña" bajo el logo, hover y subrayado de la navegación, anillo de foco, precios sobre blanco y marfil, filtro, día y horario elegidos, número de paso, cifra del contador, texto de error y cursor de los campos. Blanco sobre ají da 8.7:1 y ají sobre marfil 7.2:1.
- **Ají Hondo** (aji-hondo): hover del primario y fondo del degradado de las cards de especialidades.

### Secondary
- **Maíz Dorado** (maiz): acento sobre carbón. Botón de reservar sobre carbón (contacto; texto carbón, 7.5:1), la marca "Estás aquí" del menú móvil, rótulos de reglas y enlaces en reservas, rótulos de grupo del contacto, horarios del menú móvil. Fuera del carbón: la cinta entre la portada y la carta (con texto carbón), etiquetas de plato, enlace "saltar al contenido", selección de texto, halo de foco de los campos y el tipo y origen de las cards de la carta sobre el degradado carbón. Sobre ají da solo 4.1:1: en las cards de especialidades el texto pequeño pasa a marfil.
- **Maíz Claro** (maiz-claro): solo hover del botón maíz.
- **Maíz Hondo** (maiz-hondo): maíz legible sobre claro (5.1:1 sobre marfil); borde discontinuo de los días con pocas mesas.

### Tertiary
- **Terracota** (terracota): detalle exclusivamente decorativo: barra de los títulos de categoría, marcadores cuadrados de listas de datos (reservas, "Lo que llega del norte"), puntos separadores del horario de la portada, punto del día de hoy. Sobre marfil, blanco o carbón queda entre 3.8 y 4.2:1, así que nunca lleva texto.
- **Verde Hierbas** (hierbas): acento secundario de uso limitado: etiqueta "nuevo", paso completado, aviso de modo edición y confirmación de reserva, siempre con blanco (7.5:1).

### Neutral
- **Carbón** (carbon): bandas oscuras (aviso, reservas, contacto y pie; el botón del menú móvil), texto principal sobre claro (titular, logo y navegación de la cabecera), botón secundario y bordes de 2 px de filtros, horarios, contadores y botón de línea.
- **Carbón Suave** (carbon-suave): texto secundario sobre marfil y blanco (6.5:1 sobre marfil), incluida la propuesta de la portada; hover del botón secundario.
- **Marfil Cálido** (marfil): fondo de la portada, de la carta y de nosotros; texto principal sobre carbón y ají.
- **Marfil Luz** (marfil-luz): marfil más claro, para dos cosas: la luz radial del centro de la mesa y el fondo de la cabecera al 95 % con desenfoque. En el código va como valor literal, no como variable.
- **Piedra** (piedra): relleno neutro para fotos cargando, días completos, horarios llenos y pasos bloqueados; divisores del panel de reserva.
- **Borde** (borde): bordes de 2 px sobre claro (campos, días disponibles, horarios deshabilitados, ticket) y línea inferior de 1 px de la cabecera con scroll.
- **Blanco** (blanco): banda "Lo que llega del norte", borde de las fotos redondas, tarjetas de plato, panel de reserva, campos y controles; texto sobre ají y botones oscuros.

### Named Rules
**La regla de la banda entera.** El color de fondo cambia por banda completa, a todo el ancho, nunca por recuadros flotando sobre un fondo neutro. Las bandas de contenido alternan carbón con claro (marfil o blanco) y dos bandas seguidas no comparten color.

**La regla del ají único.** El ají ocupa un solo bloque grande en la página, las cards de especialidades de la carta; en todo lo demás es acento (titular, botón primario, precio, elegido, foco). No se pinta de ají la portada, la cabecera, el pie ni ninguna otra banda.

**La regla del maíz que señala.** El maíz vive sobre carbón (reservar, precios, rótulos) y en etiquetas. Sobre ají solo aparece como precio Calistoga grande o barra decorativa; sobre claro solo como fondo con texto carbón, y nunca como texto.

**La regla de la terracota muda.** La terracota decora (barras, marcadores, puntos) y nunca lleva texto ni es el único portador de un estado.

## Typography

**Display Font:** Calistoga (con Georgia, serif)
**Body Font:** Archivo variable (con ui-sans-serif, system-ui, sans-serif)

**Character:** Calistoga es una serif de un solo peso, gruesa y redondeada, que da a títulos y precios el calor de un rótulo pintado; Archivo, firme y compacto, sostiene la interfaz en pesos altos para que nada se lea delicado.

### Hierarchy
- **Display** (400, clamp(2.6rem, 5.6vw, 4.8rem), 1): titular de la portada en dos líneas centradas, la primera en carbón y la segunda ("a fuego de leña") en ají. No lleva rótulo encima.
- **Headline** (400, clamp(2.6rem, 5vw, 4rem), 1.02): títulos de banda (reservas y contacto en blanco, nosotros en ají). "La carta" sube a clamp(3rem, 6.5vw, 5rem) en ají.
- **Title** (400, clamp(2rem, 4vw, 2.75rem), 1.02): títulos de categoría con barra; también "Lo que llega del norte". La cinta usa Calistoga carbón a clamp(1.6rem, 4vw, 3rem).
- **Precio** (Calistoga 400, 1.15–2.25rem, 1, cifras tabulares): siempre en ají sobre claro y en maíz sobre ají o carbón.
- **Nombre de plato** (Archivo 800, 1.08–1.2rem, 1.375): nombres en tarjetas y listas.
- **Body** (Archivo 400, 1.0625rem, 1.6): párrafos; la propuesta de la portada a 1.1rem en carbón suave, descripciones de plato a 0.95rem. Ancho de lectura limitado a unos 32–44rem.
- **Interfaz** (Archivo 700, 1.08rem en botones, 0.98rem en filtros): botones, filtros, horarios, rótulos de formulario y navegación (650). El horario de la portada va en una línea, 0.95rem, 600, carbón.
- **Label** (Archivo 800, 0.74rem, 0.05em, mayúsculas): solo dentro de etiquetas de plato. "Cocina norteña" bajo el logo usa 0.7rem, 700, mayúsculas, 0.12em; los rótulos de grupo del contacto (Dirección, Horario) 0.85rem, 800, mayúsculas, 0.06em.

### Named Rules
**La regla del peso alto.** Nada de interfaz por debajo de 600: botones y filtros en 700, nombres de plato y etiquetas en 800. El 400 queda para los párrafos.

**La regla de la serif que cobra.** Calistoga se reserva para títulos, precios, códigos de reserva y números de paso; no se usa en párrafos ni en botones.

## Layout

Una sola columna de bandas a todo el ancho; dentro, un contenedor de 80rem centrado con márgenes laterales de 16 px en móvil y 32 px desde 640 px. Las bandas respiran con 64 px verticales en móvil y 96 px desde 1024 px (la cinta no tiene relleno propio: se monta 24 px sobre la portada y la carta; "Lo que llega del norte", 56–64 px).

En escritorio el contenido se reparte en una rejilla de 12 columnas: reservas en 4 + 8 (la columna de reglas queda fija al hacer scroll). Nosotros va centrado, con las paradas alternando a cada lado del camino, y "Lo que llega del norte" es una tira de seis franjas. La carta usa una columna lateral fija de 15.5rem (filtros) y la rejilla de cards en el resto.

La portada es una mesa con alto mínimo de min(52rem, 100svh − 5.5rem) y el contenido centrado en vertical. La columna central mide como máximo 44rem, está centrada y apila emblema, titular, propuesta (máx. 32rem), botones y horario, con 96, 112 y 128 px de aire vertical según el ancho. Los siete platos se colocan en absoluto alrededor de los bordes y salen parcialmente de ellos; sus tamaños usan clamp (del más chico, clamp(6rem, 11vw, 10.5rem), al más grande, clamp(10rem, 24vw, 23rem)). Por debajo de 1024 px se ocultan los dos platos laterales medios; por debajo de 640 px quedan cuatro platos en las esquinas, de 8.5 a 10rem, y la mesa pierde el alto mínimo. Los filtros de la carta hacen scroll horizontal en móvil y se envuelven desde 640 px.

## Elevation & Depth

Sistema mayormente plano: la profundidad la dan los cambios de banda y el contraste. Las sombras son suaves, cálidas (carbón con opacidad) y se reservan para lo que se levanta sobre el fondo: los platos de la mesa, las tarjetas, el panel de reserva y la cabecera al hacer scroll. Los anillos sin desplazamiento ni desenfoque (0 0 0 Npx) hacen de borde, no de sombra.

### Shadow Vocabulary
- **Plato en la mesa** (`box-shadow: 0 0 0 7px #fff, 0 22px 40px -18px rgb(33 30 26 / 0.45), 0 4px 10px -4px rgb(33 30 26 / 0.18)`): borde blanco de 7 px más una sombra en capas, larga y corta, que apoya el plato en la mesa.
- **Tarjeta** (`box-shadow: 0 2px 0 rgb(33 30 26 / 0.08), 0 14px 30px -18px rgb(33 30 26 / 0.45)`): tarjetas de plato y listas en reposo.
- **Tarjeta en hover** (`box-shadow: 0 2px 0 rgb(33 30 26 / 0.08), 0 22px 36px -18px rgb(33 30 26 / 0.55)`): con subida de 3 px, solo con puntero fino.
- **Panel** (`box-shadow: 0 30px 60px -28px rgb(0 0 0 / 0.6)`): panel blanco de reserva sobre carbón.
- **Cabecera con scroll** (`box-shadow: 0 10px 24px -18px rgb(33 30 26 / 0.35)`): junto con una línea inferior de 1 px en borde, aparece cuando la página se ha desplazado.

### Named Rules
**La regla de la sombra difusa.** Todas las sombras son desenfocadas y con desplazamiento negativo (spread hacia dentro); no hay sombras duras desplazadas.

## Shapes

Formas firmes y amables. Los controles (botones, filtros, campos, días, horarios, contadores, cajas de resumen) llevan 10 px de radio; las tarjetas y fotos destacadas 14 px; el panel de reserva 16 px; las fotos documentales 12 px; las etiquetas 6 px. Los bordes funcionales son de 2 px (filtros, horarios, campos, días, botones de línea, ticket); la foto de nosotros lleva un marco carbón de 4 px. Los filetes finos de 1 px separan la cabecera con scroll (borde) y la franja de créditos del pie (marfil al 10 %).

Las geometrías propias del mundo son tres: el círculo (las fotos redondas con su borde blanco, el emblema de marca, los números de paso y el punto de hoy), el cuadrado terracota de 2 px de radio que marca rótulos en listas de datos. Las barras de título de categoría son verticales, de 0.55rem por 1em, 3 px de radio. No se usan bordes laterales de color como acento.

## Components

### Buttons
Sólidos y con presencia.
- **Shape:** esquinas suaves (10px), borde de 2 px (transparente en los sólidos), alto mínimo 3.25rem, peso 700.
- **Primario:** ají con texto blanco; hover a ají hondo. Es el botón de reservar sobre claro (cabecera, portada) y el de confirmar en el panel de reserva.
- **Maíz:** maíz con texto carbón; hover a maíz claro. Es el botón de reservar sobre carbón (contacto).
- **Secundario:** carbón con texto blanco; hover a carbón suave.
- **Línea:** transparente con borde y texto carbón (alto 2.9rem); hover se rellena de carbón con texto marfil. Acompaña al primario en la portada ("Ver la carta"). **Línea clara:** borde y texto marfil sobre fondos oscuros; hover se rellena de marfil con texto carbón.
- **Chico:** variante de 2.75rem y 1rem para la cabecera y las filas de turnos.
- **Hover / Focus:** transición de 180 ms con easing de salida; al presionar baja 1 px; foco con contorno ají de 3 px separado 3 px. Deshabilitado al 55 % de opacidad.

### Chips
- **Filtros de la carta:** en escritorio, un índice vertical en la columna lateral: filas de Archivo 700 a 1.05rem con el número de platos en ají a la derecha, entre filetes de 1 px; hover las pasa a ají y las corre un poco; la elegida es una ficha carbón de 12 px de radio con texto marfil y número en maíz. En móvil son píldoras blancas con borde carbón de 2 px en una fila deslizable (la elegida en carbón). Botones con `aria-pressed`.
- **Etiquetas de plato:** maíz con texto carbón, 800, mayúsculas, 6px de radio; la etiqueta "nuevo" en hierbas con blanco. En la carta van en la línea del origen, junto a él.

### Carta: filtros a un lado y rejilla de cards
Todos los platos van en una sola rejilla; no hay secciones por categoría.
- **Columna lateral** (15.5rem, fija al hacer scroll desde 1024 px): buscador en píldora blanca con borde carbón de 2 px (busca en nombre, origen y descripción, sin importar tildes), el índice de categorías, la casilla "Ocultar agotados de hoy" y una ficha carbón de 18 px de radio que invita a reservar (título en Calistoga blanca, botón maíz; solo escritorio). En móvil todo va arriba de la rejilla.
- **Resultado:** encima de la rejilla, "N platos en …" en 0.85rem, 800, mayúsculas, carbón suave; es la región `aria-live` que anuncia cada cambio.
- **Páginas:** la rejilla muestra como mucho cuatro filas (16 platos con 4 columnas, 12 con 3, 8 con 2); el resto pasa a páginas. Debajo, centrados, una flecha en círculo con borde carbón de 2 px a cada lado y los números en círculos de 2.75rem (el actual, carbón con texto marfil; con más de 7 páginas, "…" entre la primera, las vecinas de la actual y la última). Al cambiar, la rejilla sale 32 px hacia un lado (160 ms) y entra desde el otro (380 ms, easing de salida); en móvil también se pasa deslizando el dedo de lado. El resultado suma "· del 1 al 16". Cambiar de filtro o de búsqueda vuelve a la página 1; cambiar de ancho conserva el primer plato a la vista. Con movimiento reducido, la página cambia sin desplazamiento.
- **Rejilla:** 2 columnas en móvil, 3 desde 640 px y 4 desde 1280 px, con 14–20 px de separación.
- **Card:** proporción 3:4 y 18 px de radio; la foto a sangre bajo un degradado carbón que sube desde abajo. Abajo, el tipo y el origen ("Entrada · Costa norte") en maíz (0.72rem, 800, mayúsculas) y el nombre en Calistoga blanca (1.3rem). Arriba a la izquierda, las etiquetas; arriba a la derecha, el **sello del precio**: un círculo maíz de 3.7rem con el precio en Calistoga carbón, girado -10° y con anillo blanco.
- **Especialidades:** las cards llevan degradado ají, anillo ají de 3 px y sello ají con texto blanco; es el acento ají de la carta.
- **Al pasar el mouse** (solo puntero fino, y también al enfocar con teclado): la card sube 4 px, la foto crece a 1.07, el sello se endereza a 4° y se despliega la descripción (3 líneas) con "Ver su historia →" en maíz (420 ms, curva de salida).
- **Al filtrar:** las cards se reacomodan con una transición de vista (420 ms); sin ella o con movimiento reducido, cambian al instante. Sin resultados aparece un recuadro punteado con "No encontramos ese plato" y el botón "Ver toda la carta".
- **Toda la card abre el detalle:** el nombre es un `<button class="plato-abrir">` cuyo `::after` cubre la card; el foco con teclado se dibuja alrededor (contorno ají de 3 px).
- **Agotado:** foto en gris, sello marfil con el precio tachado y la marca "Agotado hoy".
- Las versiones anteriores quedan guardadas en `docs/respaldo-carta-v1/` (carta impresa) y `docs/respaldo-carta-v2/` (pase de cocina).

### "¿Qué se te antoja?"
Sección marfil luz justo bajo la portada (`js/ui/antojo.js`), sin precios. En escritorio, tres columnas (4.2 : 4.8 : 3): a la izquierda el título en Calistoga ("antoja" en ají), una línea de ayuda y la lista de antojos (Algo fresco, Algo contundente, Para compartir, Algo dulce, Para brindar y Sorpréndeme) en Archivo 800 a 1.3rem entre un filete carbón de 2 px arriba y filetes de 1 px, cada uno con la miniatura redonda de su plato (Sorpréndeme, un círculo maíz con un destello); el elegido va en ají con un aro ají en la miniatura y una flecha. Al centro, el plato en círculo con borde blanco de 10 px y sombra, como los de la mesa, centrado sobre un mantel redondo de piedra (9 % más grande por lado) con un aro punteado entero entre el mantel y el plato. A la derecha, la ficha: origen con el cuadrado terracota, nombre en Calistoga, descripción, botón de línea "Conocer su historia" (abre la ventana del plato) y el enlace "Otra idea" subrayado en maíz (pasa a la siguiente sugerencia del mismo antojo; se oculta si solo hay una). En móvil y tablet, los antojos son fichas blancas en una sola fila que se desliza de lado (la elegida, carbón), y el plato y la ficha van centrados debajo. Al cambiar, el plato gira y se encoge al salir (240 ms) y entra girando desde el otro lado (560 ms, easing de salida) mientras la ficha aparece; con movimiento reducido solo se funde. Solo sugiere platos disponibles; arranca en "Algo contundente".

### Ventana de detalle del plato
`<dialog>` nativo (`js/ui/plato-detalle.js`): foco atrapado, Escape, clic en el fondo para cerrar y retorno del foco a la tarjeta; la página no se desplaza detrás. En escritorio es un panel blanco de 18 px de radio y hasta 60rem en dos columnas: la foto del plato a sangre a la izquierda y, a la derecha, nombre en Calistoga, origen con marcador terracota y precio en Calistoga ají, la descripción en carbón, el rótulo "Su historia" en ají (0.8rem, 800, mayúsculas) con la historia en carbón suave, y los botones "Reservar mesa" (primario; cierra y lleva a reservas) y "Volver a la carta" (línea). Entra con opacidad y desde 14 px abajo a escala 0.97 (320/420 ms) sobre un fondo carbón al 62 %; sale en 220 ms. En móvil (<768 px) es una hoja que sube desde abajo (curva cubic-bezier(0.32, 0.72, 0, 1), 420 ms) con la foto 16:10 arriba y el botón de cerrar sobre la foto. Las historias resumen la tradición conocida de cada plato; donde es relato popular, el texto lo dice.

### Especialidades
Ya no hay banda: con la carta en una sola rejilla, el ají de especialidades vive en sus cards (degradado, anillo y sello ají). La regla del ají único se mantiene: ningún otro bloque grande de la página es ají.

### Inputs / Fields
- **Style:** fondo blanco, borde borde de 2 px, 10px de radio, alto mínimo 3.1rem; cursor de texto en ají.
- **Hover:** borde a carbón suave.
- **Focus:** borde carbón y halo maíz de 3 px (maíz al 55 %), sin contorno.
- **Error:** borde ají; el mensaje va en ají, 600, precedido de un icono dibujado (círculo con signo de exclamación trazado a 2 px) que hereda el color.
- **Contador de personas:** botones cuadrados de 3rem, 10px de radio, borde carbón de 2 px; la cifra en Calistoga ají.

### Calendario y horarios
Cada estado combina forma y palabra.
- **Día disponible:** blanco con borde borde de 2 px; hover a borde carbón.
- **Día con pocas mesas:** tinte maíz al 22 %, borde discontinuo maíz hondo y la palabra "pocas".
- **Día completo:** piedra con rayado diagonal y la palabra "lleno". Pasados: número tachado. Cerrado: palabra "cerrado".
- **Día elegido:** ají con texto blanco. **Hoy:** punto terracota de 7 px en la esquina.
- **Palabras de estado:** 0.66rem, 800, mayúsculas; en móvil 0.62rem en minúsculas.
- **Horarios:** 10px de radio, borde carbón de 2 px, hora en cifras tabulares y debajo las mesas que quedan; elegido en ají con blanco; lleno con rayado, hora tachada y la palabra "lleno".
- **Pasos de la reserva:** círculo ají de 2.4rem con el número en Calistoga; completado en hierbas; bloqueado en piedra con título apagado.

### Navigation
- **Aviso:** franja carbón sobre la cabecera, 0.84rem, texto marfil al 85 % con la primera frase en marfil 800.
- **Cabecera:** fija, de 4.5rem, en marfil luz al 95 % con desenfoque de 6 px. Emblema y "Algarrobo" en Calistoga carbón, con "Cocina norteña" en ají debajo; enlaces en Archivo 650 carbón; teléfono en carbón suave desde 1280 px; botón primario chico "Reservar mesa". Hover del enlace: texto ají y subrayado ají de 3 px que crece desde la izquierda. Con scroll gana la sombra de cabecera y una línea inferior en borde. El botón de menú es un cuadrado de 2.75rem con borde carbón al 30 %.
- **Móvil:** el botón es un círculo carbón de 2.75rem con tres trazos marfil (el tercero más corto) que se vuelven una X al abrir (320 ms); en hover pasa a ají. El menú es una hoja marfil luz que baja con clip-path (420 ms) justo bajo la cabecera, que queda visible encima. Arriba, el chip de estado del local ("Abierto ahora · almuerzo hasta las 16:30", con punto verde que late; gris si está cerrado). Los enlaces van en Archivo 800 grande (1.7–2.1rem) con una nota en carbón suave y una flecha en un círculo con borde carbón (se rellena al pasar o enfocar), entre un filete carbón de 2 px arriba y filetes de 1 px. La sección en la que está la persona va en ají con la marca "Estás aquí" en maíz (`aria-current="location"`). Debajo, atajos en fichas blancas (Llamar, Cómo llegar y, si hay, Mis reservas) y al pie el botón primario "Reservar mesa" a todo el ancho con los horarios. Foco atrapado entre la X y la hoja, Escape cierra y devuelve el foco. Las piezas entran escalonadas 45 ms. La versión anterior queda en `docs/respaldo-menu-hoy/`.

### Portada: flyer "Recién del fogón"
Inspirada en un flyer de bistró: un afiche marfil luz con trama de puntos (radio 28 px, 16:9.4 en escritorio; vertical 100:192 por debajo de 1024 px). Arriba a la izquierda, "RECIÉN / DEL FOGÓN" en Archivo 800 al 62 % de ancho y en mayúsculas (11cqw), con una bajada; arriba a la derecha, el emblema. La banda diagonal (−27°; −30° vertical) son dos cápsulas carbón paralelas y desfasadas medio grosor cada una (`--paso`): la de arriba entra por la derecha y la de abajo por la izquierda, y sus extremos redondeados se cruzan en el centro formando un escalón (`--corte-a`, `--corte-b`). En escritorio el emblema del afiche se oculta porque la banda llega a esa esquina y la cabecera ya lo muestra. Cada plato va dentro de su cápsula, centrado en la punta redondeada y enderezado (el ceviche en la de arriba, el seco en la de abajo): entra con ella y siempre queda al final de la franja (`--plato`, `--hacia`). Las bebidas acompañan a cada plato: en escritorio, el maracuyá bajo el ceviche y la chicha junto al seco, con sus textos a la misma altura; en móvil, la chicha a la izquierda del ceviche y el maracuyá a la derecha del seco. Son PNG recortados con fondo transparente, generados con IA por el dueño (`assets/img/portada/`, WebP en `m/`), con sombra por `drop-shadow`. Cada pieza lleva origen (ají; maíz sobre la banda), nombre en Archivo 800 al 75 % y una línea descriptiva, sin precios. El texto del ceviche va girado sobre la banda en escritorio; los textos sobre el marfil llevan fondo marfil luz propio. Todo se mide en `cqw` del afiche, con posiciones en variables (`--x --y --w --tx --ty --tw`) por pieza y por tamaño. El pie (dirección, horario y botones) va dentro del afiche abajo a la derecha en escritorio, al lado en tablet y debajo en móvil. Coreografía de entrada (CSS, una vez): dos cápsulas carbón llegan desde esquinas opuestas y forman la banda (900 ms), los platos llegan sobre ellas girando (1 s), los vasos asoman y al final aparecen los textos y el pie (~2.7 s en total). Con mouse, las piezas flotan unos píxeles en sentido contrario, cada una a su profundidad (`js/ui/portada.js`). Con movimiento reducido, todo aparece quieto. Respaldos de las portadas anteriores en `docs/respaldo-portada*/`.

### Nosotros: el camino de la receta
Sin el esquema de texto a la izquierda e imagen a la derecha. Arriba, centrados, "Nosotros" en Calistoga ají y la frase en Calistoga carbón (clamp(1.6rem, 3.4vw, 2.4rem)). Debajo, el camino de Monsefú a Barranco: tres paradas (Monsefú, la Panamericana Norte vista desde el bus en Pasamayo, Barranco 2019) con una foto redonda (17rem desde 900 px, alternando a izquierda y derecha del texto; 7.5rem a la izquierda en móvil, con el pie de foto solo para lectores de pantalla) y, al final, la caja carbón "Hoy". Una ruta SVG pasa por el centro de cada foto (`js/ui/nosotros.js` la traza con curvas suaves y la recalcula si cambia el tamaño): por debajo, discontinua en borde; encima, una línea ají de 3 px que se dibuja al bajar, con un viajero maíz de borde carbón que avanza a la altura del 60 % de la pantalla. Cuando el viajero llega a una parada, su foto se abre como un lente (clip-path de un punto a un círculo, 900 ms, mientras el zoom baja de 1.3 a 1) y su texto sube; quedan abiertas aunque se vuelva a subir. Con movimiento reducido o sin JavaScript, el camino está entero y todo visible. Respaldos de los diseños anteriores en `docs/respaldo-nosotros/` y `docs/respaldo-nosotros-v2/`.

### "Lo que llega del norte": la tira que se despliega
Banda blanca. Cabecera con el título a la izquierda y una línea de ayuda a la derecha (desde 1024 px). Debajo, una tira de seis franjas de foto (leña de algarrobo, cabrito de Olmos, zapallo loche, zarandaja, ají limo, chicha de jora; fotos en `assets/img/norte/`), sin tarjetas. Desde 900 px van una al lado de la otra en 30rem de alto: la abierta crece (flex-grow 5.5, 750 ms) y muestra a todo color su nombre arriba en Calistoga y abajo el origen en maíz, para qué sirve y "En la carta"; las cerradas se apagan (saturación 0.45, brillo 0.62) y muestran el nombre de pie. Se abren al detener el cursor 140 ms encima (así cruzar la tira no la hace saltar), al tocar o con las flechas del teclado (`aria-expanded`). En móvil son franjas apiladas de 4.25rem y la abierta mide 25rem. Con movimiento reducido cambian sin transición.

### Elige tu mesa (paso 4 de la reserva)
Opcional, como las butacas de un cine. Al elegir la hora la casa aparta una mesa y el plano la marca; tocar otra libre la aparta en su lugar, y "Que la casa elija" vuelve a la asignación automática. Pestañas de piso (Primer piso / Segundo piso, con cuántas mesas libres quedan), y un lienzo marfil luz con trama de puntos y borde carbón de 2 px (100:74; 100:128 en móvil). Zonas con borde discontinuo y nombre en mayúsculas (Junto al ventanal, Salón, Junto al fogón; Terraza junto a la baranda, Terraza) y referencias: ventanal y baranda rayados en carbón, fogón en ají, escalera, barra, entrada y macetas. Paleta propia, distinta del rojo de la reserva y sin colores llamativos: cada mesa es un botón con su forma (redonda de 2, cuadrada de 4, rectangular de 6 y 8) con volumen de madera (degradado claro, borde café #8a6a47, brillo arriba, canto abajo y sombra en el piso) y sillas con respaldo y sombra. Libre: madera clara (hover dorado suave, se eleva 2 px); elegida: café tostado (#6b4a32) con halo suave; ocupada: madera gris; de otro tamaño: solo el contorno punteado. La pestaña del piso activo va en el mismo café. Las zonas de cada piso no se superponen y cada mesa, con sus sillas, queda dentro de su zona y bajo su nombre. Por debajo de 640 px el primer piso usa otra distribución en tres franjas (`PLANO_ANGOSTO`), y por debajo de 380 px el lienzo es más alto (100:150). Mínimo 44 px. Leyenda y resumen ("Mesa M9 · Salón · 1.er piso · 4 asientos"). La ubicación de cada mesa vive en `js/data/plano.js`; una mesa nueva sin ubicar aparece en "Otras mesas". El comprobante muestra la zona.

### Contacto y pie
Banda carbón: título en Calistoga blanco, botón maíz "Reservar mesa", rótulos de grupo en maíz (0.85rem, 800, mayúsculas) y tabla de horario con divisores marfil al 15 %. Debajo, tras un filete de 1 px marfil al 10 %, la franja de créditos de fotos y el aviso de proyecto ficticio.

### Motion
Easing de salida único, cubic-bezier(0.16, 1, 0.3, 1). Una vez por visita, las letras del titular entran de izquierda a derecha (720 ms por letra, 24 ms entre letras, 90 ms extra por línea, con desenfoque que se aclara) y después asoman la propuesta, los botones y el horario; un temporizador de 1.2 s garantiza que el titular se muestre aunque falle el script. En el resto de la página, `js/ui/revelar.js` hace que cada bloque marcado con `data-revelar` ( cabecera y filtros de la carta, títulos de categoría y platos, columna y panel de reservas, gestión, cabecera y paradas de Nosotros, cabecera y tarjetas de "Lo que llega del norte", columnas del contacto) suba 24 px y aparezca la primera vez que entra en pantalla (opacidad 650 ms, desplazamiento 800 ms). Las piezas que entran a la vez se escalonan 80 ms, con un tope de 5 escalones. Solo se prepara lo que está por debajo de la pantalla al cargar, cada bloque se revela una sola vez y al filtrar la carta los platos aparecen al instante. Con movimiento reducido todo queda estático y visible.

## Do's and Don'ts

### Do:
- **Do** alternar bandas completas de carbón y claro (marfil o blanco), sin repetir color en dos bandas seguidas.
- **Do** guardar el ají como superficie solo para las cards de especialidades y usarlo como acento en todo lo demás.
- **Do** usar el primario ají con texto blanco para reservar sobre claro, y el botón maíz con texto carbón para reservar sobre carbón.
- **Do** poner los precios en Calistoga: ají sobre claro, maíz sobre ají o carbón.
- **Do** dar a cada estado de calendario y horario una forma (rayado, borde discontinuo, tachado) y una palabra, además del color.
- **Do** mantener 10 px de radio en controles, 14 px en tarjetas y bordes funcionales de 2 px.
- **Do** usar estos mismos tokens y componentes en el futuro panel administrativo.
- **Do** respetar `prefers-reduced-motion` en toda animación nueva.

### Don't:
- **Don't** pintar de ají una segunda superficie grande (portada, cabecera, pie u otra banda).
- **Don't** usar la terracota para texto: no alcanza 4.5:1 sobre ninguno de los fondos.
- **Don't** usar maíz sobre ají fuera de precios Calistoga grandes o barras decorativas (4.1:1), ni maíz como texto sobre claro.
- **Don't** volver al aire de cafetería: beige dominante, secciones todas blancas, títulos finos o espacios exagerados.
- **Don't** marcar listas o tarjetas con bordes laterales de color; para rótulos de datos se usa el marcador cuadrado terracota.
- **Don't** usar sombras duras desplazadas; las sombras son difusas.
- **Don't** usar Calistoga en párrafos o botones, ni Archivo por debajo de 600 en interfaz.
