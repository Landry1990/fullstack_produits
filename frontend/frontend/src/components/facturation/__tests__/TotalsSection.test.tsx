import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import TotalsSection from '../TotalsSection'

// Mock des fonctions props
const mockSetRemiseGlobale = vi.fn()
const mockSetRemiseMode = vi.fn()
const mockSetCouponNumero = vi.fn()
const mockOnRechercherCoupon = vi.fn()
const mockOnClearCoupon = vi.fn()

const defaultProps = {
  totalHT: 10000,
  remiseGlobale: '0',
  setRemiseGlobale: mockSetRemiseGlobale,
  remiseMode: 'montant' as const,
  setRemiseMode: mockSetRemiseMode,
  remiseMontant: 0,
  tvaAmount: 1925,
  totalTTC: 11925,
  couponNumero: '',
  setCouponNumero: mockSetCouponNumero,
  couponData: null,
  couponLoading: false,
  couponError: null,
  onRechercherCoupon: mockOnRechercherCoupon,
  onClearCoupon: mockOnClearCoupon,
  couponMontant: 0,
  tauxCouverture: 0,
  partAssurance: 0,
  partPatient: 0
} // as any to avoid strictly matching every prop if interfaces change slightly, but here we match

describe('TotalsSection', () => {

  it('affiche correctement les totaux standards (sans TP, sans Coupon)', () => {
    render(<TotalsSection {...defaultProps} totalHT={5000} tvaAmount={0} totalTTC={5000} />)
    
    // Vérifier HT et TTC (apparaissent 2 fois)
    const amounts = screen.getAllByText((content) => content.includes('5 000') && content.includes('F'))
    expect(amounts.length).toBeGreaterThanOrEqual(2)
    
    expect(screen.getByText('Total TTC')).toBeInTheDocument()
    // Pas de mention Assurance
    expect(screen.queryByText('Assurance')).not.toBeInTheDocument()
    expect(screen.queryByText('NET À PAYER')).not.toBeInTheDocument()
  })

  it('affiche le Tiers Payant correctement (Couverture 70%)', () => {
    const tpProps = {
      ...defaultProps,
      totalHT: 10000,
      tvaAmount: 0,
      totalTTC: 10000,
      tauxCouverture: 70,
      partAssurance: 7000,
      partPatient: 3000
    }
    render(<TotalsSection {...tpProps} />)

    // Vérifier badges
    expect(screen.getByText('70%')).toBeInTheDocument()
    expect(screen.getByText('Assurance')).toBeInTheDocument()
    expect(screen.getByText((content) => content.includes('7 000') && content.includes('F'))).toBeInTheDocument() // Part Assurance

    // Vérifier Part Patient qui remplace le gros Total TTC
    expect(screen.getByText(/Part Patient/i)).toBeInTheDocument()
    expect(screen.getByText((content) => content.includes('3 000') && content.includes('F'))).toBeInTheDocument()

    // Vérifier affichage discret du Total TTC global
    expect(screen.getByText((content) => content.includes('Total TTC: 10 000') && content.includes('F'))).toBeInTheDocument()
  })

})
