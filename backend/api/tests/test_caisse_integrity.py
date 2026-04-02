from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from decimal import Decimal
from api.models import (
    Facture, Caisse, MouvementCaisse
)

class CaisseIntegrityTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(username='admin', password='password', email='admin@test.com')
        self.client_api = APIClient()
        self.client_api.force_authenticate(user=self.user)
        
        # 1. Facture payée en espèces (1000F)
        self.facture1 = Facture.objects.create(
            total_ttc=Decimal('1000.00'),
            status=Facture.Status.PAYEE,
            created_by=self.user
        )
        Caisse.objects.create(
            facture=self.facture1,
            montant=Decimal('1000.00'),
            mode_paiement='especes',
            statut='completee',
            user=self.user
        )

        # 2. Facture de recouvrement de créance (500F payé aujourd'hui pour une dette passée)
        self.facture2 = Facture.objects.create(
            total_ttc=Decimal('5000.00'),
            status=Facture.Status.VALIDEE,
            created_by=self.user
        )
        # On simule un paiement de type recouvrement (indépendant de la vente du jour)
        Caisse.objects.create(
            facture=self.facture2,
            montant=Decimal('500.00'),
            mode_paiement='especes',
            reference='[RECOUV] Paiement partiel',
            statut='completee',
            user=self.user
        )

        # 3. Une sortie de caisse (200F)
        MouvementCaisse.objects.create(
            type='SORTIE',
            montant=Decimal('200.00'),
            motif='Achat café',
            user=self.user
        )

    def test_encaissements_par_mode_consolidated(self):
        """Vérifie que les détails par mode incluent ventes + recouvrements."""
        
        # 1. Vente OM (1000F)
        f_om = Facture.objects.create(total_ttc=Decimal('1000.00'), status=Facture.Status.PAYEE, created_by=self.user)
        Caisse.objects.create(facture=f_om, montant=Decimal('1000.00'), mode_paiement='om', statut='completee', user=self.user)
        
        # 2. Recouvrement OM (500F)
        f_debt = Facture.objects.create(total_ttc=Decimal('5000.00'), status=Facture.Status.VALIDEE, created_by=self.user)
        Caisse.objects.create(facture=f_debt, montant=Decimal('500.00'), mode_paiement='om', reference='[RECOUV]', statut='completee', user=self.user)
        
        # Action : Récupérer les totaux
        url = '/api/caisse/get_totals/'
        response = self.client_api.get(url)
        data = response.data
        
        # Le détail OM actuel renverrait 1000F (que la vente). 
        # On VEUT 1500F (Vente + Recouvrement).
        self.assertEqual(float(data['details']['om']), 1500.00, 
                         f"Erreur: le détail OM est de {data['details']['om']} au lieu de 1500F (1000 vente + 500 recouvrement)")
