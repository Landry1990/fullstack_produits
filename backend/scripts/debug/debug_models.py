import os
import django
import sys

# Add the project root to sys.path
sys.path.append(os.getcwd())

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

try:
    print("Attempting to import api.models...")
    import api.models
    print(f"api.models imported: {api.models}")
    print(f"Content of api.models: {dir(api.models)}")
    
    print("Attempting to import Commande...")
    from api.models import Commande
    print(f"Commande imported: {Commande}")
except Exception as e:
    print(f"CRITICAL ERROR: {e}")
    import traceback
    traceback.print_exc()
