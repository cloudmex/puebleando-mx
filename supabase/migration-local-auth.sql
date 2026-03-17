-- =============================================================
-- Puebleando – Migración local para tablas de Auth/Contribuciones
-- Ejecuta esto en pgAdmin sobre la base de datos "puebleando"
-- DESPUÉS de haber ejecutado schema-local.sql
-- =============================================================

-- Habilitar extensión UUID (por si no está activa)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- ── user_profiles (versión local sin FK a auth.users de Supabase) ──
CREATE TABLE IF NOT EXISTS user_profiles (
  id             TEXT PRIMARY KEY,  -- TEXT en local (no UUID de auth.users)
  display_name   TEXT,
  trust_level    TEXT NOT NULL DEFAULT 'new'
                 CHECK (trust_level IN ('new', 'verified', 'admin')),
  bio            TEXT,
  avatar_url     TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar el usuario administrador local para pruebas
INSERT INTO user_profiles (id, display_name, trust_level)
VALUES ('local-admin', 'Administrador Local', 'admin')
ON CONFLICT (id) DO NOTHING;

-- ── Agregar columnas de contribución a places ─────────────────
ALTER TABLE places ADD COLUMN IF NOT EXISTS
  submitted_by TEXT REFERENCES user_profiles(id);

ALTER TABLE places ADD COLUMN IF NOT EXISTS
  status TEXT NOT NULL DEFAULT 'publicado'
  CHECK (status IN ('pendiente_revision', 'publicado', 'rechazado'));

-- ── content_submissions ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_submissions (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id        TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  content_type   TEXT NOT NULL CHECK (content_type IN ('place', 'event')),
  status         TEXT NOT NULL DEFAULT 'pendiente_revision'
                 CHECK (status IN ('pendiente_revision', 'publicado', 'rechazado')),
  payload        JSONB NOT NULL,
  reviewer_note  TEXT,
  reviewed_by    TEXT REFERENCES user_profiles(id),
  reviewed_at    TIMESTAMPTZ,
  published_id   TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── claims ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS claims (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id        TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  content_type   TEXT NOT NULL CHECK (content_type IN ('place', 'event')),
  content_id     TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected')),
  reason         TEXT,
  admin_note     TEXT,
  reviewed_by    TEXT REFERENCES user_profiles(id),
  reviewed_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── scraping_sources (necesario para el discoverer) ───────────
CREATE TABLE IF NOT EXISTS scraping_sources (
  id               TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(8), 'hex'),
  name             TEXT NOT NULL,
  base_url         TEXT NOT NULL UNIQUE,
  default_category TEXT NOT NULL REFERENCES categories(id),
  parser_config    JSONB NOT NULL DEFAULT '{}',
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Índices ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS claims_user_idx        ON claims(user_id);
CREATE INDEX IF NOT EXISTS claims_status_idx      ON claims(status);
CREATE INDEX IF NOT EXISTS submissions_user_idx   ON content_submissions(user_id);
CREATE INDEX IF NOT EXISTS submissions_status_idx ON content_submissions(status);
CREATE INDEX IF NOT EXISTS places_submitter_idx   ON places(submitted_by);
