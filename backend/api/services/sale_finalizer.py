"""
Finalisation d'une vente : création de facture, produits, promis, ordonnancier,
coupon, validation et paiements.

Extrait de SalesService.finalize_sale pour lisibilité et maintenabilité.
"""
import logging
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from django.db import transaction
from django.db.utils import DataError
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from ..models import (
    Caisse,
    CouponMonnaie,
    Facture,
    FactureProduit,
    LigneOrdonnancier,
    Ordonnancier,
    PosteVente,
    Produit,
    Promis,
    get_next_ticket_session,
)
from ..utils.validation import (
    MAX_DECIMAL_10_2,
    MAX_DECIMAL_12_2,
    MAX_DECIMAL_5_2,
    MAX_INT32,
    parse_decimal,
    parse_int,
    validation_error_message,
)
from .sale_validator import SaleValidator

logger = logging.getLogger(__name__)


def _as_value_error(exc):
    """Convertit une ValidationError DRF en ValueError (contrat des services :
    les appelants traduisent ValueError en HTTP 400)."""
    return ValueError(validation_error_message(exc))


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
        # Un dict/liste ici lèverait TypeError dans le .create() ORM → 500.
        for id_field, id_value in (('client', client_id), ('ayant_droit', ayant_droit_id)):
            if id_value:
                try:
                    parsed_id = parse_int(id_value, field=id_field, min_value=1, max_value=MAX_INT32)
                except ValidationError as exc:
                    raise _as_value_error(exc) from exc
                if id_field == 'client':
                    client_id = parsed_id
                else:
                    ayant_droit_id = parsed_id
        # Decimal fini >= 0 borné au DecimalField(12, 2) de Facture.remise.
        # Avant : 'NaN' passait le cast et se persistait en numeric.
        try:
            remise_montant = parse_decimal(
                data.get('remise', '0') or '0', field='remise',
                min_value=Decimal(0), max_value=MAX_DECIMAL_12_2
            )
        except ValidationError as exc:
            raise _as_value_error(exc) from exc
        produits_data = data.get('produits') or []
        paiements_data = data.get('paiements', [])
        loyalty_data = data.get('loyalty', {})
        ordonnance_data = data.get('ordonnance')
        coupon_numero = data.get('coupon_numero')
        validation_user = data.get('validation_user') or user
        remise_validation_user = data.get('remise_validation_user')
        prix_validation_user = data.get('prix_validation_user')

        if not isinstance(produits_data, list) or not produits_data:
            raise ValueError("La liste des produits ne peut pas être vide.")

        # 2. Validate poste de vente
        poste_vente_id = data.get('poste_vente_id')
        if poste_vente_id:
            # Un dict/liste ici lèverait TypeError dans le filtre ORM → 500.
            try:
                poste_vente_id = parse_int(
                    poste_vente_id, field='poste_vente_id', min_value=1, max_value=MAX_INT32
                )
            except ValidationError as exc:
                raise _as_value_error(exc) from exc
        poste_vente = SaleFinalizer._validate_poste_vente(user, poste_vente_id, centralized)

        # Mode centralisé : la facture est rattachée à la caisse qui
        # l'encaissera — pas au poste du vendeur (un poste POS n'a pas de
        # caisse → poste_caisse null serait filtré hors de la file caisse,
        # la notif WS ignorée, et le paiement exclu des totaux/clôture).
        poste_caisse_id = (
            SaleFinalizer._resolve_poste_caisse(data, poste_vente)
            if centralized
            else (poste_vente.caisse_id if poste_vente else None)
        )
        poste_vente_id = poste_vente.id if poste_vente else None

        # 3. Validate product entries
        SaleFinalizer._validate_products(produits_data)

        # 4. Create or update Facture
        existing_id = data.get('existing_id')
        if existing_id:
            # Un dict/liste ici lèverait TypeError dans le .get() ORM → 500.
            try:
                existing_id = parse_int(
                    existing_id, field='existing_id', min_value=1, max_value=MAX_INT32
                )
            except ValidationError as exc:
                raise _as_value_error(exc) from exc
        if poste_vente_id and poste_vente:
            poste_vente_id = poste_vente.id

        if existing_id:
            facture = SaleFinalizer._update_existing_facture(
                existing_id, client_id, client_name_override, ayant_droit_id,
                remise_montant, validation_user, poste_vente, poste_caisse_id, centralized,
                remise_validation_user, prix_validation_user
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
                remise_validated_by=remise_validation_user,
                prix_validated_by=prix_validation_user,
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
                verse_dec = Decimal(str(montant_verse))
                # Rejette NaN/Infinity (persistables en numeric sinon)
                if verse_dec.is_finite():
                    facture.montant_verse = verse_dec
            except (InvalidOperation, TypeError, ValueError):
                pass
        if montant_rendu is not None:
            try:
                rendu_dec = Decimal(str(montant_rendu))
                if rendu_dec.is_finite():
                    facture.montant_rendu = rendu_dec
            except (InvalidOperation, TypeError, ValueError):
                pass
        facture.save(
            update_fields=['montant_verse', 'montant_rendu']
            if (montant_verse is not None or montant_rendu is not None) else None
        )

        # 10. Validation (caisse centralisée ou directe)
        if not isinstance(loyalty_data, dict):
            # 'loyalty' non-dict → .get() lèverait AttributeError → 500.
            loyalty_data = {}
        if not isinstance(paiements_data, list):
            raise ValueError("Le format des paiements est invalide.")
        paiement_immediat = Decimal(0)
        for p in paiements_data:
            if not isinstance(p, dict):
                # p['montant'] sur un non-dict → TypeError → 500.
                raise ValueError("Le format d'un paiement est invalide.")
            try:
                paiement_immediat += parse_decimal(
                    p.get('montant', 0), field='montant du paiement',
                    min_value=Decimal(0), max_value=MAX_DECIMAL_10_2
                )
            except ValidationError as exc:
                raise _as_value_error(exc) from exc
        validation_data = {
            'use_pending_discount': loyalty_data.get('use_pending_discount', False),
            'points_to_use': loyalty_data.get('points_to_use', 0),
            'paiement_immediat': paiement_immediat,
            'mode_paiement': data.get('mode_paiement')
        }
        SaleValidator.validate_invoice(facture, validation_user, validation_data)

        if centralized:
            # Notifier la caisse centralisée en temps réel via WebSocket
            facture_id = facture.id
            poste_caisse_id = getattr(facture, 'poste_caisse_id', None)

            def notify_caisse():
                try:
                    from channels.layers import get_channel_layer
                    from asgiref.sync import async_to_sync
                    channel_layer = get_channel_layer()
                    if channel_layer:
                        async_to_sync(channel_layer.group_send)(
                            'caisse_centralisee',
                            {
                                'type': 'facture_update',
                                'action': 'created',
                                'facture_id': facture_id,
                                'poste_caisse_id': poste_caisse_id,
                            }
                        )
                except Exception as ws_err:
                    logger.warning(f"WebSocket broadcast caisse échoué: {ws_err}")

            transaction.on_commit(notify_caisse)

        # 11. Payments (direct mode only)
        if not centralized and paiements_data:
            SaleFinalizer._handle_payments(facture, paiements_data, validation_user)

        return facture

    # ──────────────────────────────────────────────
    #  Private helpers
    # ──────────────────────────────────────────────

    @staticmethod
    def _resolve_poste_caisse(data, poste_vente):
        """Caisse destinataire d'une vente centralisée (multi-caisses).

        Priorité :
        1. ``poste_caisse_id`` explicite — choix du vendeur sur l'appareil
           (mobile/tablette) ; doit correspondre à un PosteVente ouvert
           rattaché à cette caisse ;
        2. la caisse du poste_vente transmis — le web envoie le poste de
           la caissière choisie comme ``poste_vente_id`` ;
        3. la caisse ouverte le plus récemment (comportement historique,
           couvre le cas mono-caisse).
        """
        open_caisse_postes = PosteVente.objects.filter(
            est_actif=True, caisse__isnull=False
        )
        requested = data.get('poste_caisse_id')
        if requested:
            try:
                requested_id = parse_int(
                    requested, field='poste_caisse_id',
                    min_value=1, max_value=MAX_INT32
                )
            except ValidationError as exc:
                raise _as_value_error(exc) from exc
            target = open_caisse_postes.filter(caisse_id=requested_id).first()
            if not target:
                raise ValueError(
                    "Le point de caisse choisi n'est pas ouvert. "
                    "Veuillez choisir une caisse actuellement ouverte."
                )
            return target.caisse_id
        if poste_vente and poste_vente.caisse_id:
            return poste_vente.caisse_id
        caisse_ouverte = open_caisse_postes.first()
        if not caisse_ouverte:
            raise ValueError(
                "Aucun point de caisse n'est ouvert. "
                "Veuillez ouvrir un point de caisse avant de réaliser une vente."
            )
        return caisse_ouverte.caisse_id

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

            if poste_vente.caisse_id is not None:
                # Poste rattaché à une caisse physique : en centralisé, seul
                # son propriétaire (la caissière) peut y vendre — sinon un POS
                # se grefferait sur le poste de la caisse et mélangerait les
                # totaux. Les postes POS purs restent partageables entre
                # vendeurs (comptoir partagé).
                if poste_vente.vendeur_id != user.id and not user.is_superuser:
                    raise ValueError(
                        f"Le point de vente {poste_vente.nom} est rattaché à la caisse "
                        f"de {poste_vente.vendeur.username}. Ouvrez votre propre point de vente."
                    )
            elif not centralized and poste_vente.vendeur != user and not user.is_superuser:
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
        if not all(isinstance(p, dict) for p in produits_data):
            # p.get() sur un non-dict → AttributeError → 500.
            raise ValueError("Format de ligne produit invalide.")
        try:
            requested_ids = [
                parse_int(p.get('produit'), field='produit', min_value=1, max_value=MAX_INT32)
                for p in produits_data if p.get('produit') is not None
            ]
        except ValidationError as exc:
            raise _as_value_error(exc) from exc
        valid_product_ids = set(
            Produit.objects.filter(id__in=requested_ids).values_list('id', flat=True)
        )
        for p in produits_data:
            try:
                pid = parse_int(p.get('produit'), field='produit', min_value=1, max_value=MAX_INT32)
            except ValidationError as exc:
                raise _as_value_error(exc) from exc
            if pid not in valid_product_ids:
                raise ValueError(f"Produit introuvable (id={pid}).")
            try:
                parse_decimal(
                    p.get('selling_price', '0'), field='selling_price',
                    min_value=Decimal(0), max_value=MAX_DECIMAL_10_2
                )
            except ValidationError as exc:
                raise ValueError(f"Prix de vente invalide ou hors limites pour le produit id={pid}.") from exc
            try:
                parse_int(p.get('quantity', 0), field='quantity', max_value=MAX_INT32)
            except ValidationError as exc:
                raise ValueError(f"Quantité invalide ou hors limites pour le produit id={pid}.") from exc

    @staticmethod
    def _update_existing_facture(existing_id, client_id, client_name_override, ayant_droit_id,
                                  remise_montant, validation_user, poste_vente, poste_caisse_id, centralized,
                                  remise_validation_user=None, prix_validation_user=None):
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
            facture.remise_validated_by = remise_validation_user
            facture.prix_validated_by = prix_validation_user
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
            facture_produits_to_create = []
            for p in produits_data:
                # Champs déjà validés par _validate_products, mais on re-parse
                # défensivement : 'discount'/'tva' n'y sont pas contrôlés et
                # NaN/infini passeraient le cast Decimal puis planteraient le
                # quantize (InvalidOperation → 500).
                try:
                    produit_id = parse_int(
                        p.get('produit'), field='produit',
                        min_value=1, max_value=MAX_INT32
                    )
                    quantity = parse_int(
                        p.get('quantity', 0), field='quantity', max_value=MAX_INT32
                    )
                    selling_price = parse_decimal(
                        p.get('selling_price', '0'), field='selling_price',
                        min_value=Decimal(0), max_value=MAX_DECIMAL_10_2
                    )
                    discount = parse_decimal(
                        p.get('discount', '0'), field='discount',
                        min_value=Decimal(0), max_value=MAX_DECIMAL_10_2
                    )
                    tva = parse_decimal(
                        p.get('tva', '0'), field='tva',
                        min_value=Decimal(0), max_value=MAX_DECIMAL_5_2
                    )
                except ValidationError as exc:
                    raise _as_value_error(exc) from exc
                # lot_id : un dict/liste lèverait TypeError dans bulk_create → 500.
                lot_id = p.get('lot_id')
                if lot_id is not None:
                    try:
                        lot_id = parse_int(lot_id, field='lot_id', min_value=1, max_value=MAX_INT32)
                    except ValidationError as exc:
                        raise _as_value_error(exc) from exc
                facture_produits_to_create.append(FactureProduit(
                    facture=facture,
                    produit_id=produit_id,
                    quantity=quantity,
                    selling_price=selling_price.quantize(
                        Decimal('0.01'), rounding=ROUND_HALF_UP
                    ),
                    discount=discount.quantize(
                        Decimal('0.01'), rounding=ROUND_HALF_UP
                    ),
                    tva=tva.quantize(
                        Decimal('0.01'), rounding=ROUND_HALF_UP
                    ),
                    stock_lot_id=lot_id
                ))
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
            # Vérifier si le coupon existe mais n'est pas actif
            if CouponMonnaie.objects.filter(numero=coupon_numero).exists():
                raise ValueError(f"Le coupon #{coupon_numero} n'est pas actif (déjà utilisé ou expiré).")
            raise ValueError(f"Coupon #{coupon_numero} introuvable.")

    @staticmethod
    def _handle_promis(facture, produits_data, client_id, client_name_override, validation_user):
        """Crée les promis pour les produits marqués is_promis."""
        promis_to_create = []
        for p in produits_data:
            if not isinstance(p, dict):
                raise ValueError("Format de ligne produit invalide.")
            # '5' > 0 lèverait TypeError → 500 ; on parse d'abord en entier.
            try:
                promis_qty = parse_int(
                    p.get('promis_quantity', 0), field='promis_quantity', max_value=MAX_INT32
                )
            except ValidationError as exc:
                raise _as_value_error(exc) from exc
            if not p.get('is_promis') or promis_qty <= 0:
                continue
            promis_to_create.append(Promis(
                facture=facture,
                client_id=client_id,
                client_name=client_name_override or '',
                client_phone=p.get('promis_phone', ''),
                produit_id=p.get('produit'),
                quantite=promis_qty,
                status=Promis.Status.EN_ATTENTE,
                created_by=validation_user
            ))
        if promis_to_create:
            Promis.objects.bulk_create(promis_to_create)

    @staticmethod
    def _handle_ordonnancier(ordonnance_data, facture, validation_user, image_file):
        """Crée l'ordonnancier et ses lignes."""
        if not isinstance(ordonnance_data, dict):
            # .get() sur un non-dict → AttributeError → 500.
            raise ValueError("Le format de l'ordonnance est invalide.")
        lignes = ordonnance_data.get('lignes', [])
        if not isinstance(lignes, list) or not all(isinstance(l, dict) for l in lignes):
            raise ValueError("Le format des lignes d'ordonnance est invalide.")
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
            ) for l in lignes
        ]
        if lignes_to_create:
            LigneOrdonnancier.objects.bulk_create(lignes_to_create)

    @staticmethod
    def _handle_payments(facture, paiements_data, validation_user):
        """Enregistre les paiements en mode direct."""
        if Caisse.objects.filter(facture=facture).exists():
            return
        for p_data in paiements_data:
            if not isinstance(p_data, dict):
                # p_data[...] sur un non-dict → TypeError → 500.
                raise ValueError("Le format d'un paiement est invalide.")
            try:
                montant = parse_decimal(
                    p_data.get('montant', 0), field='montant du paiement',
                    max_value=MAX_DECIMAL_10_2
                )
            except ValidationError as exc:
                raise _as_value_error(exc) from exc
            if montant <= 0:
                # Lignes vides/négatives ignorées (le frontend envoie des
                # lignes par mode inutilisé) — jamais persistées.
                continue
            try:
                # part_patient/part_assurance : DecimalField(10, 2) nullables —
                # 'abc'/NaN/-5 passaient bruts jusqu'au create → 500 ou
                # montant négatif/NaN persisté.
                part_patient = (
                    parse_decimal(
                        p_data.get('part_patient'), field='part_patient',
                        min_value=Decimal(0), max_value=MAX_DECIMAL_10_2
                    ) if p_data.get('part_patient') is not None else None
                )
                part_assurance = (
                    parse_decimal(
                        p_data.get('part_assurance'), field='part_assurance',
                        min_value=Decimal(0), max_value=MAX_DECIMAL_10_2
                    ) if p_data.get('part_assurance') is not None else None
                )
            except ValidationError as exc:
                raise _as_value_error(exc) from exc
            if p_data.get('mode') == 'depot':
                client = facture.client
                if not client or not client.is_deposit_enabled:
                    raise ValueError(
                        "Paiement par dépôt impossible : ce client n'a pas le dépôt/acompte activé."
                    )
                if client.solde_depot < montant:
                    raise ValueError(
                        f"Solde dépôt insuffisant : {client.solde_depot} F disponibles, "
                        f"{montant} F demandés."
                    )
            paiement = Caisse.objects.create(
                facture=facture,
                mode_paiement=p_data.get('mode', 'especes'),
                montant=montant,
                reference=p_data.get('reference'),
                statut='completee',
                user=validation_user,
                part_patient=part_patient,
                part_assurance=part_assurance
            )
            from .payment_service import PaymentService
            PaymentService.process_payment(paiement, is_created=True)
        facture.refresh_from_db()
