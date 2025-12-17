from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.core.cache import cache
from .models import Facture, Caisse, Client, Produit

@receiver([post_save, post_delete], sender=Facture)
@receiver([post_save, post_delete], sender=Caisse)
@receiver([post_save, post_delete], sender=Client)
@receiver([post_save, post_delete], sender=Produit)
def invalidate_dashboard_stats(sender, instance, **kwargs):
    """
    Invalidate dashboard stats cache when data changes.
    """
    cache.delete('dashboard_stats')
    # print(f"Cache invalidated due to change in {sender.__name__}") # Debug

# --- AUDIT LOGGING ---
from django.forms.models import model_to_dict
from .models import Commande, InvoiceSettings, AuditLog
import json
from django.core.serializers.json import DjangoJSONEncoder

@receiver(post_save, sender=Produit)
@receiver(post_save, sender=Facture)
@receiver(post_save, sender=Commande)
@receiver(post_save, sender=Client)
@receiver(post_save, sender=InvoiceSettings)
def log_save(sender, instance, created, **kwargs):
    # Determine Action
    action = AuditLog.Action.create if created else AuditLog.Action.update
    model_name = sender.__name__
    
    # Serialize data
    try:
        # Basic serialization
        data = model_to_dict(instance)
        # JSON dump
        details = json.dumps(data, cls=DjangoJSONEncoder, default=str)
    except Exception as e:
        details = str(e)

    # We don't have request user here easily. 
    # For now, it will be None (System) or we rely on a middleware if implemented.
    AuditLog.objects.create(
        action=action,
        model_name=model_name,
        object_id=str(instance.pk),
        details=details
    )

@receiver(post_delete, sender=Produit)
@receiver(post_delete, sender=Facture)
@receiver(post_delete, sender=Commande)
@receiver(post_delete, sender=Client)
def log_delete(sender, instance, **kwargs):
    model_name = sender.__name__
    
    AuditLog.objects.create(
        action=AuditLog.Action.delete,
        model_name=model_name,
        object_id=str(instance.pk),
        details=json.dumps({"info": "Deleted completely"}, cls=DjangoJSONEncoder)
    )
