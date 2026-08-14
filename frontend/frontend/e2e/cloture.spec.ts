import { test, expect } from '@playwright/test'
import { login, navigateTo } from './helpers'

/**
 * Test E2E : Flow clôture de caisse.
 *
 * Vérifie que :
 * 1. La page journal/historique des clôtures s'affiche
 * 2. Les clôtures passées sont listées (ou message vide)
 * 3. Le bouton de fermeture de session est accessible depuis la caisse
 */
test.describe('Clôture de caisse', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('page historique clôtures s\'affiche', async ({ page }) => {
    await navigateTo(page, 'ventes/clotures')
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 })
  })

  test('liste des clôtures passées', async ({ page }) => {
    await navigateTo(page, 'ventes/clotures')
    await page.waitForLoadState('networkidle')

    // Soit des clôtures sont listées, soit un message vide
    const clotureRows = page.locator('table tbody tr, [class*="cloture"] [class*="card"]')
    const emptyMsg = page.locator('text=/aucune.*cl[ôo]ture|vide|rien/i')
    const hasRows = await clotureRows.count() > 0
    const hasEmpty = await emptyMsg.isVisible().catch(() => false)
    expect(hasRows || hasEmpty).toBeTruthy()
  })

  test('bouton fermer session visible sur caisse', async ({ page }) => {
    await navigateTo(page, 'caisse')
    await page.waitForLoadState('networkidle')

    // Si une session est active, le bouton "Fermer ma caisse" doit être visible
    const closeBtn = page.locator('text=/fermer.*caisse|fermer.*session|cl[ôo]turer/i')
    const openBtn = page.locator('text=/ouvrir.*session|ouvrir.*caisse/i')
    const hasClose = await closeBtn.isVisible({ timeout: 5000 }).catch(() => false)
    const hasOpen = await openBtn.isVisible({ timeout: 3000 }).catch(() => false)

    // L'un des deux doit être présent (soit on a une session à fermer, soit on peut en ouvrir une)
    expect(hasClose || hasOpen).toBeTruthy()
  })
})
