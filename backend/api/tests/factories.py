"""
Test data factories for creating test objects.
Uses Django's ORM directly for simplicity.
"""
from django.contrib.auth import get_user_model
from decimal import Decimal
from django.utils import timezone
import itertools
from ..models import (
    Produit, Rayon, Fournisseur, Client, Facture, FactureProduit,
    StockLot, Commande, CommandeProduit, ClotureCaisse, Caisse,
    MouvementCaisse, StockAdjustment, PosteCaisse, SessionCaisse
)

User = get_user_model()


class TestDataFactory:
    """Factory class for creating test objects with sensible defaults."""
    _counter = itertools.count(1)
    
    @staticmethod
    def _next_id():
        return next(TestDataFactory._counter)
    
    @staticmethod
    def create_user(username=None, password='testpass123', **kwargs):
        """Create a test user."""
        if username is None:
            username = f'user_{TestDataFactory._next_id()}'
        user = User.objects.create_user(
            username=username,
            password=password,
            email=kwargs.pop('email', f'{username}@test.com'),
        )
        return user
    
    @staticmethod
    def create_superuser(username=None, password='adminpass123', **kwargs):
        """Create a superuser for tests."""
        if username is None:
            username = f'admin_{TestDataFactory._next_id()}'
        user = User.objects.create_superuser(
            username=username,
            password=password,
            email=kwargs.pop('email', f'{username}@test.com'),
        )
        return user
    
    @staticmethod
    def create_rayon(name=None, **kwargs):
        """Create a test rayon (category)."""
        if name is None:
            name = f'Rayon_{TestDataFactory._next_id()}'
        return Rayon.objects.create(name=name, **kwargs)
    
    @staticmethod
    def create_fournisseur(name=None, **kwargs):
        """Create a test supplier."""
        uid = TestDataFactory._next_id()
        if name is None:
            name = f'Fournisseur_{uid}'
            
        return Fournisseur.objects.create(
            name=name,
            address=kwargs.pop('address', '123 rue Test'),
            phone=kwargs.pop('phone', f'01234567{uid:02d}'),
            email=kwargs.pop('email', f'fournisseur_{uid}@test.com'),
            **kwargs
        )
    
    @staticmethod
    def create_produit(name=None, stock=100, cost_price=50, selling_price=100, **kwargs):
        """Create a test product."""
        uid = TestDataFactory._next_id()
        if name is None:
            name = f'Produit_{uid}'
        
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
    def create_client(name=None, **kwargs):
        """Create a test client."""
        uid = TestDataFactory._next_id()
        if name is None:
            name = f'Client_{uid}'
            
        return Client.objects.create(
            name=name,
            phone=kwargs.pop('phone', f'06123456{uid:02d}'),
            email=kwargs.pop('email', f'client_{uid}@test.com'),
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
    def create_commande_produit(commande, produit, quantity=1, **kwargs):
        """Create a line item for an order."""
        # Clean up kwargs to avoid passing unknown fields if user uses old names
        kwargs.pop('quantite_demandee', None)
        kwargs.pop('quantite_recue', None)
        
        price = kwargs.pop('price', produit.cost_price)
        price_cost = kwargs.pop('price_cost', price) # Default to price if not set
        
        return CommandeProduit.objects.create(
            commande=commande,
            produit=produit,
            quantity=quantity,
            price=price,
            price_cost=price_cost,
            **kwargs
        )
    
    @staticmethod
    def create_mouvement_caisse(user, type_mouvement='ENTREE', montant=1000, motif='Test motif', **kwargs):
        """Create a cash movement."""
        description = kwargs.pop('description', 'Test description')
        return MouvementCaisse.objects.create(
            user=user,
            type=type_mouvement,
            montant=Decimal(str(montant)),
            motif=motif,
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

    @staticmethod
    def create_poste_caisse(nom=None, code=None, **kwargs):
        """Create a test cashier station."""
        uid = TestDataFactory._next_id()
        if nom is None:
            nom = f'Caisse {uid}'
        if code is None:
            code = f'CAISSE-{uid:03d}'
        return PosteCaisse.objects.create(
            nom=nom,
            code=code,
            est_ouvert=kwargs.pop('est_ouvert', True),
            **kwargs
        )

    @staticmethod
    def create_session_caisse(user=None, poste=None, **kwargs):
        """Create an active cashier session for tests."""
        if poste is None:
            poste = TestDataFactory.create_poste_caisse()
        if user is None:
            user = TestDataFactory.create_superuser()
        return SessionCaisse.objects.create(
            poste=poste,
            ouvert_par=user,
            fond_de_caisse=Decimal(str(kwargs.pop('fond_de_caisse', 0))),
            est_active=kwargs.pop('est_active', True),
            **kwargs
        )
