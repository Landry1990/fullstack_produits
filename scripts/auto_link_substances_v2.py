
import os
import sys
import django
import unicodedata
import re
from django.db.models import Q

# Setup Django
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.insert(0, BASE_DIR)
sys.path.insert(0, os.path.join(BASE_DIR, 'backend'))
django.setup()

from api.models import Produit, Substance, MedicamentReference

def normalize(text):
    if not text: return ""
    # Supprimer accents
    text = "".join(c for c in unicodedata.normalize('NFKD', text) if not unicodedata.combining(c))
    text = text.upper()
    # Standardiser les doses: 500MG -> 500 MG
    text = re.sub(r'(\d+)\s*(MG|G|ML|UI|UG)', r'\1 \2', text)
    # Remplacer les ponctuations par des espaces
    text = re.sub(r'[,.;:/!|_]', ' ', text)
    # Supprimer les espaces doubles
    text = " ".join(text.split())
    return text

def get_keywords(text):
    tokens = normalize(text).split()
    # On garde les mots de plus de 2 lettres
    return [t for t in tokens if len(t) > 2]

def auto_link_v2():
    print("Démarrage de la fusion V2 (Algorithme agressif)...")
    
    produits = Produit.objects.filter(dci_reference__isnull=True)
    total = produits.count()
    print(f"Analyse de {total} produits orphelins...")
    
    substances_map = {normalize(s.nom): s for s in Substance.objects.all()}
    # Créer un index inverse des références par leurs mots-clés (pour aller vite)
    # On ne fait ça que pour les refs les plus courantes pour pas exploser la RAM
    
    count_linked = 0
    
    for i, p in enumerate(produits):
        if i % 100 == 0:
            print(f"Progression : {i}/{total} (Trouvés: {count_linked})")
            
        p_name_norm = normalize(p.name)
        p_keywords = get_keywords(p.name)
        
        if not p_keywords: continue
        
        linked = False
        
        # Stratégie 1 : Match exact sur le nom normalisé
        ref = MedicamentReference.objects.filter(nom__icontains=p_name_norm).first()
        if not ref:
            # Stratégie 2 : Est-ce que le début du nom match ? (ex: "AMOXICILLINE SANDOZ 500 MG")
            if len(p_keywords) >= 2:
                prefix = f"{p_keywords[0]} {p_keywords[1]}"
                ref = MedicamentReference.objects.filter(nom__istartswith=prefix).first()
        
        if ref:
            substance_names = [s.strip() for s in ref.substances.split(';') if s.strip()]
            for s_name in substance_names:
                s_norm = normalize(s_name)
                substance = substances_map.get(s_norm)
                if not substance:
                    substance, _ = Substance.objects.get_or_create(nom=s_norm)
                    substances_map[s_norm] = substance
                
                p.substances.add(substance)
                if not p.dci_reference:
                    p.dci_reference = substance
                linked = True
        
        # Stratégie 3 : Si toujours rien, chercher si un mot-clé du produit est une DCI connue
        if not linked:
            for kw in p_keywords:
                if len(kw) > 4: # On évite les mots trop courts
                    substance = substances_map.get(kw)
                    if substance:
                        p.substances.add(substance)
                        if not p.dci_reference:
                            p.dci_reference = substance
                        linked = True
                        break
        
        if linked:
            p.is_generic = True
            p.save()
            count_linked += 1

    print(f"Fusion V2 terminée ! {count_linked} nouveaux produits rattachés.")

if __name__ == "__main__":
    auto_link_v2()
