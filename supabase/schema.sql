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
  tags        TEXT[]      DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
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
