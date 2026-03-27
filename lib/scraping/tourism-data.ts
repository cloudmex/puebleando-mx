/**
 * Curated tourism data that DENUE (business registry) does NOT cover:
 * - Zonas arqueológicas (INAH)
 * - Pueblos Mágicos (SECTUR)
 * - Playas y cenotes
 * - Parques nacionales y reservas
 * - Cascadas y miradores
 *
 * These are inserted as verified places with high importance scores.
 * Used by syncTourismForCity() during weekend planning to enrich
 * results beyond registered businesses.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Pool } from 'pg';
import type { Place } from '../../types';

// ── Types ───────────────────────────────────────────────────────────────────

interface TourismEntry {
  id: string;           // prefixed: "turismo-{slug}"
  name: string;
  description: string;
  category: Place['category'];
  latitude: number;
  longitude: number;
  town: string;
  state: string;
  tags: string[];
  importance_score: number;
}

// ── Curated data ────────────────────────────────────────────────────────────

const TOURISM_PLACES: TourismEntry[] = [
  // ── Zonas Arqueológicas ─────────────────────────────────────────────
  {
    id: 'turismo-chichen-itza',
    name: 'Chichén Itzá',
    description: 'Una de las Nuevas Siete Maravillas del Mundo. Zona arqueológica maya con la icónica pirámide de Kukulcán.',
    category: 'cultura',
    latitude: 20.6843, longitude: -88.5678,
    town: 'Tinum', state: 'Yucatán',
    tags: ['zona arqueologica', 'maya', 'patrimonio mundial', 'inah'],
    importance_score: 95,
  },
  {
    id: 'turismo-teotihuacan',
    name: 'Teotihuacán',
    description: 'La ciudad de los dioses. Pirámides del Sol y la Luna, Calzada de los Muertos. A 50 km de CDMX.',
    category: 'cultura',
    latitude: 19.6925, longitude: -98.8438,
    town: 'San Juan Teotihuacán', state: 'Estado de México',
    tags: ['zona arqueologica', 'piramides', 'patrimonio mundial', 'inah'],
    importance_score: 95,
  },
  {
    id: 'turismo-monte-alban',
    name: 'Monte Albán',
    description: 'Capital zapoteca con vistas panorámicas del Valle de Oaxaca. Patrimonio de la Humanidad.',
    category: 'cultura',
    latitude: 17.0436, longitude: -96.7675,
    town: 'Oaxaca de Juárez', state: 'Oaxaca',
    tags: ['zona arqueologica', 'zapoteca', 'patrimonio mundial', 'inah'],
    importance_score: 90,
  },
  {
    id: 'turismo-palenque',
    name: 'Palenque',
    description: 'Zona arqueológica maya rodeada de selva tropical. Templo de las Inscripciones y Palacio.',
    category: 'cultura',
    latitude: 17.4838, longitude: -92.0462,
    town: 'Palenque', state: 'Chiapas',
    tags: ['zona arqueologica', 'maya', 'selva', 'patrimonio mundial', 'inah'],
    importance_score: 90,
  },
  {
    id: 'turismo-tulum-ruinas',
    name: 'Zona Arqueológica de Tulum',
    description: 'Ruinas mayas frente al mar Caribe. Único sitio maya con vista al océano.',
    category: 'cultura',
    latitude: 20.2145, longitude: -87.4291,
    town: 'Tulum', state: 'Quintana Roo',
    tags: ['zona arqueologica', 'maya', 'playa', 'inah'],
    importance_score: 88,
  },
  {
    id: 'turismo-uxmal',
    name: 'Uxmal',
    description: 'Arquitectura Puuc maya excepcional. Pirámide del Adivino y Cuadrángulo de las Monjas.',
    category: 'cultura',
    latitude: 20.3594, longitude: -89.7714,
    town: 'Santa Elena', state: 'Yucatán',
    tags: ['zona arqueologica', 'maya', 'puuc', 'patrimonio mundial', 'inah'],
    importance_score: 85,
  },
  {
    id: 'turismo-mitla',
    name: 'Mitla',
    description: 'Zona arqueológica zapoteca-mixteca famosa por sus grecas geométricas únicas en Mesoamérica.',
    category: 'cultura',
    latitude: 16.9263, longitude: -96.3624,
    town: 'San Pablo Villa de Mitla', state: 'Oaxaca',
    tags: ['zona arqueologica', 'zapoteca', 'mixteca', 'inah'],
    importance_score: 75,
  },
  {
    id: 'turismo-guachimontones',
    name: 'Guachimontones',
    description: 'Pirámides circulares únicas de la tradición Teuchitlán. Cerca de Guadalajara.',
    category: 'cultura',
    latitude: 20.6944, longitude: -103.8353,
    town: 'Teuchitlán', state: 'Jalisco',
    tags: ['zona arqueologica', 'piramides circulares', 'inah'],
    importance_score: 70,
  },
  {
    id: 'turismo-tajin',
    name: 'El Tajín',
    description: 'Capital totonaca con la Pirámide de los Nichos. Patrimonio de la Humanidad.',
    category: 'cultura',
    latitude: 20.4485, longitude: -97.3784,
    town: 'Papantla', state: 'Veracruz de Ignacio de la Llave',
    tags: ['zona arqueologica', 'totonaca', 'patrimonio mundial', 'inah'],
    importance_score: 82,
  },
  {
    id: 'turismo-calakmul',
    name: 'Calakmul',
    description: 'Antigua ciudad maya rival de Tikal, inmersa en la Reserva de la Biosfera de Calakmul.',
    category: 'cultura',
    latitude: 18.1056, longitude: -89.8108,
    town: 'Calakmul', state: 'Campeche',
    tags: ['zona arqueologica', 'maya', 'reserva biosfera', 'patrimonio mundial', 'inah'],
    importance_score: 82,
  },

  // ── Naturaleza: Cenotes ─────────────────────────────────────────────
  {
    id: 'turismo-cenote-ik-kil',
    name: 'Cenote Ik Kil',
    description: 'Cenote a cielo abierto con lianas colgantes, cerca de Chichén Itzá. Nadar entre raíces y agua turquesa.',
    category: 'naturaleza',
    latitude: 20.6612, longitude: -88.5503,
    town: 'Tinum', state: 'Yucatán',
    tags: ['cenote', 'nadar', 'naturaleza'],
    importance_score: 78,
  },
  {
    id: 'turismo-cenote-suytun',
    name: 'Cenote Suytun',
    description: 'Cenote subterráneo con plataforma de piedra iluminada por un rayo de luz cenital.',
    category: 'naturaleza',
    latitude: 20.7279, longitude: -88.4403,
    town: 'Valladolid', state: 'Yucatán',
    tags: ['cenote', 'subterraneo', 'fotografia'],
    importance_score: 72,
  },
  {
    id: 'turismo-gran-cenote',
    name: 'Gran Cenote',
    description: 'Cenote cristalino ideal para snorkel y buceo. Tortugas, estalactitas subacuáticas.',
    category: 'naturaleza',
    latitude: 20.2461, longitude: -87.4648,
    town: 'Tulum', state: 'Quintana Roo',
    tags: ['cenote', 'snorkel', 'buceo'],
    importance_score: 75,
  },

  // ── Naturaleza: Cascadas y parques ──────────────────────────────────
  {
    id: 'turismo-hierve-el-agua',
    name: 'Hierve el Agua',
    description: 'Cascadas petrificadas con pozas naturales y vista panorámica del Valle de Oaxaca.',
    category: 'naturaleza',
    latitude: 16.8660, longitude: -96.2759,
    town: 'San Lorenzo Albarradas', state: 'Oaxaca',
    tags: ['cascada petrificada', 'pozas naturales', 'mirador'],
    importance_score: 80,
  },
  {
    id: 'turismo-agua-azul',
    name: 'Cascadas de Agua Azul',
    description: 'Serie de cascadas de agua turquesa en la selva de Chiapas. Imperdible en ruta a Palenque.',
    category: 'naturaleza',
    latitude: 17.2528, longitude: -92.1133,
    town: 'Tumbalá', state: 'Chiapas',
    tags: ['cascada', 'selva', 'turquesa'],
    importance_score: 78,
  },
  {
    id: 'turismo-canon-sumidero',
    name: 'Cañón del Sumidero',
    description: 'Cañón de hasta 1000m de profundidad recorrido en lancha por el río Grijalva.',
    category: 'naturaleza',
    latitude: 16.8366, longitude: -93.0799,
    town: 'Chiapa de Corzo', state: 'Chiapas',
    tags: ['canon', 'lancha', 'parque nacional'],
    importance_score: 85,
  },
  {
    id: 'turismo-huasteca-potosina',
    name: 'Huasteca Potosina',
    description: 'Cascadas turquesa, pozas de agua cristalina, sótanos y cuevas en la sierra de San Luis.',
    category: 'naturaleza',
    latitude: 21.4380, longitude: -99.0994,
    town: 'Ciudad Valles', state: 'San Luis Potosí',
    tags: ['cascadas', 'pozas', 'ecoturismo', 'aventura'],
    importance_score: 85,
  },
  {
    id: 'turismo-basaseachi',
    name: 'Cascada de Basaseachi',
    description: 'Una de las cascadas más altas de México (246m) en las Barrancas del Cobre.',
    category: 'naturaleza',
    latitude: 28.1900, longitude: -108.2081,
    town: 'Ocampo', state: 'Chihuahua',
    tags: ['cascada', 'barrancas del cobre', 'senderismo'],
    importance_score: 75,
  },
  {
    id: 'turismo-barrancas-cobre',
    name: 'Barrancas del Cobre',
    description: 'Sistema de cañones más grande que el Gran Cañón. Recorrido en el Chepe (tren).',
    category: 'naturaleza',
    latitude: 27.5125, longitude: -108.3700,
    town: 'Urique', state: 'Chihuahua',
    tags: ['barrancas', 'chepe', 'tren', 'senderismo', 'tarahumara'],
    importance_score: 88,
  },
  {
    id: 'turismo-islas-marietas',
    name: 'Islas Marietas',
    description: 'Parque Nacional con la Playa Escondida (Playa del Amor). Snorkel y avistamiento de aves.',
    category: 'naturaleza',
    latitude: 20.6979, longitude: -105.5711,
    town: 'Bahía de Banderas', state: 'Nayarit',
    tags: ['isla', 'playa escondida', 'snorkel', 'parque nacional'],
    importance_score: 82,
  },
  {
    id: 'turismo-sian-kaan',
    name: 'Reserva de Sian Ka\'an',
    description: 'Reserva de la Biosfera: manglares, arrecife, lagunas. Patrimonio de la Humanidad.',
    category: 'naturaleza',
    latitude: 19.8900, longitude: -87.5600,
    town: 'Felipe Carrillo Puerto', state: 'Quintana Roo',
    tags: ['reserva biosfera', 'patrimonio mundial', 'manglares', 'arrecife'],
    importance_score: 85,
  },
  {
    id: 'turismo-cabo-pulmo',
    name: 'Parque Nacional Cabo Pulmo',
    description: 'Arrecife de coral vivo más antiguo del Pacífico americano. Buceo y snorkel de clase mundial.',
    category: 'naturaleza',
    latitude: 23.4394, longitude: -109.4247,
    town: 'Cabo Pulmo', state: 'Baja California Sur',
    tags: ['arrecife', 'buceo', 'snorkel', 'parque nacional'],
    importance_score: 80,
  },

  // ── Playas icónicas ─────────────────────────────────────────────────
  {
    id: 'turismo-playa-sayulita',
    name: 'Playa Sayulita',
    description: 'Pueblo surfero con playa de arena dorada, galerías de arte y ambiente bohemio.',
    category: 'naturaleza',
    latitude: 20.8692, longitude: -105.4408,
    town: 'Sayulita', state: 'Nayarit',
    tags: ['playa', 'surf', 'pueblo magico'],
    importance_score: 78,
  },
  {
    id: 'turismo-playa-zipolite',
    name: 'Playa Zipolite',
    description: 'Playa nudista en la costa oaxaqueña. Olas fuertes, atardeceres espectaculares, ambiente libre.',
    category: 'naturaleza',
    latitude: 15.6661, longitude: -96.5261,
    town: 'San Pedro Pochutla', state: 'Oaxaca',
    tags: ['playa', 'nudista', 'costa oaxaquena'],
    importance_score: 68,
  },
  {
    id: 'turismo-playa-balandra',
    name: 'Playa Balandra',
    description: 'Considerada la mejor playa de México. Aguas turquesa poco profundas, el icónico Hongo de roca.',
    category: 'naturaleza',
    latitude: 24.3206, longitude: -110.3258,
    town: 'La Paz', state: 'Baja California Sur',
    tags: ['playa', 'hongo', 'turquesa', 'snorkel'],
    importance_score: 85,
  },
  {
    id: 'turismo-bacalar-laguna',
    name: 'Laguna de Bacalar',
    description: 'La laguna de los 7 colores. Aguas cristalinas, cenotes conectados, kayak y velero.',
    category: 'naturaleza',
    latitude: 18.6773, longitude: -88.3922,
    town: 'Bacalar', state: 'Quintana Roo',
    tags: ['laguna', '7 colores', 'kayak', 'pueblo magico'],
    importance_score: 82,
  },

  // ── Pueblos Mágicos (los que no aparecen como "negocios" en DENUE) ──
  {
    id: 'turismo-pm-san-cristobal',
    name: 'Centro Histórico de San Cristóbal de las Casas',
    description: 'Pueblo Mágico colonial en los altos de Chiapas. Catedrales, mercados indígenas, café de altura.',
    category: 'cultura',
    latitude: 16.7370, longitude: -92.6376,
    town: 'San Cristóbal de las Casas', state: 'Chiapas',
    tags: ['pueblo magico', 'colonial', 'indigena', 'cafe'],
    importance_score: 85,
  },
  {
    id: 'turismo-pm-taxco',
    name: 'Centro Histórico de Taxco',
    description: 'Pueblo Mágico de la plata. Callejones empedrados, Santa Prisca, talleres de platería.',
    category: 'cultura',
    latitude: 18.5564, longitude: -99.6050,
    town: 'Taxco de Alarcón', state: 'Guerrero',
    tags: ['pueblo magico', 'plata', 'colonial', 'artesanias'],
    importance_score: 78,
  },
  {
    id: 'turismo-pm-real-de-catorce',
    name: 'Real de Catorce',
    description: 'Pueblo fantasma minero en el desierto potosino. Se accede por túnel de 2.3 km.',
    category: 'cultura',
    latitude: 23.6885, longitude: -100.8852,
    town: 'Real de Catorce', state: 'San Luis Potosí',
    tags: ['pueblo magico', 'minero', 'desierto', 'wixarika'],
    importance_score: 75,
  },
  {
    id: 'turismo-pm-valladolid',
    name: 'Centro Histórico de Valladolid',
    description: 'Pueblo Mágico colonial entre Mérida y Cancún. Cenotes cercanos, gastronomía yucateca.',
    category: 'cultura',
    latitude: 20.6890, longitude: -88.2014,
    town: 'Valladolid', state: 'Yucatán',
    tags: ['pueblo magico', 'colonial', 'cenotes', 'gastronomia yucateca'],
    importance_score: 72,
  },
  {
    id: 'turismo-pm-todos-santos',
    name: 'Todos Santos',
    description: 'Pueblo Mágico artístico en Baja California Sur. Galerías, surf, Hotel California.',
    category: 'cultura',
    latitude: 23.4474, longitude: -110.2236,
    town: 'Todos Santos', state: 'Baja California Sur',
    tags: ['pueblo magico', 'arte', 'surf', 'galerias'],
    importance_score: 70,
  },
  {
    id: 'turismo-pm-mazunte',
    name: 'Mazunte',
    description: 'Pueblo costero oaxaqueño con centro de tortugas, Punta Cometa y ambiente ecológico.',
    category: 'naturaleza',
    latitude: 15.6685, longitude: -96.5569,
    town: 'Mazunte', state: 'Oaxaca',
    tags: ['playa', 'tortugas', 'punta cometa', 'ecoturismo'],
    importance_score: 68,
  },
  {
    id: 'turismo-pm-izamal',
    name: 'Izamal — Ciudad Amarilla',
    description: 'Pueblo Mágico enteramente pintado de amarillo. Convento franciscano sobre pirámide maya.',
    category: 'cultura',
    latitude: 20.9311, longitude: -89.0176,
    town: 'Izamal', state: 'Yucatán',
    tags: ['pueblo magico', 'amarillo', 'convento', 'maya'],
    importance_score: 72,
  },

  // ── Mercados emblemáticos ───────────────────────────────────────────
  {
    id: 'turismo-mercado-benito-juarez-oax',
    name: 'Mercado Benito Juárez',
    description: 'Mercado central de Oaxaca. Mezcal, chapulines, chocolate, mole, artesanías zapotecas.',
    category: 'mercados',
    latitude: 17.0612, longitude: -96.7253,
    town: 'Oaxaca de Juárez', state: 'Oaxaca',
    tags: ['mercado', 'mezcal', 'chapulines', 'mole', 'artesanias'],
    importance_score: 80,
  },
  {
    id: 'turismo-mercado-san-juan',
    name: 'Mercado de San Juan',
    description: 'Mercado gourmet de CDMX con productos exóticos, quesos artesanales e ingredientes internacionales.',
    category: 'gastronomia',
    latitude: 19.4295, longitude: -99.1434,
    town: 'Ciudad de México', state: 'Ciudad de México',
    tags: ['mercado', 'gourmet', 'gastronomia'],
    importance_score: 75,
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function norm(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function isSupabase(db: SupabaseClient | Pool): db is SupabaseClient {
  return typeof (db as SupabaseClient).from === 'function';
}

/**
 * Haversine distance in km between two lat/lng points.
 */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Finds tourism places near a city and upserts them into the DB.
 * Returns the matched places for immediate use in weekend planning.
 *
 * @param db         Supabase or PG pool (write access)
 * @param cityLat    Latitude of city center
 * @param cityLng    Longitude of city center
 * @param cityName   Display name of the city (for text matching)
 * @param radiusKm   Search radius in kilometers (default: 80km for weekend trips)
 */
