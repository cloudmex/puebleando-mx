require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function checkFinal() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query(`
      SELECT id, title, city, status, start_date, 
             (start_date >= NOW() - INTERVAL '1 hour') as is_upcoming
      FROM events 
      WHERE (city ILIKE '%Sayulita%' OR title ILIKE '%Sayulita%')
    `);
    console.log('--- EVENTOS SAYULITA EN BD ---');
    console.log(JSON.stringify(rows, null, 2));
    
    const { rows: all } = await pool.query("SELECT COUNT(*) FROM events WHERE status = 'publicado'");
    console.log('Total eventos publicados:', all[0].count);
    
  } finally {
    await pool.end();
  }
}

checkFinal();
