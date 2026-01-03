import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth.models import User
from api.models import InvoiceSettings, Profile

# 1. Enable Centralized Cash Register
settings, created = InvoiceSettings.objects.get_or_create(pk=1, defaults={
    'company_name': 'Pharmacie Test',
    'company_address': '123 Test St',
    'footer_text': 'Merci',
    'header_layout': 'split',
    'primary_color': '#000000'
})
settings.centralized_cash_register = True
settings.save()
print("InvoiceSettings: Centralized Cash Register ENABLED")

# 2. Create or Update Restricted User (Seller)
username = 'vendeur_test'
password = 'password123'
email = 'vendeur@test.com'

user, created = User.objects.get_or_create(username=username, defaults={'email': email})
user.set_password(password)
user.first_name = "Vendeur"
user.last_name = "Test"
user.is_superuser = False
user.save()

# Ensure Profile exists and set permissions
profile, _ = Profile.objects.get_or_create(user=user)
profile.can_cash_out = False # RESTRICTED
profile.allowed_menus = ['ventes', 'facturation', 'produits', 'clients'] # Give access to basic menus
profile.save()

print(f"User '{username}' setup complete. Password: '{password}'. Can Cash Out: {profile.can_cash_out}")
