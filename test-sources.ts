import { getPool } from "./lib/db";
import { getSupabaseClient } from "./lib/supabase";

async function test() {
  console.log("Testing Scraping Sources...");
  const pool = getPool();
  
  if (!pool) {
    console.log("No DB config found.");
    return;
  }

  try {
    const { rows } = await pool.query("SELECT id, name, base_url, is_active FROM scraping_sources WHERE is_active = true");
    console.log("Active Sources:");
    console.table(rows);
    
    if (rows.length === 0) {
      console.log("No active sources found. Need to seed the database.");
    } else {
      console.log("You can trigger a scrape with:");
      console.log(`curl -X POST http://localhost:3000/api/scraping/crawl -H "Content-Type: application/json" -d '{"sourceId": "${rows[0].id}"}'`);
    }
  } catch(e) {
    console.error("Error querying sources:", e);
  } finally {
    process.exit(0);
  }
}

test();
