import os
import django
import json

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.serializers import UserSerializer
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

def print_serializer_fields():
    serializer = UserSerializer()
    for name, field in serializer.fields.items():
        print(f"{name}: {field.__class__.__name__} (required={field.required}, read_only={field.read_only})")
        if name == 'profile':
            print("  --- Profile Fields ---")
            for p_name, p_field in field.fields.items():
                print(f"  {p_name}: {p_field.__class__.__name__} (required={p_field.required}, read_only={p_field.read_only})")

if __name__ == "__main__":
    print_serializer_fields()
