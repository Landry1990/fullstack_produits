import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useCaisseKeyboard } from '../useCaisseKeyboard'
import type { Facture } from '../../types'

describe('useCaisseKeyboard Hook', () => {
  const mockFactures: Facture[] = [
    { id: 1, numero_facture: 'FAC-001', total_ttc: 10000 } as unknown as Facture,
    { id: 2, numero_facture: 'FAC-002', total_ttc: 15000 } as unknown as Facture,
    { id: 3, numero_facture: 'FAC-003', total_ttc: 20000 } as unknown as Facture,
  ]

  const mockHandlers = {
    onEncaisser: vi.fn(),
    onOpenCouponPanel: vi.fn(),
    onRefresh: vi.fn(),
    onToggleCouponPanel: vi.fn(),
    onCloseModal: vi.fn(),
    canCashOut: true
  }

  const mockState = {
    sortedFactures: mockFactures,
    selectedRowIndex: 0,
    isPaymentModalOpen: false,
    isGenererCouponModalOpen: false,
    isDetailsCouponModalOpen: false,
    isSudoModalOpen: false,
    showTicketPreview: false,
    isCouponPanelOpen: false
  }

  const mockSetSelectedRowIndex = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Cleanup event listeners
    document.removeEventListener('keydown', vi.fn())
  })

  it('devrait naviguer avec les flèches vers le bas', () => {
    renderHook(() => useCaisseKeyboard(mockHandlers, mockState, mockSetSelectedRowIndex))

    const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
    document.dispatchEvent(event)

    expect(mockSetSelectedRowIndex).toHaveBeenCalledWith(expect.any(Function))
  })

  it('devrait naviguer avec la touche j (vim style)', () => {
    renderHook(() => useCaisseKeyboard(mockHandlers, mockState, mockSetSelectedRowIndex))

    const event = new KeyboardEvent('keydown', { key: 'j' })
    document.dispatchEvent(event)

    expect(mockSetSelectedRowIndex).toHaveBeenCalled()
  })

  it('devrait naviguer avec les flèches vers le haut', () => {
    renderHook(() => useCaisseKeyboard(mockHandlers, { ...mockState, selectedRowIndex: 2 }, mockSetSelectedRowIndex))

    const event = new KeyboardEvent('keydown', { key: 'ArrowUp' })
    document.dispatchEvent(event)

    expect(mockSetSelectedRowIndex).toHaveBeenCalled()
  })

  it('devrait naviguer avec la touche k (vim style)', () => {
    renderHook(() => useCaisseKeyboard(mockHandlers, { ...mockState, selectedRowIndex: 2 }, mockSetSelectedRowIndex))

    const event = new KeyboardEvent('keydown', { key: 'k' })
    document.dispatchEvent(event)

    expect(mockSetSelectedRowIndex).toHaveBeenCalled()
  })

  it('devrait encaisser avec Enter quand canCashOut est true', () => {
    renderHook(() => useCaisseKeyboard(mockHandlers, mockState, mockSetSelectedRowIndex))

    const event = new KeyboardEvent('keydown', { key: 'Enter' })
    document.dispatchEvent(event)

    expect(mockHandlers.onEncaisser).toHaveBeenCalledWith(mockFactures[0])
  })

  it('ne devrait pas encaisser avec Enter quand canCashOut est false', () => {
    const handlersSansCashOut = { ...mockHandlers, canCashOut: false }
    renderHook(() => useCaisseKeyboard(handlersSansCashOut, mockState, mockSetSelectedRowIndex))

    const event = new KeyboardEvent('keydown', { key: 'Enter' })
    document.dispatchEvent(event)

    expect(mockHandlers.onEncaisser).not.toHaveBeenCalled()
  })

  it('devrait ouvrir le panneau coupon avec C', () => {
    renderHook(() => useCaisseKeyboard(mockHandlers, mockState, mockSetSelectedRowIndex))

    const event = new KeyboardEvent('keydown', { key: 'C' })
    document.dispatchEvent(event)

    expect(mockHandlers.onOpenCouponPanel).toHaveBeenCalledWith(mockFactures[0])
  })

  it('devrait rafraîchir avec R', () => {
    renderHook(() => useCaisseKeyboard(mockHandlers, mockState, mockSetSelectedRowIndex))

    const event = new KeyboardEvent('keydown', { key: 'r' })
    document.dispatchEvent(event)

    expect(mockHandlers.onRefresh).toHaveBeenCalled()
  })

  it('devrait fermer le panneau coupon avec Escape', () => {
    renderHook(() => useCaisseKeyboard(mockHandlers, { ...mockState, isCouponPanelOpen: true }, mockSetSelectedRowIndex))

    const event = new KeyboardEvent('keydown', { key: 'Escape' })
    document.dispatchEvent(event)

    expect(mockHandlers.onToggleCouponPanel).toHaveBeenCalled()
  })

  it('devrait sélectionner une facture avec les touches 1-9', () => {
    renderHook(() => useCaisseKeyboard(mockHandlers, mockState, mockSetSelectedRowIndex))

    const event = new KeyboardEvent('keydown', { key: '2' })
    document.dispatchEvent(event)

    expect(mockSetSelectedRowIndex).toHaveBeenCalledWith(1)
  })

  it('ne devrait pas sélectionner si l\'index dépasse le nombre de factures', () => {
    renderHook(() => useCaisseKeyboard(mockHandlers, { ...mockState, sortedFactures: mockFactures.slice(0, 2) }, mockSetSelectedRowIndex))

    const event = new KeyboardEvent('keydown', { key: '5' })
    document.dispatchEvent(event)

    expect(mockSetSelectedRowIndex).not.toHaveBeenCalled()
  })

  it('devrait fermer les modales avec Escape quand une modale est ouverte', () => {
    renderHook(() => useCaisseKeyboard(mockHandlers, { ...mockState, isPaymentModalOpen: true }, mockSetSelectedRowIndex))

    const event = new KeyboardEvent('keydown', { key: 'Escape' })
    document.dispatchEvent(event)

    expect(mockHandlers.onCloseModal).toHaveBeenCalled()
  })

  it('ne devrait pas réagir aux touches quand l\'utilisateur tape dans un input', () => {
    renderHook(() => useCaisseKeyboard(mockHandlers, mockState, mockSetSelectedRowIndex))

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    const event = new KeyboardEvent('keydown', { key: 'j', bubbles: true })
    input.dispatchEvent(event)

    expect(mockSetSelectedRowIndex).not.toHaveBeenCalled()

    document.body.removeChild(input)
  })
})
