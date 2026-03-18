import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { ScrapingOrchestrator } from './lib/scraping/orchestrator.js';

// Cargar variables de entorno
dotenv.config({ path: '.env.local' });

async function runManualScrape() {
  console.log('--- EXTRACCIÓN MANUAL DE SAYULITA LIFE ---');
  
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const orchestrator = new ScrapingOrchestrator(pool);

  try {
    // 1. Obtener la fuente de Sayulita Life
    const { rows } = await pool.query("SELECT * FROM scraping_sources WHERE name = 'Sayulita Life' LIMIT 1");
    if (rows.length === 0) {
      console.error('No se encontró la fuente "Sayulita Life" en la base de datos.');
      return;
    }

    const source = rows[0];
    console.log(`Iniciando extracción para: ${source.name} (${source.base_url})`);
    console.log(`Objetivo: ${source.target_location}`);

    // 2. Ejecutar el orquestador
    // Nota: El orquestador ya tiene la lógica para usar target_location
    const result = await orchestrator.runJob(source);
    
    console.log('\n--- RESULTADOS ---');
    console.log(`Eventos nuevos guardados: ${result.newCount}`);
    console.log(`Eventos duplicados omitidos: ${result.duplicateCount}`);
    console.log(`Eventos fallidos: ${result.errorCount}`);

  } catch (err) {
    console.error('Error durante la extracción manual:', err);
  } finally {
    await pool.end();
  }
}

runManualScrape();
