"""
Tests pour les suggestions de commandes (POST /api/generer-suggestions/)
et les helpers de calcul dans api.views.commandes.suggestions.

Couvre :
- Mode 'simple' (remplacement des ventes de la période)
- Mode 'intelligent' (stock min/max + tendances)
- Mode 'ventes_horaire' (tranche de dates ISO)
- Filtre fournisseur, budget_max, enrichissement promis/ruptures
- calculer_reapprovisionnement_cumulatif (schedules auto)
"""
from datetime import timedelta
from decimal import Decimal

from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from api.models import Commande, Facture, Promis, RuptureFournisseur
from api.tests.factories import TestDataFactory
from api.views.commandes.suggestions import calculer_reapprovisionnement_cumulatif

URL = '/api/generer-suggestions/'


class SuggestionsCommandeTestCase(TestCase):

    def setUp(self):
        cache.clear()
        self.api = APIClient()
        self.factory = TestDataFactory()
        self.user = self.factory.create_superuser(username='admin_sugg')
        self.api.force_authenticate(user=self.user)
        self.fournisseur = self.factory.create_fournisseur(name='Grossiste A')

    def _produit(self, name='Prod', stock=10, cost=100, fournisseur=None):
        return self.factory.create_produit(
            name=name, stock=stock, cost_price=cost, selling_price=200,
            fournisseur=fournisseur,
        )

    def _vendre(self, produit, quantity, jours_ago=1, statut=Facture.Status.VALIDEE):
        """Crée une ligne de vente sur une facture (backdatée si besoin)."""
        f = self.factory.create_facture(status=statut)
        self.factory.create_facture_produit(facture=f, produit=produit, quantity=quantity)
        if jours_ago:
            Facture.objects.filter(pk=f.pk).update(
                date=timezone.now() - timedelta(days=jours_ago)
            )
        return f

    # ------------------------------------------------------------------
    # Mode simple

    def test_simple_quantite_egale_ventes(self):
        p = self._produit(stock=3)
        self._vendre(p, 10)
        r = self.api.post(URL, {'mode': 'simple', 'periode': 30}, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['total_produits'], 1)
        s = r.data['suggestions'][0]
        self.assertEqual(s['produit_id'], p.id)
        self.assertEqual(s['quantite_suggeree'], 10)
        self.assertEqual(s['montant_ht'], 1000.0)  # 10 * 100

    def test_simple_exclut_produit_sans_vente(self):
        p = self._produit()
        self._vendre(p, 5)
        self._produit(name='Jamais vendu')
        r = self.api.post(URL, {'mode': 'simple'}, format='json')
        ids = {s['produit_id'] for s in r.data['suggestions']}
        self.assertEqual(len(ids), 1)

    def test_simple_exclut_produit_inactif(self):
        p = self._produit()
        self._vendre(p, 5)
        p.is_active = False
        p.save()
        r = self.api.post(URL, {'mode': 'simple'}, format='json')
        self.assertEqual(r.data['total_produits'], 0)

    def test_simple_exclut_ventes_brouillon(self):
        p = self._produit()
        self._vendre(p, 5, statut=Facture.Status.BROUILLON)
        r = self.api.post(URL, {'mode': 'simple'}, format='json')
        self.assertEqual(r.data['total_produits'], 0)

    def test_simple_rupture_urgence(self):
        p = self._produit(stock=0)
        self._vendre(p, 4)
        r = self.api.post(URL, {'mode': 'simple'}, format='json')
        s = r.data['suggestions'][0]
        self.assertEqual(s['urgence'], 'urgent')
        self.assertIn('RUPTURE', s['raison'])

    def test_simple_periode_limite_ventes(self):
        p = self._produit()
        self._vendre(p, 10, jours_ago=5)    # dans la fenêtre
        self._vendre(p, 20, jours_ago=60)   # hors fenêtre 30j
        r = self.api.post(URL, {'mode': 'simple', 'periode': 30}, format='json')
        s = r.data['suggestions'][0]
        self.assertEqual(s['ventes_periode'], 10)

    def test_simple_budget_max_quantite_partielle(self):
        pa = self._produit(name='A', cost=100)
        pb = self._produit(name='B', cost=100)
        self._vendre(pa, 10)  # 1000 HT
        self._vendre(pb, 5)   # 500 HT
        r = self.api.post(URL, {'mode': 'simple', 'budget_max': 1200}, format='json')
        sugg = r.data['suggestions']
        self.assertEqual(len(sugg), 2)
        # B est tronqué à 2 unités (200 F) pour rester dans le budget
        b = next(s for s in sugg if s['produit_id'] == pb.id)
        self.assertEqual(b['quantite_suggeree'], 2)
        self.assertEqual(r.data['total_ht'], 1200.0)

    def test_simple_filtre_fournisseur(self):
        autre_f = self.factory.create_fournisseur(name='Grossiste B')
        p1 = self._produit(name='F1', fournisseur=self.fournisseur)
        p2 = self._produit(name='F2', fournisseur=autre_f)
        self._vendre(p1, 3)
        self._vendre(p2, 7)
        r = self.api.post(URL, {
            'mode': 'simple', 'fournisseur_id': self.fournisseur.id,
        }, format='json')
        ids = {s['produit_id'] for s in r.data['suggestions']}
        self.assertIn(p1.id, ids)
        self.assertNotIn(p2.id, ids)

    # ------------------------------------------------------------------
    # Mode ventes_horaire

    def test_ventes_horaire_dates_requises(self):
        r = self.api.post(URL, {'mode': 'ventes_horaire'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_ventes_horaire_compte_dans_la_tranche(self):
        p = self._produit()
        self._vendre(p, 6, jours_ago=0)    # aujourd'hui
        self._vendre(p, 10, jours_ago=40)  # hors tranche
        debut = (timezone.now() - timedelta(hours=2)).isoformat()
        fin = (timezone.now() + timedelta(hours=1)).isoformat()
        r = self.api.post(URL, {
            'mode': 'ventes_horaire', 'date_debut': debut, 'date_fin': fin,
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        s = r.data['suggestions'][0]
        self.assertEqual(s['ventes_periode'], 6)
        self.assertEqual(s['quantite_suggeree'], 6)

    # ------------------------------------------------------------------
    # Mode intelligent

    def test_intelligent_rupture_suggere_reassort(self):
        p = self._produit(stock=0)
        self._vendre(p, 20, jours_ago=10)
        r = self.api.post(URL, {'mode': 'intelligent', 'periode': 30}, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        s = next(x for x in r.data['suggestions'] if x['produit_id'] == p.id)
        self.assertEqual(s['urgence'], 'urgent')
        self.assertGreater(s['quantite_suggeree'], 0)
        self.assertIn('RUPTURE', s['raison'])

    def test_intelligent_stock_suffisant_non_suggere(self):
        p = self._produit(stock=500)
        self._vendre(p, 10, jours_ago=10)
        r = self.api.post(URL, {'mode': 'intelligent', 'periode': 30}, format='json')
        ids = {s['produit_id'] for s in r.data['suggestions']}
        self.assertNotIn(p.id, ids)

    # ------------------------------------------------------------------
    # Enrichissement promis / ruptures fournisseur

    def test_enrichissement_promis_et_rupture(self):
        p = self._produit(stock=0)
        self._vendre(p, 3)
        Promis.objects.create(produit=p, quantite=5, status=Promis.Status.EN_ATTENTE)
        Promis.objects.create(produit=p, quantite=2, status=Promis.Status.DELIVRE)  # ignoré
        RuptureFournisseur.objects.create(produit=p, est_resolu=False)
        RuptureFournisseur.objects.create(produit=p, est_resolu=True)  # ignorée

        r = self.api.post(URL, {'mode': 'simple'}, format='json')
        s = r.data['suggestions'][0]
        self.assertEqual(s['promis_count'], 5)
        self.assertTrue(s['en_rupture_fournisseur'])

    # ------------------------------------------------------------------
    # Cache + sécurité

    def test_reponse_mise_en_cache(self):
        p = self._produit()
        self._vendre(p, 5)
        r1 = self.api.post(URL, {'mode': 'simple'}, format='json')
        # Une vente supplémentaire ne doit pas apparaître (cache 5 min)
        self._vendre(p, 99)
        r2 = self.api.post(URL, {'mode': 'simple'}, format='json')
        s1 = r1.data['suggestions'][0]
        s2 = r2.data['suggestions'][0]
        self.assertEqual(s1['ventes_periode'], s2['ventes_periode'])

    def test_non_authentifie_refuse(self):
        r = APIClient().post(URL, {'mode': 'simple'}, format='json')
        self.assertIn(r.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    # ------------------------------------------------------------------
    # Cumulatif (schedules auto)

    def test_cumulatif_fallback_periode(self):
        """Sans commande auto, on compte les ventes de la période de fallback."""
        p = self._produit(fournisseur=self.fournisseur)
        self._vendre(p, 8, jours_ago=10)
        self._vendre(p, 50, jours_ago=100)  # hors fallback 30j
        suggestions, total_ht = calculer_reapprovisionnement_cumulatif(
            self.fournisseur.id, periode_fallback=30
        )
        self.assertEqual(len(suggestions), 1)
        self.assertEqual(suggestions[0]['quantite_suggeree'], 8)

    def test_cumulatif_depuis_derniere_commande_auto(self):
        """Après une commande AUTO, seules les ventes postérieures comptent."""
        p = self._produit(fournisseur=self.fournisseur)
        # Commande auto il y a 5 jours
        cmd = self.factory.create_commande(fournisseur=self.fournisseur)
        cmd.source = Commande.Source.AUTO_SCHEDULE
        cmd.save()
        Commande.objects.filter(pk=cmd.pk).update(
            date=timezone.now() - timedelta(days=5)
        )
        self._vendre(p, 7, jours_ago=2)    # après la commande auto
        self._vendre(p, 30, jours_ago=10)  # avant la commande auto
        suggestions, _ = calculer_reapprovisionnement_cumulatif(
            self.fournisseur.id, periode_fallback=30
        )
        self.assertEqual(len(suggestions), 1)
        self.assertEqual(suggestions[0]['quantite_suggeree'], 7)
