const fs = require('fs');
const { Pool } = require('pg');

async function diagnose() {
  console.log('--- DIAGNÓSTICO DE DATOS ---');
  let url = process.env.DATABASE_URL;
  if (!url) {
    try {
      const env = fs.readFileSync('.env.local', 'utf8');
      const match = env.match(/DATABASE_URL=(.+)/);
      if (match) url = match[1].trim();
    } catch (e) {
      console.error('No se pudo leer .env.local');
    }
  }

  if (!url) {
    console.error('DATABASE_URL no definida.');
    return;
  }

  const pool = new Pool({ connectionString: url });
  try {
    const { rows } = await pool.query(`
      SELECT title, start_date, city, status, 
             (start_date >= NOW() - INTERVAL '1 hour') as is_upcoming
      FROM events 
      ORDER BY start_date DESC 
      LIMIT 10
    `);
    
    console.log('Últimos 10 eventos en la BD:');
    rows.forEach(r => {
      console.log(`- ${r.title} | ${r.start_date} | ${r.city} | Status: ${r.status} | Upcoming: ${r.is_upcoming}`);
    });

  } catch (err) {
    console.error('Error en la consulta:', err);
  } finally {
    await pool.end();
  }
}

diagnose();
