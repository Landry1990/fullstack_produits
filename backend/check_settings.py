import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from django.conf import settings
from rest_framework.settings import api_settings

print("--- settings.REST_FRAMEWORK ---")
print(getattr(settings, 'REST_FRAMEWORK', 'Not found'))

print("\n--- api_settings (effective) ---")
print(f"DEFAULT_PAGINATION_CLASS: {api_settings.DEFAULT_PAGINATION_CLASS}")
print(f"PAGE_SIZE: {api_settings.PAGE_SIZE}")

# Check PageNumberPagination defaults
from rest_framework.pagination import PageNumberPagination
p = PageNumberPagination()
print("\n--- PageNumberPagination defaults ---")
print(f"page_size_query_param: {p.page_size_query_param}")
