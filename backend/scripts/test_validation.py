
import os
import django
import sys

# Setup Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Inventaire, LigneInventaire, Produit, StockLot, Commande, CommandeProduit
from django.contrib.auth.models import User
from rest_framework.test import APIRequestFactory
from api.views.stocks import InventaireViewSet

def run_test():
    print("=== DÉBUT DU TEST DE VALIDATION INVENTAIRE ===")
    
    # 1. SETUP
    print("1. Création des données de test...")
    admin_user, _ = User.objects.get_or_create(username='admin_test', defaults={'email': 'admin@test.com'})
    admin_user.is_superuser = True
    admin_user.save()
    sudo_user, _ = User.objects.get_or_create(username='sudo_validator', defaults={'email': 'sudo@test.com'})
    
    # Produit A: Gestion par lot par défaut = False (sera activé par validation)
    prod_a, _ = Produit.objects.get_or_create(
        name="Produit Test A (Global)", 
        defaults={'cip1': '111111', 'selling_price': 1000, 'cost_price': 500, 'stock': 10}
    )
    
    # Produit B: Gestion par lot = True, avec un lot existant
    prod_b, _ = Produit.objects.get_or_create(
        name="Produit Test B (Lot)", 
        defaults={'cip1': '222222', 'selling_price': 2000, 'cost_price': 1000, 'stock': 20, 'use_lot_management': True}
    )
    
    lot_b, _ = StockLot.objects.get_or_create(
        produit=prod_b,
        lot="LOT-TEST-B",
        defaults={
            'quantity_initial': 50,
            'quantity_remaining': 50,
            'price_cost': 1000,
            'date_reception': "2025-01-01"
        }
    )
    
    # Création Inventaire
    inventaire = Inventaire.objects.create(
        description="Inventaire Test Script",
        created_by=admin_user,
        status=Inventaire.Status.EN_COURS
    )
    print(f"Inventaire créé: ID {inventaire.id}")

    # 2. SCÉNARIO A: Doublons Produit Global (Pas de lot spécifié)
    # On ajoute deux lignes pour Produit A. Lors de la validation, elles devraient être fusionnées dans un nouveau lot LOT-INV-XXX
    print("\n2. Ajout doublons Produit A (Global)...")
    LigneInventaire.objects.create(inventaire=inventaire, produit=prod_a, stock_theorique=10, quantite_physique=15)
    LigneInventaire.objects.create(inventaire=inventaire, produit=prod_a, stock_theorique=10, quantite_physique=5)
    
    # 3. SCÉNARIO B: Doublons Produit Lot (Même lot spécifié) -> IMPOSSIBLE via constraint unique_inventaire_lot
    # On teste juste l'existence d'une ligne lot
    print("3. Ajout ligne Produit B (Lot existant)...")
    LigneInventaire.objects.create(inventaire=inventaire, produit=prod_b, stock_lot=lot_b, stock_theorique=50, quantite_physique=40)
    # LigneInventaire.objects.create(inventaire=inventaire, produit=prod_b, stock_lot=lot_b, ... ) # VIOLATION CONTRAINTE DIRECTE
    
    print(f"Lignes avant validation: {inventaire.lignes.count()} (Attendu: 3)")
    
    # 4. VALIDATION VIA VIEWSET
    print("\n4. Exécution de la validation (Mode Sudo)...")
    factory = APIRequestFactory()
    view = InventaireViewSet.as_view({'post': 'validate'})
    
    # Initials for admin MUST include a password properly set for check_password to work
    admin_user.set_password("adminpass123")
    admin_user.save()

    # 4a. Tentative SANS mot de passe (Doit échouer)
    print("   -> Test SANS mot de passe...")
    request_fail = factory.post(f'/api/inventaires/{inventaire.id}/validate/', {'validated_by_id': sudo_user.id}, format='json')
    request_fail.user = admin_user
    try:
        resp_fail = view(request_fail, pk=inventaire.id)
        if resp_fail.status_code == 400:
            print(f"      OK: Rejeté comme prévu ({resp_fail.data})")
        else:
            print(f"      ERREUR: Code inattendu {resp_fail.status_code}")
    except Exception as e:
        print(f"      Exception: {e}")

    # 4b. Tentative AVEC mot de passe (Doit réussir)
    print("   -> Test AVEC mot de passe...")
    request_ok = factory.post(f'/api/inventaires/{inventaire.id}/validate/', {
        'validated_by_id': sudo_user.id,
        'sudo_password': 'adminpass123'
    }, format='json')
    request_ok.user = admin_user
    
    try:
        response = view(request_ok, pk=inventaire.id)
        print(f"      Code Réponse: {response.status_code}")
        if response.status_code != 200:
            print(f"      Erreur: {response.data}")
    except Exception as e:
        print(f"EXCEPTION CRITIQUE PENDANT VALIDATION: {e}")
        import traceback
        traceback.print_exc()
        return

    # 5. VÉRIFICATION RÉSULTATS
    print("\n5. Vérification post-validation...")
    inventaire.refresh_from_db()
    
    # Status
    print(f"Status Inventaire: {inventaire.status} (Attendu: VALIDEE)")
    
    # Sudo
    print(f"Validé par: {inventaire.validated_by.username if inventaire.validated_by else 'MainUser'} (Attendu: sudo_validator)")
    
    # Lignes
    lignes_finales = inventaire.lignes.all()
    print(f"Nombre de lignes finales: {lignes_finales.count()} (Attendu: 2 - Une pour A, Une pour B)")
    
    for l in lignes_finales:
        print(f" - Ligne ID {l.id}: Produit {l.produit.name}, Lot {l.stock_lot.lot}, Qté {l.quantite_physique}")
        
        # Vérif fusion A (15 + 5 = 20)
        if l.produit == prod_a:
            if l.quantite_physique == 20: 
                print("   -> SUCCÈS FUSION A")
            else:
                print(f"   -> ÉCHEC FUSION A (Attendu 20, Reçu {l.quantite_physique})")
                
        # Vérif fusion B (40 + 5 = 45) in Lot B
        if l.produit == prod_b:
            if l.stock_lot.id == lot_b.id and l.quantite_physique == 45:
                print("   -> SUCCÈS FUSION B")
            else:
                print(f"   -> ÉCHEC FUSION B (Attendu 45 sur Lot B, Reçu {l.quantite_physique})")

    # Cleanup
    print("\nNettoyage...")
    # inventaire.delete() # Optionnel, garder pour inspection si besoin
    # prod_a.delete()
    # prod_b.delete()
    print("=== FIN DU TEST ===")

if __name__ == '__main__':
    run_test()
