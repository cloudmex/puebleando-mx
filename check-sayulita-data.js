require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function checkData() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query("SELECT title, city, start_date FROM events WHERE city ILIKE '%Sayulita%' OR title ILIKE '%Sayulita%'");
    console.log(`Eventos encontrados en Sayulita: ${rows.length}`);
    rows.forEach(r => console.log(`- ${r.title} | ${r.city} | ${r.start_date}`));
  } finally {
    await pool.end();
  }
}

checkData();
