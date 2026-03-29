import os
import django
import sys

# Setup Django
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.core.settings')
django.setup()

from api.models import Produit, Promis
from api.serializers_optimized import ProduitListSerializer
from api.views.produits import ProduitViewSet
from rest_framework.test import APIRequestFactory

def test_promis_annotation():
    # Créer un produit de test
    p = Produit.objects.first()
    if not p:
        print("Aucun produit trouvé pour le test")
        return

    # Créer un promis pour ce produit
    Promis.objects.create(produit=p, status='ATT', quantite=5)
    
    # Récupérer via queryset annoté
    factory = APIRequestFactory()
    request = factory.get('/api/produits/')
    viewset = ProduitViewSet()
    viewset.request = request
    viewset.format_kwarg = None
    
    qs = viewset.get_queryset().filter(pk=p.pk)
    annotated_p = qs.first()
    
    print(f"Produit: {annotated_p.name}")
    print(f"Active Promis Count: {annotated_p.active_promis_count}")
    
    # Vérifier le serializer
    serializer = ProduitListSerializer(annotated_p)
    if 'active_promis_count' in serializer.data:
        print(f"Serializer data active_promis_count: {serializer.data['active_promis_count']}")
    else:
        print("ERREUR: active_promis_count absent du serializer")

if __name__ == "__main__":
    test_promis_annotation()
