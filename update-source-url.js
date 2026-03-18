require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function updateSource() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const newUrl = 'https://www.sayulitalife.com/sayulero/calendar/';
    await pool.query("UPDATE scraping_sources SET base_url = $1 WHERE name = 'Sayulita Life'", [newUrl]);
    console.log('Fuente actualizada con éxito a:', newUrl);
  } finally {
    await pool.end();
  }
}

updateSource();
