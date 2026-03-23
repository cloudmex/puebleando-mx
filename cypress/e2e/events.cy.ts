describe('Event Visualization and Navigation', () => {
  it('navigates through the main screens and opens an event', () => {
    cy.visit('/');

    // Validate Homepage has the main headers or elements
    cy.contains('Descubre eventos reales').should('be.visible');

    // Moverse a la pestaña de "Eventos" (Bottom nav u otra)
    cy.get('a[href="/eventos"]').first().click();
    cy.url().should('include', '/eventos');

    // Check if event cards are loaded
    // Since we don't mock it here, we just verify the container or an article exists
    cy.get('article').should('have.length.at.least', 1);

    // Filter or interact if needed
    // Click on the first event card to see details
    cy.get('article a').first().click();
    
    // Should be in event details page
    cy.url().should('include', '/evento/');
    cy.get('h1').should('exist');
  });
});
