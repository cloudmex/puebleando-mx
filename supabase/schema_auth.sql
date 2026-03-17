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
