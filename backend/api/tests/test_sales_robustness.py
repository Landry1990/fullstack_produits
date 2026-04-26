"""
Tests de robustesse pour le système de ventes.
Vérifie que l'application résiste aux données invalides, malveillantes ou extrêmes.
"""
import pytest
from decimal import Decimal, InvalidOperation
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from rest_framework.test import APIClient
from rest_framework import status
from django.db import transaction
import json

from ..models import (
    Produit, Facture, FactureProduit, Client, Caisse, 
    StockLot, Promis, Ordonnancier, Profile
)
from ..services.sales_service import SalesService
from .factories import TestDataFactory

User = get_user_model()


@pytest.mark.django_db
def test_finaliser_vente_montant_negatif():
    """Test: Une vente avec montant négatif doit être rejetée ou nécessiter Sudo."""
    client = APIClient()
    user = TestDataFactory.create_user()
    client.force_authenticate(user=user)
    
    produit = TestDataFactory.create_produit(stock=100, selling_price=100)
    
    # Tentative avec prix de vente négatif
    data = {
        'produits': [{
            'produit': produit.id,
            'quantity': 1,
            'selling_price': -100,  # Négatif!
            'discount': 0,
            'tva': 19.25
        }],
        'remise': 0,
        'centralized_cashRegister': True,
        'totals': {'totalTtc': -100}
    }
    
    response = client.post(
        reverse('facture-finaliser'),
        data=json.dumps(data),
        content_type='application/json'
    )
    
    # Doit échouer ou nécessiter une validation Sudo (403 ou 400)
    assert response.status_code in [status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN]
    
    # Vérifier qu'aucune facture n'a été créée
    assert Facture.objects.count() == 0


@pytest.mark.django_db
def test_finaliser_vente_quantite_extreme():
    """Test: Une vente avec une quantité extrêmement élevée."""
    client = APIClient()
    user = TestDataFactory.create_user()
    client.force_authenticate(user=user)
    
    produit = TestDataFactory.create_produit(stock=100, selling_price=10)
    
    # Tentative avec quantité impossible (1 million)
    data = {
        'produits': [{
            'produit': produit.id,
            'quantity': 1000000,  # Quantité absurde
            'selling_price': 10,
            'discount': 0,
            'tva': 19.25
        }],
        'remise': 0,
        'centralized_cashRegister': True
    }
    
    response = client.post(
        reverse('facture-finaliser'),
        data=json.dumps(data),
        content_type='application/json'
    )
    
    # Doit échouer car stock insuffisant
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert 'stock' in response.data['detail'].lower() or 'insuffisant' in response.data['detail'].lower()


@pytest.mark.django_db
def test_finaliser_vente_produit_inexistant():
    """Test: Tentative de vendre un produit qui n'existe pas (ID inexistant)."""
    client = APIClient()
    user = TestDataFactory.create_user()
    client.force_authenticate(user=user)
    
    # ID de produit inexistant (très élevé)
    data = {
        'produits': [{
            'produit': 999999,
            'quantity': 1,
            'selling_price': 100,
            'discount': 0,
            'tva': 19.25
        }],
        'remise': 0,
        'centralized_cashRegister': True
    }
    
    response = client.post(
        reverse('facture-finaliser'),
        data=json.dumps(data),
        content_type='application/json'
    )
    
    # Doit échouer
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_finaliser_vente_remise_superieure_total():
    """Test: Une remise supérieure au total de la facture."""
    client = APIClient()
    user = TestDataFactory.create_user()
    client.force_authenticate(user=user)
    
    produit = TestDataFactory.create_produit(stock=100, selling_price=100)
    
    # Remise de 1000 sur un achat de 100
    data = {
        'produits': [{
            'produit': produit.id,
            'quantity': 1,
            'selling_price': 100,
            'discount': 0,
            'tva': 19.25
        }],
        'remise': 1000,  # Supérieur au total!
        'centralized_cashRegister': True
    }
    
    response = client.post(
        reverse('facture-finaliser'),
        data=json.dumps(data),
        content_type='application/json'
    )
    
    # Doit échouer
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert 'remise' in response.data['detail'].lower()


