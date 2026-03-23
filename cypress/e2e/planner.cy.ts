describe('Weekend Planner', () => {
  beforeEach(() => {
    // Intercept API call to avoid real LLM/Scraping requests during tests
    cy.intercept('POST', '/api/weekend-plan', {
      statusCode: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
      body: JSON.stringify({
        type: "ready",
        ciudad: "Guadalajara",
        resumen: "Fin de semana de prueba",
        dias: ["sabado", "domingo"],
        sabado: [
          {
            order: 1,
            hora: "10:00 AM",
            razon: "Explorar el centro ideal",
            day: "sabado",
            place: { id: "test-place-1", name: "Catedral de Guadalajara", town: "Guadalajara", category: "cultura", latitude: 20.6767, longitude: -103.3475 }
          }
        ],
        domingo: []
      }) + '\n'
    }).as('generatePlan');
  });

  it('allows the user to open the planner and see loaded events on the map', () => {
    // 1. Visitar la página principal
    cy.visit('/');

    // 2. Navegar al planificador
    cy.get('a[href="/planear"]').first().click();
    cy.url().should('include', '/planear');

    // 3. Escribir una ciudad
    cy.get('input[type="text"]').type('Guadalajara');
    
    // 4. Seleccionar días (ej. Sábado y Domingo vienen por defecto) y enviar
    cy.contains('button', 'Armar mi plan').click();

    // 5. Debería redirigir a la vista de la ciudad
    cy.url().should('include', '/planear/Guadalajara');

    // 6. Verificar que se muestre el spinner de carga o el resultado de la intersección
    cy.wait('@generatePlan');

    // 7. Verificar que cargaron los resultados
    cy.contains('Fin de semana de prueba').should('be.visible');
    cy.contains('Catedral de Guadalajara').should('be.visible');

    // 8. Verificar que el mapa (ItineraryMap) esté presente
    cy.get('.mapboxgl-map').should('exist');
    cy.get('.mapboxgl-marker').should('have.length', 1);
  });
});
