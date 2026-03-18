import pg from 'pg';
import fs from 'fs';
import path from 'path';

async function updateSchema() {
  console.log('--- Actualizando esquema de base de datos ---');
  
  let databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    try {
      const envPath = path.resolve(process.cwd(), '.env.local');
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/DATABASE_URL=(.+)/);
      if (match) {
        databaseUrl = match[1].trim();
      }
    } catch (e) {
      console.error('Error al leer .env.local:', e.message);
    }
  }

  if (!databaseUrl) {
    console.error('ERROR: No se encontró DATABASE_URL');
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });

  try {
    console.log('Añadiendo columna target_location a scraping_sources...');
    await pool.query('ALTER TABLE scraping_sources ADD COLUMN IF NOT EXISTS target_location TEXT;');
    console.log('✅ Columna añadida/verificada con éxito.');

    console.log('Insertando o actualizando una fuente de ejemplo para Sayulita...');
    // Buscamos si ya existe una fuente de Sayulita o creamos una nueva para pruebas
    const { rows } = await pool.query("SELECT id FROM scraping_sources WHERE name = 'Sayulita Life' LIMIT 1");
    
    if (rows.length > 0) {
      await pool.query("UPDATE scraping_sources SET target_location = 'Sayulita', is_active = true WHERE id = $1", [rows[0].id]);
      console.log('✅ Fuente "Sayulita Life" actualizada.');
    } else {
      await pool.query(`
        INSERT INTO scraping_sources (id, name, base_url, is_active, frequency_hours, target_location, parser_config)
        VALUES (gen_random_uuid(), 'Sayulita Life', 'https://www.sayulitalife.com/events', true, 24, 'Sayulita', '{}')
      `);
      console.log('✅ Fuente "Sayulita Life" creada.');
    }

  } catch (err) {
    console.error('❌ Error actualizando esquema:', err.message);
  } finally {
    await pool.end();
  }
}

updateSchema();
