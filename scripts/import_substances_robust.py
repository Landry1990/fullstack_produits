
import os
import sys
import django
import unicodedata

# Setup Django
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.insert(0, BASE_DIR)
sys.path.insert(0, os.path.join(BASE_DIR, 'backend'))
django.setup()

from api.models import Substance

def remove_accents(input_str):
    if not input_str:
        return ""
    nfkd_form = unicodedata.normalize('NFKD', input_str)
    return "".join([c for c in nfkd_form if not unicodedata.combining(c)])

def clean_text(text):
    if not text:
        return ""
    return remove_accents(text).upper().strip()

def import_substances_from_compo():
    compo_path = os.path.join(BASE_DIR, 'COMPO.txt')
    if not os.path.exists(compo_path):
        print(f"ERROR: {compo_path} not found")
        return

    substances = set()
    encodings = ['utf-8', 'latin-1', 'cp1252']
    
    success = False
    for enc in encodings:
        try:
            with open(compo_path, 'r', encoding=enc) as f:
                for line in f:
                    parts = line.strip().split('\t')
                    if len(parts) >= 4:
                        # parts[3] is the substance name
                        name = clean_text(parts[3])
                        if name:
                            substances.add(name)
            print(f"Successfully read COMPO.txt with {enc}")
            success = True
            break
        except Exception as e:
            continue
            
    if not success:
        print("Could not read COMPO.txt")
        return

    print(f"Found {len(substances)} unique substances. Importing to database...")
    
    created_count = 0
    existing_count = 0
    
    # Use bulk_create for performance
    existing_names = set(Substance.objects.values_list('nom', flat=True))
    
    new_substances = []
    for name in substances:
        if name not in existing_names:
            new_substances.append(Substance(nom=name))
            
    if new_substances:
        Substance.objects.bulk_create(new_substances, ignore_conflicts=True)
        created_count = len(new_substances)
        
    print(f"Done! Created: {created_count}, Already existed: {len(substances) - created_count}")

if __name__ == "__main__":
    import_substances_from_compo()
