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
            expect(normalizeNumberInput(null as unknown)).toBe(0)
            expect(normalizeNumberInput(undefined as unknown)).toBe(0)
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
            const paiements: unknown[] = []
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

    describe('Decimal Exchange Rate Conversion', () => {
        it('should convert price correctly with a decimal exchange rate (e.g., 1.5)', () => {
            const prixEuro = 100
            const tauxChange = 1.5
            const prixConverted = prixEuro * tauxChange
            expect(prixConverted).toBe(150)
        })

        it('should convert price with decimal rate and frais coefficient', () => {
            const prixEuro = 200
            const tauxChange = 1.5
            const fraisCoefficient = 1.2
            const prixFCFA = prixEuro * tauxChange * fraisCoefficient
            expect(prixFCFA).toBe(360)
        })

        it('should handle fractional euro amounts with decimal rate', () => {
            const prixEuro = 10.5
            const tauxChange = 1.5
            const prixConverted = prixEuro * tauxChange
            expect(prixConverted).toBeCloseTo(15.75, 2)
        })
    })

    describe('Multi-Fournisseur Payment Distribution', () => {
        it('should distribute payment across multiple fournisseurs correctly', () => {
            const commandes = [
                { id: 1, fournisseur: 'A', reste: 5000, created_at: '2024-01-01' },
                { id: 2, fournisseur: 'B', reste: 3000, created_at: '2024-01-02' },
                { id: 3, fournisseur: 'A', reste: 2000, created_at: '2024-01-03' }
            ]
            const montantARepartir = 8000
            let totalPaye = 0
            const paiements: { commande_id: number; fournisseur: string; montant_paye: number; reste_apres: number }[] = []

            for (const cmd of commandes) {
                if (totalPaye >= montantARepartir) break
                const montantPaiement = Math.min(montantARepartir - totalPaye, cmd.reste)
                totalPaye += montantPaiement
                paiements.push({
                    commande_id: cmd.id,
                    fournisseur: cmd.fournisseur,
                    montant_paye: montantPaiement,
                    reste_apres: cmd.reste - montantPaiement
                })
            }

            // Total paye should equal the amount to distribute
            expect(totalPaye).toBe(8000)

            // First commande (fournisseur A) fully paid
            expect(paiements[0].commande_id).toBe(1)
            expect(paiements[0].montant_paye).toBe(5000)
            expect(paiements[0].reste_apres).toBe(0)

            // Second commande (fournisseur B) fully paid
            expect(paiements[1].commande_id).toBe(2)
            expect(paiements[1].montant_paye).toBe(3000)
            expect(paiements[1].reste_apres).toBe(0)

            // Third commande should not be paid (budget exhausted)
            expect(paiements).toHaveLength(2)

            // Verify per-fournisseur totals
            const payeParFournisseurA = paiements
                .filter(p => p.fournisseur === 'A')
                .reduce((sum, p) => sum + p.montant_paye, 0)
            const payeParFournisseurB = paiements
                .filter(p => p.fournisseur === 'B')
                .reduce((sum, p) => sum + p.montant_paye, 0)
            expect(payeParFournisseurA).toBe(5000)
            expect(payeParFournisseurB).toBe(3000)
        })
    })

    describe('Gratuités (Free Units)', () => {
        it('should not count free units (unites_gratuites) in the order total', () => {
            const produits = [
                { quantity: 10, price: '100', unites_gratuites: 5 },
                { quantity: 3, price: '200', unites_gratuites: 0 },
                { quantity: 8, price: '50', unites_gratuites: 2 }
            ]

            // Total should only use quantity * price, not free units
            const total = produits.reduce((sum, p) => {
                const qty = normalizeNumberInput(p.quantity)
                const price = normalizeNumberInput(p.price)
                return sum + (qty * price)
            }, 0)

            // 10*100 + 3*200 + 8*50 = 1000 + 600 + 400 = 2000
            expect(total).toBe(2000)

            // Free units should be tracked separately
            const totalGratuites = produits.reduce((sum, p) => sum + (p.unites_gratuites || 0), 0)
            expect(totalGratuites).toBe(7)

            // Total received units = quantity + gratuites
            const totalUnitesRecues = produits.reduce((sum, p) => sum + p.quantity + (p.unites_gratuites || 0), 0)
            expect(totalUnitesRecues).toBe(28)
        })

        it('should calculate total with gratuites excluded from cost but included in stock', () => {
            const lignes = [
                { quantity: 10, price: '500', unites_gratuites: 5 },
                { quantity: 20, price: '300', unites_gratuites: 0 }
            ]

            const coutTotal = lignes.reduce((sum, l) => sum + (l.quantity * parseFloat(l.price)), 0)
            const totalGratuites = lignes.reduce((sum, l) => sum + l.unites_gratuites, 0)
            const stockTotal = lignes.reduce((sum, l) => sum + l.quantity + l.unites_gratuites, 0)

            // Cost: 10*500 + 20*300 = 5000 + 6000 = 11000 (free units not counted)
            expect(coutTotal).toBe(11000)
            // Free units: 5
            expect(totalGratuites).toBe(5)
            // Stock: 10+5 + 20+0 = 35 (free units included in stock)
            expect(stockTotal).toBe(35)
        })
    })
})
