-- Datos iniciales FICTICIOS: los mismos valores que js/config/restaurante.js.

INSERT INTO configuracion (
  duracion_minutos, intervalo_minutos, ventana_dias, min_personas, max_personas_en_linea,
  holgura_asientos, horas_para_cambios, tolerancia_minutos, umbral_limitado,
  max_reservas_activas_contacto, retencion_minutos, dias_cerrados
) VALUES (90, 30, 60, 1, 8, 2, 3, 15, 0.30, 3, 5, '{1}');

INSERT INTO turnos (id, nombre, inicio, fin, orden) VALUES
  ('almuerzo', 'Almuerzo', '12:00', '16:30', 1),
  ('cena',     'Cena',     '19:00', '23:00', 2);

INSERT INTO mesas (id, asientos, nombre, orden) VALUES
  ('M1', 2, NULL, 1), ('M2', 2, NULL, 2), ('M3', 2, NULL, 3),
  ('M4', 2, NULL, 4), ('M5', 2, NULL, 5), ('M6', 2, NULL, 6),
  ('M7', 4, NULL, 7), ('M8', 4, NULL, 8), ('M9', 4, NULL, 9),
  ('M10', 4, NULL, 10), ('M11', 4, NULL, 11),
  ('M12', 6, NULL, 12), ('M13', 6, NULL, 13),
  ('M14', 8, 'Mesa larga', 14);
