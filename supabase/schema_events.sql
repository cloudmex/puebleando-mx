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
  confidence_score  FLOAT DEFAULT 1.0,
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
