import { type Page } from '@playwright/test'

/**
 * Helpers partagés pour les tests E2E Zenith Pharma.
 */

/** Credentials de test — adapter selon l'environnement Docker local. */
export const TEST_USER = {
  username: process.env.E2E_USERNAME || 'admin',
  password: process.env.E2E_PASSWORD || 'admin',
}

/**
 * Connexion via la page de login.
 * Login par mot de passe seul (le système identifie l'utilisateur automatiquement).
 */
export async function login(page: Page) {
  await page.goto('/login')

  // Attendre que la page de login soit chargée
  await page.waitForLoadState('networkidle')

  // Remplir le mot de passe
  const passwordInput = page.locator('input[type="password"]').first()
  await passwordInput.fill(TEST_USER.password)

  // Soumettre
  await page.getByRole('button', { type: 'submit' }).click()

  // Attendre la redirection vers /app
  await page.waitForURL('**/app**', { timeout: 15_000 })
  await page.waitForLoadState('networkidle')
}

/**
 * Déconnexion propre.
 */
export async function logout(page: Page) {
  // Chercher le bouton de déconnexion
  const logoutBtn = page.getByText(/d[ée]connexion/i).first()
  if (await logoutBtn.isVisible()) {
    await logoutBtn.click()
  }
  await page.waitForURL('**/login**', { timeout: 10_000 }).catch(() => {})
}

/**
 * Naviguer vers une route interne (/app/...).
 */
export async function navigateTo(page: Page, path: string) {
  await page.goto(`/app/${path}`)
  await page.waitForLoadState('networkidle')
}
