"""
SalesService — Facade mince pour la gestion des ventes.

Délègue vers des services spécialisés :
  - SaleFinalizer.finalize_sale     → création + validation d'une vente
  - SaleValidator.validate_invoice  → validation stock, lots, fidélité
  - SaleCanceller.cancel_invoice    → annulation + restauration stock
  - SaleModifier.modify_sale        → modification d'une vente validée

LotAllocationService centralise la logique d'allocation/restauration des lots,
éliminant la duplication entre cancel, modify et validate.

Rétro-compatibilité : toutes les méthodes statiques gardent la même signature
que l'ancien SalesService monolithique, donc aucun changement côté appelants
(factures.py, tests, etc.).
"""
import logging

from .sale_canceller import SaleCanceller
from .sale_finalizer import SaleFinalizer
from .sale_modifier import SaleModifier
from .sale_validator import SaleValidator

logger = logging.getLogger(__name__)


class SalesService:
    """
    Facade pour la gestion des ventes.
    Préserve l'API publique existante tout en déléguant aux services spécialisés.
    """

    @staticmethod
    def finalize_sale(user, data, centralized=True, image_file=None):
        return SaleFinalizer.finalize_sale(user, data, centralized, image_file)

    @staticmethod
    def validate_invoice(facture, validation_user, data):
        return SaleValidator.validate_invoice(facture, validation_user, data)

    @staticmethod
    def cancel_invoice(facture, user, motif=""):
        return SaleCanceller.cancel_invoice(facture, user, motif)

    @staticmethod
    def modify_sale(facture, user, data):
        return SaleModifier.modify_sale(facture, user, data)
