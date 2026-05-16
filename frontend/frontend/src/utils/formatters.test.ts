import { describe, it, expect } from 'vitest'
import { normalizeNumberInput, formatPrice } from './formatters'

describe('formatters', () => {
  describe('normalizeNumberInput', () => {
    it('retourne 0 pour null/undefined', () => {
      expect(normalizeNumberInput(null)).toBe(0)
      expect(normalizeNumberInput(undefined)).toBe(0)
    })

    it('convertit une string en nombre', () => {
      expect(normalizeNumberInput('42')).toBe(42)
    })

    it('gere la virgule comme separateur decimal', () => {
      expect(normalizeNumberInput('12,50')).toBe(12.5)
    })

    it('retourne 0 pour valeur non numerique', () => {
      expect(normalizeNumberInput('abc')).toBe(0)
      expect(normalizeNumberInput('')).toBe(0)
    })

    it('respecte les bornes min/max', () => {
      expect(normalizeNumberInput(150, { min: 0, max: 100 })).toBe(100)
      expect(normalizeNumberInput(-10, { min: 0 })).toBe(0)
    })
  })

  describe('formatPrice', () => {
    it('formate un prix en francs CFA', () => {
      expect(formatPrice(1500)).toBe('1\u202f500')
    })

    it('formate un prix decimal', () => {
      expect(formatPrice(1500.5)).toBe('1\u202f501')
    })
  })
})