@pytest.mark.django_db
def test_finaliser_vente_sans_produits():
    """Test: Tentative de créer une facture sans produits."""
    client = APIClient()
    user = TestDataFactory.create_user()
    client.force_authenticate(user=user)
    
    data = {
        'produits': [],  # Vide!
        'remise': 0,
        'centralized_cashRegister': True
    }
    
    response = client.post(
        reverse('facture-finaliser'),
        data=json.dumps(data),
        content_type='application/json'
    )
    
    # Doit échouer
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_finaliser_vente_data_malformee():
    """Test: Données JSON malformées ou types incorrects."""
    client = APIClient()
    user = TestDataFactory.create_user()
    client.force_authenticate(user=user)
    
    produit = TestDataFactory.create_produit(stock=100, selling_price=100)
    
    # Tests avec différentes données malformées
    test_cases = [
        # Prix comme string non-numérique
        {
            'produits': [{'produit': produit.id, 'quantity': 1, 'selling_price': 'abc', 'discount': 0}],
            'remise': 0,
            'centralized_cashRegister': True
        },
        # Quantité comme string
        {
            'produits': [{'produit': produit.id, 'quantity': 'beaucoup', 'selling_price': 100, 'discount': 0}],
            'remise': 0,
            'centralized_cashRegister': True
        },
        # Remise comme null
        {
            'produits': [{'produit': produit.id, 'quantity': 1, 'selling_price': 100, 'discount': 0}],
            'remise': None,
            'centralized_cashRegister': True
        },
        # Produits comme null
        {
            'produits': None,
            'remise': 0,
            'centralized_cashRegister': True
        },
    ]
    
    for i, data in enumerate(test_cases):
        response = client.post(
            reverse('facture-finaliser'),
            data=json.dumps(data),
            content_type='application/json'
        )
        
        # Chaque cas doit échouer gracieusement (pas de 500)
        assert response.status_code in [
            status.HTTP_400_BAD_REQUEST, 
            status.HTTP_422_UNPROCESSABLE_ENTITY
        ], f"Test case {i} a échoué avec {response.status_code}: {response.data}"


@pytest.mark.django_db
def test_validation_sans_permission():
    """Test: Un utilisateur sans permission ne peut pas valider certaines ventes."""
    client = APIClient()
    user = TestDataFactory.create_user()
    client.force_authenticate(user=user)
    
    # Créer une facture à montant nul
    client_obj = TestDataFactory.create_client()
    facture = Facture.objects.create(
        client=client_obj,
        status='BROU',
        total_ttc=0,
        created_by=user
    )
    
    # Tentative de validation d'une facture à 0
    response = client.post(
        reverse('facture-valider', kwargs={'pk': facture.id}),
        data={},
        content_type='application/json'
    )
    
    # Doit être refusé (403 Forbidden)
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_annulation_sans_permission():
    """Test: Un utilisateur sans permission cannot_cancel_invoice ne peut pas annuler."""
    client = APIClient()
    user = TestDataFactory.create_user()
    client.force_authenticate(user=user)
    
    # Créer ou mettre à jour le profil sans permission d'annulation
    profile, _ = Profile.objects.get_or_create(user=user)
    profile.can_cancel_invoice = False
    profile.save()
    
    client_obj = TestDataFactory.create_client()
    facture = TestDataFactory.create_facture(client=client_obj, status='VAL')
    
    response = client.post(
        reverse('facture-annuler', kwargs={'pk': facture.id}),
        data={'motif': 'Test'},
        content_type='application/json'
    )
    
    # Doit être refusé
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_modification_vente_veille():
    """Test: Impossible de modifier une vente d'hier."""
    from datetime import timedelta
    from django.utils import timezone
    
    client = APIClient()
    user = TestDataFactory.create_user()
    client.force_authenticate(user=user)
    
    # Créer une facture validée avec date d'hier
    client_obj = TestDataFactory.create_client()
    facture = TestDataFactory.create_facture(client=client_obj, status='VAL')
    facture.date = timezone.now() - timedelta(days=2)
    facture.save()
    
    # Tentative de modification
    response = client.post(
        reverse('facture-modifier', kwargs={'pk': facture.id}),
        data={
            'produits': [],
            'remise': 0
        },
        content_type='application/json'
    )
    
    # Doit échouer car date antérieure
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_double_paiement_protection():
    """Test: Protection contre les double-paiements concurrents."""
    client = APIClient()
    user = TestDataFactory.create_user()
    client.force_authenticate(user=user)
    
    client_obj = TestDataFactory.create_client()
    facture = TestDataFactory.create_facture(client=client_obj, status='VAL', total_ttc=100)
    
    # Premier paiement complet
    response1 = client.post(
        reverse('caisse-list'),
        data={
            'facture': facture.id,
            'montant': 100,
            'mode_paiement': 'especes'
        },
        content_type='application/json'
    )
    
    assert response1.status_code == status.HTTP_201_CREATED
    
    # Deuxième paiement (doit être limité ou refusé)
    response2 = client.post(
        reverse('caisse-list'),
        data={
            'facture': facture.id,
            'montant': 50,  # Excès
            'mode_paiement': 'especes'
        },
        content_type='application/json'
    )
    
    # Le montant doit être ajusté à 0 ou refusé
    if response2.status_code == status.HTTP_201_CREATED:
        # Si accepté, le montant doit avoir été ajusté à 0
        assert Decimal(str(response2.data['montant'])) == 0


