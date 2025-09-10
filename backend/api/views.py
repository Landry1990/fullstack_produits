from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.db.models import F
from django_filters.rest_framework import DjangoFilterBackend
from .filters import ProduitFilter
from .models import (
    Produit, Rayon, Fournisseur, Client, Commande, CommandeProduit
)
from .serializers import (
    ProduitSerializer, RayonSerializer, FournisseurSerializer,
    ClientSerializer, CommandeSerializer, CommandeProduitSerializer
)

# Create your views here.

class ProduitViewSet(viewsets.ModelViewSet):
    """
    API endpoint for products.
    """
    queryset = Produit.objects.all().order_by('-created_at')
    serializer_class = ProduitSerializer
    filter_backends = (DjangoFilterBackend,)
    filterset_class = ProduitFilter

class RayonViewSet(viewsets.ModelViewSet):
    """API endpoint for rayons."""
    queryset = Rayon.objects.all().order_by('name')
    serializer_class = RayonSerializer

class FournisseurViewSet(viewsets.ModelViewSet):
    """API endpoint for fournisseurs."""
    queryset = Fournisseur.objects.all().order_by('name')
    serializer_class = FournisseurSerializer

class ClientViewSet(viewsets.ModelViewSet):
    """API endpoint for clients."""
    queryset = Client.objects.all().order_by('name')
    serializer_class = ClientSerializer

class CommandeViewSet(viewsets.ModelViewSet):
    """API endpoint for commandes."""
    queryset = Commande.objects.all().order_by('-date')
    serializer_class = CommandeSerializer

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def cloturer(self, request, pk=None):
        """
        Clôture une commande et met à jour le stock des produits.
        """
        commande = self.get_object()
        if commande.status == Commande.Status.CLOTUREE:
            return Response({'detail': 'Cette commande est déjà clôturée.'}, status=status.HTTP_400_BAD_REQUEST)

        # Mettre à jour le stock pour chaque produit dans la commande
        for item in commande.produits.all():
            produit = item.produit
            produit.stock = F('stock') + item.quantity
            produit.save(update_fields=['stock'])

        # Changer le statut de la commande
        commande.status = Commande.Status.CLOTUREE
        commande.save(update_fields=['status'])

        return Response({'status': 'Commande clôturée et stock mis à jour.'})

class CommandeProduitViewSet(viewsets.ModelViewSet):
    """API endpoint for commande produits."""
    queryset = CommandeProduit.objects.all().order_by('-created_at')
    serializer_class = CommandeProduitSerializer
    filter_backends = (DjangoFilterBackend,)
    filterset_fields = ['produit']

    def perform_create(self, serializer):
        selling_price = serializer.validated_data.pop('selling_price', None)
        commande_produit = serializer.save()
        if selling_price is not None:
            produit = commande_produit.produit
            produit.selling_price = selling_price
            produit.save(update_fields=['selling_price'])
