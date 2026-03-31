-- Puebleando — Routes: ensure user_id is TEXT and RLS is correct
-- Must drop policies BEFORE altering column type (policies depend on it)

DROP POLICY IF EXISTS "Public read routes" ON routes;
DROP POLICY IF EXISTS "User reads own routes" ON routes;
DROP POLICY IF EXISTS "User inserts own routes" ON routes;
DROP POLICY IF EXISTS "User updates own routes" ON routes;
DROP POLICY IF EXISTS "User deletes own routes" ON routes;

-- Drop FK constraint if present (may reference auth.users)
DO $$
BEGIN
  ALTER TABLE routes DROP CONSTRAINT IF EXISTS routes_user_id_fkey;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Ensure user_id column exists
ALTER TABLE routes ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Change type to TEXT (flexible for mock + real UUIDs)
ALTER TABLE routes ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- Ensure stops column exists
ALTER TABLE routes ADD COLUMN IF NOT EXISTS stops JSONB NOT NULL DEFAULT '[]';

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS routes_user_idx ON routes(user_id);

-- Enable RLS
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;

-- Recreate policies with TEXT comparison
CREATE POLICY "User reads own routes"
  ON routes FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "User inserts own routes"
  ON routes FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "User updates own routes"
  ON routes FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "User deletes own routes"
  ON routes FOR DELETE
  USING (auth.uid()::text = user_id);
