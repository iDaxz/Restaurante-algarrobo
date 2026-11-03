-- Bebida nueva: frozen de maracuyá (aparece en la portada). Entra al final de Bebidas;
-- si el administrador ya creó un plato con ese id, se respeta el suyo.

INSERT INTO platos (id, categoria_id, nombre, descripcion, origen, historia, precio, etiqueta, foto, disponible, orden)
SELECT 'frozen-de-maracuya', 'bebidas', 'Frozen de maracuyá', 'Maracuyá con hielo frappé y un toque de hierbabuena. Vaso grande.', 'Selva y costa del Perú', 'El maracuyá crece en la selva y en los valles cálidos de la costa peruana, y su jugo ácido y perfumado se toma en todo el país. Batido con hielo hasta quedar frappé es una de las bebidas más pedidas en los días de calor.', 16, 'nuevo', 'assets/img/platos/frozen-de-maracuya.jpg', TRUE,
       (SELECT coalesce(max(orden), 0) + 1 FROM platos WHERE categoria_id = 'bebidas')
WHERE EXISTS (SELECT 1 FROM categorias WHERE id = 'bebidas')
ON CONFLICT (id) DO NOTHING;
