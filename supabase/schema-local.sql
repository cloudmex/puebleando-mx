-- =============================================================
-- Puebleando – Schema para PostgreSQL local (pgAdmin / pg)
-- Ejecuta este archivo en pgAdmin sobre la base de datos "puebleando"
-- =============================================================

-- Extensión para UUIDs (incluida por defecto en PostgreSQL 13+)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Categorías ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  icon  TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#888888'
);

-- ── Lugares ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS places (
  id          TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(8), 'hex'),
  name        TEXT        NOT NULL,
  description TEXT        NOT NULL DEFAULT '',
  category    TEXT        NOT NULL REFERENCES categories(id),
  latitude    NUMERIC     NOT NULL,
  longitude   NUMERIC     NOT NULL,
  photos      TEXT[]      NOT NULL DEFAULT '{}',
  town        TEXT        NOT NULL DEFAULT '',
  state       TEXT        NOT NULL DEFAULT '',
  tags        TEXT[]      NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS places_category_idx ON places (category);
CREATE INDEX IF NOT EXISTS places_state_idx    ON places (state);

-- ── Rutas ────────────────────────────────────────────────────
-- (Opcional: las rutas se guardan en localStorage en el MVP,
--  pero el schema está listo si en el futuro se persisten en BD)
CREATE TABLE IF NOT EXISTS routes (
  id          TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(8), 'hex'),
  name        TEXT        NOT NULL,
  description TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS route_places (
  route_id    TEXT    NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  place_id    TEXT    NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (route_id, place_id)
);
