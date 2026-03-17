const dotenv = require("dotenv");
const { Pool } = require("pg");

dotenv.config({ path: ".env.local" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  try {
    console.log("Creating event_status table and inserting enum values...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS event_status (
        id TEXT PRIMARY KEY
      );

      INSERT INTO event_status (id) VALUES 
      ('nuevo'), ('actualizado'), ('duplicado'), 
      ('pendiente_revision'), ('publicado'), ('descartado')
      ON CONFLICT DO NOTHING;
    `);

    console.log("Creating events table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id                TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(8), 'hex'),
        title             TEXT NOT NULL,
        slug              TEXT UNIQUE NOT NULL,
        description       TEXT,
        short_description TEXT,
        source_name       TEXT NOT NULL,
        source_url        TEXT NOT NULL,
        source_type       TEXT DEFAULT 'scraping',
        category          TEXT REFERENCES categories(id),
        subcategory       TEXT,
        tags              TEXT[] DEFAULT '{}',
        start_date        TIMESTAMPTZ NOT NULL,
        end_date          TIMESTAMPTZ,
        time_text         TEXT,
        venue_name        TEXT,
        address           TEXT,
        city              TEXT,
        state             TEXT,
        country           TEXT DEFAULT 'México',
        latitude          FLOAT,
        longitude         FLOAT,
        price_text        TEXT,
        is_free           BOOLEAN DEFAULT false,
        image_url         TEXT,
        scraped_at        TIMESTAMPTZ DEFAULT NOW(),
        updated_at        TIMESTAMPTZ DEFAULT NOW(),
        published_at      TIMESTAMPTZ,
        status            TEXT DEFAULT 'nuevo' REFERENCES event_status(id),
        confidence_score  FLOAT DEFAULT 1.0,
        dedup_hash        TEXT UNIQUE,
        created_at        TIMESTAMPTZ DEFAULT NOW(),
        submitted_by      TEXT
      );
    `);
    
    console.log("Creating content_submissions table for local db...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS content_submissions (
        id            TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(8), 'hex'),
        user_id       TEXT NOT NULL,
        content_type  TEXT NOT NULL,
        payload       JSONB NOT NULL,
        status        TEXT DEFAULT 'pending',
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    
    console.log("Schema creation finished successfully.");
  } catch (err) {
    console.error("Error creating schema:");
    console.error(err);
    process.exit(1);
  } finally {
    pool.end();
  }
}

main();
