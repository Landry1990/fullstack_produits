import os
import json
import django
import sys
from decimal import Decimal

# Configuration Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Produit
from django.db import transaction

def import_products(json_file_path):
    if not os.path.exists(json_file_path):
        print(f"❌ Erreur : Le fichier {json_file_path} n'existe pas.")
        return

    try:
        with open(json_file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Si c'est un dictionnaire avec une clé 'produits', on récupère la liste
        if isinstance(data, dict) and 'produits' in data:
            products_list = data['produits']
        elif isinstance(data, list):
            products_list = data
        else:
            print("❌ Erreur : Format JSON non supporté (doit être une liste ou un objet {'produits': [...]})")
            return

        print(f"📦 Début de l'import de {len(products_list)} produits...")

        created_count = 0
        updated_count = 0
        
        with transaction.atomic():
            for item in products_list:
                # Mapping flexible des noms de champs
                name = item.get('name') or item.get('nom') or item.get('designation')
                if not name:
                    print(f"⚠️ Saut d'un item sans nom : {item}")
                    continue

                cost_price = Decimal(str(item.get('cost_price') or item.get('prix_achat') or item.get('cession') or 0)).replace(',', '.')
                selling_price = Decimal(str(item.get('selling_price') or item.get('prix_vente') or item.get('public') or 0)).replace(',', '.')
                tva = Decimal(str(item.get('tva') or item.get('taux_tva') or 0)).replace(',', '.')
                stock = int(item.get('stock') or item.get('quantite') or item.get('qte') or 0)
                
                cip1 = str(item.get('cip1') or item.get('cip') or item.get('code') or '').strip() or None
                cip2 = str(item.get('cip2') or '').strip() or None
                cip3 = str(item.get('cip3') or '').strip() or None

                # Recherche du produit existant (par CIP ou Nom)
                product = None
                if cip1:
                    product = Produit.objects.filter(cip1=cip1).first()
                if not product:
                    product = Produit.objects.filter(name__iexact=name).first()

                if product:
                    # Mise à jour
                    product.cost_price = cost_price
                    product.selling_price = selling_price
                    product.tva = tva
                    product.stock = stock
                    if cip1: product.cip1 = cip1
                    product.save()
                    updated_count += 1
                else:
                    # Création
                    Produit.objects.create(
                        name=name,
                        cost_price=cost_price,
                        selling_price=selling_price,
                        tva=tva,
                        stock=stock,
                        cip1=cip1,
                        cip2=cip2,
                        cip3=cip3
                    )
                    created_count += 1

        print(f"✅ Import terminé !")
        print(f"   - Créés : {created_count}")
        print(f"   - Mis à jour : {updated_count}")

    except Exception as e:
        print(f"💥 Erreur lors de l'import : {str(e)}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/import_products_json.py <chemin_vers_fichier.json>")
    else:
        import_products(sys.argv[1])
