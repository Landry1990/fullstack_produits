from decimal import Decimal
from django.db import transaction
from django.db.models import Sum

class PaymentService:
    @staticmethod
    @transaction.atomic
    def process_payment(caisse, is_created=True):
        """
        Remplace la logique du signal post_save sur le modèle Caisse.
        Gère le marquage Tiers Payant, la génération automatique de créance (Split Billing)
        et la mise à jour du statut de la facture.
        """
        from ..models import Caisse, Facture

        if caisse.statut != 'completee':
            return
            
        facture = caisse.facture
        if not facture:
            return
        
        # 1. Marquage Tiers Payant (Part Patient)
        if facture.part_client is not None and caisse.mode_paiement != 'en_compte':
            if not caisse.part_patient and (caisse.part_assurance is None or caisse.part_assurance == 0):
                Caisse.objects.filter(id=caisse.id).update(
                    part_patient=caisse.montant,
                    part_assurance=Decimal('0.00')
                )
        
        # 2. Split Billing (Génération automatique de la créance)
        if is_created and facture.part_client is not None and caisse.mode_paiement != 'en_compte':
            paiements_reels = Caisse.objects.filter(
                facture=facture, 
                statut='completee'
            ).exclude(mode_paiement='en_compte').aggregate(total=Sum('montant'))['total'] or Decimal('0')
            
            if paiements_reels >= facture.part_client:
                reste_a_couvrir = facture.total_ttc - paiements_reels
                if reste_a_couvrir > Decimal('1.00'):
                    # Check if ANY en_compte payment already exists (from finaliser or AUTO-CREDIT)
                    deja_traite = Caisse.objects.filter(
                        facture=facture, 
                        mode_paiement='en_compte',
                        statut='completee'
                    ).exists()
                    
                    if not deja_traite:
                        Caisse.objects.create(
                            facture=facture,
                            mode_paiement='en_compte',
                            montant=reste_a_couvrir,
                            user=caisse.user,
                            statut='completee',
                            reference=f"AUTO-CREDIT-{facture.numero_facture or facture.id}",
                            part_assurance=reste_a_couvrir,
                            part_patient=Decimal('0.00')
                        )
                        
        # 3. Mise à jour du statut de la facture
        if facture.status not in [Facture.Status.ANNULEE, Facture.Status.PAYEE]:
            total_encaisse = Caisse.objects.filter(
                facture=facture, 
                statut='completee'
            ).aggregate(total=Sum('montant'))['total'] or Decimal('0.00')
            
            if total_encaisse >= (facture.total_ttc - Decimal('0.1')):
                facture.status = Facture.Status.PAYEE
                facture.save(update_fields=['status'])
