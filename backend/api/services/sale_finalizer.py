"""
Finalisation d'une vente : création de facture, produits, promis, ordonnancier,
coupon, validation et paiements.

Extrait de SalesService.finalize_sale pour lisibilité et maintenabilité.
"""
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from django.db import transaction
from django.db.utils import DataError
from django.utils import timezone
import logging

from ..models import (
    Facture, FactureProduit, Caisse,
    Produit, Promis, Ordonnancier,
    LigneOrdonnancier, get_next_ticket_session,
    CouponMonnaie, DepotClient, PosteVente
)
from .promotion_service import PromotionService

logger = logging.getLogger(__name__)


class SaleFinalizer:
    """Orchestre la finalisation complète d'une vente."""

    @staticmethod
    @transaction.atomic
    def finalize_sale(user, data, centralized=True, image_file=None):
        """
        Atomic implementation of sale finalization.
        Creates Facture, FactureProduit, Promis, Ordonnancier, and handles validation.
        """
        # 1. Extract & validate data
        client_id = data.get('client')
        client_name_override = data.get('client_name_override')
        ayant_droit_id = data.get('ayant_droit')
        try:
            remise_montant = Decimal(str(data.get('remise', '0') or '0'))
        except (InvalidOperation, ValueError):
            remise_montant = Decimal('0')
        produits_data = data.get('produits') or []
        paiements_data = data.get('paiements', [])
        loyalty_data = data.get('loyalty', {})
        ordonnance_data = data.get('ordonnance')
        coupon_numero = data.get('coupon_numero')
        validation_user = data.get('validation_user') or user

        if not isinstance(produits_data, list) or not produits_data:
            raise ValueError("La liste des produits ne peut pas être vide.")

        # 2. Validate poste de vente
        poste_vente_id = data.get('poste_vente_id')
        poste_vente = SaleFinalizer._validate_poste_vente(user, poste_vente_id, centralized)

        if centralized:
            caisse_ouverte = PosteVente.objects.filter(est_actif=True, caisse__isnull=False).first()
            if not caisse_ouverte:
                raise ValueError(
                    "Aucun point de caisse n'est ouvert. "
                    "Veuillez ouvrir un point de caisse avant de réaliser une vente."
                )

        poste_caisse_id = poste_vente.caisse_id if poste_vente else None
        poste_vente_id = poste_vente.id if poste_vente else None

        # 3. Validate product entries
        SaleFinalizer._validate_products(produits_data)

        # 4. Create or update Facture
        existing_id = data.get('existing_id')
        if poste_vente_id and poste_vente:
            poste_vente_id = poste_vente.id
            poste_caisse_id = poste_vente.caisse_id

        if existing_id:
            facture = SaleFinalizer._update_existing_facture(
                existing_id, client_id, client_name_override, ayant_droit_id,
                remise_montant, validation_user, poste_vente, poste_caisse_id, centralized
            )
        else:
            facture = Facture.objects.create(
                client_id=client_id,
                client_name_override=client_name_override,
                ayant_droit_id=ayant_droit_id,
                remise=remise_montant,
                status=Facture.Status.BROUILLON,
                created_by=validation_user,
                validated_by=validation_user,
                poste_caisse_id=poste_caisse_id,
                poste_vente=poste_vente,
                ticket_session=get_next_ticket_session() if centralized else None
            )

        # 5. Create FactureProduit lines
        SaleFinalizer._create_facture_produits(facture, produits_data)

        # Recalculate totals before validation
        facture.calculate_totals(save=True)

        # 6. Handle Coupon
        if coupon_numero:
            SaleFinalizer._handle_coupon(coupon_numero, facture, validation_user)

        # 7. Handle Promis
        SaleFinalizer._handle_promis(facture, produits_data, client_id, client_name_override, validation_user)

        # 8. Handle Ordonnancier
        if ordonnance_data:
            SaleFinalizer._handle_ordonnancier(ordonnance_data, facture, validation_user, image_file)

        # 9. Store ticket payment info
        montant_verse = data.get('montant_verse')
        montant_rendu = data.get('montant_rendu')
        if montant_verse is not None:
            try:
                facture.montant_verse = Decimal(str(montant_verse))
            except (InvalidOperation, TypeError, ValueError):
                pass
        if montant_rendu is not None:
            try:
                facture.montant_rendu = Decimal(str(montant_rendu))
            except (InvalidOperation, TypeError, ValueError):
                pass
        facture.save(
            update_fields=['montant_verse', 'montant_rendu']
            if (montant_verse is not None or montant_rendu is not None) else None
        )

        # 10. Validation or Proforma
        if centralized:
            facture.status = Facture.Status.PROFORMA
            facture._skip_audit = True
            facture.save(update_fields=['status'])
        else:
            validation_data = {
                'use_pending_discount': loyalty_data.get('use_pending_discount', False),
                'points_to_use': loyalty_data.get('points_to_use', 0),
                'paiement_immediat': sum(Decimal(str(p['montant'])) for p in paiements_data),
                'mode_paiement': data.get('mode_paiement')
            }
            from .sale_validator import SaleValidator
            SaleValidator.validate_invoice(facture, validation_user, validation_data)

        # 11. Payments (direct mode only)
        if not centralized and paiements_data:
            SaleFinalizer._handle_payments(facture, paiements_data, validation_user)

        return facture

    # ──────────────────────────────────────────────
    #  Private helpers
    # ──────────────────────────────────────────────

    @staticmethod
    def _validate_poste_vente(user, poste_vente_id, centralized):
        """Valide et retourne le poste de vente actif."""
        if poste_vente_id:
            poste_vente = PosteVente.objects.filter(
                id=poste_vente_id, est_actif=True
            ).select_related('caisse', 'vendeur').first()

            if not poste_vente:
                raise ValueError(
                    "Le point de vente sélectionné n'est pas actif ou n'existe pas. "
                    "Veuillez ouvrir un point de vente avant de réaliser une vente."
                )

            if not centralized and poste_vente.vendeur != user and not user.is_superuser:
                raise ValueError(
                    f"Seul {poste_vente.vendeur.username} (qui a ouvert ce point de vente) "
                    f"peut encaisser ici. Veuillez ouvrir votre propre point de vente."
                )
        else:
            poste_vente = PosteVente.objects.filter(
                vendeur=user, est_actif=True
            ).select_related('caisse').first()

            if not poste_vente:
                raise ValueError(
                    "Vous n'avez aucun point de vente actif. "
                    "Veuillez ouvrir un point de vente avant de réaliser une vente."
                )

        return poste_vente

    @staticmethod
    def _validate_products(produits_data):
        """Valide les entrées produit avant toute opération DB."""
        valid_product_ids = set(
            Produit.objects.filter(
                id__in=[p.get('produit') for p in produits_data if p.get('produit')]
            ).values_list('id', flat=True)
        )
        for p in produits_data:
            pid = p.get('produit')
            if not pid or pid not in valid_product_ids:
                raise ValueError(f"Produit introuvable (id={pid}).")
            try:
                price = Decimal(str(p.get('selling_price', '0')))
                if abs(price) >= Decimal('10000000000'):
                    raise ValueError(f"Prix de vente hors limites pour le produit id={pid}.")
            except (InvalidOperation, ValueError) as exc:
                raise ValueError(f"Prix de vente invalide pour le produit id={pid}: {exc}") from exc
            try:
                int(p.get('quantity', 0))
            except (TypeError, ValueError):
                raise ValueError(f"Quantité invalide pour le produit id={pid}.")

    @staticmethod
    def _update_existing_facture(existing_id, client_id, client_name_override, ayant_droit_id,
                                  remise_montant, validation_user, poste_vente, poste_caisse_id, centralized):
        """Met à jour une facture existante (mode re-validation)."""
        try:
            facture = Facture.objects.get(id=existing_id)
            facture.status = Facture.Status.BROUILLON
            facture.client_id = client_id
            facture.client_name_override = client_name_override
            facture.ayant_droit_id = ayant_droit_id
            facture.remise = remise_montant
            facture.created_by = validation_user
            facture.validated_by = validation_user
            if poste_vente:
                facture.poste_vente = poste_vente
            if poste_caisse_id:
                facture.poste_caisse_id = poste_caisse_id
            if centralized and not facture.ticket_session:
                facture.ticket_session = get_next_ticket_session()
            facture.save()

            facture.produits.all().delete()
            Promis.objects.filter(facture=facture).delete()
            Ordonnancier.objects.filter(facture=facture).delete()
            return facture
        except Facture.DoesNotExist:
            raise ValueError(f"La facture #{existing_id} est introuvable.")

    @staticmethod
    def _create_facture_produits(facture, produits_data):
        """Crée les lignes FactureProduit en bulk."""
        try:
            facture_produits_to_create = [
                FactureProduit(
                    facture=facture,
                    produit_id=p.get('produit'),
                    quantity=int(p.get('quantity', 0)),
                    selling_price=Decimal(str(p.get('selling_price', '0'))).quantize(
                        Decimal('0.01'), rounding=ROUND_HALF_UP
                    ),
                    discount=Decimal(str(p.get('discount', '0'))).quantize(
                        Decimal('0.01'), rounding=ROUND_HALF_UP
                    ),
                    tva=Decimal(str(p.get('tva', '0'))).quantize(
                        Decimal('0.01'), rounding=ROUND_HALF_UP
                    ),
                    stock_lot_id=p.get('lot_id')
                ) for p in produits_data
            ]
            if facture_produits_to_create:
                FactureProduit.objects.bulk_create(facture_produits_to_create)
                for item, p in zip(facture_produits_to_create, produits_data):
                    allocs = p.get('lot_allocations')
                    if allocs:
                        item._lot_allocations = allocs
        except DataError as e:
            raise ValueError(f"Valeur numérique hors limites dans les produits : {e}") from e

    @staticmethod
    def _handle_coupon(coupon_numero, facture, validation_user):
        """Traite un coupon de monnaie."""
        try:
            coupon = CouponMonnaie.objects.get(
                numero=coupon_numero, status=CouponMonnaie.Status.ACTIF
            )
            coupon.status = CouponMonnaie.Status.UTILISE
            coupon.facture_utilisation = facture
            coupon.date_utilisation = timezone.now()
            coupon.utilise_par = validation_user
            coupon.save()
        except CouponMonnaie.DoesNotExist:
            pass

    @staticmethod
    def _handle_promis(facture, produits_data, client_id, client_name_override, validation_user):
        """Crée les promis pour les produits marqués is_promis."""
        promis_to_create = [
            Promis(
                facture=facture,
                client_id=client_id,
                client_name=client_name_override or '',
                client_phone=p.get('promis_phone', ''),
                produit_id=p['produit'],
                quantite=p['promis_quantity'],
                status=Promis.Status.EN_ATTENTE,
                created_by=validation_user
            ) for p in produits_data if p.get('is_promis') and p.get('promis_quantity', 0) > 0
        ]
        if promis_to_create:
            Promis.objects.bulk_create(promis_to_create)

    @staticmethod
    def _handle_ordonnancier(ordonnance_data, facture, validation_user, image_file):
        """Crée l'ordonnancier et ses lignes."""
        ord_obj = Ordonnancier.objects.create(
            patient_nom=ordonnance_data.get('patient_nom'),
            prescripteur_nom=ordonnance_data.get('prescripteur_nom'),
            image_ordonnance=image_file,
            facture=facture,
            enregistre_par=validation_user
        )
        lignes_to_create = [
            LigneOrdonnancier(
                ordonnancier=ord_obj,
                produit_id=l.get('produit_id'),
                produit_nom=l.get('produit_nom'),
                quantite=l.get('quantite'),
                surveillance_category=l.get('surveillance_category', 'NONE')
            ) for l in ordonnance_data.get('lignes', [])
        ]
        if lignes_to_create:
            LigneOrdonnancier.objects.bulk_create(lignes_to_create)

    @staticmethod
    def _handle_payments(facture, paiements_data, validation_user):
        """Enregistre les paiements en mode direct."""
        if Caisse.objects.filter(facture=facture).exists():
            return
        for p_data in paiements_data:
            if Decimal(str(p_data.get('montant', 0))) > 0:
                paiement = Caisse.objects.create(
                    facture=facture,
                    mode_paiement=p_data.get('mode', 'especes'),
                    montant=Decimal(str(p_data['montant'])),
                    reference=p_data.get('reference'),
                    statut='completee',
                    user=validation_user,
                    part_patient=p_data.get('part_patient'),
                    part_assurance=p_data.get('part_assurance')
                )
                from .payment_service import PaymentService
                PaymentService.process_payment(paiement, is_created=True)
        facture.refresh_from_db()
