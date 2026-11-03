-- Diez platos más en la carta: entradas, principales y postres de otras regiones del Perú.
-- Cada uno entra al final de su categoría. Si el administrador ya creó un plato con ese id, se respeta el suyo.

INSERT INTO platos (id, categoria_id, nombre, descripcion, origen, historia, precio, etiqueta, foto, disponible, orden)
SELECT 'causa-limena', 'entradas', 'Causa limeña', 'Papa amarilla prensada con ají amarillo y limón, rellena de pollo, palta y mayonesa de la casa.', 'Lima', 'La causa es un pastel frío de papa amarilla sazonada con ají y limón, uno de los platos más antiguos de Lima. Sobre su nombre hay versiones populares: una lo relaciona con la palabra quechua "kausay", lo que da vida; otra, con las colectas para la causa de la independencia.', 28, NULL, 'assets/img/platos/causa-limena.jpg', TRUE,
       (SELECT coalesce(max(orden), 0) + 1 FROM platos WHERE categoria_id = 'entradas')
WHERE EXISTS (SELECT 1 FROM categorias WHERE id = 'entradas')
ON CONFLICT (id) DO NOTHING;

INSERT INTO platos (id, categoria_id, nombre, descripcion, origen, historia, precio, etiqueta, foto, disponible, orden)
SELECT 'papa-a-la-huancaina', 'entradas', 'Papa a la huancaína', 'Papa amarilla bañada en crema de ají amarillo y queso fresco, con huevo, aceituna botija y choclo.', 'Lima y sierra central', 'Pese a su nombre, se reconoce tanto en Huancayo como en Lima. Según la historia popular, la preparaba una mujer de Huancayo para los obreros del Ferrocarril Central. Su salsa de ají amarillo y queso acompaña hoy media cocina peruana.', 22, NULL, 'assets/img/platos/papa-a-la-huancaina.jpg', TRUE,
       (SELECT coalesce(max(orden), 0) + 1 FROM platos WHERE categoria_id = 'entradas')
WHERE EXISTS (SELECT 1 FROM categorias WHERE id = 'entradas')
ON CONFLICT (id) DO NOTHING;

INSERT INTO platos (id, categoria_id, nombre, descripcion, origen, historia, precio, etiqueta, foto, disponible, orden)
SELECT 'anticuchos', 'entradas', 'Anticuchos de corazón', 'Brochetas de corazón de res marinadas en ají panca, comino y vinagre, a la parrilla. Con papa dorada y choclo.', 'Lima, cocina criolla', 'Vienen de la Colonia: la población africana esclavizada en Lima aprovechó las vísceras que se desechaban, como el corazón de res, y las asó en palitos con aderezos andinos. Hoy se venden en carretillas de esquina y no faltan en octubre, mes del Señor de los Milagros.', 30, NULL, 'assets/img/platos/anticuchos.jpg', TRUE,
       (SELECT coalesce(max(orden), 0) + 1 FROM platos WHERE categoria_id = 'entradas')
WHERE EXISTS (SELECT 1 FROM categorias WHERE id = 'entradas')
ON CONFLICT (id) DO NOTHING;

INSERT INTO platos (id, categoria_id, nombre, descripcion, origen, historia, precio, etiqueta, foto, disponible, orden)
SELECT 'lomo-saltado', 'principales', 'Lomo saltado', 'Tiras de lomo saltadas al wok con cebolla, tomate y ají amarillo en sillao y vinagre. Con papas fritas y arroz.', 'Lima, cocina chifa', 'Es la muestra más conocida de la cocina chifa: el salteado al wok que trajeron los inmigrantes cantoneses en el siglo XIX, con carne, ají y papa peruanos. Las papas fritas van dentro del plato y el arroz al lado.', 52, NULL, 'assets/img/platos/lomo-saltado.jpg', TRUE,
       (SELECT coalesce(max(orden), 0) + 1 FROM platos WHERE categoria_id = 'principales')
WHERE EXISTS (SELECT 1 FROM categorias WHERE id = 'principales')
ON CONFLICT (id) DO NOTHING;

INSERT INTO platos (id, categoria_id, nombre, descripcion, origen, historia, precio, etiqueta, foto, disponible, orden)
SELECT 'aji-de-gallina', 'principales', 'Ají de gallina', 'Gallina deshilachada en crema de ají amarillo, pan remojado y pecanas, con papa amarilla, huevo y aceituna botija.', 'Lima, cocina criolla', 'Desciende del manjar blanco de la cocina colonial, un guiso de ave espesado con pan y almendras. En Lima se le sumó el ají amarillo y se volvió uno de los guisos criollos más pedidos en casa.', 44, NULL, 'assets/img/platos/aji-de-gallina.jpg', TRUE,
       (SELECT coalesce(max(orden), 0) + 1 FROM platos WHERE categoria_id = 'principales')
