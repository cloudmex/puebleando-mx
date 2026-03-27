/**
 * Audit script: hits POST /api/weekend-plan for 10 diverse cities,
 * collects the streaming results, and produces a quality report.
 *
 * Usage:  npx tsx scripts/audit-weekend-plans.ts
 *
 * Requires the dev server running on localhost:3000 (or set BASE_URL).
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3001";

// ── 10 diverse cities across Mexico ─────────────────────────────────────────
const CITIES = [
  "Oaxaca",
  "Mérida",
  "San Miguel de Allende",
  "Puerto Vallarta",
  "Guadalajara",
  "Tulum",
  "Guanajuato",
  "Puebla",
  "San Cristóbal de las Casas",
  "Acaponeta",
];

// ── Types ───────────────────────────────────────────────────────────────────

interface StopData {
  order: number;
  hora: string;
  razon: string;
  day: string;
  place?: {
    id: string; name: string; category: string;
    latitude: number; longitude: number;
    town: string; state: string;
    importance_score?: number;
    photos?: string[];
  };
  event?: {
    id: string; title: string; category?: string;
    latitude?: number; longitude?: number;
    city?: string; state?: string;
    source_name?: string; source_url?: string;
    confidence_score?: number;
    image_url?: string;
    start_date?: string;
  };
  referenceUrl?: string;
  referenceName?: string;
  mapsUrl?: string;
}

interface PlanResult {
  ciudad: string;
  resumen?: string;
  descripcion?: string;
  clima?: string;
  vestimenta?: string;
  tips?: string[];
  dias?: string[];
  sabado?: StopData[];
  domingo?: StopData[];
  viernes?: StopData[];
  meta?: {
    verified_places: number;
    verified_events: number;
    external_sources_found: number;
    hallucinations_rejected: number;
  };
}

interface CityAudit {
  ciudad: string;
  status: "ok" | "error" | "empty";
  errorMessage?: string;
  durationMs: number;
  totalStops: number;
  stopsPerDay: Record<string, number>;
  emptyDays: string[];
  categories: Record<string, number>;
  sourcesUsed: Record<string, number>;
  hasPhotos: number;
  noPhotos: number;
  hasCoords: number;
  noCoords: number;
  hasMapsUrl: number;
  hasSourceUrl: number;  // non-Google Maps reference
  onlyGoogleMaps: number;
  duplicateNames: string[];
  lowConfidenceEvents: string[];
  coordsOutOfRange: string[]; // stops far from city
  allUppercaseTitles: string[];
  missingHora: number;
  averageImportance: number;
  meta?: PlanResult["meta"];
  stops: StopData[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Rough city center coordinates for distance checks
const CITY_APPROX: Record<string, [number, number]> = {
  "Oaxaca": [17.07, -96.72],
  "Mérida": [20.97, -89.62],
  "San Miguel de Allende": [20.91, -100.74],
  "Puerto Vallarta": [20.65, -105.23],
  "Guadalajara": [20.66, -103.35],
  "Tulum": [20.21, -87.46],
  "Guanajuato": [21.02, -101.26],
  "Puebla": [19.04, -98.21],
  "San Cristóbal de las Casas": [16.74, -92.64],
  "Acaponeta": [22.49, -105.37],
};

async function fetchPlan(ciudad: string): Promise<{ plan: PlanResult | null; error?: string; durationMs: number }> {
  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/api/weekend-plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ciudad, dias: ["sabado", "domingo"] }),
      signal: AbortSignal.timeout(120_000),
    });

    const text = await res.text();
    const lines = text.trim().split("\n").filter(Boolean);
    const durationMs = Date.now() - start;

    // Parse the last line which should be "ready" or "error"
    let plan: PlanResult | null = null;
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj.type === "ready") {
          plan = obj as PlanResult;
        } else if (obj.type === "error") {
          return { plan: null, error: obj.message, durationMs };
        }
      } catch { /* skip non-JSON lines */ }
    }

    return { plan, durationMs };
  } catch (err: any) {
    return { plan: null, error: err.message, durationMs: Date.now() - start };
  }
}

