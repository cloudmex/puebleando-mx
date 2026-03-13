import { getPool } from "./lib/db.js";
import dotenv from "dotenv";
dotenv.config();

async function checkEvents() {
    const pool = getPool();
    if (!pool) {
        console.error("No DB pool");
        return;
    }
    const { rows } = await pool.query("SELECT title, city, latitude, longitude, created_at FROM events ORDER BY created_at DESC LIMIT 20");
    console.table(rows);
    process.exit(0);
}

checkEvents();
