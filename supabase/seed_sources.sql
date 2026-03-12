-- Semilla para Guadalajara Secreta
INSERT INTO scraping_sources (name, base_url, default_category, parser_config, is_active)
VALUES (
  'Guadalajara Secreta',
  'https://guadalajarasecreta.com',
  'cultura',
  '{
    "depth": 1,
    "max_pages": 10,
    "selectors": {
      "item": "article",
      "title": "h2",
      "image": "img"
    }
  }'::jsonb,
  true
) ON CONFLICT (base_url) DO UPDATE
SET parser_config = EXCLUDED.parser_config;

-- National Sources Fallback
INSERT INTO scraping_sources (name, base_url, default_category, parser_config, is_active)
VALUES 
('Mexico es Cultura', 'https://www.mexicoescultura.com/ciclos', 'cultura', '{"depth": 1, "render": false}', true),
('Cartelera CDMX', 'https://cartelera.cdmx.gob.mx/', 'cultura', '{"depth": 1, "render": true}', true)
ON CONFLICT (base_url) DO NOTHING;
