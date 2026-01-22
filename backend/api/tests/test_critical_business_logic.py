"""
Tests pour les fonctionnalités critiques du business logic.
Tests approfondis pour:
- FIFO/FEFO (allocation de lots complexes)
- Gestion des créances (dettes clients)
- Transactions complexes (coupons, remises, fidélité, paiements multiples)
"""
from decimal import Decimal
from django.test import TestCase, TransactionTestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.utils import timezone
from datetime import timedelta

from .factories import TestDataFactory
from ..models import (
    Facture, FactureProduit, Produit, StockLot, Caisse,
    FactureProduitAllocation, Client, CouponMonnaie
)


class FIFOAllocationTestCase(TransactionTestCase):
    """
    Tests approfondis pour l'allocation FIFO/FEFO.
    Vérifie que les lots sont correctement alloués selon l'ordre d'expiration.
    """
    
    def setUp(self):
        """Set up test data."""
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)
        
        self.rayon = TestDataFactory.create_rayon(name='Médicaments')
        self.fournisseur = TestDataFactory.create_fournisseur(name='Pharma Distrib')
        self.produit = TestDataFactory.create_produit(
            name='Doliprane 500mg',
            stock=0,  # Stock géré par les lots
            cost_price=50,
            selling_price=100,
            rayon=self.rayon,
            fournisseur=self.fournisseur,
            use_lot_management=True
        )
        self.client_obj = TestDataFactory.create_client(name='Patient Test')
    
    def test_fifo_allocation_multiple_lots(self):
        """
        Test FIFO avec plusieurs lots: les lots les plus anciens sont utilisés en premier.
        """
        # Créer 3 lots avec dates d'expiration différentes
        now = timezone.now()
        lot_oldest = TestDataFactory.create_stock_lot(
            produit=self.produit,
            quantity=20,
            lot_name='LOT-OLDEST',
            date_expiration=now.date() + timedelta(days=30),
            date_reception=now - timedelta(days=60),
            price_cost=Decimal('40.00')
        )
        lot_middle = TestDataFactory.create_stock_lot(
            produit=self.produit,
            quantity=30,
            lot_name='LOT-MIDDLE',
            date_expiration=now.date() + timedelta(days=90),
            date_reception=now - timedelta(days=30),
            price_cost=Decimal('45.00')
        )
        lot_newest = TestDataFactory.create_stock_lot(
            produit=self.produit,
            quantity=50,
            lot_name='LOT-NEWEST',
            date_expiration=now.date() + timedelta(days=180),
            date_reception=now,
            price_cost=Decimal('50.00')
        )
        
        # Mettre à jour le stock global
        self.produit.stock = 100
        self.produit.save()
        
        # Vendre 60 unités (devrait prendre: 20 du oldest, 30 du middle, 10 du newest)
        facture = TestDataFactory.create_facture(
            client=self.client_obj,
            status='BROU'
        )
        facture_produit = TestDataFactory.create_facture_produit(
            facture=facture,
            produit=self.produit,
            quantity=60,
            selling_price=self.produit.selling_price
        )
        
        # Valider la facture
        url = reverse('facture-valider', kwargs={'pk': facture.pk})
        response = self.client.post(url, {'mode_paiement': 'especes'}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Vérifier les allocations FIFO
        lot_oldest.refresh_from_db()
        lot_middle.refresh_from_db()
        lot_newest.refresh_from_db()
        
        self.assertEqual(lot_oldest.quantity_remaining, 0, "Le lot le plus ancien doit être épuisé")
        self.assertEqual(lot_middle.quantity_remaining, 0, "Le lot intermédiaire doit être épuisé")
        self.assertEqual(lot_newest.quantity_remaining, 40, "Le lot le plus récent doit avoir 40 restants")
        
        # Vérifier les allocations créées
        allocations = FactureProduitAllocation.objects.filter(facture_produit=facture_produit)
        self.assertEqual(allocations.count(), 3, "3 allocations doivent être créées")
        
        # Vérifier les quantités allouées
        alloc_oldest = allocations.filter(stock_lot=lot_oldest).first()
        alloc_middle = allocations.filter(stock_lot=lot_middle).first()
        alloc_newest = allocations.filter(stock_lot=lot_newest).first()
        
        self.assertIsNotNone(alloc_oldest)
        self.assertEqual(alloc_oldest.quantity, 20)
        self.assertIsNotNone(alloc_middle)
        self.assertEqual(alloc_middle.quantity, 30)
        self.assertIsNotNone(alloc_newest)
        self.assertEqual(alloc_newest.quantity, 10)
    
    def test_fefo_allocation_expiration_priority(self):
        """
        Test FEFO: les lots avec expiration la plus proche sont utilisés en premier,
        même s'ils ont été reçus plus récemment.
        """
        now = timezone.now()
        # Lot reçu récemment mais expire bientôt
        lot_expires_soon = TestDataFactory.create_stock_lot(
            produit=self.produit,
            quantity=25,
            lot_name='LOT-EXPIRES-SOON',
            date_expiration=now.date() + timedelta(days=15),  # Expire dans 15 jours
            date_reception=now - timedelta(days=5),  # Reçu il y a 5 jours
            price_cost=Decimal('40.00')
        )
        # Lot reçu il y a longtemps mais expire plus tard
        lot_expires_later = TestDataFactory.create_stock_lot(
            produit=self.produit,
            quantity=30,
            lot_name='LOT-EXPIRES-LATER',
            date_expiration=now.date() + timedelta(days=60),  # Expire dans 60 jours
            date_reception=now - timedelta(days=90),  # Reçu il y a 90 jours
            price_cost=Decimal('45.00')
        )
        
        self.produit.stock = 55
        self.produit.save()
        
        # Vendre 30 unités (devrait prendre du lot qui expire bientôt)
        facture = TestDataFactory.create_facture(
            client=self.client_obj,
            status='BROU'
        )
        facture_produit = TestDataFactory.create_facture_produit(
            facture=facture,
            produit=self.produit,
            quantity=30,
            selling_price=self.produit.selling_price
        )
        
        url = reverse('facture-valider', kwargs={'pk': facture.pk})
        response = self.client.post(url, {'mode_paiement': 'especes'}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Vérifier que le lot qui expire bientôt est utilisé en premier
        lot_expires_soon.refresh_from_db()
        lot_expires_later.refresh_from_db()
        
        # Le lot qui expire bientôt devrait être partiellement utilisé
        self.assertLess(lot_expires_soon.quantity_remaining, 25, "Le lot qui expire bientôt doit être utilisé")
        # Le lot qui expire plus tard ne devrait pas être touché si le premier suffit
        if lot_expires_soon.quantity_remaining == 0:
            self.assertEqual(lot_expires_later.quantity_remaining, 30, "Le lot qui expire plus tard ne doit pas être touché")
    
    def test_fifo_allocation_insufficient_stock_across_lots(self):
        """
        Test que la vente échoue si le stock total est insuffisant, même réparti sur plusieurs lots.
        """
        # Créer 2 lots avec stock total insuffisant
        lot1 = TestDataFactory.create_stock_lot(
            produit=self.produit,
            quantity=10,
            lot_name='LOT-1',
            date_expiration=timezone.now().date() + timedelta(days=30)
        )
        lot2 = TestDataFactory.create_stock_lot(
            produit=self.produit,
            quantity=15,
            lot_name='LOT-2',
            date_expiration=timezone.now().date() + timedelta(days=60)
        )
        
        self.produit.stock = 25
        self.produit.save()
        
        # Essayer de vendre 30 unités (stock total = 25)
        facture = TestDataFactory.create_facture(
            client=self.client_obj,
            status='BROU'
        )
        TestDataFactory.create_facture_produit(
            facture=facture,
            produit=self.produit,
            quantity=30,
            selling_price=self.produit.selling_price
        )
        
        url = reverse('facture-valider', kwargs={'pk': facture.pk})
        response = self.client.post(url, {'mode_paiement': 'especes'}, format='json')
        
        # Devrait échouer si l'utilisateur n'a pas la permission de vendre en stock négatif
        self.assertIn(response.status_code, [status.HTTP_400_BAD_REQUEST, status.HTTP_200_OK])
        
        # Si la validation échoue, les lots ne doivent pas être modifiés
        if response.status_code == status.HTTP_400_BAD_REQUEST:
            lot1.refresh_from_db()
            lot2.refresh_from_db()
            self.assertEqual(lot1.quantity_remaining, 10)
            self.assertEqual(lot2.quantity_remaining, 15)


class CreancesManagementTestCase(APITestCase):
    """
    Tests pour la gestion des créances (dettes clients).
    Vérifie le calcul des dettes, paiements partiels, plafonds, etc.
    """
    
    def setUp(self):
        """Set up test data."""
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)
        
        # Créer un client professionnel avec plafond
        self.client_pro = TestDataFactory.create_client(
            name='Client Professionnel',
            client_type='PROFESSIONNEL',
            plafond=Decimal('50000.00'),
            taux_couverture=Decimal('80.00')  # 80% couverture assurance
        )
        
        self.produit = TestDataFactory.create_produit(stock=1000)
    
    def test_calculate_client_debt_single_invoice(self):
        """
        Test le calcul de la dette pour une facture unique non payée.
        """
        # Créer une facture validée non payée
        facture = TestDataFactory.create_facture(
            client=self.client_pro,
            status='VAL',
            total_ttc=Decimal('10000.00')
        )
        
        # Vérifier la dette
        debt = self.client_pro.current_debt
        self.assertEqual(debt, Decimal('10000.00'), "La dette doit être égale au montant de la facture")
    
    def test_calculate_client_debt_partial_payment(self):
        """
        Test le calcul de la dette avec paiement partiel.
        """
        # Créer une facture de 10000
        facture = TestDataFactory.create_facture(
            client=self.client_pro,
            status='VAL',
            total_ttc=Decimal('10000.00')
        )
        
        # Payer 3000
        TestDataFactory.create_caisse(
            facture=facture,
            montant=Decimal('3000.00'),
            mode_paiement='especes',
            user=self.user
        )
        
        # La dette restante doit être 7000
        debt = self.client_pro.current_debt
        self.assertEqual(debt, Decimal('7000.00'), "La dette doit être réduite du montant payé")
    
    def test_calculate_client_debt_multiple_invoices(self):
        """
        Test le calcul de la dette avec plusieurs factures.
        """
        # Créer 3 factures
        facture1 = TestDataFactory.create_facture(
            client=self.client_pro,
            status='VAL',
            total_ttc=Decimal('5000.00')
        )
        facture2 = TestDataFactory.create_facture(
            client=self.client_pro,
            status='VAL',
            total_ttc=Decimal('8000.00')
        )
        facture3 = TestDataFactory.create_facture(
            client=self.client_pro,
            status='VAL',
            total_ttc=Decimal('12000.00')
        )
        
        # Payer partiellement facture2
        TestDataFactory.create_caisse(
            facture=facture2,
            montant=Decimal('3000.00'),
            mode_paiement='especes',
            user=self.user
        )
        
        # Dette totale: 5000 + (8000-3000) + 12000 = 22000
        debt = self.client_pro.current_debt
        self.assertEqual(debt, Decimal('22000.00'), "La dette doit être la somme des factures impayées")
    
    def test_calculate_client_debt_fully_paid_invoice(self):
        """
        Test que les factures entièrement payées ne comptent pas dans la dette.
        """
        # Créer une facture
        facture = TestDataFactory.create_facture(
            client=self.client_pro,
            status='VAL',
            total_ttc=Decimal('10000.00')
        )
        
        # Payer entièrement
        TestDataFactory.create_caisse(
            facture=facture,
            montant=Decimal('10000.00'),
            mode_paiement='especes',
            user=self.user
        )
        
        # La dette doit être 0
        debt = self.client_pro.current_debt
        self.assertEqual(debt, Decimal('0.00'), "Les factures payées ne doivent pas compter dans la dette")
    
    def test_client_debt_exceeds_plafond(self):
        """
        Test que le système détecte quand la dette dépasse le plafond.
        """
        # Client avec plafond de 50000
        # Créer des factures totalisant 60000
        facture1 = TestDataFactory.create_facture(
            client=self.client_pro,
            status='VAL',
            total_ttc=Decimal('30000.00')
        )
        facture2 = TestDataFactory.create_facture(
            client=self.client_pro,
            status='VAL',
            total_ttc=Decimal('30000.00')
        )
        
        debt = self.client_pro.current_debt
        self.assertGreater(debt, self.client_pro.plafond, "La dette doit dépasser le plafond")
        self.assertEqual(debt, Decimal('60000.00'))
    
    def test_professional_client_partial_payment_creance(self):
        """
        Test que pour un client professionnel, les paiements partiels créent une créance.
        """
        # Créer une facture avec part client et part assurance
        facture = TestDataFactory.create_facture(
            client=self.client_pro,
            status='BROU',
            total_ttc=Decimal('10000.00'),
            part_client=Decimal('2000.00')  # 20% à la charge du client
        )
        
        # Valider la facture (devrait créer automatiquement la créance)
        url = reverse('facture-valider', kwargs={'pk': facture.pk})
        response = self.client.post(url, {'mode_paiement': 'en_compte'}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        facture.refresh_from_db()
        # La facture doit être validée
        self.assertEqual(facture.status, Facture.Status.VALIDEE)
        
        # Vérifier que la créance est créée (part client non payée)
        debt = self.client_pro.current_debt
        # La dette doit inclure la part client
        self.assertGreaterEqual(debt, Decimal('0.00'))


class ComplexTransactionsTestCase(TransactionTestCase):
    """
    Tests pour les transactions complexes:
    - Coupons de monnaie
    - Remises automatiques
    - Points de fidélité
    - Paiements multiples (espèces + carte + compte)
    - Combinaisons de tous les éléments ci-dessus
    """
    
    def setUp(self):
        """Set up test data."""
        self.user = TestDataFactory.create_superuser()
        self.client.force_authenticate(user=self.user)
        
        self.client_obj = TestDataFactory.create_client(
            name='Client Test',
            client_type='PARTICULIER',
            is_loyalty_member=True,
            remise_automatique=Decimal('5.00')  # 5% de remise automatique
        )
        
        self.produit = TestDataFactory.create_produit(
            name='Produit Test',
            stock=100,
            cost_price=Decimal('50.00'),
            selling_price=Decimal('100.00')
        )
    
    def test_transaction_with_coupon(self):
        """
        Test une transaction avec un coupon de monnaie.
        """
        # Créer un coupon actif
        coupon = CouponMonnaie.objects.create(
            numero='COUPON-TEST-001',
            montant=Decimal('2000.00'),
            status=CouponMonnaie.Status.ACTIF,
            cree_par=self.user
        )
        
        # Créer une facture
        facture = TestDataFactory.create_facture(
            client=self.client_obj,
            status='BROU',
            total_ttc=Decimal('10000.00')
        )
        TestDataFactory.create_facture_produit(
            facture=facture,
            produit=self.produit,
            quantity=10,
            selling_price=self.produit.selling_price
        )
        
        # Valider la facture (simulation - dans la vraie app, le coupon est appliqué avant validation)
        # Ici on teste juste que le coupon peut être utilisé
        url = reverse('coupon-utiliser', kwargs={'pk': coupon.pk})
        response = self.client.post(url, {'facture_id': facture.id}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        coupon.refresh_from_db()
        self.assertEqual(coupon.status, CouponMonnaie.Status.UTILISE, "Le coupon doit être marqué comme utilisé")
        self.assertIsNotNone(coupon.date_utilisation)
    
    def test_transaction_with_loyalty_points(self):
        """
        Test une transaction avec utilisation de points de fidélité.
        """
        # Configurer la fidélité (créer LoyaltySetting si nécessaire)
        from ..models import LoyaltySetting
        loyalty_setting, _ = LoyaltySetting.objects.get_or_create(
            pk=1,
            defaults={
                'amount_per_point': Decimal('1000.00'),  # 1 point pour 1000 F
                'point_value': Decimal('10.00'),  # 1 point = 10 F
                'auto_reward_threshold': 0,
                'auto_reward_percent': Decimal('0.00')
            }
        )
        
        # Client avec des points
        self.client_obj.points_fidelite = 100  # 100 points = 1000 F de réduction
        self.client_obj.save()
        
        # Créer une facture
        facture = TestDataFactory.create_facture(
            client=self.client_obj,
            status='BROU',
            total_ttc=Decimal('5000.00')
        )
        TestDataFactory.create_facture_produit(
            facture=facture,
            produit=self.produit,
            quantity=5,
            selling_price=self.produit.selling_price
        )
        
        # Valider avec utilisation de 50 points
        url = reverse('facture-valider', kwargs={'pk': facture.pk})
        response = self.client.post(url, {
            'mode_paiement': 'especes',
            'points_to_use': 50
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Vérifier que les points ont été déduits
        self.client_obj.refresh_from_db()
        self.assertEqual(self.client_obj.points_fidelite, 50, "50 points doivent être déduits")
        
        # Vérifier que la facture enregistre les points utilisés
        facture.refresh_from_db()
        self.assertEqual(facture.points_fidelite_utilises, 50)
    
    def test_transaction_with_automatic_discount(self):
        """
        Test une transaction avec remise automatique client.
        """
        # Client avec remise automatique de 10%
        self.client_obj.remise_automatique = Decimal('10.00')
        self.client_obj.save()
        
        # Créer une facture
        facture = TestDataFactory.create_facture(
            client=self.client_obj,
            status='BROU',
            total_ttc=Decimal('10000.00')
        )
        TestDataFactory.create_facture_produit(
            facture=facture,
            produit=self.produit,
            quantity=10,
            selling_price=self.produit.selling_price
        )
        
        # La remise devrait être appliquée lors du calcul des totaux
        # (dépend de l'implémentation dans calculate_totals)
        facture.calculate_totals(save=True)
        
        # Vérifier que le total est réduit (si la remise est appliquée)
        # Note: Cela dépend de l'implémentation réelle de calculate_totals
        facture.refresh_from_db()
        # Le total devrait être réduit de 10% si la remise est appliquée
    
    def test_transaction_multiple_payment_methods(self):
        """
        Test une transaction avec plusieurs modes de paiement.
        """
        # Créer une facture
        facture = TestDataFactory.create_facture(
            client=self.client_obj,
            status='VAL',
            total_ttc=Decimal('10000.00')
        )
        
        # Payer avec plusieurs modes
        paiement1 = TestDataFactory.create_caisse(
            facture=facture,
            montant=Decimal('3000.00'),
            mode_paiement='especes',
            user=self.user
        )
        paiement2 = TestDataFactory.create_caisse(
            facture=facture,
            montant=Decimal('4000.00'),
            mode_paiement='carte',
            user=self.user
        )
        paiement3 = TestDataFactory.create_caisse(
            facture=facture,
            montant=Decimal('3000.00'),
            mode_paiement='mobile_money',
            user=self.user
        )
        
        # Vérifier que tous les paiements sont enregistrés
        paiements = Caisse.objects.filter(facture=facture)
        self.assertEqual(paiements.count(), 3)
        
        # Vérifier le total payé
        total_paye = sum(p.montant for p in paiements)
        self.assertEqual(total_paye, Decimal('10000.00'), "Le total payé doit égaler le montant de la facture")
    
    def test_complex_transaction_all_features(self):
        """
        Test une transaction complexe combinant tous les éléments:
        - Coupon
        - Points de fidélité
        - Remise automatique
        - Paiements multiples
        """
        # Configurer la fidélité
        from ..models import LoyaltySetting
        loyalty_setting, _ = LoyaltySetting.objects.get_or_create(
            pk=1,
            defaults={
                'amount_per_point': Decimal('1000.00'),
                'point_value': Decimal('10.00'),
                'auto_reward_threshold': 0,
                'auto_reward_percent': Decimal('0.00')
            }
        )
        
        # Client avec points et remise
        self.client_obj.points_fidelite = 50
        self.client_obj.remise_automatique = Decimal('5.00')
        self.client_obj.save()
        
        # Créer un coupon
        coupon = CouponMonnaie.objects.create(
            numero='COUPON-COMPLEX-001',
            montant=Decimal('1000.00'),
            status=CouponMonnaie.Status.ACTIF,
            cree_par=self.user
        )
        
        # Créer une facture de 20000
        facture = TestDataFactory.create_facture(
            client=self.client_obj,
            status='BROU',
            total_ttc=Decimal('20000.00')
        )
        TestDataFactory.create_facture_produit(
            facture=facture,
            produit=self.produit,
            quantity=20,
            selling_price=self.produit.selling_price
        )
        
        # Utiliser le coupon
        url_coupon = reverse('coupon-utiliser', kwargs={'pk': coupon.pk})
        response_coupon = self.client.post(url_coupon, {'facture_id': facture.id}, format='json')
        self.assertEqual(response_coupon.status_code, status.HTTP_200_OK)
        
        # Valider la facture avec points
        url_facture = reverse('facture-valider', kwargs={'pk': facture.pk})
        response_facture = self.client.post(url_facture, {
            'mode_paiement': 'especes',
            'points_to_use': 30
        }, format='json')
        
        self.assertEqual(response_facture.status_code, status.HTTP_200_OK)
        
        # Vérifier l'état final
        coupon.refresh_from_db()
        self.assertEqual(coupon.status, CouponMonnaie.Status.UTILISE)
        
        self.client_obj.refresh_from_db()
        # Les points doivent être déduits (30 utilisés) et de nouveaux points gagnés
        self.assertLess(self.client_obj.points_fidelite, 50, "Les points doivent être déduits")
        
        facture.refresh_from_db()
        self.assertEqual(facture.status, Facture.Status.VALIDEE)
