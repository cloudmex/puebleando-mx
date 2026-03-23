import 'dotenv/config';

async function testGeocode(address) {
  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    limit: "1",
    country: "MX",
    proximity: "-102,23"
  });
  
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?${params}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.features && data.features.length > 0) {
      const feat = data.features[0];
      console.log(`[OK] "${address}" -> [${feat.center[1]}, ${feat.center[0]}] | Type: ${feat.place_type.join(',')} | Place: ${feat.place_name}`);
    } else {
      console.log(`[MISS] "${address}" -> No features found`);
    }
  } catch (error) {
    console.error(`[ERR] "${address}" ->`, error.message);
  }
}

testGeocode("Plaza Grande, Mérida, México");
testGeocode("II Festival de Música Campesina, Mérida, México");
