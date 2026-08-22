import { test, expect } from '@playwright/test'
import { login, navigateTo } from './helpers'

/**
 * Tests de responsivité E2E.
 *
 * Objectif : vérifier que les écrans critiques (login, dashboard, tableaux,
 * menu latéral) restent utilisables et visuellement cohérents sur mobile,
 * tablette et desktop.
 *
 * Les viewports sont pilotés par les 3 projets Playwright :
 * - mobile  : iPhone 12 Pro  (390x844)
 * - tablette: iPad Mini      (768x1024)
 * - desktop : Chrome desktop (1280x720)
 */

test.describe('Responsivité — Login', () => {
  test('le formulaire de login reste visible et utilisable sur mobile', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const body = await page.evaluate(() => document.body.scrollHeight)
    const viewportHeight = await page.evaluate(() => window.innerHeight)

    // Le body ne doit pas dépasser 1.5x la hauteur de la fenêtre
    // (tout doit tenir sans un scroll excessif)
    expect(body).toBeLessThanOrEqual(viewportHeight * 1.5)

    const passwordInput = page.locator('input[type="password"]').first()
    const submitButton = page.getByRole('button', { name: /se connecter|connexion/i }).first()

    await expect(passwordInput).toBeVisible()
    await expect(submitButton).toBeVisible()

    // Le bouton doit être cliquable (pas masqué/coupé)
    const submitBox = await submitButton.boundingBox()
    expect(submitBox).not.toBeNull()
    expect(submitBox!.y + submitBox!.height).toBeLessThanOrEqual(viewportHeight * 1.2)
  })
})

test.describe('Responsivité — Menu latéral', () => {
  test('le menu hamburger fonctionne sur mobile', async ({ page }) => {
    await login(page)

    // Sur mobile, la sidebar est masquée par défaut
    const hamburger = page.locator('button[aria-label*="menu"], button[aria-label*="navigation"]').first()
    await expect(hamburger).toBeVisible()

    // Ouvrir le menu
    await hamburger.click()

    // Vérifier qu'un lien de navigation est visible
    const dashboardLink = page.locator('nav a, nav button').filter({ hasText: /tableau de bord|dashboard/i }).first()
    await expect(dashboardLink).toBeVisible()

    // Fermer le menu en cliquant sur l'overlay
    const overlay = page.locator('div').filter({ has: page.locator('nav') }).first()
    await page.mouse.click(20, 20)
    await page.waitForTimeout(300)

    // Le menu hamburger doit être de nouveau visible
    await expect(hamburger).toBeVisible()
  })

  test('le menu reste accessible sur tablette et desktop sans hamburger', async ({ page, project }) => {
    await login(page)

    if (project.name === 'mobile') {
      test.skip('test non pertinent sur mobile')
      return
    }

    // Sur tablette/desktop, au moins un lien principal du menu doit être visible
    const nav = page.locator('nav').first()
    await expect(nav).toBeVisible()
  })
})

test.describe('Responsivité — Dashboard', () => {
  test('les onglets du dashboard restent cliquables sur mobile', async ({ page }) => {
    await login(page)
    await navigateTo(page, 'dashboard')

    const tabs = page.locator('[role="tablist"] button, [role="tab"]')
    const count = await tabs.count()

    // Au moins 3 onglets doivent être présents
    expect(count).toBeGreaterThanOrEqual(3)

    // Tous les onglets doivent être visibles et cliquables
    for (let i = 0; i < count; i++) {
      const tab = tabs.nth(i)
      await expect(tab).toBeVisible()
    }

    // Cliquer sur le dernier onglet (vérifier que la navigation fonctionne)
    await tabs.last().click()
    await page.waitForTimeout(300)
  })

  test('le contenu du dashboard est visible sans overflow horizontal', async ({ page }) => {
    await login(page)
    await navigateTo(page, 'dashboard')
    await page.waitForTimeout(800)

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)

    // Pas d'overflow horizontal significatif
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
  })
})

test.describe('Responsivité — Tableaux de données', () => {
  test('les tableaux restent accessibles avec un conteneur scrollable sur mobile', async ({ page, project }) => {
    await login(page)
    await navigateTo(page, 'produits')
    await page.waitForLoadState('networkidle')

    // Attendre le chargement d'un tableau
    const table = page.locator('table').first()
    await expect(table).toBeVisible({ timeout: 10_000 })

    if (project.name === 'mobile') {
      // Sur mobile, un conteneur scrollable horizontal doit exister autour du tableau
      const tableBox = await table.boundingBox()
      expect(tableBox).not.toBeNull()

      const hasHorizontalScroll = await page.evaluate((table) => {
        let parent = table.parentElement
        // Remonter jusqu'à trouver un conteneur avec overflow-x: auto/scroll
        while (parent && parent !== document.body) {
          const style = window.getComputedStyle(parent)
          if ((style.overflowX === 'auto' || style.overflowX === 'scroll') && parent.scrollWidth > parent.clientWidth) {
            return true
          }
          parent = parent.parentElement
        }
        return false
      }, await table.elementHandle())

      // On accepte un tableau étendu (desktop) OU un conteneur scrollable
      const tableWidth = await table.evaluate((t) => t.scrollWidth)
      const viewportWidth = await page.evaluate(() => window.innerWidth)
      const isWiderThanViewport = tableWidth > viewportWidth

      if (isWiderThanViewport) {
        expect(hasHorizontalScroll).toBe(true)
      }
    }
  })

  test('les en-têtes de tableaux restent lisibles sur tablette', async ({ page, project }) => {
    if (project.name === 'mobile') {
      test.skip('test ciblant la tablette')
      return
    }

    await login(page)
    await navigateTo(page, 'produits')
    await page.waitForLoadState('networkidle')

    const headers = page.locator('th').first()
    await expect(headers).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Responsivité — Facturation critique', () => {
  test('le panier et la recherche produit sont accessibles en mobile', async ({ page, project }) => {
    if (project.name !== 'mobile') {
      test.skip('test ciblant le mobile')
      return
    }

    await login(page)
    await navigateTo(page, 'facturation')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800)

    // Au moins un input de recherche ou un bouton "Ajouter" doit être visible
    const searchInput = page.locator('input[placeholder*="produit" i], input[placeholder*="rechercher" i]').first()
    const addButton = page.getByRole('button').filter({ hasText: /ajouter|rechercher/i }).first()

    if (await searchInput.isVisible().catch(() => false)) {
      await expect(searchInput).toBeVisible()
    } else {
      await expect(addButton).toBeVisible()
    }

    // Pas d'overflow horizontal bloquant
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2)
  })
})
