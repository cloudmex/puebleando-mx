import pg from 'pg';
import fs from 'fs';
import path from 'path';

async function testConnection() {
  console.log('--- Probando conexión a la base de datos ---');
  
  let databaseUrl = process.env.DATABASE_URL;

  // Si no está en process.env, intentamos leer .env.local manualmente
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
    console.error('ERROR: No se encontró DATABASE_URL en el entorno ni en .env.local');
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });

  try {
    const start = Date.now();
    const res = await pool.query('SELECT NOW(), current_database(), (SELECT count(*) FROM places) as places_count');
    const duration = Date.now() - start;
    
    console.log('✅ ¡Conexión exitosa!');
    console.log('Hora del servidor:', res.rows[0].now);
    console.log('Base de datos:', res.rows[0].current_database);
    console.log('Lugares encontrados en la tabla "places":', res.rows[0].places_count);
    console.log('Tiempo de respuesta:', duration, 'ms');
  } catch (err) {
    console.error('❌ Error de conexión:', err.message);
    if (err.message.includes('password authentication failed')) {
      console.log('TIP: Revisa que la contraseña en .env.local sea correcta.');
    } else if (err.message.includes('does not exist')) {
      console.log('TIP: Revisa que el nombre de la base de datos sea correcto.');
    }
  } finally {
    await pool.end();
  }
}

testConnection();
