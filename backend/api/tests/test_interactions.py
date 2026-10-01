"""
Tests pour api/views/interactions.py (DrugInteractionViewSet).

Couvre : CRUD (list/retrieve/create/update/delete), filtres (gravity,
substance, search, ordering), normalisation des paires de substances,
statistiques (action stats) et import CSV (action upload_csv).
"""
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from ..models import DrugInteraction, Substance
from .factories import TestDataFactory as F


def make_csv(content, filename='interactions.csv', encoding='utf-8'):
    """Construit un fichier CSV uploadable."""
    return SimpleUploadedFile(
        filename, content.encode(encoding), content_type='text/csv'
    )


class InteractionsBase(TestCase):
    def setUp(self):
        self.client_api = APIClient()
        self.admin = F.create_superuser()
        self.client_api.force_authenticate(user=self.admin)

    # -- Helpers ------------------------------------------------------------

    def sub(self, nom):
        return Substance.objects.create(nom=nom)

    def interaction(self, a, b, gravity='PRECAUTION', description='Desc'):
        pair_a, pair_b = (a, b) if a.id < b.id else (b, a)
        return DrugInteraction.objects.create(
            substance_a=pair_a, substance_b=pair_b,
            gravity=gravity, description=description,
        )


# ── Accès ────────────────────────────────────────────────────────────────────

class InteractionsAccessTest(InteractionsBase):
    def test_anonyme_refuse(self):
        resp = APIClient().get(reverse('interaction-list'))
        self.assertIn(resp.status_code, (401, 403))

    def test_anonyme_upload_refuse(self):
        resp = APIClient().post(reverse('interaction-upload-csv'), {})
        self.assertIn(resp.status_code, (401, 403))

    def test_utilisateur_simple_autorise(self):
        """Le ViewSet n'exige que IsAuthenticated (pas de rôle staff)."""
        client = APIClient()
        client.force_authenticate(user=F.create_user())
        resp = client.get(reverse('interaction-list'))
        self.assertEqual(resp.status_code, 200)


# ── CRUD ─────────────────────────────────────────────────────────────────────