WHERE EXISTS (SELECT 1 FROM categorias WHERE id = 'principales')
ON CONFLICT (id) DO NOTHING;

INSERT INTO platos (id, categoria_id, nombre, descripcion, origen, historia, precio, etiqueta, foto, disponible, orden)
SELECT 'rocoto-relleno', 'principales', 'Rocoto relleno', 'Rocoto relleno de carne picada, maní, pasas y aceituna, gratinado con queso. Con pastel de papa.', 'Arequipa', 'Es el plato emblema de las picanterías de Arequipa. El rocoto se desvena y se hierve varias veces para bajarle el picor antes de rellenarlo, y se sirve junto al pastel de papa con queso.', 46, NULL, 'assets/img/platos/rocoto-relleno.jpg', TRUE,
       (SELECT coalesce(max(orden), 0) + 1 FROM platos WHERE categoria_id = 'principales')
WHERE EXISTS (SELECT 1 FROM categorias WHERE id = 'principales')
ON CONFLICT (id) DO NOTHING;

INSERT INTO platos (id, categoria_id, nombre, descripcion, origen, historia, precio, etiqueta, foto, disponible, orden)
SELECT 'juane', 'principales', 'Juane de gallina', 'Arroz sazonado con palillo, gallina, aceituna y huevo, envuelto en hoja de bijao y cocido. Con plátano maduro frito.', 'Selva peruana', 'Es el plato de la Amazonía peruana por excelencia y se come sobre todo en la fiesta de San Juan, el 24 de junio. Según la tradición popular, su forma redonda envuelta en hoja de bijao recuerda la cabeza de Juan el Bautista.', 48, NULL, 'assets/img/platos/juane.jpg', TRUE,
       (SELECT coalesce(max(orden), 0) + 1 FROM platos WHERE categoria_id = 'principales')
WHERE EXISTS (SELECT 1 FROM categorias WHERE id = 'principales')
ON CONFLICT (id) DO NOTHING;

INSERT INTO platos (id, categoria_id, nombre, descripcion, origen, historia, precio, etiqueta, foto, disponible, orden)
SELECT 'suspiro-a-la-limena', 'postres', 'Suspiro a la limeña', 'Manjar blanco de yemas cubierto con merengue al oporto y canela.', 'Lima', 'Postre limeño del siglo XIX. Se atribuye a Amparo Ayarza, esposa del poeta José Gálvez, quien según la historia popular le dio el nombre porque era suave y dulce como el suspiro de una mujer.', 15, NULL, 'assets/img/platos/suspiro-a-la-limena.jpg', TRUE,
       (SELECT coalesce(max(orden), 0) + 1 FROM platos WHERE categoria_id = 'postres')
WHERE EXISTS (SELECT 1 FROM categorias WHERE id = 'postres')
ON CONFLICT (id) DO NOTHING;

INSERT INTO platos (id, categoria_id, nombre, descripcion, origen, historia, precio, etiqueta, foto, disponible, orden)
SELECT 'picarones', 'postres', 'Picarones', 'Aros de masa de zapallo y camote fritos al momento, bañados en miel de chancaca con naranja e higo.', 'Lima, cocina criolla', 'Nacieron en la Colonia como versión peruana de los buñuelos españoles: el zapallo y el camote reemplazaron parte de la harina. Se fríen al momento en carretillas y se bañan en miel de chancaca.', 16, NULL, 'assets/img/platos/picarones.jpg', TRUE,
       (SELECT coalesce(max(orden), 0) + 1 FROM platos WHERE categoria_id = 'postres')
WHERE EXISTS (SELECT 1 FROM categorias WHERE id = 'postres')
ON CONFLICT (id) DO NOTHING;

INSERT INTO platos (id, categoria_id, nombre, descripcion, origen, historia, precio, etiqueta, foto, disponible, orden)
SELECT 'turron-de-dona-pepa', 'postres', 'Turrón de Doña Pepa', 'Bastones de masa con anís en capas, con miel de frutas y grageas de colores. Porción de la casa.', 'Lima', 'Es el dulce de octubre en Lima, el mes de la procesión del Señor de los Milagros. Según la tradición, lo creó Josefa Marmanillo, una mujer esclavizada de Cañete, en agradecimiento por haber sanado de una parálisis en los brazos.', 15, NULL, 'assets/img/platos/turron-de-dona-pepa.jpg', TRUE,
       (SELECT coalesce(max(orden), 0) + 1 FROM platos WHERE categoria_id = 'postres')
WHERE EXISTS (SELECT 1 FROM categorias WHERE id = 'postres')
ON CONFLICT (id) DO NOTHING;
