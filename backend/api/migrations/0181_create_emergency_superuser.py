# Generated manually for emergency superuser creation
from django.db import migrations
from django.contrib.auth import get_user_model
from django.utils import timezone
import os


def create_emergency_superuser(apps, schema_editor):
    """Crée un super-admin de secours qui ne peut pas être supprimé via l'interface."""
    from django.db.models.signals import post_save
    
    User = get_user_model()
    username = os.getenv('EMERGENCY_ADMIN_USER', 'sysadmin')
    
    # Import user signals to disconnect them
    try:
        from api.models.users import create_user_profile, save_user_profile
        post_save.disconnect(create_user_profile, sender=User)
        post_save.disconnect(save_user_profile, sender=User)
    except ImportError:
        pass

    try:
        if not User.objects.filter(username=username).exists():
            user = User.objects.create_superuser(
                username=username,
                email='admin@localhost',
                password='ChangeMeImmediately123!',  # À changer IMMÉDIATEMENT
                first_name='System',
                last_name='Administrator',
                last_login=timezone.now()
            )
            # Create profile manually using historical model
            Profile = apps.get_model('api', 'Profile')
            UserHistorical = apps.get_model('auth', 'User')
            user_historical = UserHistorical.objects.get(pk=user.pk)
            profile, created = Profile.objects.get_or_create(user=user_historical)
            
            # Set protected fields if they exist in this migration's state
            if hasattr(profile, 'is_technical_account'):
                profile.is_technical_account = True
            if hasattr(profile, 'can_be_deleted'):
                profile.can_be_deleted = False
            profile.save()
            
            print(f"\n{'='*60}")
            print(f"COMPTE SUPER-ADMIN DE SECOURS CRÉÉ")
            print(f"{'='*60}")
            print(f"Username: {username}")
            print(f"Password par défaut: ChangeMeImmediately123!")
            print(f"⚠️  CHANGER IMMÉDIATEMENT VIA: python manage.py changepassword {username}")
            print(f"{'='*60}\n")
    finally:
        # Reconnect signals
        try:
            from api.models.users import create_user_profile, save_user_profile
            post_save.connect(create_user_profile, sender=User)
            post_save.connect(save_user_profile, sender=User)
        except ImportError:
            pass


def delete_emergency_superuser(apps, schema_editor):
    """Supprime le compte de secours (uniquement via migration)."""
    User = get_user_model()
    username = os.getenv('EMERGENCY_ADMIN_USER', 'sysadmin')
    User.objects.filter(username=username).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('api', '0180_fournisseur_is_divers_alter_commande_type_and_more'),
    ]

    operations = [
        migrations.RunPython(create_emergency_superuser, delete_emergency_superuser),
    ]
