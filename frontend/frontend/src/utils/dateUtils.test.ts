import { describe, it, expect, vi } from 'vitest'
import { getLocalDateString, getLocalDateTimeString } from './dateUtils'

// Mock i18n pour les tests
vi.mock('../i18n', () => ({
  default: { language: 'fr' }
}))

describe('dateUtils', () => {
  describe('getLocalDateString', () => {
    it('formate une date en YYYY-MM-DD', () => {
      const date = new Date(2026, 4, 15) // 15 mai 2026
      expect(getLocalDateString(date)).toBe('2026-05-15')
    })

    it('pad les mois et jours < 10', () => {
      const date = new Date(2026, 0, 5) // 5 janvier 2026
      expect(getLocalDateString(date)).toBe('2026-01-05')
    })

    it('utilise la date du jour par defaut', () => {
      const result = getLocalDateString()
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  describe('getLocalDateTimeString', () => {
    it('formate une date-heure complete', () => {
      const date = new Date(2026, 4, 15, 14, 30, 0)
      const result = getLocalDateTimeString(date)
      expect(result).toMatch(/^2026-05-15T14:30:00[+-]\d{2}:\d{2}$/)
    })
  })
})
