"""
Tests pour api/views/commandes/commande_produits.py (CommandeProduitViewSet).

Couvre :
- Permissions (401 anonyme, acces utilisateur authentifie)
- CRUD : list / retrieve / create / update / partial_update / destroy
- perform_create : mise a jour du prix de vente du produit
- Blocage des modifications sur commande cloturee (update/patch/delete/create)
- get_queryset : filtre ?produit= limite aux commandes CLOT
- bulk_sync : validation, creation, update, delete, warnings, parsing dates
- correct_lot : correction lot/date, mise a jour du StockLot associe
"""
from datetime import date
from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from ..models import Commande, CommandeProduit
from .factories import TestDataFactory as F

ADMIN_PWD = 'adminpass123'


class CommandeProduitBase(TestCase):
    def setUp(self):
        self.client_api = APIClient()
        self.admin = F.create_superuser(password=ADMIN_PWD)
        self.client_api.force_authenticate(user=self.admin)
        self.fournisseur = F.create_fournisseur()
        self.produit = F.create_produit(
            name='Produit Test', stock=10,
            cost_price=500, selling_price=1000,
            fournisseur=self.fournisseur,
        )
        self.commande = F.create_commande(fournisseur=self.fournisseur, status='PREP')


# ── Permissions ───────────────────────────────────────────────────────────────

class CommandeProduitAccessTest(CommandeProduitBase):
    def test_anonyme_list_401(self):
        resp = APIClient().get(reverse('commandeproduit-list'))
        self.assertIn(resp.status_code, (401, 403))

    def test_anonyme_bulk_sync_401(self):
        resp = APIClient().post(
            reverse('commandeproduit-bulk-sync'), {}, format='json',
        )
        self.assertIn(resp.status_code, (401, 403))

    def test_anonyme_correct_lot_401(self):
        ligne = F.create_commande_produit(self.commande, self.produit, quantity=1)
        resp = APIClient().patch(
            reverse('commandeproduit-correct-lot', kwargs={'pk': ligne.pk}),
            {'lot': 'X'}, format='json',
        )
        self.assertIn(resp.status_code, (401, 403))

    def test_user_non_privilegie_acces_autorise(self):
        """Le ViewSet n'exige que IsAuthenticated : un user simple passe."""
        user = F.create_user()
        client = APIClient()
        client.force_authenticate(user=user)
        resp = client.get(reverse('commandeproduit-list'))
        self.assertEqual(resp.status_code, 200)


# ── CRUD ──────────────────────────────────────────────────────────────────────

