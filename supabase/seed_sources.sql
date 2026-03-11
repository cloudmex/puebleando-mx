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
