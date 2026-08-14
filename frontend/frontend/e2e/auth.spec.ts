import { test, expect } from '@playwright/test'
import { login, TEST_USER } from './helpers'

/**
 * Test E2E : Flow de connexion.
 *
 * Vérifie que :
 * 1. La page de login s'affiche
 * 2. La connexion avec les bons credentials redirige vers /app
 * 3. La connexion avec un mauvais mot de passe affiche une erreur
 * 4. Le token est stocké (localStorage)
 */
test.describe('Authentication', () => {
  test('login avec credentials valides', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // La page de login doit avoir un champ username et password
    const usernameInput = page.locator('input[name="username"], input[placeholder*="utilisateur"], input[placeholder*="user" i]').first()
    await expect(usernameInput).toBeVisible()

    const passwordInput = page.locator('input[type="password"]').first()
    await expect(passwordInput).toBeVisible()

    // Remplir et soumettre
    await usernameInput.fill(TEST_USER.username)
    await passwordInput.fill(TEST_USER.password)
    await page.getByRole('button', { type: 'submit' }).click()

    // Doit rediriger vers /app
    await page.waitForURL('**/app**', { timeout: 15_000 })

    // Le token doit être dans localStorage
    const token = await page.evaluate(() => localStorage.getItem('token') || localStorage.getItem('auth_token'))
    expect(token).toBeTruthy()
  })

  test('login avec mauvais mot de passe affiche une erreur', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const usernameInput = page.locator('input[name="username"], input[placeholder*="utilisateur"], input[placeholder*="user" i]').first()
    const passwordInput = page.locator('input[type="password"]').first()

    await usernameInput.fill(TEST_USER.username)
    await passwordInput.fill('mauvais-mot-de-passe-123')
    await page.getByRole('button', { type: 'submit' }).click()

    // Doit rester sur la page de login et afficher une erreur
    await page.waitForTimeout(2000)
    expect(page.url()).toContain('login')

    // Un message d'erreur doit apparaître
    const errorMsg = page.locator('text=/impossible|incorrect|erreur/i').first()
    await expect(errorMsg).toBeVisible({ timeout: 5000 })
  })

  test('déconnexion redirige vers login', async ({ page }) => {
    await login(page)

    // Le token doit exister
    const tokenBefore = await page.evaluate(() => localStorage.getItem('token') || localStorage.getItem('auth_token'))
    expect(tokenBefore).toBeTruthy()

    // Déconnexion
    const logoutBtn = page.getByText(/d[ée]connexion/i).first()
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click()
      await page.waitForURL('**/login**', { timeout: 10_000 })
    }

    // Le token doit être supprimé
    const tokenAfter = await page.evaluate(() => localStorage.getItem('token') || localStorage.getItem('auth_token'))
    expect(tokenAfter).toBeNull()
  })
})
