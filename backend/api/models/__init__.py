# -*- coding: utf-8 -*-
"""
API Models Package

All models are imported here for backward compatibility.
Usage: from api.models import Produit, Facture, etc.
"""

# Users
from .users import Profile, create_user_profile, save_user_profile

# Settings
from .settings import LoyaltySetting, PharmacySettings, InvoiceSettings

# Products
from .products import (
    Rayon, Forme, Groupe, FamilleRisque, 
    Substance, DrugInteraction, Produit
)

# Stock
from .stock import (
    StockLot, LotSequence, StockAdjustment, MouvementStock,
    generate_lot_number
)

# Clients
from .clients import Fournisseur, Client, AyantDroit

# Orders
from .orders import Commande, CommandeProduit, Avoir, LigneAvoir

# Billing
from .billing import (
    Facture, FactureProduit, FactureProduitAllocation,
    Caisse, RelevePaiement, ClotureCaisse, CouponMonnaie, Promis
)

# Inventory
from .inventory import (
    Inventaire, LigneInventaire, 
    RelationTransformation, HistoriqueTransformation
)

# Audit
from .audit import (
    ActivityLog, AuditLog, MouvementCaisse, 
    Ordonnancier, LigneOrdonnancier
)

# Communication
from .communication import SmsLog, SmsTemplate

# Signals for soft delete (preserving names before deletion)
from .signals import (
    preserve_product_name_on_delete,
)

__all__ = [
    # Users
    'Profile',
    # Settings
    'LoyaltySetting', 'PharmacySettings', 'InvoiceSettings',
    # Products
    'Rayon', 'Forme', 'Groupe', 'FamilleRisque', 
    'Substance', 'DrugInteraction', 'Produit',
    # Stock
    'StockLot', 'LotSequence', 'StockAdjustment', 'MouvementStock',
    'generate_lot_number',
    # Clients
    'Fournisseur', 'Client', 'AyantDroit',
    # Orders
    'Commande', 'CommandeProduit', 'Avoir', 'LigneAvoir',
    # Billing
    'Facture', 'FactureProduit', 'FactureProduitAllocation',
    'Caisse', 'RelevePaiement', 'ClotureCaisse', 'CouponMonnaie', 'Promis',
    # Inventory
    'Inventaire', 'LigneInventaire', 
    'RelationTransformation', 'HistoriqueTransformation',
    # Audit
    'ActivityLog', 'AuditLog', 'MouvementCaisse', 
    'Ordonnancier', 'LigneOrdonnancier',
    # Communication
    'SmsLog', 'SmsTemplate',
]
