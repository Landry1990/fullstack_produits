import { describe, it, expect, vi, beforeEach } from 'vitest'
import creanceService from '../creanceService'
import api from '../api'

// Mock the API
vi.mock('../api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn()
    }
}))

describe('creanceService - Bulk Payment with Partial Amount', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('bulkPaiement', () => {
        it('should call API with montant_total for partial payment', async () => {
            const mockResponse = {
                data: {
                    detail: 'Règlement effectué. 2 factures traitées.',
                    releve_id: 123,
                    releve_reference: 'REL-20240512-001',
                    total_amount: '13000.00',
                    total_dettes: '15000.00',
                    reste_a_payer: '2000.00',
                    paiements: [
                        {
                            facture_id: 1,
                            numero_facture: 'FAC-001',
                            montant_total_facture: '10000.00',
                            montant_paye: '10000.00',
                            reste_avant: '10000.00',
                            reste_apres: '0.00',
                            est_soldee: true
                        },
                        {
                            facture_id: 2,
                            numero_facture: 'FAC-002',
                            montant_total_facture: '5000.00',
                            montant_paye: '3000.00',
                            reste_avant: '5000.00',
                            reste_apres: '2000.00',
                            est_soldee: false
                        }
                    ]
                }
            }

            vi.mocked(api.post).mockResolvedValue(mockResponse)

            const payload = {
                facture_ids: [1, 2],
                mode_paiement: 'especes',
                reference: 'Paiement client',
                validated_by_id: 5,
                sudo_password: 'password123',
                montant_total: 13000 // Montant partiel < total dettes (15000)
            }

            const result = await creanceService.bulkPaiement(payload)

            // Vérifier que l'API est appelée avec le bon payload
            expect(api.post).toHaveBeenCalledWith('creances/bulk_paiement/', payload)
            
            // Vérifier la réponse
            expect(result.total_amount).toBe('13000.00')
            expect(result.total_dettes).toBe('15000.00')
            expect(result.reste_a_payer).toBe('2000.00')
            expect(result.paiements).toHaveLength(2)
            
            // Première facture soldée
            expect(result.paiements[0].est_soldee).toBe(true)
            expect(result.paiements[0].reste_apres).toBe('0.00')
            
            // Deuxième facture partiellement payée
            expect(result.paiements[1].est_soldee).toBe(false)
            expect(result.paiements[1].reste_apres).toBe('2000.00')
        })

        it('should call API without montant_total for full payment', async () => {
            const mockResponse = {
                data: {
                    detail: 'Règlement effectué. 2 factures traitées.',
                    releve_id: 124,
                    releve_reference: 'REL-20240512-002',
                    total_amount: '15000.00',
                    total_dettes: '15000.00',
                    reste_a_payer: '0.00',
                    paiements: [
                        {
                            facture_id: 1,
                            numero_facture: 'FAC-001',
                            montant_total_facture: '10000.00',
                            montant_paye: '10000.00',
                            reste_avant: '10000.00',
                            reste_apres: '0.00',
                            est_soldee: true
                        },
                        {
                            facture_id: 2,
                            numero_facture: 'FAC-002',
                            montant_total_facture: '5000.00',
                            montant_paye: '5000.00',
                            reste_avant: '5000.00',
                            reste_apres: '0.00',
                            est_soldee: true
                        }
                    ]
                }
            }

            vi.mocked(api.post).mockResolvedValue(mockResponse)

            const payload = {
                facture_ids: [1, 2],
                mode_paiement: 'cheque',
                reference: 'Chèque 12345',
                validated_by_id: 5,
                sudo_password: 'password123'
                // Pas de montant_total = paiement complet
            }

            const result = await creanceService.bulkPaiement(payload)

            expect(api.post).toHaveBeenCalledWith('creances/bulk_paiement/', payload)
            expect(result.total_amount).toBe('15000.00')
            expect(result.reste_a_payer).toBe('0.00')
            expect(result.paiements.every(p => p.est_soldee)).toBe(true)
        })

        it('should handle API error gracefully', async () => {
            const errorResponse = {
                response: {
                    data: {
                        detail: 'Le montant (20000.00) dépasse le total des dettes (15000.00).'
                    }
                }
            }

            vi.mocked(api.post).mockRejectedValue(errorResponse)

            const payload = {
                facture_ids: [1, 2],
                mode_paiement: 'especes',
                reference: 'Trop percu',
                validated_by_id: 5,
                sudo_password: 'password123',
                montant_total: 20000 // Montant trop élevé
            }

            await expect(creanceService.bulkPaiement(payload)).rejects.toEqual(errorResponse)
        })
    })

    describe('ajouterPaiement', () => {
        it('should add single payment to creance', async () => {
            const mockResponse = {
                data: {
                    detail: 'Paiement enregistré avec succès.',
                    paiement_id: 456,
                    creance: {
                        id: 1,
                        numero_facture: 'FAC-001',
                        reste_a_payer: '5000.00'
                    }
                }
            }

            vi.mocked(api.post).mockResolvedValue(mockResponse)

            const payload = {
                mode_paiement: 'om',
                montant: 5000,
                reference: 'OM123456',
                validated_by_id: 5,
                sudo_password: 'password123'
            }

            const result = await creanceService.ajouterPaiement(1, payload)

            expect(api.post).toHaveBeenCalledWith('creances/1/ajouter_paiement/', payload)
            expect(result.paiement_id).toBe(456)
            expect(result.creance.id).toBe(1)
        })
    })

    describe('getAll', () => {
        it('should fetch creances with filters', async () => {
            const mockResponse = {
                data: {
                    results: [
                        { id: 1, numero_facture: 'FAC-001', reste_a_payer: '10000.00' },
                        { id: 2, numero_facture: 'FAC-002', reste_a_payer: '5000.00' }
                    ],
                    count: 2
                }
            }

            vi.mocked(api.get).mockResolvedValue(mockResponse)

            const filters = {
                client_id: '42',
                date_debut: '2024-01-01',
                date_fin: '2024-12-31'
            }

            const result = await creanceService.getAll(filters)

            expect(api.get).toHaveBeenCalledWith('creances/', { params: filters })
            expect(result).toHaveLength(2)
            expect(result[0].numero_facture).toBe('FAC-001')
        })

        it('should handle array response format', async () => {
            const mockResponse = {
                data: [
                    { id: 1, numero_facture: 'FAC-001' },
                    { id: 2, numero_facture: 'FAC-002' }
                ]
            }

            vi.mocked(api.get).mockResolvedValue(mockResponse)

            const result = await creanceService.getAll()

            expect(result).toHaveLength(2)
            expect(result[0].numero_facture).toBe('FAC-001')
        })
    })
})
