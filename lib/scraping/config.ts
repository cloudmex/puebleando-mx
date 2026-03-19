
/**
 * Configuration for the automated scraping system
 */

export const PRIORITY_LOCATIONS = [
  "Ciudad de México",
  "Oaxaca de Juárez",
  "Guadalajara, Jalisco",
  "Sayulita, Nayarit",
  "Tulum, Quintana Roo",
  "San Miguel de Allende, Guanajuato",
  "Puerto Vallarta, Jalisco",
  "Mérida, Yucatán",
  "San Cristóbal de las Casas, Chiapas",
  "Mazatlán, Sinaloa"
];

export const SCRAPING_CONFIG = {
  // Number of new sources to try to discover per cron run
  discovery_limit: 5,
  
  // How often to run discovery (every N cron runs)
  discovery_frequency: 1, // 1 = every time for initial phase
  
  // Categories to prioritize
  target_categories: [
    "festivales",
    "cultura",
    "gastronomia",
    "naturaleza"
  ]
};
