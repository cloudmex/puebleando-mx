require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function fixOutliers() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    // Correct coordinates for Sayulita center: 20.8689, -105.4407
    console.log('--- CORRIGIENDO COORDENADAS DE SAYULITA ---');
    
    const query = `
      UPDATE events 
      SET latitude = 20.8689, longitude = -105.4407 
      WHERE (city ILIKE '%Sayulita%' OR title ILIKE '%Sayulita%')
      AND (latitude < 20.0 OR latitude > 21.5 OR longitude > -100.0 OR longitude < -106.0)
    `;
    
    const res = await pool.query(query);
    console.log(`✅ Actualizados ${res.rowCount} eventos que estaban fuera de rango.`);
    
    // Verify results
    const { rows } = await pool.query(`
      SELECT title, city, latitude, longitude 
      FROM events 
      WHERE (city ILIKE '%Sayulita%' OR title ILIKE '%Sayulita%')
    `);
    
    console.log('\n--- ESTADO ACTUAL DE EVENTOS EN SAYULITA ---');
    rows.forEach(r => {
      console.log(`- ${r.title} | ${r.city} | [${r.latitude}, ${r.longitude}]`);
    });

  } catch (err) {
    console.error('❌ Error fixing outliers:', err);
  } finally {
    await pool.end();
  }
}

fixOutliers();