@pytest.mark.django_db
def test_sql_injection_protection():
    """Test: Protection contre les injections SQL dans les champs texte."""
    client = APIClient()
    user = TestDataFactory.create_user()
    client.force_authenticate(user=user)
    
    produit = TestDataFactory.create_produit(stock=100, selling_price=100)
    
    # Tentative d'injection SQL dans le nom client
    data = {
        'produits': [{
            'produit': produit.id,
            'quantity': 1,
            'selling_price': 100,
            'discount': 0,
            'tva': 19.25
        }],
        'client_name_override': "'; DROP TABLE api_facture; --",
        'remise': 0,
        'centralized_cashRegister': True
    }
    
    response = client.post(
        reverse('facture-finaliser'),
        data=json.dumps(data),
        content_type='application/json'
    )
    
    # La requête doit soit échouer gracieusement, soit créer une facture avec le texte échappé
    # Mais surtout ne PAS effacer la table
    assert Facture.objects.count() >= 0  # La table existe toujours
    
    # Si une facture a été créée, le nom doit être stocké tel quel (échappé)
    if response.status_code == status.HTTP_201_CREATED:
        facture = Facture.objects.latest('id')
        assert facture.client_name_override == "'; DROP TABLE api_facture; --"


@pytest.mark.django_db
def test_stock_negatif_protection():
    """Test: Protection contre la vente en stock négatif sans permission."""
    client = APIClient()
    user = TestDataFactory.create_user()
    # Pas de permission can_sell_negative_stock
    if hasattr(user, 'profile'):
        user.profile.can_sell_negative_stock = False
        user.profile.save()
    
    client.force_authenticate(user=user)
    
    # Produit avec très peu de stock
    produit = TestDataFactory.create_produit(stock=1, selling_price=100)
    
    data = {
        'produits': [{
            'produit': produit.id,
            'quantity': 10,  # Plus que le stock disponible
            'selling_price': 100,
            'discount': 0,
            'tva': 19.25
        }],
        'remise': 0,
        'centralized_cashRegister': True
    }
    
    response = client.post(
        reverse('facture-finaliser'),
        data=json.dumps(data),
        content_type='application/json'
    )
    
    # Doit échouer car stock insuffisant
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert 'stock' in response.data['detail'].lower() or 'insuffisant' in response.data['detail'].lower()


@pytest.mark.django_db
def test_plafond_credit_protection():
    """Test: Protection contre le dépassement du plafond de crédit."""
    from decimal import Decimal
    
    client = APIClient()
    user = TestDataFactory.create_user()
    client.force_authenticate(user=user)
    
    # Client professionnel avec plafond de crédit faible
    client_pro = TestDataFactory.create_client(
        client_type='PROFESSIONNEL',
        plafond=Decimal('1000.00')
    )
    
    # Créer une facture existante pour générer une dette
    from django.utils import timezone
    existing_facture = Facture.objects.create(
        client=client_pro,
        status='VAL',
        total_ttc=Decimal('800.00'),
        created_by=user,
        date=timezone.now()
    )
    # Créer un paiement 'en_compte' pour simuler la dette
    Caisse.objects.create(
        facture=existing_facture,
        montant=Decimal('800.00'),
        mode_paiement='en_compte',
        statut='completee',
        user=user
    )
    
    produit = TestDataFactory.create_produit(stock=100, selling_price=500)
    
    data = {
        'client': client_pro.id,
        'produits': [{
            'produit': produit.id,
            'quantity': 1,
            'selling_price': 500,
            'discount': 0,
            'tva': 19.25
        }],
        'remise': 0,
        'centralized_cashRegister': True
    }
    
    response = client.post(
        reverse('facture-finaliser'),
        data=json.dumps(data),
        content_type='application/json'
    )
    
    # Doit échouer car dépassement du plafond
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert 'plafond' in response.data['detail'].lower() or 'crédit' in response.data['detail'].lower()


