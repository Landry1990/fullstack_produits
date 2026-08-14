import { test, expect } from '@playwright/test'
import { login, navigateTo } from './helpers'

/**
 * Test E2E : Navigation générale.
 *
 * Vérifie que les pages principales se chargent sans erreur
 * après connexion.
 */
test.describe('Navigation des pages principales', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  const pages = [
    { path: '', label: 'Dashboard' },
    { path: 'facturation', label: 'Facturation' },
    { path: 'caisse', label: 'Caisse' },
    { path: 'produits', label: 'Produits' },
    { path: 'clients', label: 'Clients' },
    { path: 'fournisseurs', label: 'Fournisseurs' },
    { path: 'ventes/historique', label: 'Historique ventes' },
    { path: 'ventes/journal', label: 'Journal ventes' },
    { path: 'ventes/clotures', label: 'Clôtures' },
    { path: 'inventaire/saisie', label: 'Inventaire saisie' },
    { path: 'statistiques/rapports', label: 'Statistiques' },
    { path: 'utilisateurs', label: 'Gestion utilisateurs' },
    { path: 'corbeille', label: 'Corbeille' },
  ]

  for (const p of pages) {
    test(`page ${p.label} se charge`, async ({ page: browserPage }) => {
      await navigateTo(browserPage, p.path)
      // La page doit avoir du contenu visible (pas une page blanche)
      await expect(browserPage.locator('body')).not.toBeEmpty()
      // Pas d'erreur 500 ou page d'erreur
      const errorEl = browserPage.locator('text=/error 500|page not found|404|erreur serveur/i')
      await expect(errorEl).not.toBeVisible({ timeout: 3000 })
    })
  }
})
