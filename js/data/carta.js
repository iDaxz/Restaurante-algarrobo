// Carta de demostración. Platos reales de la cocina norteña; precios ficticios en soles.
// "historia" resume la tradición conocida de cada plato; donde es un relato popular, lo dice.
// En la etapa 3 llegará desde la API (GET /api/platos) con la misma forma.

export const CATEGORIAS = [
  { id: 'entradas', nombre: 'Entradas' },
  { id: 'principales', nombre: 'Platos principales' },
  { id: 'especialidades', nombre: 'Especialidades de la casa' },
  { id: 'postres', nombre: 'Postres' },
  { id: 'bebidas', nombre: 'Bebidas' },
];

export const ETIQUETAS = {
  'mas-vendido': 'Más vendido',
  nuevo: 'Nuevo',
  recomendado: 'Recomendado',
};

const foto = (archivo) => `assets/img/platos/${archivo}.jpg`;

export const PLATOS = [
  {
    id: 'ceviche-de-mero', categoria: 'entradas', nombre: 'Ceviche de mero',
    descripcion: 'Mero del día en limón de Chulucanas, ají limo y cebolla morada, con camote glaseado y cancha serrana.',
    precio: 42, etiqueta: 'mas-vendido', foto: foto('ceviche-de-mero'), disponible: true,
    origen: "Costa norte",
    historia: 'El ceviche es el plato bandera del Perú y en 2023 la UNESCO lo inscribió como Patrimonio Cultural Inmaterial de la Humanidad. En el norte se prepara con ají limo y se acompaña con camote y cancha, para equilibrar el ácido del limón.',
  },
  {
    id: 'chinguirito', categoria: 'entradas', nombre: 'Chinguirito',
    descripcion: 'Guitarra seca deshilachada al limón con cebolla y ají, como se prepara en Lambayeque. Con yuca sancochada.',
    precio: 34, etiqueta: 'recomendado', foto: foto('chinguirito'), disponible: true,
    origen: "Lambayeque",
    historia: 'Nace en las caletas de Lambayeque, donde el pez guitarra se salaba y secaba al sol para conservarlo. Desmenuzado y curado en limón, se volvió un ceviche "seco" que se come en las cebicherías de Chiclayo y alrededores.',
  },
  {
    id: 'leche-de-tigre', categoria: 'entradas', nombre: 'Leche de tigre',
    descripcion: 'El jugo del ceviche, servido en vaso con trozos de pescado, mariscos y un toque de ají mochero.',
    precio: 22, foto: foto('leche-de-tigre'), disponible: true,
    origen: "Costa peruana",
    historia: 'Es el jugo que queda del ceviche: limón, ají, cebolla y el sabor del pescado. Se sirve en vaso y tiene fama popular de "levantamuertos", el remedio de la mañana siguiente.',
  },
  {
    id: 'tortilla-de-raya', categoria: 'entradas', nombre: 'Tortilla de raya',
    descripcion: 'Raya seca desmenuzada y batida con huevo, dorada en sartén de fierro. Con yuca y zarza criolla.',
    precio: 32, foto: foto('tortilla-de-raya'), disponible: true,
    origen: "Lambayeque",
    historia: 'La raya seca y salada es un clásico de la costa lambayecana, donde se secaba para durar meses. Batida con huevo en tortilla es un plato de casa, muy pedido en tiempo de Cuaresma y Semana Santa.',
  },
  {
    id: 'humitas', categoria: 'entradas', nombre: 'Humitas verdes',
    descripcion: 'Choclo molido con culantro y queso fresco, envuelto en panca y cocido al vapor. Dos unidades.',
    precio: 18, etiqueta: 'nuevo', foto: foto('humitas'), disponible: true,
    origen: "Andes y costa norte",
    historia: 'Las humitas vienen de la cocina prehispánica: maíz molido envuelto en su propia hoja y cocido al vapor. En el norte también se preparan verdes, con culantro, saladas o dulces según la casa.',
  },
  {
    id: 'causa-limena', categoria: 'entradas', nombre: "Causa limeña",
    descripcion: "Papa amarilla prensada con ají amarillo y limón, rellena de pollo, palta y mayonesa de la casa.",
    precio: 28, foto: foto('causa-limena'), disponible: true,
    origen: "Lima",
    historia: "La causa es un pastel frío de papa amarilla sazonada con ají y limón, uno de los platos más antiguos de Lima. Sobre su nombre hay versiones populares: una lo relaciona con la palabra quechua \"kausay\", lo que da vida; otra, con las colectas para la causa de la independencia.",
  },
  {
    id: 'papa-a-la-huancaina', categoria: 'entradas', nombre: "Papa a la huancaína",
    descripcion: "Papa amarilla bañada en crema de ají amarillo y queso fresco, con huevo, aceituna botija y choclo.",
    precio: 22, foto: foto('papa-a-la-huancaina'), disponible: true,
    origen: "Lima y sierra central",
    historia: "Pese a su nombre, se reconoce tanto en Huancayo como en Lima. Según la historia popular, la preparaba una mujer de Huancayo para los obreros del Ferrocarril Central. Su salsa de ají amarillo y queso acompaña hoy media cocina peruana.",
  },
  {
    id: 'anticuchos', categoria: 'entradas', nombre: "Anticuchos de corazón",
    descripcion: "Brochetas de corazón de res marinadas en ají panca, comino y vinagre, a la parrilla. Con papa dorada y choclo.",
    precio: 30, foto: foto('anticuchos'), disponible: true,
    origen: "Lima, cocina criolla",
    historia: "Vienen de la Colonia: la población africana esclavizada en Lima aprovechó las vísceras que se desechaban, como el corazón de res, y las asó en palitos con aderezos andinos. Hoy se venden en carretillas de esquina y no faltan en octubre, mes del Señor de los Milagros.",
  },
  {
    id: 'arroz-con-pato', categoria: 'principales', nombre: 'Arroz con pato a la chiclayana',
    descripcion: 'Pierna de pato macerada en chicha de jora, arroz verde de culantro y loche, con zarza de cebolla.',
    precio: 58, etiqueta: 'mas-vendido', foto: foto('arroz-con-pato'), disponible: true,
    origen: "Chiclayo, Lambayeque",
    historia: 'Es el gran plato de Chiclayo. El arroz se tiñe de verde con culantro y se cocina en el jugo del pato macerado en chicha de jora, con el zapallo loche que solo crece en el norte.',
  },
  {
    id: 'seco-de-chabelo', categoria: 'principales', nombre: 'Seco de chabelo',
    descripcion: 'Plátano verde asado y machacado con cecina de res, tomate y ají. Plato de domingo en Piura.',
    precio: 44, foto: foto('seco-de-chabelo'), disponible: true,
    origen: "Piura",
    historia: 'Plato piurano de plátano verde asado, machacado y mezclado con cecina de res. Su nombre tiene varias explicaciones populares; lo seguro es que se come en las casas y picanterías de Piura, sobre todo los domingos.',
  },
  {
    id: 'sudado-de-mero', categoria: 'principales', nombre: 'Sudado de pescado',
    descripcion: 'Pescado de la caleta cocido al vapor en su jugo con tomate, cebolla, chicha de jora y ají amarillo.',
    precio: 52, foto: foto('sudado-de-mero'), disponible: true,
    origen: "Caletas del norte",
    historia: 'Es la comida del pescador: el pescado del día se cocina tapado en su propio jugo con cebolla, tomate y ají. En el norte se le añade un chorro de chicha de jora, que le da su sabor.',
  },
  {
    id: 'espesado', categoria: 'principales', nombre: 'Espesado',
    descripcion: 'Choclo molido con culantro, zapallo loche y carne de res. En Chiclayo se come los lunes; aquí, de martes a domingo.',
    precio: 38, foto: foto('espesado'), disponible: true,
    origen: "Chiclayo, Lambayeque",
    historia: 'En Chiclayo es tradición comer espesado los lunes: un guiso de choclo molido con culantro, loche y carne de res. Se dice que llenaba bien para empezar la semana de trabajo.',
  },
  {
    id: 'lomo-saltado', categoria: 'principales', nombre: "Lomo saltado",
    descripcion: "Tiras de lomo saltadas al wok con cebolla, tomate y ají amarillo en sillao y vinagre. Con papas fritas y arroz.",
    precio: 52, foto: foto('lomo-saltado'), disponible: true,
    origen: "Lima, cocina chifa",
    historia: "Es la muestra más conocida de la cocina chifa: el salteado al wok que trajeron los inmigrantes cantoneses en el siglo XIX, con carne, ají y papa peruanos. Las papas fritas van dentro del plato y el arroz al lado.",
  },
  {
    id: 'aji-de-gallina', categoria: 'principales', nombre: "Ají de gallina",
    descripcion: "Gallina deshilachada en crema de ají amarillo, pan remojado y pecanas, con papa amarilla, huevo y aceituna botija.",
    precio: 44, foto: foto('aji-de-gallina'), disponible: true,
    origen: "Lima, cocina criolla",
    historia: "Desciende del manjar blanco de la cocina colonial, un guiso de ave espesado con pan y almendras. En Lima se le sumó el ají amarillo y se volvió uno de los guisos criollos más pedidos en casa.",
  },
  {
    id: 'rocoto-relleno', categoria: 'principales', nombre: "Rocoto relleno",
    descripcion: "Rocoto relleno de carne picada, maní, pasas y aceituna, gratinado con queso. Con pastel de papa.",
    precio: 46, foto: foto('rocoto-relleno'), disponible: true,
    origen: "Arequipa",
    historia: "Es el plato emblema de las picanterías de Arequipa. El rocoto se desvena y se hierve varias veces para bajarle el picor antes de rellenarlo, y se sirve junto al pastel de papa con queso.",
  },
  {
    id: 'juane', categoria: 'principales', nombre: "Juane de gallina",
    descripcion: "Arroz sazonado con palillo, gallina, aceituna y huevo, envuelto en hoja de bijao y cocido. Con plátano maduro frito.",
    precio: 48, foto: foto('juane'), disponible: true,
    origen: "Selva peruana",
    historia: "Es el plato de la Amazonía peruana por excelencia y se come sobre todo en la fiesta de San Juan, el 24 de junio. Según la tradición popular, su forma redonda envuelta en hoja de bijao recuerda la cabeza de Juan el Bautista.",
  },
  {
    id: 'seco-de-cabrito', categoria: 'especialidades', nombre: 'Seco de cabrito',
    descripcion: 'Cabrito de Olmos macerado en chicha de jora y culantro, cocido a fuego lento en leña de algarrobo. Con frejoles y yuca.',
    precio: 64, etiqueta: 'recomendado', foto: foto('seco-de-cabrito'), disponible: true,
    origen: "Lambayeque y La Libertad",
    historia: 'El cabrito llegó con los españoles y el norte lo hizo suyo con chicha de jora, culantro y ají. Se cocina despacio hasta que la carne se deshace, y se sirve con frejoles y yuca.',
  },
  {
    id: 'cabrito-con-zarandaja', categoria: 'especialidades', nombre: 'Cabrito con zarandaja',
    descripcion: 'Nuestro seco de cabrito con zarandaja, el frejol del norte, guisada con loche. Arroz blanco y salsa criolla.',
    precio: 66, foto: foto('cabrito-con-zarandaja'), disponible: true,
    origen: "Piura y Lambayeque",
    historia: 'La zarandaja es un frejol que se cultiva en el norte desde hace siglos. Guisada junto al cabrito es la combinación de las picanterías norteñas, donde no falta en los días de fiesta.',
  },
  {
    id: 'arroz-con-pato-mesa', categoria: 'especialidades', nombre: 'Arroz con pato para compartir',
    descripcion: 'La fuente de la casa para tres o cuatro personas: pato entero en presas sobre arroz verde.',
    precio: 168, etiqueta: 'nuevo', foto: foto('arroz-con-pato-mesa'), disponible: true,
    origen: "Chiclayo, Lambayeque",
    historia: 'En el norte el arroz con pato es plato de reunión familiar: se cocina en olla grande y se sirve al centro. Esta fuente sigue esa costumbre, para compartir entre tres o cuatro.',
  },
  {
    id: 'king-kong', categoria: 'postres', nombre: 'King kong de manjarblanco',
    descripcion: 'Galleta de mantequilla en capas con manjarblanco, dulce de piña y maní. Porción de la casa.',
    precio: 16, etiqueta: 'mas-vendido', foto: foto('king-kong'), disponible: true,
    origen: "Lambayeque",
    historia: 'Es el dulce más famoso de Lambayeque: capas de galleta con manjarblanco, dulce de piña y maní. Según la historia popular, se le llamó así en los años treinta por su gran tamaño, cuando la película King Kong llegó al Perú.',
  },
  {
    id: 'mazamorra-morada', categoria: 'postres', nombre: 'Mazamorra morada',
    descripcion: 'Maíz morado cocido con piña, membrillo, guindones y canela.',
    precio: 14, foto: foto('mazamorra-morada'), disponible: true,
    origen: "Lima, cocina criolla",
    historia: 'Postre criollo hecho con maíz morado, un grano que se cultiva en el Perú desde antes de los incas. Se espesa con harina de camote o chuño y se perfuma con canela y clavo.',
  },
  {
    id: 'arroz-zambito', categoria: 'postres', nombre: 'Clásico: zambito y arroz con leche',
    descripcion: 'Arroz con chancaca y coco junto a arroz con leche con canela. Mitad y mitad.',
    precio: 15, foto: foto('arroz-zambito'), disponible: true,
    origen: "Lima, cocina criolla",
    historia: 'Al arroz con leche servido junto a la mazamorra o al zambito se le llama "el clásico" en Lima. El zambito toma su color oscuro de la chancaca, el azúcar de caña sin refinar.',
  },
  {
    id: 'suspiro-a-la-limena', categoria: 'postres', nombre: "Suspiro a la limeña",
    descripcion: "Manjar blanco de yemas cubierto con merengue al oporto y canela.",
    precio: 15, foto: foto('suspiro-a-la-limena'), disponible: true,
    origen: "Lima",
    historia: "Postre limeño del siglo XIX. Se atribuye a Amparo Ayarza, esposa del poeta José Gálvez, quien según la historia popular le dio el nombre porque era suave y dulce como el suspiro de una mujer.",
  },
  {
    id: 'picarones', categoria: 'postres', nombre: "Picarones",
    descripcion: "Aros de masa de zapallo y camote fritos al momento, bañados en miel de chancaca con naranja e higo.",
    precio: 16, foto: foto('picarones'), disponible: true,
    origen: "Lima, cocina criolla",
    historia: "Nacieron en la Colonia como versión peruana de los buñuelos españoles: el zapallo y el camote reemplazaron parte de la harina. Se fríen al momento en carretillas y se bañan en miel de chancaca.",
  },
  {
    id: 'turron-de-dona-pepa', categoria: 'postres', nombre: "Turrón de Doña Pepa",
    descripcion: "Bastones de masa con anís en capas, con miel de frutas y grageas de colores. Porción de la casa.",
    precio: 15, foto: foto('turron-de-dona-pepa'), disponible: true,
    origen: "Lima",
    historia: "Es el dulce de octubre en Lima, el mes de la procesión del Señor de los Milagros. Según la tradición, lo creó Josefa Marmanillo, una mujer esclavizada de Cañete, en agradecimiento por haber sanado de una parálisis en los brazos.",
  },
  {
    id: 'chicha-morada', categoria: 'bebidas', nombre: 'Chicha morada',
    descripcion: 'Maíz morado hervido con piña, canela y clavo. Vaso grande, bien helado.',
    precio: 18, foto: foto('chicha-morada'), disponible: true,
    origen: "Todo el Perú",
    historia: 'La bebida más popular del país nace del maíz morado, cultivado en los Andes desde tiempos prehispánicos. Se hierve con piña, canela y clavo, y se toma bien fría con la comida.',
  },
  {
    id: 'chicha-de-jora', categoria: 'bebidas', nombre: 'Clarito de jora',
    descripcion: 'Chicha de jora fermentada en casa, servida fresca en vaso, como en las picanterías de Monsefú.',
    precio: 12, etiqueta: 'recomendado', foto: foto('chicha-de-jora'), disponible: true,
    origen: "Picanterías del norte",
    historia: 'La chicha de jora se hace con maíz germinado y fermentado, y se bebe en el norte desde hace siglos. El "clarito" es la parte más limpia y fresca, la que se sirve en las picanterías de Lambayeque y Piura.',
  },
  {
    id: 'coctel-de-algarrobina', categoria: 'bebidas', nombre: 'Cóctel de algarrobina',
    descripcion: 'Pisco quebranta, algarrobina de Piura, leche evaporada y canela.',
    precio: 26, foto: foto('coctel-de-algarrobina'), disponible: true,
    origen: "Piura",
    historia: 'La algarrobina es el jarabe espeso que se obtiene de las vainas del algarrobo, el árbol del bosque seco piurano. Con pisco, leche y canela se convierte en uno de los cócteles más queridos del norte.',
  },  {
    id: 'frozen-de-maracuya', categoria: 'bebidas', nombre: 'Frozen de maracuyá',
    descripcion: 'Maracuyá con hielo frappé y un toque de hierbabuena. Vaso grande.',
    precio: 16, etiqueta: 'nuevo', foto: foto('frozen-de-maracuya'), disponible: true,
    origen: "Selva y costa del Perú",
    historia: 'El maracuyá crece en la selva y en los valles cálidos de la costa peruana, y su jugo ácido y perfumado se toma en todo el país. Batido con hielo hasta quedar frappé es una de las bebidas más pedidas en los días de calor.',
  },

];

// Para la pizarra "Hoy hay": tres platos por día de la semana (0 = domingo).
export const PLATOS_DEL_DIA = {
  0: ['seco-de-chabelo', 'seco-de-cabrito', 'king-kong'],
  2: ['espesado', 'ceviche-de-mero', 'chicha-de-jora'],
  3: ['arroz-con-pato', 'chinguirito', 'mazamorra-morada'],
  4: ['sudado-de-mero', 'tortilla-de-raya', 'coctel-de-algarrobina'],
  5: ['seco-de-cabrito', 'leche-de-tigre', 'arroz-zambito'],
  6: ['arroz-con-pato-mesa', 'ceviche-de-mero', 'king-kong'],
};
