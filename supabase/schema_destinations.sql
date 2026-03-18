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
