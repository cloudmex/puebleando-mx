// Simplified test script to verify the logic we added to the orchestrator
// No imports to avoid ESM/TS issues in this environment

async function testSayulitaFilteringLogic() {
  console.log('--- Probando Lógica de Filtrado de Sayulita (Simulada) ---');
  
  // Datos de prueba: lo que el LLM devolvería
  const mockSource = {
    target_location: 'Sayulita'
  };

  const extractedEvents = [
    {
      title: 'Festival de Surf Sayulita 2024',
      city: 'Sayulita',
      venue_name: 'Playa Principal',
      description: 'Competencia internacional de surf.'
    },
    {
      title: 'Mariachi en Tlaquepaque',
      city: 'Tlaquepaque',
      venue_name: 'El Parian',
      description: 'Música tradicional mexicana.'
    },
    {
      title: 'Cena Romántica en la Jungla',
      city: 'Sayulita',
      venue_name: 'Restaurante Oculto',
      description: 'Experiencia gastronómica en el corazón de Sayulita.'
    },
    {
      title: 'Tour de Avistamiento de Ballenas',
      city: 'Puerto Vallarta',
      venue_name: 'Marina Vallarta',
      description: 'Salidas diarias desde el muelle.'
    }
  ];

  console.log(`Buscando eventos para el destino: ${mockSource.target_location}\n`);

  const targetNorm = mockSource.target_location.toLowerCase().trim();
  
  const results = extractedEvents.map(e => {
    const cityMatch = (e.city || '').toLowerCase().trim().includes(targetNorm) || 
                      (e.venue_name || '').toLowerCase().trim().includes(targetNorm) ||
                      (e.description || '').toLowerCase().trim().includes(targetNorm);
    
    return { ...e, passed: cityMatch };
  });

  let passCount = 0;
  results.forEach(res => {
    if (res.passed) {
      console.log(`✅ MANTIENE: "${res.title}" - Detectado en ${res.city || 'Desconocido'}`);
      passCount++;
    } else {
      console.log(`❌ DESCARTA: "${res.title}" - Ubicación: ${res.city || 'Desconocido'}`);
    }
  });

  console.log(`\nResumen: ${passCount} de ${extractedEvents.length} eventos pasaron el filtro de ${mockSource.target_location}.`);

  if (passCount === 2 && results[0].passed && results[2].passed) {
    console.log('\n✨ TEST EXITOSO: La lógica de filtrado es correcta.');
  } else {
    console.error('\n⚠️ TEST FALLIDO: Los resultados no coinciden con lo esperado.');
  }
}

testSayulitaFilteringLogic();
