-- Puebleando — Rutas con usuario y paradas persistentes

-- user_id: a qué usuario pertenece la ruta
ALTER TABLE routes ADD COLUMN IF NOT EXISTS
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- stops: arreglo JSON con las paradas (lugares y/o eventos)
ALTER TABLE routes ADD COLUMN IF NOT EXISTS
  stops JSONB NOT NULL DEFAULT '[]';

-- RLS: cada usuario solo ve y edita sus propias rutas
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User reads own routes"  ON routes;
DROP POLICY IF EXISTS "User inserts own routes" ON routes;
DROP POLICY IF EXISTS "User updates own routes" ON routes;
DROP POLICY IF EXISTS "User deletes own routes" ON routes;

CREATE POLICY "User reads own routes"
  ON routes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "User inserts own routes"
  ON routes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "User updates own routes"
  ON routes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "User deletes own routes"
  ON routes FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS routes_user_idx ON routes(user_id);
