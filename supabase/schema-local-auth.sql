-- =============================================================
-- Puebleando – Auth & Routes Schema para PostgreSQL local
-- Ejecuta DESPUES de schema-local.sql en pgAdmin
-- Compatible con PostgreSQL puro (sin auth.users de Supabase)
-- =============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── user_profiles ──────────────────────────────────────────
-- En local usamos TEXT como PK (no UUID ligado a auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id             TEXT PRIMARY KEY DEFAULT 'local-admin',
  display_name   TEXT NOT NULL DEFAULT '',
  trust_level    TEXT NOT NULL DEFAULT 'new'
                 CHECK (trust_level IN ('new', 'verified', 'admin')),
  bio            TEXT,
  avatar_url     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Perfil de administrador local para desarrollo
INSERT INTO user_profiles (id, display_name, trust_level)
VALUES ('local-admin', 'Administrador Local', 'admin')
ON CONFLICT (id) DO NOTHING;

-- ── Columnas de propiedad en places y events ───────────────
ALTER TABLE places ADD COLUMN IF NOT EXISTS submitted_by TEXT;
ALTER TABLE places ADD COLUMN IF NOT EXISTS status       TEXT NOT NULL DEFAULT 'publicado';

ALTER TABLE events ADD COLUMN IF NOT EXISTS submitted_by TEXT;

-- ── content_submissions ────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_submissions (
  id             TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(8), 'hex'),
  user_id        TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  content_type   TEXT NOT NULL CHECK (content_type IN ('place', 'event')),
  status         TEXT NOT NULL DEFAULT 'pendiente_revision'
                 CHECK (status IN ('pendiente_revision', 'publicado', 'rechazado')),
  payload        JSONB NOT NULL DEFAULT '{}',
  reviewer_note  TEXT,
  reviewed_by    TEXT REFERENCES user_profiles(id),
  reviewed_at    TIMESTAMPTZ,
  published_id   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── claims ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS claims (
  id             TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(8), 'hex'),
  user_id        TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  content_type   TEXT NOT NULL CHECK (content_type IN ('place', 'event')),
  content_id     TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected')),
  reason         TEXT,
  admin_note     TEXT,
  reviewed_by    TEXT REFERENCES user_profiles(id),
  reviewed_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Rutas con usuario ─────────────────────────────────────
-- Agrega user_id y stops (JSON) a la tabla de rutas existente
ALTER TABLE routes ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES user_profiles(id) ON DELETE CASCADE;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS stops   JSONB NOT NULL DEFAULT '[]';
