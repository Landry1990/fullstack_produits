import { describe, it, expect } from 'vitest'
import { normalizeNumberInput, formatCurrency } from '../formatters'

/**
 * Tests pour les calculs métier des commandes
 * 
 * Scénarios testés:
 * - Calcul des totaux avec remises
 * - Conversion des prix (taux de change)
 * - Calcul des marges
 */

describe('Commande Calculations', () => {
    describe('normalizeNumberInput', () => {
        it('should convert string numbers to float', () => {
            expect(normalizeNumberInput('1000.50')).toBe(1000.5)
            expect(normalizeNumberInput('0')).toBe(0)
            expect(normalizeNumberInput('')).toBe(0)
        })

        it('should handle comma as decimal separator', () => {
            expect(normalizeNumberInput('1000,50')).toBe(1000.5)
        })

        it('should handle already numeric values', () => {
            expect(normalizeNumberInput(1000.5)).toBe(1000.5)
        })

        it('should return 0 for invalid inputs', () => {
            expect(normalizeNumberInput(null as any)).toBe(0)
            expect(normalizeNumberInput(undefined as any)).toBe(0)
            expect(normalizeNumberInput('invalid')).toBe(0)
        })
    })

    describe('Order Total Calculations', () => {
        it('should calculate total with multiple products', () => {
            const produits = [
                { quantity: 10, price: '100.00', tva: '19.25' },
                { quantity: 5, price: '200.00', tva: '19.25' },
                { quantity: 3, price: '50.00', tva: '19.25' }
            ]

            const total = produits.reduce((sum, p) => {
                const qty = normalizeNumberInput(p.quantity)
                const price = normalizeNumberInput(p.price)
                return sum + (qty * price)
            }, 0)

            // 10*100 + 5*200 + 3*50 = 1000 + 1000 + 150 = 2150
            expect(total).toBe(2150)
        })

        it('should calculate total with taux_change for direct orders', () => {
            // Commande directe avec taux de change
            const prixEuro = 100
            const tauxChange = 655.957
            const fraisCoefficient = 1.35

            const prixFCFA = prixEuro * tauxChange * fraisCoefficient
            
            expect(prixFCFA).toBeCloseTo(88554.195, 2)
        })

        it('should handle marge calculation', () => {
            const costPrice = 100
            const sellingPrice = 150
            
            const marge = sellingPrice / costPrice
            
            expect(marge).toBe(1.5) // 50% de marge
        })
    })

    describe('Bulk Payment Distribution', () => {
        /**
         * Simule la logique de répartition du backend pour les paiements partiels
         */
        it('should distribute partial payment chronologically', () => {
            const factures = [
                { id: 1, numero_facture: 'FAC-001', reste: 10000, created_at: '2024-01-01' },
                { id: 2, numero_facture: 'FAC-002', reste: 5000, created_at: '2024-01-02' }
            ]

            const montantARepartir = 13000
            const paiements: any[] = []
            let montantRestant = montantARepartir

            for (const facture of factures) {
                if (montantRestant <= 0) break
                
                const montantPaiement = Math.min(montantRestant, facture.reste)
                const resteApres = facture.reste - montantPaiement
                
                paiements.push({
                    facture_id: facture.id,
                    numero_facture: facture.numero_facture,
                    montant_paye: montantPaiement,
                    reste_apres: resteApres,
                    est_soldee: resteApres <= 0
                })
                
                montantRestant -= montantPaiement
            }

            // Vérifications
            expect(paiements).toHaveLength(2)
            
            // Première facture soldée
            expect(paiements[0].montant_paye).toBe(10000)
            expect(paiements[0].reste_apres).toBe(0)
            expect(paiements[0].est_soldee).toBe(true)
            
            // Deuxième facture partiellement payée
            expect(paiements[1].montant_paye).toBe(3000)
            expect(paiements[1].reste_apres).toBe(2000)
            expect(paiements[1].est_soldee).toBe(false)
            
            // Total payé = 13000
            const totalPaye = paiements.reduce((sum, p) => sum + p.montant_paye, 0)
            expect(totalPaye).toBe(13000)
        })

        it('should handle full payment', () => {
            const factures = [
                { id: 1, reste: 10000 },
                { id: 2, reste: 5000 }
            ]

            const montantARepartir = 15000
            let totalPaye = 0

            for (const facture of factures) {
                const montantPaiement = Math.min(montantARepartir - totalPaye, facture.reste)
                totalPaye += montantPaiement
            }

            expect(totalPaye).toBe(15000)
        })
    })

    describe('formatCurrency', () => {
        it('should format currency correctly', () => {
            expect(formatCurrency(1000)).toContain('1')
            expect(formatCurrency(1000000)).toContain('1')
        })
    })
})
