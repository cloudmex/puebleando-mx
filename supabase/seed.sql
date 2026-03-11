-- ============================================================
-- Puebleando — Seed Data
-- Run AFTER schema.sql
-- ============================================================

-- ── Categories ───────────────────────────────────────────────
INSERT INTO categories (id, name, icon, color) VALUES
  ('gastronomia', 'Gastronomía', '🌮', '#C4622D'),
  ('cultura',     'Cultura',     '🎭', '#B03A2E'),
  ('naturaleza',  'Naturaleza',  '🌿', '#2D7D62'),
  ('mercados',    'Mercados',    '🧺', '#E8B84B'),
  ('artesanos',   'Artesanos',   '🧶', '#1A8FA0'),
  ('festivales',  'Festivales',  '🎉', '#9B4420')
ON CONFLICT (id) DO NOTHING;

-- ── Places ───────────────────────────────────────────────────
INSERT INTO places (id, name, description, category, latitude, longitude, photos, town, state, tags) VALUES

('1',
 'Tacos Don Chuy',
 'Taquería familiar con más de 30 años sirviendo los mejores tacos de canasta en el centro de Oaxaca. Don Chuy prepara cada taco con tortillas hechas a mano y guisados de temporada.',
 'gastronomia', 17.0732, -96.7266,
 ARRAY['https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&q=80',
       'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=800&q=80'],
 'Oaxaca de Juárez', 'Oaxaca',
 ARRAY['tacos', 'comida callejera', 'tradicional', 'familiar']),

('2',
 'Taller de Cerámica Tradicional',
 'Taller artesanal donde la familia Mendoza continúa la tradición alfarera de Tonalá. Aprende a moldear barro y llévate tu propia pieza pintada a mano con motivos prehispánicos.',
 'artesanos', 20.6166, -103.2417,
 ARRAY['https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800&q=80',
       'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&q=80'],
 'Tonalá', 'Jalisco',
 ARRAY['cerámica', 'artesanía', 'barro', 'taller']),

('3',
 'Mercado del Pueblo',
 'El mercado más antiguo de San Cristóbal, donde confluyen artesanos tzotziles y tzeltales. Flores, textiles, frutas tropicales y copal llenan cada rincón de color y aroma.',
 'mercados', 16.7369, -92.6376,
 ARRAY['https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80',
       'https://images.unsplash.com/photo-1604719312566-8912e9c8a213?w=800&q=80'],
 'San Cristóbal de las Casas', 'Chiapas',
 ARRAY['mercado', 'textiles', 'indígena', 'flores']),

('4',
 'Cocina Tradicional Doña Lupita',
 'Doña Lupita cocina mole negro desde hace 40 años con la receta de su abuela. Su comedor de cinco mesas es el secreto mejor guardado de los viajeros en Tlaxcala.',
 'gastronomia', 19.3139, -98.2404,
 ARRAY['https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80',
       'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&q=80'],
 'Tlaxcala', 'Tlaxcala',
 ARRAY['mole', 'cocina tradicional', 'comedor', 'casero']),

('5',
 'Bosque de Niebla El Cielo',
 'Reserva natural donde el bosque tropical se convierte en selva de niebla. Rutas de senderismo entre helechos gigantes, orquídeas y quetzales. Un ecosistema único en México.',
 'naturaleza', 23.0918, -99.2153,
 ARRAY['https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=80',
       'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=800&q=80'],
 'Gómez Farías', 'Tamaulipas',
 ARRAY['bosque', 'senderismo', 'naturaleza', 'niebla', 'aves']),

('6',
 'Feria de los Globos de Cantoya',
 'Festival nocturno donde cientos de globos de cantoya iluminan el cielo de Pátzcuaro durante el Día de Muertos. Una de las tradiciones más bellas del mundo indígena purhépecha.',
 'festivales', 19.5149, -101.6091,
 ARRAY['https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
       'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80'],
 'Pátzcuaro', 'Michoacán',
 ARRAY['festival', 'día de muertos', 'tradición', 'globos', 'purhépecha']),

