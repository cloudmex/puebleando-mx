-- Crear bucket para fotos de lugares (público para lectura)
INSERT INTO storage.buckets (id, name, public)
VALUES ('places-images', 'places-images', true)
ON CONFLICT (id) DO NOTHING;

-- Permitir uploads autenticados
CREATE POLICY "Authenticated users can upload place images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'places-images');

-- Lectura pública
CREATE POLICY "Public read access for place images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'places-images');

-- Asegurar que events-images también existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('events-images', 'events-images', true)
ON CONFLICT (id) DO NOTHING;
