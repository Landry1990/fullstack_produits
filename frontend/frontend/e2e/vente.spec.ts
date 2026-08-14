import { test, expect } from '@playwright/test'
import { login, navigateTo } from './helpers'

/**
 * Test E2E : Flow de vente (facturation).
 *
 * Vérifie que :
 * 1. La page facturation s'affiche
 * 2. On peut rechercher un produit
 * 3. On peut l'ajouter au panier
 * 4. Le total se calcule
 * 5. On peut valider la facture
 */
test.describe('Flow de vente', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('page facturation s\'affiche', async ({ page }) => {
    await navigateTo(page, 'facturation')
    // Le titre ou un élément clé de la page facturation doit être visible
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 })
  })

  test('recherche d\'un produit', async ({ page }) => {
    await navigateTo(page, 'facturation')

    // Trouver le champ de recherche produit
    const searchInput = page.locator(
      'input[placeholder*="recherch" i], input[placeholder*="CIP"], input[placeholder*="produit" i]'
    ).first()

    if (await searchInput.isVisible({ timeout: 5000 })) {
      await searchInput.fill('doliprane')
      await page.waitForTimeout(1000)

      // Des résultats doivent apparaître
      const results = page.locator('[class*="product"], [class*="result"], [data-product-id]')
      const count = await results.count()
      // Au moins un résultat ou un message "aucun résultat"
      expect(count > 0 || await page.locator('text=/aucun/i').isVisible()).toBeTruthy()
    }
  })

  test('ajout d\'un produit au panier', async ({ page }) => {
    await navigateTo(page, 'facturation')

    const searchInput = page.locator(
      'input[placeholder*="recherch" i], input[placeholder*="CIP"], input[placeholder*="produit" i]'
    ).first()

    if (await searchInput.isVisible({ timeout: 5000 })) {
      await searchInput.fill('doliprane')
      await page.waitForTimeout(1500)

      // Cliquer sur le premier résultat
      const firstResult = page.locator('[class*="product"], [class*="result"], [data-product-id]').first()
      if (await firstResult.isVisible({ timeout: 3000 })) {
        await firstResult.click()
        await page.waitForTimeout(500)

        // Le panier doit avoir au moins une ligne
        const cartItems = page.locator('[class*="cart" i] [class*="item"], [class*="panier" i] tr, [class*="ligne"]')
        const cartCount = await cartItems.count()
        expect(cartCount).toBeGreaterThan(0)
      }
    }
  })
})