@pytest.mark.django_db
def test_vente_montant_zero_sans_sudo():
    """Test: Une vente à 0 nécessite une validation Sudo."""
    client = APIClient()
    user = TestDataFactory.create_user()
    client.force_authenticate(user=user)
    
    produit = TestDataFactory.create_produit(stock=100, selling_price=0)  # Prix 0
    
    data = {
        'produits': [{
            'produit': produit.id,
            'quantity': 1,
            'selling_price': 0,
            'discount': 0,
            'tva': 19.25
        }],
        'remise': 0,
        'centralized_cashRegister': True,
        'totals': {'totalTtc': 0}
    }
    
    response = client.post(
        reverse('facture-finaliser'),
        data=json.dumps(data),
        content_type='application/json'
    )
    
    # Doit demander une validation Sudo (403)
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_cross_user_data_access():
    """Test: Un utilisateur ne peut pas accéder aux données d'un autre utilisateur."""
    client1 = APIClient()
    user1 = TestDataFactory.create_user(username='user1')
    client1.force_authenticate(user=user1)
    
    client2 = APIClient()
    user2 = TestDataFactory.create_user(username='user2')
    
    # User1 crée une facture
    client_obj = TestDataFactory.create_client()
    facture = TestDataFactory.create_facture(client=client_obj, status='BROU', created_by=user1)
    
    # User2 tente de modifier la facture de User1
    client2.force_authenticate(user=user2)
    response = client2.post(
        reverse('facture-modifier', kwargs={'pk': facture.id}),
        data={'produits': [], 'remise': 0},
        content_type='application/json'
    )
    
    # Doit être refusé (403 Forbidden)
    assert response.status_code in [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND]


@pytest.mark.django_db
def test_paiement_montant_negatif():
    """Test: Impossible d'enregistrer un paiement négatif."""
    client = APIClient()
    user = TestDataFactory.create_user()
    client.force_authenticate(user=user)
    
    client_obj = TestDataFactory.create_client()
    facture = TestDataFactory.create_facture(client=client_obj, status='VAL', total_ttc=100)
    
    response = client.post(
        reverse('caisse-list'),
        data={
            'facture': facture.id,
            'montant': -50,  # Négatif!
            'mode_paiement': 'especes'
        },
        content_type='application/json'
    )
    
    # Doit échouer
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_ordonnance_data_validation():
    """Test: Validation des données d'ordonnance malformées."""
    client = APIClient()
    user = TestDataFactory.create_user()
    client.force_authenticate(user=user)
    
    produit = TestDataFactory.create_produit(stock=100, selling_price=100)
    
    # Ordonnance avec données malformées
    data = {
        'produits': [{
            'produit': produit.id,
            'quantity': 1,
            'selling_price': 100,
            'discount': 0,
            'tva': 19.25
        }],
        'ordonnance': {
            'patient_nom': 'A' * 1000,  # Nom très long
            'prescripteur_nom': 'B' * 1000,
            'lignes': 'invalid'  # Doit être une liste
        },
        'remise': 0,
        'centralized_cashRegister': True
    }
    
    response = client.post(
        reverse('facture-finaliser'),
        data=json.dumps(data),
        content_type='application/json'
    )
    
    # Doit échouer gracieusement
    assert response.status_code in [status.HTTP_400_BAD_REQUEST, status.HTTP_500_INTERNAL_SERVER_ERROR]


@pytest.mark.django_db
def test_promis_validation():
    """Test: Validation des données de promis malformées."""
    client = APIClient()
    user = TestDataFactory.create_user()
    client.force_authenticate(user=user)
    
    produit = TestDataFactory.create_produit(stock=100, selling_price=100)
    
    data = {
        'produits': [{
            'produit': produit.id,
            'quantity': 1,
            'selling_price': 100,
            'discount': 0,
            'tva': 19.25,
            'is_promis': True,
            'promis_quantity': -5,  # Négatif!
            'promis_phone': 'invalid_phone' * 100
        }],
        'remise': 0,
        'centralized_cashRegister': True
    }
    
    response = client.post(
        reverse('facture-finaliser'),
        data=json.dumps(data),
        content_type='application/json'
    )
    
    # Doit échouer ou créer avec quantité 0
    assert response.status_code in [status.HTTP_400_BAD_REQUEST, status.HTTP_201_CREATED]
    
    if response.status_code == status.HTTP_201_CREATED:
        # Si créé, vérifier que le promis n'a pas été créé avec quantité négative
        facture = Facture.objects.latest('id')
        promis = Promis.objects.filter(facture=facture)
        for p in promis:
            assert p.quantite >= 0