('7',
 'Ruinas de Teotihuacan al Amanecer',
 'Visita guiada a la Pirámide del Sol antes del mediodía turístico. Un guía local purépecha comparte la cosmovisión mesoamericana mientras el sol tiñe de naranja las piedras milenarias.',
 'cultura', 19.6925, -98.8438,
 ARRAY['https://images.unsplash.com/photo-1518638150340-f706e86654de?w=800&q=80',
       'https://images.unsplash.com/photo-1565643580649-8ad0acb34d84?w=800&q=80'],
 'San Juan Teotihuacan', 'Estado de México',
 ARRAY['ruinas', 'prehispánico', 'historia', 'amanecer', 'pirámides']),

('8',
 'Pulquería La Tlachiquera',
 'Pulquería centenaria en el corazón de Hidalgo donde los tlachiqueros comparten el arte del raspado del maguey. Pulque de temporada, curados de frutas y música de huapango los fines de semana.',
 'gastronomia', 20.1011, -98.7624,
 ARRAY['https://images.unsplash.com/photo-1582053433976-25c00369fc93?w=800&q=80',
       'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=800&q=80'],
 'Actopan', 'Hidalgo',
 ARRAY['pulque', 'maguey', 'tradición', 'bebida', 'huapango']),

('9',
 'Tejido Zapoteca con Doña Rosa',
 'Doña Rosa y sus hijas tejen tapetes de lana en telar de pedal usando pigmentos naturales: cochinilla para el rojo, índigo para el azul. Cada pieza tarda semanas en completarse.',
 'artesanos', 16.9967, -96.4667,
 ARRAY['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
       'https://images.unsplash.com/photo-1567767292278-a4f21aa2d36e?w=800&q=80'],
 'Teotitlán del Valle', 'Oaxaca',
 ARRAY['tapetes', 'zapoteca', 'lana', 'telar', 'natural']),

('10',
 'Cenote Sagrado Ik Kil',
 'Cenote natural de 60 metros de diámetro rodeado de vegetación tropical y cascadas de raíces. Lugar sagrado para los mayas, hoy accesible para nadar en sus aguas turquesas.',
 'naturaleza', 20.6553, -88.5796,
 ARRAY['https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80',
       'https://images.unsplash.com/photo-1591208014756-e2f1f1b2e47a?w=800&q=80'],
 'Pisté', 'Yucatán',
 ARRAY['cenote', 'maya', 'naturaleza', 'nado', 'sagrado']),

('11',
 'Mercado de Artesanías de Oaxaca',
 'El mercado 20 de Noviembre y sus alrededores concentran lo mejor de la artesanía oaxaqueña: barro negro, textiles bordados a mano, mezcales artesanales y chocolates de metate.',
 'mercados', 17.0657, -96.7233,
 ARRAY['https://images.unsplash.com/photo-1596649299486-4cdea56fd59d?w=800&q=80',
       'https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=800&q=80'],
 'Oaxaca de Juárez', 'Oaxaca',
 ARRAY['barro negro', 'mezcal', 'chocolate', 'textiles', 'artesanía']),

('12',
 'Danza de los Voladores de Papantla',
 'Ritual totonaca de más de 2000 años donde cuatro danzantes descienden en espiral desde lo alto de un palo de 30 metros. Patrimonio Cultural Inmaterial de la UNESCO.',
 'cultura', 20.4483, -97.3211,
 ARRAY['https://images.unsplash.com/photo-1605098702611-3f6c0e63c0b3?w=800&q=80',
       'https://images.unsplash.com/photo-1578328819058-a09e0c5b1f89?w=800&q=80'],
 'Papantla', 'Veracruz',
 ARRAY['voladores', 'totonaca', 'ritual', 'UNESCO', 'danza'])

ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category,
  latitude    = EXCLUDED.latitude,
  longitude   = EXCLUDED.longitude,
  photos      = EXCLUDED.photos,
  town        = EXCLUDED.town,
  state       = EXCLUDED.state,
  tags        = EXCLUDED.tags;
