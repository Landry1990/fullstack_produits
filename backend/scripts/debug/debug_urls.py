import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.urls import router

print("Registered URLs:")
for url in router.urls:
    print(url)
