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
    action = AuditLog.Action.CREATE if created else AuditLog.Action.UPDATE
    model_name = sender.__name__
    
    if not getattr(instance, '_skip_audit', False):
        try:
            # Basic serialization using model_to_dict
            details_dict = model_to_dict(instance)
            
            # Re-serialize and deserialize to get a clean dict with serializable types
            # Use ensure_ascii=True to avoid encoding issues during intermediate step
            details_json = json.dumps(details_dict, cls=DjangoJSONEncoder, ensure_ascii=True)
            safe_details = json.loads(details_json)
            
            AuditLog.objects.create(
                action=action,
                model_name=model_name,
                object_id=str(instance.pk),
                details=safe_details
            )
        except Exception as e:
            try:
                AuditLog.objects.create(
                    action=action,
                    model_name=model_name,
                    object_id=str(instance.pk),
                    details={"error": str(e), "note": "Audit serialization failed"}
                )
            except:
                pass

@receiver(post_delete, sender=Produit)
@receiver(post_delete, sender=Facture)
@receiver(post_delete, sender=Commande)
@receiver(post_delete, sender=Client)
def log_delete(sender, instance, **kwargs):
    model_name = sender.__name__
    try:
        AuditLog.objects.create(
            action=AuditLog.Action.DELETE,
            model_name=model_name,
            object_id=str(instance.pk),
            details={"info": "Deleted completely"}
        )
    except Exception as e:
        print(f"Error logging delete: {e}")
