-- ============================================================
-- Puebleando — Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ── Categories ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id    TEXT PRIMARY KEY,           -- e.g. "gastronomia"
  name  TEXT NOT NULL,
  icon  TEXT NOT NULL,
  color TEXT NOT NULL
);

-- ── Places ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS places (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name        TEXT        NOT NULL,
  description TEXT,
  category    TEXT        REFERENCES categories(id),
  latitude    FLOAT       NOT NULL,
  longitude   FLOAT       NOT NULL,
  photos      TEXT[]      DEFAULT '{}',
  town        TEXT,
  state       TEXT,
  tags             TEXT[]   DEFAULT '{}',
  importance_score SMALLINT DEFAULT 50, -- 0-100: 80+ national, 55+ regional, 30+ city, <30 local
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Routes ───────────────────────────────────────────────────
-- (currently stored client-side in localStorage,
--  table ready for when user auth is added)
CREATE TABLE IF NOT EXISTS routes (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name        TEXT        NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Route Places (join) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS route_places (
  route_id    TEXT    REFERENCES routes(id) ON DELETE CASCADE,
  place_id    TEXT    REFERENCES places(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (route_id, place_id)
);

-- ============================================================
-- Row Level Security — public read-only
-- ============================================================
ALTER TABLE categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE places      ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_places ENABLE ROW LEVEL SECURITY;

-- Anyone can read places and categories (public discovery app)
CREATE POLICY "Public read categories"
  ON categories FOR SELECT USING (true);

CREATE POLICY "Public read places"
  ON places FOR SELECT USING (true);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS places_category_idx ON places(category);
CREATE INDEX IF NOT EXISTS places_state_idx    ON places(state);
-- ============================================================
-- Puebleando — Events & Scraping Schema
-- ============================================================

-- ── Event Status Enum ────────────────────────────────────────
-- Using TEXT with CHECK constraint for simplicity in Supabase logic
CREATE TABLE IF NOT EXISTS event_status (
  id TEXT PRIMARY KEY
);

INSERT INTO event_status (id) VALUES 
('nuevo'), 
('actualizado'), 
('duplicado'), 
('pendiente_revision'), 
('publicado'), 
('descartado')
ON CONFLICT DO NOTHING;

-- ── Events ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title             TEXT NOT NULL,
  slug              TEXT UNIQUE NOT NULL,
  description       TEXT,
  short_description TEXT,
  source_name       TEXT NOT NULL,
  source_url        TEXT NOT NULL,
  source_type       TEXT DEFAULT 'scraping', -- e.g. 'manual', 'scraping'
  category          TEXT REFERENCES categories(id),
  subcategory       TEXT,
  tags              TEXT[] DEFAULT '{}',
  start_date        TIMESTAMPTZ NOT NULL,
  end_date          TIMESTAMPTZ,
  time_text         TEXT,
  venue_name        TEXT,
  address           TEXT,
  city              TEXT,
  state             TEXT,
  country           TEXT DEFAULT 'México',
  latitude          FLOAT,
  longitude         FLOAT,
  price_text        TEXT,
  is_free           BOOLEAN DEFAULT false,
  image_url         TEXT,
  scraped_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  published_at      TIMESTAMPTZ,
  status            TEXT DEFAULT 'nuevo' REFERENCES event_status(id),
  confidence_score  FLOAT    DEFAULT 1.0,
  importance_score  SMALLINT DEFAULT 50, -- 0-100: 80+ national, 55+ regional, 30+ city, <30 local
  dedup_hash        TEXT UNIQUE, -- Hash of title + date + location to prevent dups
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Scraping Sources ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scraping_sources (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name              TEXT NOT NULL,
  base_url          TEXT NOT NULL UNIQUE,
  default_category  TEXT REFERENCES categories(id),
  parser_config     JSONB NOT NULL DEFAULT '{}', -- CSS selectors, regex patterns
  is_active         BOOLEAN DEFAULT true,
  target_location   TEXT, -- Limit scraping to this area (city/state)
  last_run_at       TIMESTAMPTZ,
  frequency_hours   INTEGER DEFAULT 24,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Scraping Jobs ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scraping_jobs (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  source_id         TEXT REFERENCES scraping_sources(id),
  status            TEXT CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at        TIMESTAMPTZ DEFAULT NOW(),
  finished_at       TIMESTAMPTZ,
  total_scraped     INTEGER DEFAULT 0,
  new_events        INTEGER DEFAULT 0,
  updated_events    INTEGER DEFAULT 0,
  failed_events    INTEGER DEFAULT 0,
  error_message     TEXT
);

-- ── Scraping Logs ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scraping_logs (
  id                BIGSERIAL PRIMARY KEY,
  job_id            TEXT REFERENCES scraping_jobs(id) ON DELETE CASCADE,
  level             TEXT CHECK (level IN ('info', 'warn', 'error')),
  message           TEXT NOT NULL,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS - Row Level Security
-- ============================================================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraping_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraping_jobs ENABLE ROW LEVEL SECURITY;
-- scraping_logs don't necessarily need RLS if only admin accessed

-- Public read for published events
DO $$ BEGIN
  CREATE POLICY "Public read published events"
    ON events FOR SELECT USING (status = 'publicado');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Admin access (placeholder for when auth is fully implemented)
-- For now, allowing service role or specific admin check

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS events_start_date_idx ON events(start_date);
CREATE INDEX IF NOT EXISTS events_status_idx ON events(status);
CREATE INDEX IF NOT EXISTS events_category_idx ON events(category);
CREATE INDEX IF NOT EXISTS events_location_idx ON events(latitude, longitude);
CREATE INDEX IF NOT EXISTS events_dedup_hash_idx ON events(dedup_hash);
-- Schema for Multi-Destination Support (Phase 3)

CREATE TABLE IF NOT EXISTS destinations (
  id          TEXT PRIMARY KEY, -- e.g. 'sayulita', 'san-sebastian', 'puerto-vallarta'
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  description TEXT,
  state       TEXT,
  country     TEXT DEFAULT 'México',
  latitude    FLOAT,
  longitude   FLOAT,
  keywords    TEXT[] DEFAULT '{}', -- Used by the AI classifier
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Associate events with destinations
ALTER TABLE events ADD COLUMN IF NOT EXISTS destination_id TEXT REFERENCES destinations(id);

-- Add destination_id to scraping_sources to allow pinning sources to specific targets
ALTER TABLE scraping_sources ADD COLUMN IF NOT EXISTS destination_id TEXT REFERENCES destinations(id);

-- Initial seed for Sayulita as a destination
INSERT INTO destinations (id, name, slug, state, keywords)
VALUES ('sayulita', 'Sayulita', 'sayulita', 'Nayarit', ARRAY['surf', 'playa', 'riviera nayarit', 'sayulita life', 'pueblo magico'])
ON CONFLICT (id) DO NOTHING;
-- ============================================================
-- Puebleando — Auth & Contribution Schema
-- Run AFTER schema.sql and schema_events.sql in Supabase Dashboard
-- ============================================================

-- ── user_profiles ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name   TEXT,
  trust_level    TEXT NOT NULL DEFAULT 'new'
                 CHECK (trust_level IN ('new', 'verified', 'admin')),
  bio            TEXT,
  avatar_url     TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── claims ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS claims (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id        UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  content_type   TEXT NOT NULL CHECK (content_type IN ('place', 'event')),
  content_id     TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected')),
  reason         TEXT,
  admin_note     TEXT,
  reviewed_by    UUID REFERENCES user_profiles(id),
  reviewed_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── content_submissions ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_submissions (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id        UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  content_type   TEXT NOT NULL CHECK (content_type IN ('place', 'event')),
  status         TEXT NOT NULL DEFAULT 'pendiente_revision'
                 CHECK (status IN ('pendiente_revision', 'publicado', 'rechazado')),
  payload        JSONB NOT NULL,
  reviewer_note  TEXT,
  reviewed_by    UUID REFERENCES user_profiles(id),
  reviewed_at    TIMESTAMPTZ,
  published_id   TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Add ownership columns to existing tables ──────────────────
ALTER TABLE places ADD COLUMN IF NOT EXISTS
  submitted_by UUID REFERENCES user_profiles(id);
ALTER TABLE places ADD COLUMN IF NOT EXISTS
  status TEXT NOT NULL DEFAULT 'publicado'
  CHECK (status IN ('pendiente_revision', 'publicado', 'rechazado'));

ALTER TABLE events ADD COLUMN IF NOT EXISTS
  submitted_by UUID REFERENCES user_profiles(id);

-- ── Trigger: auto-create user_profile on signup ──────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE user_profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims              ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_submissions ENABLE ROW LEVEL SECURITY;

-- user_profiles: todos pueden leer, solo el dueño puede actualizar
CREATE POLICY "Public read profiles"
  ON user_profiles FOR SELECT USING (true);

CREATE POLICY "Own profile update"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- claims: solo el dueño ve sus claims
CREATE POLICY "User sees own claims"
  ON claims FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "User inserts own claim"
  ON claims FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- content_submissions: solo el dueño ve sus submissions
CREATE POLICY "User sees own submissions"
  ON content_submissions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "User inserts own submission"
  ON content_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- places: lectura pública solo publicados, o el propio dueño
DROP POLICY IF EXISTS "Public read places" ON places;
CREATE POLICY "Public read published places"
  ON places FOR SELECT
  USING (status = 'publicado' OR auth.uid() = submitted_by);

CREATE POLICY "Auth users insert places"
  ON places FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Owner updates place"
  ON places FOR UPDATE
  USING (auth.uid() = submitted_by);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS claims_user_idx        ON claims(user_id);
CREATE INDEX IF NOT EXISTS claims_content_idx     ON claims(content_type, content_id);
CREATE INDEX IF NOT EXISTS claims_status_idx      ON claims(status);
CREATE INDEX IF NOT EXISTS submissions_user_idx   ON content_submissions(user_id);
CREATE INDEX IF NOT EXISTS submissions_status_idx ON content_submissions(status);
CREATE INDEX IF NOT EXISTS places_submitter_idx   ON places(submitted_by);
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
