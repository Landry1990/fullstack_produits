# Generated manually for emergency superuser creation
from django.db import migrations
from django.contrib.auth import get_user_model
import os


def create_emergency_superuser(apps, schema_editor):
    """Crée un super-admin de secours qui ne peut pas être supprimé via l'interface."""
    User = get_user_model()
    
    # Nom d'utilisateur technique (éviter les noms évidents)
    username = os.getenv('EMERGENCY_ADMIN_USER', 'sysadmin')
    
    # Mot de passe à définir via variable d'environnement ou à changer immédiatement après install
    # En prod, utiliser: python manage.py shell
    # from django.contrib.auth import get_user_model
    # User = get_user_model()
    # u = User.objects.get(username='sysadmin')
    # u.set_password('NOUVEAU_MOT_DE_PASSE_SUPER_FORT')
    # u.save()
    
    if not User.objects.filter(username=username).exists():
        user = User.objects.create_superuser(
            username=username,
            email='admin@localhost',
            password='ChangeMeImmediately123!',  # À changer IMMÉDIATEMENT
            first_name='System',
            last_name='Administrator'
        )
        # Marquer comme compte technique protégé
        user.profile.is_technical_account = True
        user.profile.can_be_deleted = False
        user.profile.save()
        
        print(f"\n{'='*60}")
        print(f"COMPTE SUPER-ADMIN DE SECOURS CRÉÉ")
        print(f"{'='*60}")
        print(f"Username: {username}")
        print(f"Password par défaut: ChangeMeImmediately123!")
        print(f"⚠️  CHANGER IMMÉDIATEMENT VIA: python manage.py changepassword {username}")
        print(f"{'='*60}\n")


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