function auditPlan(ciudad: string, plan: PlanResult | null, error: string | undefined, durationMs: number): CityAudit {
  const audit: CityAudit = {
    ciudad,
    status: plan ? "ok" : error ? "error" : "empty",
    errorMessage: error,
    durationMs,
    totalStops: 0,
    stopsPerDay: {},
    emptyDays: [],
    categories: {},
    sourcesUsed: {},
    hasPhotos: 0,
    noPhotos: 0,
    hasCoords: 0,
    noCoords: 0,
    hasMapsUrl: 0,
    hasSourceUrl: 0,
    onlyGoogleMaps: 0,
    duplicateNames: [],
    lowConfidenceEvents: [],
    coordsOutOfRange: [],
    allUppercaseTitles: [],
    missingHora: 0,
    averageImportance: 0,
    meta: plan?.meta,
    stops: [],
  };

  if (!plan) return audit;

  const days = plan.dias ?? ["sabado", "domingo"];
  const allStops: StopData[] = [];
  for (const d of days) {
    const dayStops = (plan as any)[d] as StopData[] ?? [];
    audit.stopsPerDay[d] = dayStops.length;
    if (dayStops.length === 0) audit.emptyDays.push(d);
    allStops.push(...dayStops);
  }

  audit.totalStops = allStops.length;
  audit.stops = allStops;

  const seenNames = new Set<string>();
  let totalImportance = 0;
  let importanceCount = 0;
  const cityCenter = CITY_APPROX[ciudad];

  for (const stop of allStops) {
    const name = stop.place?.name ?? stop.event?.title ?? "";
    const cat = stop.place?.category ?? stop.event?.category ?? "unknown";
    audit.categories[cat] = (audit.categories[cat] ?? 0) + 1;

    // Photos
    const hasPhoto = (stop.place?.photos && stop.place.photos.length > 0) || !!stop.event?.image_url;
    if (hasPhoto) audit.hasPhotos++; else audit.noPhotos++;

    // Coords
    const lat = stop.place?.latitude ?? stop.event?.latitude;
    const lng = stop.place?.longitude ?? stop.event?.longitude;
    if (lat && lng) {
      audit.hasCoords++;
      // Distance from city
      if (cityCenter) {
        const dist = haversineKm(cityCenter[0], cityCenter[1], lat, lng);
        if (dist > 100) {
          audit.coordsOutOfRange.push(`${name} (${Math.round(dist)}km away)`);
        }
      }
    } else {
      audit.noCoords++;
    }

    // Links
    if (stop.mapsUrl) audit.hasMapsUrl++;
    if (stop.referenceUrl && stop.referenceName !== "Google Maps") {
      audit.hasSourceUrl++;
      const src = stop.referenceName ?? "unknown";
      audit.sourcesUsed[src] = (audit.sourcesUsed[src] ?? 0) + 1;
    } else {
      audit.onlyGoogleMaps++;
    }

    // Duplicates
    const normName = name.toLowerCase().trim();
    if (seenNames.has(normName)) audit.duplicateNames.push(name);
    seenNames.add(normName);

    // Low confidence events
    if (stop.event?.confidence_score != null && stop.event.confidence_score < 0.6) {
      audit.lowConfidenceEvents.push(`${name} (${stop.event.confidence_score})`);
    }

    // ALL CAPS titles
    if (name.length > 3 && name === name.toUpperCase()) {
      audit.allUppercaseTitles.push(name);
    }

    // Missing hora
    if (!stop.hora || stop.hora.trim() === "") audit.missingHora++;

    // Importance
    const imp = stop.place?.importance_score;
    if (imp != null) { totalImportance += imp; importanceCount++; }
  }

  audit.averageImportance = importanceCount > 0 ? Math.round(totalImportance / importanceCount) : 0;

  return audit;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  PUEBLEANDO — Weekend Plan Audit Script");
  console.log(`  Server: ${BASE_URL}`);
  console.log(`  Cities: ${CITIES.length}`);
  console.log(`  Date: ${new Date().toISOString()}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  const audits: CityAudit[] = [];

  for (const ciudad of CITIES) {
    process.stdout.write(`⏳ ${ciudad}...`);
    const { plan, error, durationMs } = await fetchPlan(ciudad);
    const audit = auditPlan(ciudad, plan, error, durationMs);
    audits.push(audit);

    const icon = audit.status === "ok" ? "✅" : audit.status === "error" ? "❌" : "⚠️";
    console.log(`\r${icon} ${ciudad} — ${audit.totalStops} stops, ${Math.round(durationMs / 1000)}s${audit.emptyDays.length > 0 ? ` ⚠ empty: ${audit.emptyDays.join(",")}` : ""}${audit.errorMessage ? ` — ${audit.errorMessage}` : ""}`);
  }

  // ── ANALYSIS ────────────────────────────────────────────────────────────
  console.log("\n\n═══════════════════════════════════════════════════════════════");
  console.log("  ANALYSIS");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const ok = audits.filter(a => a.status === "ok");
  const failed = audits.filter(a => a.status !== "ok");

  console.log(`📊 Success rate: ${ok.length}/${audits.length} cities returned plans\n`);

  if (failed.length > 0) {
    console.log("❌ FAILED CITIES:");
    for (const a of failed) {
      console.log(`   ${a.ciudad}: ${a.errorMessage ?? a.status}`);
    }
    console.log();
  }

  // Timing
  const avgMs = Math.round(audits.reduce((s, a) => s + a.durationMs, 0) / audits.length);
  const maxA = audits.reduce((a, b) => a.durationMs > b.durationMs ? a : b);
  const minA = audits.reduce((a, b) => a.durationMs < b.durationMs ? a : b);
  console.log(`⏱️  TIMING:`);
  console.log(`   Average: ${(avgMs / 1000).toFixed(1)}s`);
  console.log(`   Fastest: ${minA.ciudad} (${(minA.durationMs / 1000).toFixed(1)}s)`);
  console.log(`   Slowest: ${maxA.ciudad} (${(maxA.durationMs / 1000).toFixed(1)}s)\n`);

  // Empty days
  const emptyDayCities = ok.filter(a => a.emptyDays.length > 0);
  if (emptyDayCities.length > 0) {
    console.log("⚠️  EMPTY DAYS (backfill may not be working):");
    for (const a of emptyDayCities) {
      console.log(`   ${a.ciudad}: ${a.emptyDays.join(", ")} empty (stops: ${JSON.stringify(a.stopsPerDay)})`);
    }
    console.log();
  } else {
    console.log("✅ No empty days detected across all cities\n");
  }

  // Stops per day
  const allStopCounts = ok.flatMap(a => Object.values(a.stopsPerDay));
  const avgStops = allStopCounts.length > 0
    ? (allStopCounts.reduce((a, b) => a + b, 0) / allStopCounts.length).toFixed(1)
    : "N/A";
  const minStops = allStopCounts.length > 0 ? Math.min(...allStopCounts) : 0;
  console.log(`📍 STOPS PER DAY: avg=${avgStops}, min=${minStops}`);
  for (const a of ok) {
    console.log(`   ${a.ciudad}: ${Object.entries(a.stopsPerDay).map(([d, n]) => `${d}=${n}`).join(", ")}`);
  }
  console.log();

  // Categories distribution
  const globalCats: Record<string, number> = {};
  for (const a of ok) {
    for (const [cat, n] of Object.entries(a.categories)) {
      globalCats[cat] = (globalCats[cat] ?? 0) + n;
    }
  }
  console.log("🏷️  CATEGORY DISTRIBUTION:");
  const sortedCats = Object.entries(globalCats).sort((a, b) => b[1] - a[1]);
  for (const [cat, n] of sortedCats) {
    const pct = ((n / ok.reduce((s, a) => s + a.totalStops, 0)) * 100).toFixed(0);
    console.log(`   ${cat}: ${n} (${pct}%)`);
  }
  console.log();

  // Photos
  const totalPhotos = ok.reduce((s, a) => s + a.hasPhotos, 0);
  const totalNoPhotos = ok.reduce((s, a) => s + a.noPhotos, 0);
  const photoPct = totalPhotos + totalNoPhotos > 0
    ? ((totalPhotos / (totalPhotos + totalNoPhotos)) * 100).toFixed(0)
    : "N/A";
  console.log(`📸 PHOTOS: ${totalPhotos}/${totalPhotos + totalNoPhotos} stops have images (${photoPct}%)`);
  const worstPhoto = ok.filter(a => a.noPhotos > 0).sort((a, b) => b.noPhotos - a.noPhotos);
  if (worstPhoto.length > 0) {
    console.log("   Cities with most missing photos:");
    for (const a of worstPhoto.slice(0, 5)) {
      console.log(`   ${a.ciudad}: ${a.noPhotos}/${a.totalStops} stops without photo`);
    }
  }
  console.log();

  // Coords
  const totalNoCoords = ok.reduce((s, a) => s + a.noCoords, 0);
  if (totalNoCoords > 0) {
    console.log(`📌 MISSING COORDINATES: ${totalNoCoords} stops have no coords`);
    for (const a of ok.filter(a => a.noCoords > 0)) {
      console.log(`   ${a.ciudad}: ${a.noCoords} stops`);
    }
    console.log();
  }

  // Out-of-range coords
  const outOfRange = ok.flatMap(a => a.coordsOutOfRange.map(s => `${a.ciudad}: ${s}`));
  if (outOfRange.length > 0) {
    console.log(`🗺️  COORDS OUT OF RANGE (>100km from city):`);
    for (const s of outOfRange) console.log(`   ${s}`);
    console.log();
  } else {
    console.log("✅ All coords within 100km of their city\n");
  }

  // Source links
  const totalSourceUrl = ok.reduce((s, a) => s + a.hasSourceUrl, 0);
  const totalOnlyMaps = ok.reduce((s, a) => s + a.onlyGoogleMaps, 0);
  console.log(`🔗 REFERENCE LINKS:`);
  console.log(`   With source URL (news/tickets): ${totalSourceUrl}`);
  console.log(`   Only Google Maps: ${totalOnlyMaps}`);
  const globalSources: Record<string, number> = {};
  for (const a of ok) {
    for (const [src, n] of Object.entries(a.sourcesUsed)) {
      globalSources[src] = (globalSources[src] ?? 0) + n;
    }
  }
  if (Object.keys(globalSources).length > 0) {
    console.log("   Sources breakdown:");
    for (const [src, n] of Object.entries(globalSources).sort((a, b) => b[1] - a[1])) {
      console.log(`     ${src}: ${n}`);
    }
  }
  console.log();

  // Duplicates
  const allDups = ok.flatMap(a => a.duplicateNames.map(d => `${a.ciudad}: ${d}`));
  if (allDups.length > 0) {
    console.log(`🔄 DUPLICATE STOPS:`);
    for (const d of allDups) console.log(`   ${d}`);
    console.log();
  }

  // ALL CAPS
  const allCaps = ok.flatMap(a => a.allUppercaseTitles.map(t => `${a.ciudad}: ${t}`));
  if (allCaps.length > 0) {
    console.log(`🔠 ALL-CAPS TITLES (needs normalization):`);
    for (const t of allCaps) console.log(`   ${t}`);
    console.log();
  }

  // Low confidence
  const lowConf = ok.flatMap(a => a.lowConfidenceEvents.map(e => `${a.ciudad}: ${e}`));
  if (lowConf.length > 0) {
    console.log(`⚡ LOW CONFIDENCE EVENTS (<0.6):`);
    for (const e of lowConf) console.log(`   ${e}`);
    console.log();
  }

  // Missing hora
  const totalMissingHora = ok.reduce((s, a) => s + a.missingHora, 0);
  if (totalMissingHora > 0) {
    console.log(`🕐 MISSING HORA: ${totalMissingHora} stops\n`);
  }

  // Average importance
  console.log(`⭐ AVERAGE IMPORTANCE SCORE:`);
  for (const a of ok.sort((a, b) => b.averageImportance - a.averageImportance)) {
    console.log(`   ${a.ciudad}: ${a.averageImportance}`);
  }
  console.log();

  // Meta stats
  console.log("📊 META STATS (DB pools):");
  for (const a of ok) {
    if (a.meta) {
      console.log(`   ${a.ciudad}: ${a.meta.verified_places} places, ${a.meta.verified_events} events, ${a.meta.external_sources_found} external, ${a.meta.hallucinations_rejected} rejected`);
    }
  }
  console.log();

  // ── Per-city detail ───────────────────────────────────────────────────
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  PER-CITY STOP DETAILS");
  console.log("═══════════════════════════════════════════════════════════════\n");

  for (const a of ok) {
    console.log(`── ${a.ciudad} ──`);
    for (const stop of a.stops) {
      const name = stop.place?.name ?? stop.event?.title ?? "???";
      const type = stop.place ? "place" : "event";
      const cat = stop.place?.category ?? stop.event?.category ?? "?";
      const lat = stop.place?.latitude ?? stop.event?.latitude;
      const lng = stop.place?.longitude ?? stop.event?.longitude;
      const hasPhoto = (stop.place?.photos && stop.place.photos.length > 0) || !!stop.event?.image_url;
      const srcType = stop.referenceName === "Google Maps" ? "maps" : stop.referenceName ?? "none";
      console.log(`  ${stop.day} #${stop.order} | ${type} | ${name} | ${cat} | ${stop.hora || "no-hora"} | coords:${lat ? "✓" : "✗"} | photo:${hasPhoto ? "✓" : "✗"} | src:${srcType}`);
    }
    console.log();
  }

  // ── SUMMARY ───────────────────────────────────────────────────────────
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  SUMMARY — TOP ISSUES TO FIX");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const issues: string[] = [];

  if (failed.length > 0) issues.push(`${failed.length} cities failed entirely`);
  if (emptyDayCities.length > 0) issues.push(`${emptyDayCities.length} cities have empty days`);
  if (totalNoPhotos > 0) issues.push(`${totalNoPhotos} stops lack photos (${100 - Number(photoPct)}%)`);
  if (totalNoCoords > 0) issues.push(`${totalNoCoords} stops have no coordinates`);
  if (outOfRange.length > 0) issues.push(`${outOfRange.length} stops mapped >100km from their city`);
  if (allCaps.length > 0) issues.push(`${allCaps.length} stops have ALL-CAPS titles`);
  if (allDups.length > 0) issues.push(`${allDups.length} duplicate stops within same plan`);
  if (lowConf.length > 0) issues.push(`${lowConf.length} low-confidence events included`);
  if (totalMissingHora > 0) issues.push(`${totalMissingHora} stops missing hora`);
  if (Number(photoPct) < 50) issues.push(`Photo coverage below 50%`);

  if (issues.length === 0) {
    console.log("🎉 No major issues found!\n");
  } else {
    for (let i = 0; i < issues.length; i++) {
      console.log(`  ${i + 1}. ${issues[i]}`);
    }
    console.log();
  }
}

main().catch(console.error);