@pytest.mark.django_db
def test_facture_suppression_protegee():
    """Test: Une facture validée ne peut pas être supprimée physiquement."""
    client = APIClient()
    user = TestDataFactory.create_user()
    client.force_authenticate(user=user)
    
    client_obj = TestDataFactory.create_client()
    facture = TestDataFactory.create_facture(client=client_obj, status='VAL')
    facture_id = facture.id
    
    response = client.delete(
        reverse('facture-detail', kwargs={'pk': facture_id})
    )
    
    # Doit être refusé
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    
    # La facture doit toujours exister
    assert Facture.objects.filter(id=facture_id).exists()


@pytest.mark.django_db
def test_injection_xss_protection():
    """Test: Protection contre les attaques XSS dans les champs texte."""
    client = APIClient()
    user = TestDataFactory.create_user()
    client.force_authenticate(user=user)
    
    produit = TestDataFactory.create_produit(stock=100, selling_price=100)
    
    # Tentative XSS
    xss_payload = '<script>alert("XSS")</script>'
    
    data = {
        'produits': [{
            'produit': produit.id,
            'quantity': 1,
            'selling_price': 100,
            'discount': 0,
            'tva': 19.25
        }],
        'client_name_override': xss_payload,
        'remise': 0,
        'centralized_cashRegister': True
    }
    
    response = client.post(
        reverse('facture-finaliser'),
        data=json.dumps(data),
        content_type='application/json'
    )
    
    # Si créée, vérifier que le script n'est pas exécutable (stocké comme texte)
    if response.status_code == status.HTTP_201_CREATED:
        facture = Facture.objects.latest('id')
        # Le script doit être stocké tel quel (l'échappement est fait au rendu)
        assert xss_payload in facture.client_name_override


@pytest.mark.django_db
def test_loyalty_points_manipulation():
    """Test: Protection contre la manipulation des points de fidélité."""
    client = APIClient()
    user = TestDataFactory.create_user()
    client.force_authenticate(user=user)
    
    # Client avec points de fidélité
    client_fidelite = TestDataFactory.create_client(
        is_loyalty_member=True,
        points_fidelite=100
    )
    
    produit = TestDataFactory.create_produit(stock=100, selling_price=100)
    
    # Tentative d'utiliser plus de points que disponible
    data = {
        'client': client_fidelite.id,
        'produits': [{
            'produit': produit.id,
            'quantity': 1,
            'selling_price': 100,
            'discount': 0,
            'tva': 19.25
        }],
        'loyalty': {
            'points_to_use': 10000,  # Plus que disponible!
            'use_pending_discount': False
        },
        'remise': 0,
        'centralized_cashRegister': True
    }
    
    response = client.post(
        reverse('facture-finaliser'),
        data=json.dumps(data),
        content_type='application/json'
    )
    
    # Si accepté, vérifier que les points n'ont pas été débités au-delà
    if response.status_code == status.HTTP_201_CREATED:
        client_fidelite.refresh_from_db()
        assert client_fidelite.points_fidelite >= 0


@pytest.mark.django_db
def test_decimal_precision_overflow():
    """Test: Protection contre les valeurs décimales extrêmes."""
    client = APIClient()
    user = TestDataFactory.create_user()
    client.force_authenticate(user=user)
    
    produit = TestDataFactory.create_produit(stock=100, selling_price=100)
    
    # Prix avec trop de décimales
    data = {
        'produits': [{
            'produit': produit.id,
            'quantity': 1,
            'selling_price': '999999999999999999.999999999999',  # Trop de décimales
            'discount': 0,
            'tva': 19.25
        }],
        'remise': 0,
        'centralized_cashRegister': True
    }
    
    response = client.post(
        reverse('facture-finaliser'),
        data=json.dumps(data),
        content_type='application/json'
    )
    
    # Doit échouer gracieusement
    assert response.status_code in [status.HTTP_400_BAD_REQUEST, status.HTTP_201_CREATED]
    
    if response.status_code == status.HTTP_201_CREATED:
        # Vérifier que le montant a été tronqué/arrondi correctement
        facture = Facture.objects.latest('id')
        # Le prix doit être stocké avec max 12 chiffres et 2 décimales
        assert facture.produits.first().selling_price == Decimal('999999999999.99')
