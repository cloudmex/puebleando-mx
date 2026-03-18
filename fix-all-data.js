require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function fixData() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log('Iniciando corrección masiva de eventos...');
    
    // 1. Forzar status publicado y fecha futura para eventos de Sayulita
    const res = await pool.query(`
      UPDATE events 
      SET status = 'publicado',
          start_date = NOW() + INTERVAL '2 days'
      WHERE city ILIKE '%Sayulita%' OR title ILIKE '%Sayulita%'
    `);
    console.log(`Eventos de Sayulita actualizados: ${res.rowCount}`);

    // 2. Por si acaso, actualizar todos los eventos actuales a publicado para que haya contenido
    const res2 = await pool.query(`
      UPDATE events 
      SET status = 'publicado'
      WHERE status = 'nuevo'
    `);
    console.log(`Otros eventos activados: ${res2.rowCount}`);

    // 3. Confirmar conteo final
    const { rows } = await pool.query("SELECT COUNT(*) FROM events WHERE status = 'publicado' AND start_date >= NOW()");
    console.log(`Total eventos VISIBLES en la app: ${rows[0].count}`);

  } catch (err) {
    console.error('Error durante la corrección:', err);
  } finally {
    await pool.end();
  }
}

fixData();
