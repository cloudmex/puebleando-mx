require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function checkCoords() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query(`
      SELECT id, title, city, latitude, longitude 
      FROM events 
      WHERE (city ILIKE '%Sayulita%' OR title ILIKE '%Sayulita%')
      AND latitude IS NOT NULL
    `);
    
    console.log('--- EVENTOS MATCHING "SAYULITA" (FILTRADO POR OUTLIERS) ---');
    const centerLat = 20.8689;
    const centerLng = -105.4407;
    
    rows.forEach(r => {
      const dist = Math.sqrt(Math.pow(r.latitude - centerLat, 2) + Math.pow(r.longitude - centerLng, 2));
      const isOutlier = dist > 0.1; // More than ~10km away
      if (isOutlier) {
        console.log(`[OUTLIER] [${r.id}] ${r.title} | City: ${r.city} | Lat: ${r.latitude} | Lng: ${r.longitude} | Dist: ${dist.toFixed(4)}`);
      } else {
        // console.log(`[OK] ${r.title}`);
      }
    });

    console.log(`\nTotal matches: ${rows.length}`);
    
  } finally {
    await pool.end();
  }
}

checkCoords();
