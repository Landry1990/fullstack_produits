import os
import django
from django.urls import get_resolver

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

def list_urls(lis, prefix=''):
    for entry in lis:
        if hasattr(entry, 'url_patterns'):
            list_urls(entry.url_patterns, prefix + entry.pattern.describe())
        else:
            name = entry.name
            if name and 'produit' in name:
                print(f"Name: {name}")

list_urls(get_resolver().url_patterns)
