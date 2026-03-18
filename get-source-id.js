require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function getSourceId() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query("SELECT id FROM scraping_sources WHERE name = 'Sayulita Life' LIMIT 1");
    if (rows[0]) {
      console.log(rows[0].id);
    } else {
      console.error('Source not found');
    }
  } finally {
    await pool.end();
  }
}

getSourceId();
