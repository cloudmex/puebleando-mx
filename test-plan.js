fetch('http://localhost:3000/api/weekend-plan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ciudad: 'Merida', contexto: '', dias: ['sabado', 'domingo'] })
})
.then(async r => {
  const text = await r.text();
  const lines = text.split('\n').filter(Boolean);
  const readyLine = lines.find(l => l.includes('"type":"ready"'));
  if (readyLine) {
    const data = JSON.parse(readyLine);
    console.log('--- SABADO STOPS ---');
    data.sabado.forEach(s => {
      const name = s.place?.name || s.event?.title;
      const lat = s.place?.latitude ?? s.event?.latitude;
      const lng = s.place?.longitude ?? s.event?.longitude;
      console.log(`- ${name} [lat: ${lat}, lng: ${lng}]`);
    });
  } else {
    console.log('No ready response received:', text);
  }
})
.catch(console.error);