export async function syncTourismForCity(
  db: SupabaseClient | Pool,
  cityLat: number,
  cityLng: number,
  cityName: string,
  radiusKm = 80,
): Promise<Place[]> {
  const cityNorm = norm(cityName);
  const saved: Place[] = [];

  // Find entries within radius OR matching the city/state name
  const matches = TOURISM_PLACES.filter(entry => {
    const dist = haversineKm(cityLat, cityLng, entry.latitude, entry.longitude);
    if (dist <= radiusKm) return true;

    // Also match by name (e.g., searching "Oaxaca" should include Monte Albán)
    const townNorm = norm(entry.town);
    const stateNorm = norm(entry.state);
    return townNorm.includes(cityNorm) || cityNorm.includes(townNorm) ||
           stateNorm.includes(cityNorm) || cityNorm.includes(stateNorm);
  });

  if (matches.length === 0) {
    console.log(`[Tourism] No curated places found near ${cityName}`);
    return [];
  }

  for (const entry of matches) {
    const placeData = {
      id: entry.id,
      name: entry.name,
      description: entry.description,
      category: entry.category,
      latitude: entry.latitude,
      longitude: entry.longitude,
      photos: [] as string[],
      town: entry.town,
      state: entry.state,
      tags: entry.tags,
      importance_score: entry.importance_score,
      created_at: new Date().toISOString(),
    };

    try {
      if (isSupabase(db)) {
        await (db as SupabaseClient)
          .from('places')
          .upsert(placeData, { onConflict: 'id', ignoreDuplicates: true });
      } else {
        await (db as Pool).query(
          `INSERT INTO places (id, name, description, category, latitude, longitude,
            photos, town, state, tags, importance_score, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (id) DO NOTHING`,
          [
            placeData.id, placeData.name, placeData.description, placeData.category,
            placeData.latitude, placeData.longitude,
            JSON.stringify(placeData.photos), placeData.town, placeData.state,
            JSON.stringify(placeData.tags), placeData.importance_score, placeData.created_at,
          ]
        );
      }

      saved.push({
        ...placeData,
        category: placeData.category as Place['category'],
      });
    } catch { /* ignore duplicate / constraint errors */ }
  }

  console.log(`[Tourism] syncForCity(${cityName}): ${saved.length} curated places matched (radius: ${radiusKm}km)`);
  return saved;
}
