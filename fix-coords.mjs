import 'dotenv/config';
import { getPool } from './lib/db.js';
import { GeocodingService } from './lib/scraping/geocoding.js';

async function run() {
  console.log("Fixing DB coords...");
  const pool = getPool();
  if (!pool) { console.log("No DB connection"); return; }
  
  const { rows: events } = await pool.query("SELECT id, title, venue_name, address, city FROM events");
  console.log(`Checking ${events.length} events...`);
  for (const e of events) {
    const q1 = e.address ? `${e.address}, ${e.city}, México` : null;
    const q2 = e.venue_name ? `${e.venue_name}, ${e.city}, México` : null;
    const q3 = `${e.title}, ${e.city}, México`;
    const queries = [q1, q2, q3].filter(Boolean);
    let newCoords = null;
    for (const q of queries) {
      newCoords = await GeocodingService.geocode(q);
      if (newCoords) {
        console.log(`Re-geocoded: ${e.title} -> ${newCoords}`);
        await pool.query("UPDATE events SET latitude = $1, longitude = $2 WHERE id = $3", [newCoords[0], newCoords[1], e.id]);
        break;
      }
    }
  }
  
  const { rows: places } = await pool.query("SELECT id, name, town FROM places");
  console.log(`Checking ${places.length} places...`);
  for (const p of places) {
    const q = `${p.name}, ${p.town}, México`;
    const newCoords = await GeocodingService.geocode(q);
    if (newCoords) {
      console.log(`Re-geocoded: ${p.name} -> ${newCoords}`);
      await pool.query("UPDATE places SET latitude = $1, longitude = $2 WHERE id = $3", [newCoords[0], newCoords[1], p.id]);
    }
  }
  console.log("Done.");
  process.exit(0);
}
run().catch(console.error);
