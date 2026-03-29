import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import InternalMessage

# Delete messages containing 'test' (case insensitive)
deleted_count, _ = InternalMessage.objects.filter(content__icontains='test').delete()
print(f"Deleted {deleted_count} messages containing 'test'.")
