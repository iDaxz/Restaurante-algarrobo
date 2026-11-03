-- Entrega 3d: carta, fotos subidas, días especiales y registro de cambios de configuración.

-- ---------- Carta ----------
CREATE TABLE categorias (
  id      TEXT PRIMARY KEY,
  nombre  TEXT NOT NULL,
  orden   SMALLINT NOT NULL
);

CREATE TABLE platos (
  id           TEXT PRIMARY KEY CHECK (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  categoria_id TEXT NOT NULL REFERENCES categorias(id),
  nombre       VARCHAR(80) NOT NULL CHECK (length(trim(nombre)) >= 2),
  descripcion  VARCHAR(300) NOT NULL,
  origen       VARCHAR(60),
  historia     VARCHAR(900),
  precio       NUMERIC(7,2) NOT NULL CHECK (precio >= 0 AND precio < 10000),
  etiqueta     TEXT CHECK (etiqueta IN ('mas-vendido', 'nuevo', 'recomendado')),
  foto         TEXT NOT NULL,
  disponible   BOOLEAN NOT NULL DEFAULT TRUE,
  orden        SMALLINT NOT NULL DEFAULT 0,
  actualizado  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fotos subidas desde el panel. Se guardan en la base (son pocas y pequeñas): así un despliegue
-- nuevo no pierde imágenes. Solo JPEG, PNG o WebP, validados por su contenido y no por el nombre.
CREATE TABLE fotos (
  id          BIGSERIAL PRIMARY KEY,
  nombre      VARCHAR(120) NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('image/jpeg', 'image/png', 'image/webp')),
  bytes       BYTEA NOT NULL CHECK (octet_length(bytes) <= 3145728),
  ancho       INTEGER,
  alto        INTEGER,
  usuario_id  BIGINT REFERENCES usuarios_admin(id) ON DELETE SET NULL,
  creada      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Días especiales: fechas concretas en que el restaurante no atiende ----------
CREATE TABLE dias_especiales (
  fecha       DATE PRIMARY KEY,
  motivo      VARCHAR(120) NOT NULL,
  usuario_id  BIGINT REFERENCES usuarios_admin(id) ON DELETE SET NULL,
  creado      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Quién cambió qué en la configuración ----------
CREATE TABLE cambios_config (
  id          BIGSERIAL PRIMARY KEY,
  area        TEXT NOT NULL,          -- 'politicas', 'turnos', 'mesas', 'dias', 'carta', 'usuarios'
  descripcion TEXT NOT NULL,
  usuario_id  BIGINT REFERENCES usuarios_admin(id) ON DELETE SET NULL,
  momento     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cambios_config_recientes ON cambios_config (momento DESC);

-- ---------- Datos de la carta actual (los mismos de js/data/carta.js, ficticios en precios) ----------
INSERT INTO categorias (id, nombre, orden) VALUES
  ('entradas', 'Entradas', 1),
  ('principales', 'Platos principales', 2),
  ('especialidades', 'Especialidades de la casa', 3),
  ('postres', 'Postres', 4),
  ('bebidas', 'Bebidas', 5);

INSERT INTO platos (id, categoria_id, nombre, descripcion, origen, historia, precio, etiqueta, foto, disponible, orden) VALUES
  ('ceviche-de-mero', 'entradas', 'Ceviche de mero', 'Mero del día en limón de Chulucanas, ají limo y cebolla morada, con camote glaseado y cancha serrana.', 'Costa norte', 'El ceviche es el plato bandera del Perú y en 2023 la UNESCO lo inscribió como Patrimonio Cultural Inmaterial de la Humanidad. En el norte se prepara con ají limo y se acompaña con camote y cancha, para equilibrar el ácido del limón.', 42, 'mas-vendido', 'assets/img/platos/ceviche-de-mero.jpg', TRUE, 1),
  ('chinguirito', 'entradas', 'Chinguirito', 'Guitarra seca deshilachada al limón con cebolla y ají, como se prepara en Lambayeque. Con yuca sancochada.', 'Lambayeque', 'Nace en las caletas de Lambayeque, donde el pez guitarra se salaba y secaba al sol para conservarlo. Desmenuzado y curado en limón, se volvió un ceviche "seco" que se come en las cebicherías de Chiclayo y alrededores.', 34, 'recomendado', 'assets/img/platos/chinguirito.jpg', TRUE, 2),
  ('leche-de-tigre', 'entradas', 'Leche de tigre', 'El jugo del ceviche, servido en vaso con trozos de pescado, mariscos y un toque de ají mochero.', 'Costa peruana', 'Es el jugo que queda del ceviche: limón, ají, cebolla y el sabor del pescado. Se sirve en vaso y tiene fama popular de "levantamuertos", el remedio de la mañana siguiente.', 22, NULL, 'assets/img/platos/leche-de-tigre.jpg', TRUE, 3),
  ('tortilla-de-raya', 'entradas', 'Tortilla de raya', 'Raya seca desmenuzada y batida con huevo, dorada en sartén de fierro. Con yuca y zarza criolla.', 'Lambayeque', 'La raya seca y salada es un clásico de la costa lambayecana, donde se secaba para durar meses. Batida con huevo en tortilla es un plato de casa, muy pedido en tiempo de Cuaresma y Semana Santa.', 32, NULL, 'assets/img/platos/tortilla-de-raya.jpg', TRUE, 4),
  ('humitas', 'entradas', 'Humitas verdes', 'Choclo molido con culantro y queso fresco, envuelto en panca y cocido al vapor. Dos unidades.', 'Andes y costa norte', 'Las humitas vienen de la cocina prehispánica: maíz molido envuelto en su propia hoja y cocido al vapor. En el norte también se preparan verdes, con culantro, saladas o dulces según la casa.', 18, 'nuevo', 'assets/img/platos/humitas.jpg', TRUE, 5),
  ('arroz-con-pato', 'principales', 'Arroz con pato a la chiclayana', 'Pierna de pato macerada en chicha de jora, arroz verde de culantro y loche, con zarza de cebolla.', 'Chiclayo, Lambayeque', 'Es el gran plato de Chiclayo. El arroz se tiñe de verde con culantro y se cocina en el jugo del pato macerado en chicha de jora, con el zapallo loche que solo crece en el norte.', 58, 'mas-vendido', 'assets/img/platos/arroz-con-pato.jpg', TRUE, 6),
  ('seco-de-chabelo', 'principales', 'Seco de chabelo', 'Plátano verde asado y machacado con cecina de res, tomate y ají. Plato de domingo en Piura.', 'Piura', 'Plato piurano de plátano verde asado, machacado y mezclado con cecina de res. Su nombre tiene varias explicaciones populares; lo seguro es que se come en las casas y picanterías de Piura, sobre todo los domingos.', 44, NULL, 'assets/img/platos/seco-de-chabelo.jpg', TRUE, 7),
  ('sudado-de-mero', 'principales', 'Sudado de pescado', 'Pescado de la caleta cocido al vapor en su jugo con tomate, cebolla, chicha de jora y ají amarillo.', 'Caletas del norte', 'Es la comida del pescador: el pescado del día se cocina tapado en su propio jugo con cebolla, tomate y ají. En el norte se le añade un chorro de chicha de jora, que le da su sabor.', 52, NULL, 'assets/img/platos/sudado-de-mero.jpg', TRUE, 8),
  ('espesado', 'principales', 'Espesado', 'Choclo molido con culantro, zapallo loche y carne de res. En Chiclayo se come los lunes; aquí, de martes a domingo.', 'Chiclayo, Lambayeque', 'En Chiclayo es tradición comer espesado los lunes: un guiso de choclo molido con culantro, loche y carne de res. Se dice que llenaba bien para empezar la semana de trabajo.', 38, NULL, 'assets/img/platos/espesado.jpg', TRUE, 9),
  ('seco-de-cabrito', 'especialidades', 'Seco de cabrito', 'Cabrito de Olmos macerado en chicha de jora y culantro, cocido a fuego lento en leña de algarrobo. Con frejoles y yuca.', 'Lambayeque y La Libertad', 'El cabrito llegó con los españoles y el norte lo hizo suyo con chicha de jora, culantro y ají. Se cocina despacio hasta que la carne se deshace, y se sirve con frejoles y yuca.', 64, 'recomendado', 'assets/img/platos/seco-de-cabrito.jpg', TRUE, 10),
  ('cabrito-con-zarandaja', 'especialidades', 'Cabrito con zarandaja', 'Nuestro seco de cabrito con zarandaja, el frejol del norte, guisada con loche. Arroz blanco y salsa criolla.', 'Piura y Lambayeque', 'La zarandaja es un frejol que se cultiva en el norte desde hace siglos. Guisada junto al cabrito es la combinación de las picanterías norteñas, donde no falta en los días de fiesta.', 66, NULL, 'assets/img/platos/cabrito-con-zarandaja.jpg', TRUE, 11),
  ('arroz-con-pato-mesa', 'especialidades', 'Arroz con pato para compartir', 'La fuente de la casa para tres o cuatro personas: pato entero en presas sobre arroz verde.', 'Chiclayo, Lambayeque', 'En el norte el arroz con pato es plato de reunión familiar: se cocina en olla grande y se sirve al centro. Esta fuente sigue esa costumbre, para compartir entre tres o cuatro.', 168, 'nuevo', 'assets/img/platos/arroz-con-pato-mesa.jpg', TRUE, 12),
  ('king-kong', 'postres', 'King kong de manjarblanco', 'Galleta de mantequilla en capas con manjarblanco, dulce de piña y maní. Porción de la casa.', 'Lambayeque', 'Es el dulce más famoso de Lambayeque: capas de galleta con manjarblanco, dulce de piña y maní. Según la historia popular, se le llamó así en los años treinta por su gran tamaño, cuando la película King Kong llegó al Perú.', 16, 'mas-vendido', 'assets/img/platos/king-kong.jpg', TRUE, 13),
  ('mazamorra-morada', 'postres', 'Mazamorra morada', 'Maíz morado cocido con piña, membrillo, guindones y canela.', 'Lima, cocina criolla', 'Postre criollo hecho con maíz morado, un grano que se cultiva en el Perú desde antes de los incas. Se espesa con harina de camote o chuño y se perfuma con canela y clavo.', 14, NULL, 'assets/img/platos/mazamorra-morada.jpg', TRUE, 14),
  ('arroz-zambito', 'postres', 'Clásico: zambito y arroz con leche', 'Arroz con chancaca y coco junto a arroz con leche con canela. Mitad y mitad.', 'Lima, cocina criolla', 'Al arroz con leche servido junto a la mazamorra o al zambito se le llama "el clásico" en Lima. El zambito toma su color oscuro de la chancaca, el azúcar de caña sin refinar.', 15, NULL, 'assets/img/platos/arroz-zambito.jpg', TRUE, 15),
  ('chicha-morada', 'bebidas', 'Chicha morada', 'Maíz morado hervido con piña, canela y clavo. Vaso grande, bien helado.', 'Todo el Perú', 'La bebida más popular del país nace del maíz morado, cultivado en los Andes desde tiempos prehispánicos. Se hierve con piña, canela y clavo, y se toma bien fría con la comida.', 18, NULL, 'assets/img/platos/chicha-morada.jpg', TRUE, 16),
  ('chicha-de-jora', 'bebidas', 'Clarito de jora', 'Chicha de jora fermentada en casa, servida fresca en vaso, como en las picanterías de Monsefú.', 'Picanterías del norte', 'La chicha de jora se hace con maíz germinado y fermentado, y se bebe en el norte desde hace siglos. El "clarito" es la parte más limpia y fresca, la que se sirve en las picanterías de Lambayeque y Piura.', 12, 'recomendado', 'assets/img/platos/chicha-de-jora.jpg', TRUE, 17),
  ('coctel-de-algarrobina', 'bebidas', 'Cóctel de algarrobina', 'Pisco quebranta, algarrobina de Piura, leche evaporada y canela.', 'Piura', 'La algarrobina es el jarabe espeso que se obtiene de las vainas del algarrobo, el árbol del bosque seco piurano. Con pisco, leche y canela se convierte en uno de los cócteles más queridos del norte.', 26, NULL, 'assets/img/platos/coctel-de-algarrobina.jpg', TRUE, 18);