class CommandeProduitCRUDTest(CommandeProduitBase):
    def test_list_paginee(self):
        F.create_commande_produit(self.commande, self.produit, quantity=5)
        F.create_commande_produit(self.commande, F.create_produit(), quantity=2)

        resp = self.client_api.get(reverse('commandeproduit-list'))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['count'], 2)
        self.assertEqual(len(resp.data['results']), 2)

    def test_retrieve(self):
        ligne = F.create_commande_produit(
            self.commande, self.produit, quantity=7, price_cost=450,
        )
        resp = self.client_api.get(
            reverse('commandeproduit-detail', kwargs={'pk': ligne.pk}),
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['id'], ligne.pk)
        self.assertEqual(resp.data['quantity'], 7)
        self.assertEqual(resp.data['produit_nom'], 'Produit Test')

    def test_create(self):
        resp = self.client_api.post(reverse('commandeproduit-list'), {
            'commande': self.commande.id,
            'produit': self.produit.id,
            'quantity': 10,
            'price': 480,
            'price_cost': 480,
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        ligne = CommandeProduit.objects.get()
        self.assertEqual(ligne.commande, self.commande)
        self.assertEqual(ligne.quantity, 10)
        self.assertEqual(ligne.price, Decimal('480'))

    def test_create_met_a_jour_prix_vente_produit(self):
        """perform_create : selling_price du payload met a jour le produit."""
        resp = self.client_api.post(reverse('commandeproduit-list'), {
            'commande': self.commande.id,
            'produit': self.produit.id,
            'quantity': 1,
            'price': 500,
            'price_cost': 500,
            'selling_price': 1250,
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        self.produit.refresh_from_db()
        self.assertEqual(self.produit.selling_price, Decimal('1250'))

    def test_create_sans_selling_price_ne_touche_pas_au_produit(self):
        resp = self.client_api.post(reverse('commandeproduit-list'), {
            'commande': self.commande.id,
            'produit': self.produit.id,
            'quantity': 1,
            'price': 500,
            'price_cost': 500,
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        self.produit.refresh_from_db()
        self.assertEqual(self.produit.selling_price, Decimal('1000'))

    def test_create_price_cost_negatif_400(self):
        resp = self.client_api.post(reverse('commandeproduit-list'), {
            'commande': self.commande.id,
            'produit': self.produit.id,
            'quantity': 1,
            'price': 500,
            'price_cost': -5,
        }, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(CommandeProduit.objects.count(), 0)

    def test_create_donnee_incomplete_400(self):
        resp = self.client_api.post(reverse('commandeproduit-list'), {
            'commande': self.commande.id,
        }, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_partial_update(self):
        ligne = F.create_commande_produit(self.commande, self.produit, quantity=5)
        resp = self.client_api.patch(
            reverse('commandeproduit-detail', kwargs={'pk': ligne.pk}),
            {'quantity': 42, 'lot': 'LOT-A'}, format='json',
        )
        self.assertEqual(resp.status_code, 200)
        ligne.refresh_from_db()
        self.assertEqual(ligne.quantity, 42)
        self.assertEqual(ligne.lot, 'LOT-A')

    def test_update_put(self):
        ligne = F.create_commande_produit(self.commande, self.produit, quantity=5)
        resp = self.client_api.put(
            reverse('commandeproduit-detail', kwargs={'pk': ligne.pk}),
            {
                'commande': self.commande.id,
                'produit': self.produit.id,
                'quantity': 9,
                'price': 600,
                'price_cost': 600,
            }, format='json',
        )
        self.assertEqual(resp.status_code, 200)
        ligne.refresh_from_db()
        self.assertEqual(ligne.quantity, 9)
        self.assertEqual(ligne.price, Decimal('600'))

    def test_destroy(self):
        ligne = F.create_commande_produit(self.commande, self.produit, quantity=5)
        resp = self.client_api.delete(
            reverse('commandeproduit-detail', kwargs={'pk': ligne.pk}),
        )
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(CommandeProduit.objects.filter(pk=ligne.pk).exists())


# ── Commande cloturee : blocage des modifications ─────────────────────────────

class CommandeProduitClotureeTest(CommandeProduitBase):
    def setUp(self):
        super().setUp()
        self.commande.status = Commande.Status.CLOTUREE
        self.commande.save()
        self.ligne = F.create_commande_produit(
            self.commande, self.produit, quantity=5,
        )

    def test_patch_bloque_403(self):
        resp = self.client_api.patch(
            reverse('commandeproduit-detail', kwargs={'pk': self.ligne.pk}),
            {'quantity': 99}, format='json',
        )
        self.assertEqual(resp.status_code, 403)
        self.ligne.refresh_from_db()
        self.assertEqual(self.ligne.quantity, 5)

    def test_put_bloque_403(self):
        resp = self.client_api.put(
            reverse('commandeproduit-detail', kwargs={'pk': self.ligne.pk}),
            {
                'commande': self.commande.id,
                'produit': self.produit.id,
                'quantity': 9,
                'price': 1,
                'price_cost': 1,
            }, format='json',
        )
        self.assertEqual(resp.status_code, 403)

    def test_destroy_bloque_403(self):
        resp = self.client_api.delete(
            reverse('commandeproduit-detail', kwargs={'pk': self.ligne.pk}),
        )
        self.assertEqual(resp.status_code, 403)
        self.assertTrue(CommandeProduit.objects.filter(pk=self.ligne.pk).exists())

    def test_create_bloque_sur_commande_cloturee(self):
        """Creer une ligne sur une commande CLOT doit etre refuse (coherence
        avec update/delete et bulk_sync qui bloquent deja)."""
        resp = self.client_api.post(reverse('commandeproduit-list'), {
            'commande': self.commande.id,
            'produit': self.produit.id,
            'quantity': 1,
            'price': 100,
            'price_cost': 100,
        }, format='json')
        self.assertEqual(resp.status_code, 403)
        # Seule la ligne de setUp existe
        self.assertEqual(CommandeProduit.objects.count(), 1)


# ── get_queryset : filtre par produit ─────────────────────────────────────────

class CommandeProduitQuerysetTest(CommandeProduitBase):
    def test_filtre_produit_limite_aux_commandes_clot(self):
        """?produit=X ne retourne que les lignes de commandes CLOT."""
        commande_clot = F.create_commande(status='CLOT')
        ligne_clot = F.create_commande_produit(
            commande_clot, self.produit, quantity=3,
        )
        F.create_commande_produit(self.commande, self.produit, quantity=5)

        resp = self.client_api.get(
            reverse('commandeproduit-list'), {'produit': self.produit.id},
        )
        self.assertEqual(resp.status_code, 200)
        ids = [r['id'] for r in resp.data['results']]
        self.assertEqual(ids, [ligne_clot.id])

    def test_sans_filtre_tout_est_visible(self):
        F.create_commande_produit(self.commande, self.produit, quantity=5)
        commande_clot = F.create_commande(status='CLOT')
        F.create_commande_produit(commande_clot, self.produit, quantity=3)

        resp = self.client_api.get(reverse('commandeproduit-list'))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['count'], 2)


# ── bulk_sync ─────────────────────────────────────────────────────────────────

class BulkSyncTest(CommandeProduitBase):
    def _sync(self, payload):
        return self.client_api.post(
            reverse('commandeproduit-bulk-sync'), payload, format='json',
        )

    def test_sans_commande_id_400(self):
        resp = self._sync({'produits': []})
        self.assertEqual(resp.status_code, 400)

    def test_commande_inexistante_404(self):
        resp = self._sync({'commande_id': 999999, 'produits': []})
        self.assertEqual(resp.status_code, 404)

    def test_commande_cloturee_400(self):
        self.commande.status = 'CLOT'
        self.commande.save()
        resp = self._sync({'commande_id': self.commande.id, 'produits': []})
        self.assertEqual(resp.status_code, 400)

    def test_creation_lignes(self):
        produit2 = F.create_produit()
        resp = self._sync({
            'commande_id': self.commande.id,
            'produits': [
                {
                    'produit': self.produit.id,
                    'quantity': 10,
                    'unites_gratuites': 2,
                    'price': 450,
                    'price_cost': 450,
                    'selling_price': 900,
                    'lot': 'LOT-B1',
                    'date_expiration': '2027-06-15',
                },
                {
                    'produit': produit2.id,
                    'quantity': 3,
                    'price': 100,
                    'price_cost': 100,
                    'selling_price': 200,
                },
            ],
        })
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['created'], 2)
        self.assertEqual(resp.data['updated'], 0)
        self.assertEqual(resp.data['deleted'], 0)

        lignes = CommandeProduit.objects.filter(commande=self.commande)
        self.assertEqual(lignes.count(), 2)
        l1 = lignes.get(produit=self.produit)
        self.assertEqual(l1.quantity, 10)
        self.assertEqual(l1.unites_gratuites, 2)
        self.assertEqual(l1.price_cost, Decimal('450'))
        self.assertEqual(l1.lot, 'LOT-B1')
        # La date d'expiration est normalisee au dernier jour du mois
        self.assertEqual(l1.date_expiration, date(2027, 6, 30))

    def test_update_ligne_existante(self):
        ligne = F.create_commande_produit(
            self.commande, self.produit, quantity=5, price_cost=400,
        )
        resp = self._sync({
            'commande_id': self.commande.id,
            'produits': [{
                'id': ligne.id,
                'produit': self.produit.id,
                'quantity': 20,
                'price': 350,
                'price_cost': 350,
                'selling_price': 700,
                'lot': 'LOT-UPD',
            }],
        })
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['created'], 0)
        self.assertEqual(resp.data['updated'], 1)
        ligne.refresh_from_db()
        self.assertEqual(ligne.quantity, 20)
        self.assertEqual(ligne.price_cost, Decimal('350'))
        self.assertEqual(ligne.lot, 'LOT-UPD')

    def test_lignes_absentes_supprimees(self):
        ligne1 = F.create_commande_produit(
            self.commande, self.produit, quantity=5,
        )
        ligne2 = F.create_commande_produit(
            self.commande, F.create_produit(), quantity=2,
        )
        resp = self._sync({
            'commande_id': self.commande.id,
            'produits': [{
                'id': ligne1.id,
                'produit': self.produit.id,
                'quantity': 5,
                'price': 500,
                'price_cost': 500,
                'selling_price': 1000,
            }],
        })
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['deleted'], 1)
        self.assertTrue(CommandeProduit.objects.filter(pk=ligne1.pk).exists())
        self.assertFalse(CommandeProduit.objects.filter(pk=ligne2.pk).exists())

    def test_payload_vide_supprime_tout(self):
        F.create_commande_produit(self.commande, self.produit, quantity=5)
        F.create_commande_produit(self.commande, F.create_produit(), quantity=2)
        resp = self._sync({'commande_id': self.commande.id, 'produits': []})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['deleted'], 2)
        self.assertEqual(
            CommandeProduit.objects.filter(commande=self.commande).count(), 0,
        )

    def test_date_expiration_format_mm_yy(self):
        resp = self._sync({
            'commande_id': self.commande.id,
            'produits': [{
                'produit': self.produit.id,
                'quantity': 1,
                'price': 100,
                'price_cost': 100,
                'selling_price': 200,
                'date_expiration': '03/27',
            }],
        })
        self.assertEqual(resp.status_code, 200)
        ligne = CommandeProduit.objects.get(commande=self.commande)
        self.assertEqual(ligne.date_expiration, date(2027, 3, 31))

    def test_date_expiration_iso_normalisee_fin_de_mois(self):
        resp = self._sync({
            'commande_id': self.commande.id,
            'produits': [{
                'produit': self.produit.id,
                'quantity': 1,
                'price': 100,
                'price_cost': 100,
                'selling_price': 200,
                'date_expiration': '2026-02-10',
            }],
        })
        self.assertEqual(resp.status_code, 200)
        ligne = CommandeProduit.objects.get(commande=self.commande)
        self.assertEqual(ligne.date_expiration, date(2026, 2, 28))

    def test_date_expiration_invalide_ignoree(self):
        """Une date inexploitable doit etre ignoree (None), pas planter."""
        for mauvaise in ('date-bizarre', '2026-13-01', 'a-b-c'):
            resp = self._sync({
                'commande_id': self.commande.id,
                'produits': [{
                    'produit': self.produit.id,
                    'quantity': 1,
                    'price': 100,
                    'price_cost': 100,
                    'selling_price': 200,
                    'date_expiration': mauvaise,
                }],
            })
            self.assertEqual(resp.status_code, 200, msg=f'date: {mauvaise}')
            ligne = CommandeProduit.objects.get(commande=self.commande)
            self.assertIsNone(ligne.date_expiration)
            ligne.delete()

    def test_quantite_non_numerique_rejetee_400(self):
        """Une quantite non numerique est rejetee (400) — plus de coercion
        silencieuse a 0 (audit inputs P1)."""
        resp = self._sync({
            'commande_id': self.commande.id,
            'produits': [{
                'produit': self.produit.id,
                'quantity': 'abc',
                'unites_gratuites': 'x',
                'price': 100,
                'price_cost': 100,
                'selling_price': 200,
            }],
        })
        self.assertEqual(resp.status_code, 400)
        self.assertFalse(CommandeProduit.objects.filter(commande=self.commande).exists())

    def test_warning_marge_negative(self):
        resp = self._sync({
            'commande_id': self.commande.id,
            'produits': [{
                'produit': self.produit.id,
                'quantity': 1,
                'price': 500,
                'price_cost': 500,
                'selling_price': 300,
            }],
        })
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(
            any('Marge' in w or 'marge' in w for w in resp.data['warnings']),
        )

    def test_warning_prix_vente_non_defini(self):
        resp = self._sync({
            'commande_id': self.commande.id,
            'produits': [{
                'produit': self.produit.id,
                'quantity': 1,
                'price': 500,
                'price_cost': 500,
                'selling_price': 0,
            }],
        })
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(
            any('vente' in w for w in resp.data['warnings']),
        )

    def test_synchronise_fiche_produit(self):
        """bulk_sync met a jour prix de vente / prix d'achat sur le produit."""
        resp = self._sync({
            'commande_id': self.commande.id,
            'produits': [{
                'produit': self.produit.id,
                'quantity': 1,
                'price': 600,
                'price_cost': 600,
                'selling_price': 1500,
            }],
        })
        self.assertEqual(resp.status_code, 200)
        self.produit.refresh_from_db()
        self.assertEqual(self.produit.selling_price, Decimal('1500'))
        self.assertEqual(self.produit.cost_price, Decimal('600'))


# ── correct_lot ───────────────────────────────────────────────────────────────

class CorrectLotTest(CommandeProduitBase):
    def _url(self, ligne):
        return reverse('commandeproduit-correct-lot', kwargs={'pk': ligne.pk})

    def test_corrige_lot_et_date(self):
        ligne = F.create_commande_produit(self.commande, self.produit, quantity=5)
        resp = self.client_api.patch(self._url(ligne), {
            'lot': 'LOT-NEW',
            'date_expiration': '2027-05-10',
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['lot'], 'LOT-NEW')
        self.assertEqual(resp.data['date_expiration'], '2027-05-31')
        ligne.refresh_from_db()
        self.assertEqual(ligne.lot, 'LOT-NEW')
        self.assertEqual(ligne.date_expiration, date(2027, 5, 31))

    def test_fonctionne_sur_commande_cloturee(self):
        """correct_lot est justement prevu pour corriger apres cloture."""
        self.commande.status = 'CLOT'
        self.commande.save()
        ligne = F.create_commande_produit(self.commande, self.produit, quantity=5)
        resp = self.client_api.patch(self._url(ligne), {
            'lot': 'LOT-CLOT',
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        ligne.refresh_from_db()
        self.assertEqual(ligne.lot, 'LOT-CLOT')

    def test_date_invalide_400(self):
        ligne = F.create_commande_produit(self.commande, self.produit, quantity=5)
        resp = self.client_api.patch(self._url(ligne), {
            'date_expiration': 'pas-une-date',
        }, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_date_vide_efface_la_date(self):
        ligne = F.create_commande_produit(
            self.commande, self.produit, quantity=5,
            date_expiration=date(2027, 1, 31),
        )
        resp = self.client_api.patch(self._url(ligne), {
            'date_expiration': '',
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        ligne.refresh_from_db()
        self.assertIsNone(ligne.date_expiration)

    def test_sans_date_conserve_date_existante(self):
        ligne = F.create_commande_produit(
            self.commande, self.produit, quantity=5,
            date_expiration=date(2027, 1, 31),
        )
        resp = self.client_api.patch(self._url(ligne), {
            'lot': 'LOT-KEEP',
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        ligne.refresh_from_db()
        self.assertEqual(ligne.date_expiration, date(2027, 1, 31))

    def test_met_a_jour_stock_lot_associe(self):
        """Si un StockLot existe pour (produit, lot), sa date est corrigee."""
        ligne = F.create_commande_produit(self.commande, self.produit, quantity=5)
        stock_lot = F.create_stock_lot(
            produit=self.produit, quantity=5, lot_name='LOT-SYNC',
            date_expiration=date(2026, 1, 31),
        )
        resp = self.client_api.patch(self._url(ligne), {
            'lot': 'LOT-SYNC',
            'date_expiration': '2028-04-02',
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        stock_lot.refresh_from_db()
        self.assertEqual(stock_lot.date_expiration, date(2028, 4, 30))

    def test_sans_stock_lot_associe_pas_d_erreur(self):
        """Aucun StockLot correspondant : la correction passe quand meme."""
        ligne = F.create_commande_produit(self.commande, self.produit, quantity=5)
        resp = self.client_api.patch(self._url(ligne), {
            'lot': 'LOT-INCONNU',
            'date_expiration': '2028-04-02',
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        ligne.refresh_from_db()
        self.assertEqual(ligne.lot, 'LOT-INCONNU')
