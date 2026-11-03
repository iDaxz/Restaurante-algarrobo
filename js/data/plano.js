// Plano del comedor (ficticio) para elegir mesa: dos pisos, sus zonas y dónde va cada mesa.
// Es solo dibujo: qué mesa está libre lo dice el servidor (o la demostración). Las posiciones son el
// centro de cada mesa en % del plano (x de 0 a 100 a lo ancho, y de 0 a 100 a lo alto).
// Una mesa nueva que el administrador agregue y no esté aquí aparece en "Otras mesas", sin perderse.

export const PISOS = [
  {
    id: 'primero',
    nombre: 'Primer piso',
    corto: '1.er piso',
    // Referencias dibujadas: muros con ventana, fogón, barra, entrada y escalera.
    referencias: [
      { tipo: 'ventana', x: 6, y: 3, ancho: 46, alto: 2.5, texto: 'Ventanal a la calle' },
      { tipo: 'fogon', x: 86, y: 8, ancho: 11, alto: 44, texto: 'Fogón a la vista' },
      { tipo: 'barra', x: 55, y: 86, ancho: 18, alto: 8, texto: 'Barra' },
      { tipo: 'entrada', x: 4, y: 90, ancho: 14, alto: 8, texto: 'Entrada' },
      { tipo: 'escalera', x: 76, y: 76, ancho: 18, alto: 20, texto: 'Escalera' },
    ],
    zonas: [
      { id: 'ventana', nombre: 'Junto al ventanal', x: 6, y: 9, ancho: 46, alto: 29 },
      { id: 'salon', nombre: 'Salón', x: 6, y: 42, ancho: 46, alto: 47.5 },
      { id: 'fogon', nombre: 'Junto al fogón', x: 55, y: 9, ancho: 29, alto: 64 },
    ],
  },
  {
    id: 'segundo',
    nombre: 'Segundo piso',
    corto: '2.º piso',
    referencias: [
      { tipo: 'baranda', x: 6, y: 3, ancho: 88, alto: 2.5, texto: 'Baranda con vista al mar' },
      { tipo: 'escalera', x: 76, y: 76, ancho: 18, alto: 20, texto: 'Escalera' },
      { tipo: 'macetas', x: 4, y: 88, ancho: 30, alto: 8, texto: 'Macetas de algarrobo' },
    ],
    zonas: [
      { id: 'baranda', nombre: 'Terraza, junto a la baranda', x: 6, y: 9, ancho: 88, alto: 29 },
      { id: 'terraza', nombre: 'Terraza', x: 6, y: 42, ancho: 68, alto: 42 },
    ],
  },
];

/** Mesa → piso, zona y centro en el plano. */
export const UBICACION_MESAS = {
  M1: { piso: 'primero', zona: 'ventana', x: 15, y: 26 },
  M2: { piso: 'primero', zona: 'ventana', x: 29, y: 26 },
  M3: { piso: 'primero', zona: 'ventana', x: 43, y: 26 },
  M7: { piso: 'primero', zona: 'salon', x: 17, y: 59 },
  M8: { piso: 'primero', zona: 'salon', x: 40, y: 59 },
  M9: { piso: 'primero', zona: 'salon', x: 17, y: 78.5 },
  M12: { piso: 'primero', zona: 'fogon', x: 69.5, y: 29 },
  M14: { piso: 'primero', zona: 'fogon', x: 69.5, y: 57 },
  M4: { piso: 'segundo', zona: 'baranda', x: 20, y: 26 },
  M5: { piso: 'segundo', zona: 'baranda', x: 50, y: 26 },
  M6: { piso: 'segundo', zona: 'baranda', x: 80, y: 26 },
  M10: { piso: 'segundo', zona: 'terraza', x: 19, y: 64 },
  M11: { piso: 'segundo', zona: 'terraza', x: 40, y: 64 },
  M13: { piso: 'segundo', zona: 'terraza', x: 61, y: 64 },
};

/** "Junto al ventanal · 1.er piso", o null si la mesa no está en el plano. */
export function ubicacionDe(mesaId) {
  const u = UBICACION_MESAS[mesaId];
  if (!u) return null;
  const piso = PISOS.find((p) => p.id === u.piso);
  const zona = piso.zonas.find((z) => z.id === u.zona);
  return { piso, zona, texto: `${zona.nombre} · ${piso.corto}` };
}

/**
 * En pantallas angostas (menos de 640 px) el primer piso no cabe a lo ancho con mesas de 44 px:
 * se reparte en tres franjas (ventanal, fogón, salón) sobre el lienzo más alto. Mismas zonas y mesas.
 */
export const PLANO_ANGOSTO = {
  primero: {
    referencias: [
      { tipo: 'ventana', x: 6, y: 2, ancho: 76, alto: 2, texto: 'Ventanal a la calle' },
      { tipo: 'fogon', x: 88, y: 6, ancho: 9, alto: 52, texto: 'Fogón a la vista' },
      { tipo: 'escalera', x: 86, y: 64, ancho: 11, alto: 27, texto: 'Escalera' },
      { tipo: 'entrada', x: 4, y: 93.5, ancho: 16, alto: 5.5, texto: 'Entrada' },
      { tipo: 'barra', x: 46, y: 93.5, ancho: 34, alto: 4.5, texto: 'Barra' },
    ],
    zonas: [
      { id: 'ventana', nombre: 'Junto al ventanal', x: 4, y: 6, ancho: 80, alto: 26 },
      { id: 'fogon', nombre: 'Junto al fogón', x: 4, y: 35, ancho: 80, alto: 26 },
      { id: 'salon', nombre: 'Salón', x: 4, y: 64, ancho: 80, alto: 27 },
    ],
    mesas: {
      M1: { x: 18, y: 21.5 }, M2: { x: 43, y: 21.5 }, M3: { x: 68, y: 21.5 },
      M12: { x: 22, y: 50.5 }, M14: { x: 58, y: 50.5 },
      M7: { x: 18, y: 80 }, M8: { x: 43, y: 80 }, M9: { x: 68, y: 80 },
    },
  },
};
