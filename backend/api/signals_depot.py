# -*- coding: utf-8 -*-
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models.depot import DepotClient
from .models.billing import Caisse
from .models.audit import MouvementCaisse
from django.db import transaction

@receiver(post_save, sender=DepotClient)
def handle_depot_client_change(sender, instance, created, **kwargs):
    """
    Met à jour le solde du client et crée un mouvement de caisse si nécessaire.
    """
    if not created:
        return

    client = instance.client
    
    # 1. Mise à jour du solde
    if instance.type in [DepotClient.Type.DEPOT, DepotClient.Type.ANNULATION_ACHAT]:
        client.solde_depot += instance.montant
    elif instance.type in [DepotClient.Type.RETRAIT, DepotClient.Type.ACHAT]:
        client.solde_depot -= instance.montant
    
    client.save(update_fields=['solde_depot'])

    # 2. Création du mouvement de caisse (uniquement pour versement réel ou retrait réel)
    if instance.type == DepotClient.Type.DEPOT and not instance.mouvement_caisse:
        mvt = MouvementCaisse.objects.create(
            type='ENTREE',
            montant=instance.montant,
            motif=f"Dépôt Client: {client.name}",
            description=instance.notes or f"Versement acompte client via {instance.mode_paiement}",
            user=instance.created_by
        )
        # On évite la récursion en mettant à jour sans déclencher post_save
        DepotClient.objects.filter(pk=instance.pk).update(mouvement_caisse=mvt)
    
    elif instance.type == DepotClient.Type.RETRAIT and not instance.mouvement_caisse:
        mvt = MouvementCaisse.objects.create(
            type='SORTIE',
            montant=instance.montant,
            motif=f"Remboursement Dépôt: {client.name}",
            description=instance.notes or "Retrait acompte client",
            user=instance.created_by
        )
        DepotClient.objects.filter(pk=instance.pk).update(mouvement_caisse=mvt)

@receiver(post_save, sender=Caisse)
def handle_caisse_depot_payment(sender, instance, created, **kwargs):
    """
    Si une vente est payée par dépôt, on enregistre l'utilisation dans l'historique DepotClient.
    """
    if created and instance.mode_paiement == 'depot' and instance.statut == 'completee':
        if instance.facture and instance.facture.client:
            # Vérifier si cet achat n'est pas déjà enregistré (évite doubles triggers)
            if not DepotClient.objects.filter(facture=instance.facture, type=DepotClient.Type.ACHAT, montant=instance.montant).exists():
                DepotClient.objects.create(
                    client=instance.facture.client,
                    type=DepotClient.Type.ACHAT,
                    montant=instance.montant,
                    facture=instance.facture,
                    created_by=instance.user,
                    notes=f"Paiement facture {instance.facture.numero_facture or instance.facture.id}"
                )