class InteractionsCrudTest(InteractionsBase):
    def test_liste_vide(self):
        resp = self.client_api.get(reverse('interaction-list'))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['results'], [])

    def test_liste_retourne_interactions(self):
        a = self.sub('ASPIRINE')
        b = self.sub('IBUPROFENE')
        inter = self.interaction(a, b, gravity='DECONSEILLE')

        resp = self.client_api.get(reverse('interaction-list'))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['count'], 1)
        row = resp.data['results'][0]
        self.assertEqual(row['id'], inter.id)
        self.assertEqual(row['substance_a_nom'], 'ASPIRINE')
        self.assertEqual(row['substance_b_nom'], 'IBUPROFENE')
        self.assertEqual(row['gravity'], 'DECONSEILLE')
        self.assertEqual(row['gravity_display'], 'Déconseillé')

    def test_retrieve_detail(self):
        a = self.sub('PARACETAMOL')
        b = self.sub('CODEINE')
        inter = self.interaction(a, b)

        resp = self.client_api.get(
            reverse('interaction-detail', args=[inter.id])
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['substance_a_nom'], 'PARACETAMOL')

    def test_create_ok(self):
        a = self.sub('AMOXICILLINE')
        b = self.sub('METHOTREXATE')
        resp = self.client_api.post(reverse('interaction-list'), {
            'substance_a': a.id,
            'substance_b': b.id,
            'gravity': 'A_PRENDRE_EN_COMPTE',
            'description': 'Surveillance rénale',
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(
            DrugInteraction.objects.filter(substance_a=a, substance_b=b).exists()
        )

    def test_create_normalise_ordre_paires(self):
        """La paire est stockée avec l'id le plus petit en substance_a."""
        a = self.sub('SUBSTANCE_A')
        b = self.sub('SUBSTANCE_B')
        self.assertLess(a.id, b.id)
        # On soumet volontairement (b, a) — ordre inverse
        resp = self.client_api.post(reverse('interaction-list'), {
            'substance_a': b.id,
            'substance_b': a.id,
            'gravity': 'PRECAUTION',
            'description': 'Test',
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        inter = DrugInteraction.objects.get()
        self.assertEqual(inter.substance_a_id, a.id)
        self.assertEqual(inter.substance_b_id, b.id)

    def test_create_meme_substance_400(self):
        a = self.sub('WARFARINE')
        resp = self.client_api.post(reverse('interaction-list'), {
            'substance_a': a.id,
            'substance_b': a.id,
            'gravity': 'PRECAUTION',
            'description': 'Test',
        }, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(DrugInteraction.objects.count(), 0)

    def test_create_doublon_meme_ordre_400(self):
        a = self.sub('METFORMINE')
        b = self.sub('ALCOOL')
        self.interaction(a, b)
        resp = self.client_api.post(reverse('interaction-list'), {
            'substance_a': a.id,
            'substance_b': b.id,
            'gravity': 'DECONSEILLE',
            'description': 'Doublon',
        }, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_create_doublon_ordre_inverse_400(self):
        """Régression : une paire inversée d'une interaction existante levait
        un IntegrityError (500) au lieu d'un 400 propre."""
        a = self.sub('DIGOXINE')
        b = self.sub('AMIODARONE')
        self.interaction(a, b)
        resp = self.client_api.post(reverse('interaction-list'), {
            'substance_a': b.id,  # ordre inversé
            'substance_b': a.id,
            'gravity': 'CONTRE_INDIQUE',
            'description': 'Doublon inversé',
        }, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(DrugInteraction.objects.count(), 1)

    def test_create_sans_description_400(self):
        a = self.sub('LITHIUM')
        b = self.sub('FUROSEMIDE')
        resp = self.client_api.post(reverse('interaction-list'), {
            'substance_a': a.id,
            'substance_b': b.id,
            'gravity': 'PRECAUTION',
        }, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_create_substance_inexistante_400(self):
        a = self.sub('EXISTANTE')
        resp = self.client_api.post(reverse('interaction-list'), {
            'substance_a': a.id,
            'substance_b': 999999,
            'gravity': 'PRECAUTION',
            'description': 'Test',
        }, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_update_patch_gravity(self):
        a = self.sub('SIMVASTATINE')
        b = self.sub('CLARITHROMYCINE')
        inter = self.interaction(a, b, gravity='PRECAUTION')
        resp = self.client_api.patch(
            reverse('interaction-detail', args=[inter.id]),
            {'gravity': 'CONTRE_INDIQUE'},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        inter.refresh_from_db()
        self.assertEqual(inter.gravity, 'CONTRE_INDIQUE')

    def test_update_normalise_ordre_paires(self):
        a = self.sub('SUB_A')
        b = self.sub('SUB_B')
        c = self.sub('SUB_C')  # c.id > a.id et b.id
        inter = self.interaction(a, b)
        # PATCH vers la paire (c, a) — doit être stockée (a, c)
        resp = self.client_api.patch(
            reverse('interaction-detail', args=[inter.id]),
            {'substance_a': c.id, 'substance_b': a.id},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        inter.refresh_from_db()
        self.assertEqual(inter.substance_a_id, a.id)
        self.assertEqual(inter.substance_b_id, c.id)

    def test_update_meme_substance_400(self):
        a = self.sub('SUB_UNE')
        b = self.sub('SUB_DEUX')
        inter = self.interaction(a, b)
        resp = self.client_api.patch(
            reverse('interaction-detail', args=[inter.id]),
            {'substance_b': a.id},
            format='json',
        )
        self.assertEqual(resp.status_code, 400)
        inter.refresh_from_db()
        self.assertEqual(inter.substance_b_id, b.id)  # inchangé

    def test_update_vers_paire_inversee_existante_400(self):
        """PATCH vers une paire déjà existante (ordre inversé) → 400, pas 500."""
        a = self.sub('SUB_X')
        b = self.sub('SUB_Y')
        c = self.sub('SUB_Z')
        self.interaction(a, b)
        autre = self.interaction(a, c)
        resp = self.client_api.patch(
            reverse('interaction-detail', args=[autre.id]),
            {'substance_a': b.id, 'substance_b': a.id},
            format='json',
        )
        self.assertEqual(resp.status_code, 400)
        autre.refresh_from_db()
        self.assertEqual(autre.substance_b_id, c.id)  # inchangé

    def test_delete_ok(self):
        a = self.sub('SUB_DEL_A')
        b = self.sub('SUB_DEL_B')
        inter = self.interaction(a, b)
        resp = self.client_api.delete(
            reverse('interaction-detail', args=[inter.id])
        )
        self.assertIn(resp.status_code, (200, 204))
        self.assertEqual(DrugInteraction.objects.count(), 0)


# ── Filtres / recherche / tri ────────────────────────────────────────────────

class InteractionsFilterTest(InteractionsBase):
    def setUp(self):
        super().setUp()
        self.a = self.sub('AMIODARONE')
        self.b = self.sub('BETA_BLOQUANT')
        self.c = self.sub('CIPROFLOXACINE')
        self.i1 = self.interaction(self.a, self.b, gravity='DECONSEILLE',
                                   description='Bradycardie')
        self.i2 = self.interaction(self.a, self.c, gravity='PRECAUTION',
                                   description='Allongement QT')

    def test_filtre_gravity(self):
        resp = self.client_api.get(
            reverse('interaction-list'), {'gravity': 'DECONSEILLE'}
        )
        self.assertEqual(resp.data['count'], 1)
        self.assertEqual(resp.data['results'][0]['id'], self.i1.id)

    def test_filtre_substance_matche_a_ou_b(self):
        resp = self.client_api.get(
            reverse('interaction-list'), {'substance': self.c.id}
        )
        self.assertEqual(resp.data['count'], 1)
        self.assertEqual(resp.data['results'][0]['id'], self.i2.id)

    def test_filtre_substance_commune(self):
        resp = self.client_api.get(
            reverse('interaction-list'), {'substance': self.a.id}
        )
        self.assertEqual(resp.data['count'], 2)

    def test_search_par_nom_substance(self):
        resp = self.client_api.get(
            reverse('interaction-list'), {'search': 'CIPROFLOXACINE'}
        )
        self.assertEqual(resp.data['count'], 1)
        self.assertEqual(resp.data['results'][0]['id'], self.i2.id)

    def test_search_par_description(self):
        resp = self.client_api.get(
            reverse('interaction-list'), {'search': 'Bradycardie'}
        )
        self.assertEqual(resp.data['count'], 1)

    def test_ordering_par_gravity(self):
        resp = self.client_api.get(
            reverse('interaction-list'), {'ordering': 'gravity'}
        )
        self.assertEqual(resp.status_code, 200)
        gravities = [r['gravity'] for r in resp.data['results']]
        self.assertEqual(gravities, sorted(gravities))


# ── Action stats ─────────────────────────────────────────────────────────────

class InteractionsStatsTest(InteractionsBase):
    def test_stats_vide(self):
        resp = self.client_api.get(reverse('interaction-stats'))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['total'], 0)
        self.assertEqual(resp.data['total_substances'], 0)
        self.assertEqual(resp.data['substances_with_interactions'], 0)
        for code in ('PRECAUTION', 'A_PRENDRE_EN_COMPTE',
                     'DECONSEILLE', 'CONTRE_INDIQUE'):
            self.assertEqual(resp.data['by_gravity'][code], 0)

    def test_stats_compteurs(self):
        a = self.sub('STAT_A')
        b = self.sub('STAT_B')
        c = self.sub('STAT_C')
        self.sub('STAT_SOLO')  # sans interaction
        self.interaction(a, b, gravity='DECONSEILLE')
        self.interaction(b, c, gravity='DECONSEILLE')
        self.interaction(a, c, gravity='PRECAUTION')

        resp = self.client_api.get(reverse('interaction-stats'))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['total'], 3)
        self.assertEqual(resp.data['by_gravity']['DECONSEILLE'], 2)
        self.assertEqual(resp.data['by_gravity']['PRECAUTION'], 1)
        self.assertEqual(resp.data['by_gravity']['CONTRE_INDIQUE'], 0)
        self.assertEqual(resp.data['total_substances'], 4)
        # a, b et c participent à au moins une interaction
        self.assertEqual(resp.data['substances_with_interactions'], 3)


# ── Action upload_csv ────────────────────────────────────────────────────────

class InteractionsUploadCsvTest(InteractionsBase):
    URL = 'interaction-upload-csv'

    def upload(self, content, encoding='utf-8', filename='interactions.csv'):
        fichier = make_csv(content, filename=filename, encoding=encoding)
        return self.client_api.post(reverse(self.URL), {'file': fichier})

    def test_sans_fichier_400(self):
        resp = self.client_api.post(reverse(self.URL), {})
        self.assertEqual(resp.status_code, 400)
        self.assertIn('error', resp.data)

    def test_csv_cree_interactions_et_substances(self):
        """Les substances absentes sont créées automatiquement (majuscules)."""
        resp = self.upload(
            "substance_a,substance_b,gravity,description\n"
            "Paracétamol,Tramadol,PRECAUTION,Risque de convulsions\n"
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['created'], 1)
        self.assertEqual(resp.data['skipped'], 0)
        self.assertTrue(Substance.objects.filter(nom='PARACÉTAMOL').exists())
        self.assertTrue(Substance.objects.filter(nom='TRAMADOL').exists())

    def test_csv_met_a_jour_interaction_existante(self):
        a = self.sub('WARFARINE')
        b = self.sub('AINS')
        self.interaction(a, b, gravity='PRECAUTION', description='Vieille')
        resp = self.upload(
            "substance_a,substance_b,gravity,description\n"
            "Warfarine,AINS,CONTRE_INDIQUE,Nouvelle description\n"
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['updated'], 1)
        self.assertEqual(resp.data['created'], 0)
        inter = DrugInteraction.objects.get()
        self.assertEqual(inter.gravity, 'CONTRE_INDIQUE')
        self.assertEqual(inter.description, 'Nouvelle description')

    def test_csv_reutilise_substance_casse_different(self):
        """'paracétamol' en CSV réutilise la substance 'PARACÉTAMOL' existante
        (get_or_create en nom__iexact)."""
        existante = self.sub('PARACÉTAMOL')
        resp = self.upload(
            "substance_a,substance_b,gravity,description\n"
            "paracétamol,ibuprofène,PRECAUTION,Test\n"
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['created'], 1)
        # Pas de doublon de substance (nom unique, iexact match)
        self.assertFalse(
            Substance.objects.filter(nom='PARACETAMOL').exists()
        )
        inter = DrugInteraction.objects.get()
        self.assertIn(existante.id, (inter.substance_a_id, inter.substance_b_id))

    def test_csv_ligne_sans_substance_skippee(self):
        resp = self.upload(
            "substance_a,substance_b,gravity,description\n"
            "SOLO,,PRECAUTION,Manque B\n"
            ",,PRECAUTION,Vide complet\n"
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['skipped'], 2)
        self.assertEqual(resp.data['created'], 0)

    def test_csv_gravite_invalide_skippee_avec_erreur(self):
        resp = self.upload(
            "substance_a,substance_b,gravity,description\n"
            "AAA,BBB,GRAVITE_FAUSSE,Test\n"
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['skipped'], 1)
        self.assertEqual(resp.data['created'], 0)
        self.assertEqual(len(resp.data['errors']), 1)
        self.assertIn('gravité', resp.data['errors'][0])
        self.assertIn('Ligne 2', resp.data['errors'][0])

    def test_csv_meme_substance_skippee(self):
        s = self.sub('MEME')
        resp = self.upload(
            "substance_a,substance_b,gravity,description\n"
            "MEME,meme,PRECAUTION,Même substance\n"
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['skipped'], 1)
        self.assertEqual(DrugInteraction.objects.count(), 0)
        # La résolution iexact a trouvé la substance existante pour les deux noms
        self.assertEqual(Substance.objects.count(), 1)

    def test_csv_paire_normalisee_avant_insertion(self):
        """La paire est stockée substance_a < substance_b (ids croissants)."""
        s_b = self.sub('ZZZ_DERNIER')  # créée en premier → id le plus petit
        resp = self.upload(
            "substance_a,substance_b,gravity,description\n"
            "ZZZ_DERNIER,AAA_PREMIER,PRECAUTION,Test ordre\n"
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['created'], 1)
        inter = DrugInteraction.objects.get()
        self.assertLess(inter.substance_a_id, inter.substance_b_id)
        self.assertEqual(inter.substance_a_id, s_b.id)

    def test_csv_encodage_latin1(self):
        """Un fichier encodé cp1252/latin-1 est accepté (fallback d'encodage)."""
        contenu = (
            "substance_a,substance_b,gravity,description\n"
            "Substance éà,Autre ù,PRECAUTION,Accents latin\n"
        )
        fichier = SimpleUploadedFile(
            'interactions.csv', contenu.encode('cp1252'),
            content_type='text/csv',
        )
        resp = self.client_api.post(reverse(self.URL), {'file': fichier})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['created'], 1)

    def test_csv_compteurs_totaux(self):
        resp = self.upload(
            "substance_a,substance_b,gravity,description\n"
            "A1,B1,PRECAUTION,ok\n"
            "A2,B2,FAUX,gravité invalide\n"
            ",B3,PRECAUTION,manque A\n"
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['created'], 1)
        self.assertEqual(resp.data['skipped'], 2)
        self.assertEqual(resp.data['total'], 3)


# ── Normalisation interne ────────────────────────────────────────────────────

class NormalizeFunctionTest(TestCase):
    def test_normalize_accents_casse_ponctuation(self):
        from api.views.interactions import _normalize
        self.assertEqual(_normalize('paracétamol'), 'PARACETAMOL')
        self.assertEqual(_normalize('  Ibuprofène, (500mg) '), 'IBUPROFENE 500MG')
        self.assertEqual(_normalize('a;b:c/d'), 'A B C D')
        self.assertEqual(_normalize(''), '')
        self.assertEqual(_normalize(None), '')
        self.assertEqual(_normalize('  multi   espaces '), 'MULTI ESPACES')
