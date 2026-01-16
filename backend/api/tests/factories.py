"""
Test data factories for creating test objects.
Uses Django's ORM directly for simplicity.
"""
from django.contrib.auth import get_user_model
from decimal import Decimal
from django.utils import timezone
from ..models import (
    Produit, Rayon, Fournisseur, Client, Facture, FactureProduit,
    StockLot, Commande, CommandeProduit, ClotureCaisse, Caisse,
    MouvementCaisse, StockAdjustment
)

User = get_user_model()


class TestDataFactory:
    """Factory class for creating test objects with sensible defaults."""
    
    @staticmethod
    def create_user(username='testuser', password='testpass123', **kwargs):
        """Create a test user."""
        user = User.objects.create_user(
            username=username,
            password=password,
            email=kwargs.pop('email', f'{username}@test.com'),
        )
        return user
    
    @staticmethod
    def create_superuser(username='admin', password='adminpass123', **kwargs):
        """Create a superuser for tests."""
        user = User.objects.create_superuser(
            username=username,
            password=password,
            email=kwargs.pop('email', f'{username}@test.com'),
        )
        return user
    
    @staticmethod
    def create_rayon(name='Rayon Test', **kwargs):
        """Create a test rayon (category)."""
        return Rayon.objects.create(name=name, **kwargs)
    
    @staticmethod
    def create_fournisseur(name='Fournisseur Test', **kwargs):
        """Create a test supplier."""
        return Fournisseur.objects.create(
            name=name,
            address=kwargs.pop('address', '123 rue Test'),
            phone=kwargs.pop('phone', '0123456789'),
            email=kwargs.pop('email', 'fournisseur@test.com'),
            **kwargs
        )
    
    @staticmethod
    def create_produit(name='Produit Test', stock=100, cost_price=50, selling_price=100, **kwargs):
        """Create a test product."""
        rayon = kwargs.pop('rayon', None) or TestDataFactory.create_rayon()
        fournisseur = kwargs.pop('fournisseur', None) or TestDataFactory.create_fournisseur()
        stock_minimum = kwargs.pop('stock_minimum', 10)
        
        return Produit.objects.create(
            name=name,
            stock=stock,
            cost_price=Decimal(str(cost_price)),
            selling_price=Decimal(str(selling_price)),
            rayon=rayon,
            fournisseur=fournisseur,
            stock_minimum=stock_minimum,
            **kwargs
        )
    
    @staticmethod
    def create_client(name='Client Test', **kwargs):
        """Create a test client."""
        return Client.objects.create(
            name=name,
            phone=kwargs.pop('phone', '0612345678'),
            email=kwargs.pop('email', 'client@test.com'),
            address=kwargs.pop('address', '456 rue Client'),
            **kwargs
        )
    
    @staticmethod
    def create_facture(client=None, status='BROU', total_ttc=None, **kwargs):
        """
        Create a test invoice.
        Status codes: BROU (Brouillon), VAL (Validée), PAY (Payée), ANN (Annulée)
        """
        if client is None:
            client = TestDataFactory.create_client()
        
        if total_ttc is None:
            total_ttc = Decimal('0.00')
        
        return Facture.objects.create(
            client=client,
            status=status,
            total_ttc=total_ttc,
            **kwargs
        )
    
    @staticmethod
    def create_facture_produit(facture, produit, quantity=1, **kwargs):
        """Create a line item for an invoice."""
        selling_price = kwargs.pop('selling_price', produit.selling_price)
        
        return FactureProduit.objects.create(
            facture=facture,
            produit=produit,
            quantity=quantity,
            selling_price=selling_price,
            **kwargs
        )
    
    @staticmethod
    def create_stock_lot(produit, quantity=50, lot_name='LOT-TEST-001', commande_produit=None, **kwargs):
        """Create a stock lot for FIFO testing."""
        fournisseur = kwargs.pop('fournisseur', None) or produit.fournisseur
        quantity_remaining = kwargs.pop('quantity_remaining', quantity)
        price_cost = kwargs.pop('price_cost', produit.cost_price)
        date_expiration = kwargs.pop('date_expiration', timezone.now().date() + timezone.timedelta(days=365))
        date_reception = kwargs.pop('date_reception', timezone.now())  # Required field, defaults to now
        quantity_paid = kwargs.pop('quantity_paid', quantity)
        quantity_free = kwargs.pop('quantity_free', 0)
        
        return StockLot.objects.create(
            produit=produit,
            commande_produit=commande_produit,  # Now optional
            fournisseur=fournisseur,
            quantity_initial=quantity,
            quantity_paid=quantity_paid,
            quantity_free=quantity_free,
            quantity_remaining=quantity_remaining,
            price_cost=price_cost,
            lot=lot_name,
            date_expiration=date_expiration,
            date_reception=date_reception,
            **kwargs
        )
    
    @staticmethod
    def create_commande(fournisseur=None, status='PREP', **kwargs):
        """Create a test order."""
        if fournisseur is None:
            fournisseur = TestDataFactory.create_fournisseur()
        
        return Commande.objects.create(
            fournisseur=fournisseur,
            status=status,
            **kwargs
        )
    
    @staticmethod
    def create_mouvement_caisse(user, type_mouvement='ENTREE', montant=1000, description='Test mouvement', **kwargs):
        """Create a cash movement."""
        return MouvementCaisse.objects.create(
            user=user,
            type=type_mouvement,  # Changed from type_mouvement field to type
            montant=Decimal(str(montant)),
            description=description,
            **kwargs
        )
    
    @staticmethod
    def create_caisse(facture, montant, mode_paiement='especes', user=None, **kwargs):
        """Create a payment record."""
        return Caisse.objects.create(
            facture=facture,
            montant=Decimal(str(montant)),
            mode_paiement=mode_paiement,
            statut='completee',
            user=user,
            **kwargs
        )
