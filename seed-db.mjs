import pg from 'pg';
import fs from 'fs';
import path from 'path';

// Datos extraídos de lib/data.ts
const CATEGORIES = [
  { id: "gastronomia", name: "Gastronomía", icon: "🌮", color: "#C4622D" },
  { id: "cultura", name: "Cultura", icon: "🎭", color: "#B03A2E" },
  { id: "naturaleza", name: "Naturaleza", icon: "🌿", color: "#2D7D62" },
  { id: "mercados", name: "Mercados", icon: "🧺", color: "#E8B84B" },
  { id: "artesanos", name: "Artesanos", icon: "🧶", color: "#1A8FA0" },
  { id: "festivales", name: "Festivales", icon: "🎉", color: "#9B4420" },
];

const PLACES = [
  {
    id: "1",
    name: "Tacos Don Chuy",
    description: "Taquería familiar con más de 30 años sirviendo los mejores tacos de canasta en el centro de Oaxaca.",
    category: "gastronomia",
    latitude: 17.0732,
    longitude: -96.7266,
    photos: ["https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&q=80"],
    town: "Oaxaca de Juárez",
    state: "Oaxaca",
    tags: ["tacos", "comida callejera"]
  },
  {
    id: "2",
    name: "Taller de Cerámica Tradicional",
    description: "Taller artesanal donde la familia Mendoza continúa la tradición alfarera de Tonalá.",
    category: "artesanos",
    latitude: 20.6166,
    longitude: -103.2417,
    photos: ["https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800&q=80"],
    town: "Tonalá",
    state: "Jalisco",
    tags: ["cerámica", "artesanía"]
  },
  {
    id: "3",
    name: "Mercado del Pueblo",
    description: "El mercado más antiguo de San Cristóbal, donde confluyen artesanos tzotziles y tzeltales.",
    category: "mercados",
    latitude: 16.7369,
    longitude: -92.6376,
    photos: ["https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80"],
    town: "San Cristóbal de las Casas",
    state: "Chiapas",
    tags: ["mercado", "textiles"]
  },
  {
    id: "4",
    name: "Cocina Tradicional Doña Lupita",
    description: "Doña Lupita cocina mole negro desde hace 40 años con la receta de su abuela.",
    category: "gastronomia",
    latitude: 19.3139,
    longitude: -98.2404,
    photos: ["https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80"],
    town: "Tlaxcala",
    state: "Tlaxcala",
    tags: ["mole", "cocina tradicional"]
  },
  {
    id: "5",
    name: "Bosque de Niebla El Cielo",
    description: "Reserva natural donde el bosque tropical se convierte en selva de niebla.",
    category: "naturaleza",
    latitude: 23.0918,
    longitude: -99.2153,
    photos: ["https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=80"],
    town: "Gómez Farías",
    state: "Tamaulipas",
    tags: ["bosque", "senderismo"]
  }
];

async function seed() {
  console.log('--- Iniciando Seeding de Base de Datos ---');
  
  let databaseUrl;
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/DATABASE_URL=(.+)/);
    if (match) databaseUrl = match[1].trim();
  } catch (e) {
    console.error('Error al leer .env.local:', e.message);
  }

  if (!databaseUrl) {
    console.error('ERROR: No se encontró DATABASE_URL en .env.local');
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });

  try {
    console.log('Insertando categorías...');
    for (const cat of CATEGORIES) {
      await pool.query(
        `INSERT INTO categories (id, name, icon, color)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE
           SET name = EXCLUDED.name, icon = EXCLUDED.icon, color = EXCLUDED.color`,
        [cat.id, cat.name, cat.icon, cat.color]
      );
    }

    console.log('Insertando lugares...');
    for (const place of PLACES) {
      await pool.query(
        `INSERT INTO places (id, name, description, category, latitude, longitude, photos, town, state, tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE
           SET name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category,
               latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, photos = EXCLUDED.photos,
               town = EXCLUDED.town, state = EXCLUDED.state, tags = EXCLUDED.tags`,
        [place.id, place.name, place.description, place.category, place.latitude, place.longitude, place.photos, place.town, place.state, place.tags]
      );
    }

    console.log('✅ ¡Seeding completado con éxito!');
  } catch (err) {
    console.error('❌ Error durante el seeding:', err.message);
  } finally {
    await pool.end();
  }
}

seed();
