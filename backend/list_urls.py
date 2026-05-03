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
            print(f"{prefix}{entry.pattern.describe()} [name={entry.name}]")

resolver = get_resolver()
list_urls(resolver.url_patterns)
