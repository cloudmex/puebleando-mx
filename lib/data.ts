import { Category, Place, Route } from "@/types";

export const CATEGORIES: Category[] = [
  { id: "gastronomia", name: "Gastronomía", icon: "🌮", color: "#C4622D" },
  { id: "cultura", name: "Cultura", icon: "🎭", color: "#B03A2E" },
  { id: "naturaleza", name: "Naturaleza", icon: "🌿", color: "#2D7D62" },
  { id: "mercados", name: "Mercados", icon: "🧺", color: "#E8B84B" },
  { id: "artesanos", name: "Artesanos", icon: "🧶", color: "#1A8FA0" },
  { id: "festivales", name: "Festivales", icon: "🎉", color: "#9B4420" },
];

export const PLACES: Place[] = [
  {
    id: "1",
    name: "Tacos Don Chuy",
    description:
      "Taquería familiar con más de 30 años sirviendo los mejores tacos de canasta en el centro de Oaxaca. Don Chuy prepara cada taco con tortillas hechas a mano y guisados de temporada.",
    category: "gastronomia",
    latitude: 17.0732,
    longitude: -96.7266,
    photos: [
      "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&q=80",
      "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=800&q=80",
    ],
    town: "Oaxaca de Juárez",
    state: "Oaxaca",
    tags: ["tacos", "comida callejera", "tradicional", "familiar"],
    created_at: "2024-01-10",
  },
  {
    id: "2",
    name: "Taller de Cerámica Tradicional",
    description:
      "Taller artesanal donde la familia Mendoza continúa la tradición alfarera de Tonalá. Aprende a moldear barro y llévate tu propia pieza pintada a mano con motivos prehispánicos.",
    category: "artesanos",
    latitude: 20.6166,
    longitude: -103.2417,
    photos: [
      "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800&q=80",
      "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&q=80",
    ],
    town: "Tonalá",
    state: "Jalisco",
    tags: ["cerámica", "artesanía", "barro", "taller"],
    created_at: "2024-01-12",
  },
  {
    id: "3",
    name: "Mercado del Pueblo",
    description:
      "El mercado más antiguo de San Cristóbal, donde confluyen artesanos tzotziles y tzeltales. Flores, textiles, frutas tropicales y copal llenan cada rincón de color y aroma.",
    category: "mercados",
    latitude: 16.7369,
    longitude: -92.6376,
    photos: [
      "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80",
      "https://images.unsplash.com/photo-1604719312566-8912e9c8a213?w=800&q=80",
    ],
    town: "San Cristóbal de las Casas",
    state: "Chiapas",
    tags: ["mercado", "textiles", "indígena", "flores"],
    created_at: "2024-01-14",
  },
  {
    id: "4",
    name: "Cocina Tradicional Doña Lupita",
    description:
      "Doña Lupita cocina mole negro desde hace 40 años con la receta de su abuela. Su comedor de cinco mesas es el secreto mejor guardado de los viajeros en Tlaxcala.",
    category: "gastronomia",
    latitude: 19.3139,
    longitude: -98.2404,
    photos: [
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80",
      "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&q=80",
    ],
    town: "Tlaxcala",
    state: "Tlaxcala",
    tags: ["mole", "cocina tradicional", "comedor", "casero"],
    created_at: "2024-01-15",
  },
  {
    id: "5",
    name: "Bosque de Niebla El Cielo",
    description:
      "Reserva natural donde el bosque tropical se convierte en selva de niebla. Rutas de senderismo entre helechos gigantes, orquídeas y quetzales. Un ecosistema único en México.",
    category: "naturaleza",
    latitude: 23.0918,
    longitude: -99.2153,
    photos: [
      "https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=80",
      "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=800&q=80",
    ],
    town: "Gómez Farías",
    state: "Tamaulipas",
    tags: ["bosque", "senderismo", "naturaleza", "niebla", "aves"],
    created_at: "2024-01-18",
  },
  {
    id: "6",
    name: "Feria de los Globos de Cantoya",
    description:
      "Festival nocturno donde cientos de globos de cantoya iluminan el cielo de Pátzcuaro durante el Día de Muertos. Una de las tradiciones más bellas del mundo indígena purhépecha.",
    category: "festivales",
    latitude: 19.5149,
    longitude: -101.6091,
    photos: [
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80",
    ],
    town: "Pátzcuaro",
    state: "Michoacán",
    tags: ["festival", "día de muertos", "tradición", "globos", "purhépecha"],
    created_at: "2024-01-20",
  },
  {
    id: "7",
    name: "Ruinas de Teotihuacan al Amanecer",
    description:
      "Visita guiada a la Pirámide del Sol antes del mediodía turístico. Un guía local purépecha comparte la cosmovisión mesoamericana mientras el sol tiñe de naranja las piedras milenarias.",
    category: "cultura",
    latitude: 19.6925,
    longitude: -98.8438,
    photos: [
      "https://images.unsplash.com/photo-1518638150340-f706e86654de?w=800&q=80",
      "https://images.unsplash.com/photo-1565643580649-8ad0acb34d84?w=800&q=80",
    ],
    town: "San Juan Teotihuacan",
    state: "Estado de México",
    tags: ["ruinas", "prehispánico", "historia", "amanecer", "pirámides"],
    created_at: "2024-01-22",
  },
  {
    id: "8",
    name: "Pulquería La Tlachiquera",
    description:
      "Pulquería centenaria en el corazón de Hidalgo donde los tlachiqueros comparten el arte del raspado del maguey. Pulque de temporada, curados de frutas y música de huapango los fines de semana.",
    category: "gastronomia",
    latitude: 20.1011,
    longitude: -98.7624,
    photos: [
      "https://images.unsplash.com/photo-1582053433976-25c00369fc93?w=800&q=80",
      "https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=800&q=80",
    ],
    town: "Actopan",
    state: "Hidalgo",
    tags: ["pulque", "maguey", "tradición", "bebida", "huapango"],
    created_at: "2024-01-25",
  },
  {
    id: "9",
    name: "Tejido Zapoteca con Doña Rosa",
    description:
      "Doña Rosa y sus hijas tejen tapetes de lana en telar de pedal usando pigmentos naturales: cochinilla para el rojo, índigo para el azul. Cada pieza tarda semanas en completarse.",
    category: "artesanos",
    latitude: 16.9967,
    longitude: -96.4667,
    photos: [
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
      "https://images.unsplash.com/photo-1567767292278-a4f21aa2d36e?w=800&q=80",
    ],
    town: "Teotitlán del Valle",
    state: "Oaxaca",
    tags: ["tapetes", "zapoteca", "lana", "telar", "natural"],
    created_at: "2024-01-28",
  },
  {
    id: "10",
    name: "Cenote Sagrado Ik Kil",
    description:
      "Cenote natural de 60 metros de diámetro rodeado de vegetación tropical y cascadas de raíces. Lugar sagrado para los mayas, hoy accesible para nadar en sus aguas turquesas.",
    category: "naturaleza",
    latitude: 20.6553,
    longitude: -88.5796,
    photos: [
      "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80",
      "https://images.unsplash.com/photo-1591208014756-e2f1f1b2e47a?w=800&q=80",
    ],
    town: "Pisté",
    state: "Yucatán",
    tags: ["cenote", "maya", "naturaleza", "nado", "sagrado"],
    created_at: "2024-02-01",
  },
  {
    id: "11",
    name: "Mercado de Artesanías de Oaxaca",
    description:
      "El mercado 20 de Noviembre y sus alrededores concentran lo mejor de la artesanía oaxaqueña: barro negro, textiles bordados a mano, mezcales artesanales y chocolates de metate.",
    category: "mercados",
    latitude: 17.0657,
    longitude: -96.7233,
    photos: [
      "https://images.unsplash.com/photo-1596649299486-4cdea56fd59d?w=800&q=80",
      "https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=800&q=80",
    ],
    town: "Oaxaca de Juárez",
    state: "Oaxaca",
    tags: ["barro negro", "mezcal", "chocolate", "textiles", "artesanía"],
    created_at: "2024-02-03",
  },
  {
    id: "12",
    name: "Danza de los Voladores de Papantla",
    description:
      "Ritual totonaca de más de 2000 años donde cuatro danzantes descienden en espiral desde lo alto de un palo de 30 metros. Patrimonio Cultural Inmaterial de la UNESCO.",
    category: "cultura",
    latitude: 20.4483,
    longitude: -97.3211,
    photos: [
      "https://images.unsplash.com/photo-1605098702611-3f6c0e63c0b3?w=800&q=80",
      "https://images.unsplash.com/photo-1578328819058-a09e0c5b1f89?w=800&q=80",
    ],
    town: "Papantla",
    state: "Veracruz",
    tags: ["voladores", "totonaca", "ritual", "UNESCO", "danza"],
    created_at: "2024-02-05",
  },
];

export const MOCK_ROUTES: Route[] = [
  {
    id: "r1",
    name: "Ruta Gastronómica Oaxaqueña",
    description: "Un día completo explorando los sabores más auténticos de Oaxaca",
    created_at: "2024-02-10",
    stops: [
      { place: PLACES[0], order_index: 0 },
      { place: PLACES[10], order_index: 1 },
      { place: PLACES[3], order_index: 2 },
    ],
  },
];
