require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function checkSource() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query("SELECT * FROM scraping_sources WHERE name = 'Sayulita Life' LIMIT 1");
    console.log(JSON.stringify(rows[0], null, 2));
  } finally {
    await pool.end();
  }
}

checkSource();
