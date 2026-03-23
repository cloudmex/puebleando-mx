describe('Basic Responsive Verification', () => {
  it('validates mobile viewport behavior', () => {
    // Simulator on iPhone XR
    cy.viewport('iphone-xr');
    cy.visit('/');

    // The bottom navigation should be visible on mobile
    cy.get('nav').should('be.visible');

    // The mapbox navigation controls should be positioned differently or exist
    cy.get('a[href="/planear"]').first().should('be.visible');

    // Test a modal or layout
    cy.get('a[href="/eventos"]').first().click();
    cy.url().should('include', '/eventos');

    // Ensure the event cards stack properly (verify width or just visibility)
    cy.get('article').first().should('be.visible');
  });
});
