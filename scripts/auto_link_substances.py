
import os
import sys
import django
import unicodedata
from django.db.models import Q

# Setup Django
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.insert(0, BASE_DIR)
sys.path.insert(0, os.path.join(BASE_DIR, 'backend'))
django.setup()

from api.models import Produit, Substance, MedicamentReference

def remove_accents(input_str):
    if not input_str:
        return ""
    nfkd_form = unicodedata.normalize('NFKD', input_str)
    return "".join([c for c in nfkd_form if not unicodedata.combining(c)])

def clean_text(text):
    if not text:
        return ""
    return remove_accents(text).upper().strip()

def auto_link_products():
    print("Démarrage de la fusion automatique des produits avec les DCI...")
    
    produits = Produit.objects.all()
    count_linked = 0
    count_total = produits.count()
    
    # Précharger toutes les substances pour éviter les requêtes N+1
    substances_map = {s.nom: s for s in Substance.objects.all()}
    
    for i, p in enumerate(produits):
        if i % 100 == 0:
            print(f"Progression : {i}/{count_total}...")
            
        clean_p_name = clean_text(p.name)
        
        # 1. Essayer de trouver une correspondance exacte dans la table de référence
        # On cherche un médicament de référence qui a le même nom nettoyé
        ref = MedicamentReference.objects.filter(nom__icontains=clean_p_name).first()
        
        if ref:
            # On a trouvé une référence !
            substance_names = [s.strip() for s in ref.substances.split(';') if s.strip()]
            
            linked_any = False
            for s_name in substance_names:
                clean_s_name = clean_text(s_name)
                # Trouver ou créer la substance
                substance = substances_map.get(clean_s_name)
                if not substance:
                    substance, created = Substance.objects.get_or_create(nom=clean_s_name)
                    substances_map[clean_s_name] = substance
                
                # Lier au produit
                p.substances.add(substance)
                
                # Définir comme DCI de référence si non défini
                if not p.dci_reference:
                    p.dci_reference = substance
                    p.is_generic = True # Si on trouve dans la base ANSM, c'est probablement un médoc qui peut être génériqué
                
                linked_any = True
            
            if linked_any:
                p.save()
                count_linked += 1
        else:
            # 2. Si pas de référence trouvée, essayer de chercher si le nom du produit contient directement une DCI
            # Par exemple "PARACETAMOL BIOGARAN" contient "PARACETAMOL"
            for s_name, substance in substances_map.items():
                if len(s_name) > 4 and s_name in clean_p_name:
                    p.substances.add(substance)
                    if not p.dci_reference:
                        p.dci_reference = substance
                    p.save()
                    count_linked += 1
                    break

    print(f"Fusion terminée ! {count_linked} produits ont été rattachés à une DCI.")

if __name__ == "__main__":
    auto_link_products()
