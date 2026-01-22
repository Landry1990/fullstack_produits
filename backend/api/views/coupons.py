from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from ..models import CouponMonnaie, Facture, Caisse
from ..serializers import CouponMonnaieSerializer

class CouponMonnaieViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour gérer les coupons de monnaie (bons de reste).
    """
    queryset = CouponMonnaie.objects.all()
    serializer_class = CouponMonnaieSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['numero', 'cree_par__username', 'utilise_par__username']
    ordering_fields = ['date_creation', 'montant', 'status']
    ordering = ['-date_creation']
    
    def get_queryset(self):
        """
        Filtre les coupons par statut si demandé.
        Le filtre status est appliqué AVANT la recherche pour garantir que seuls les coupons actifs sont retournés.
        """
        queryset = super().get_queryset()
        status_param = self.request.query_params.get('status')
        if status_param:
            # Filtrer par statut AVANT la recherche
            queryset = queryset.filter(status=status_param)
        return queryset
    
    def perform_create(self, serializer):
        """
        Associe l'utilisateur actuel comme créateur.
        """
        serializer.save(cree_par=self.request.user)
    
    @action(detail=True, methods=['post'])
    def utiliser(self, request, pk=None):
        """
        Marque un coupon comme utilisé.
        Attend 'facture_id' dans le body (optionnel).
        """
        coupon = self.get_object()
        
        # Log pour debug
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Tentative d'utilisation du coupon #{coupon.numero} (ID: {coupon.id}, Statut actuel: {coupon.status})")
        
        if coupon.status != CouponMonnaie.Status.ACTIF:
            logger.warning(f"Coupon #{coupon.numero} n'est pas actif (Statut: {coupon.status})")
            return Response(
                {'detail': f'Ce coupon n\'est pas actif (Statut: {coupon.get_status_display()})'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        facture_id = request.data.get('facture_id')
        facture = None
        if facture_id:
            try:
                facture = Facture.objects.get(id=facture_id)
                logger.info(f"Facture associée: {facture.id}")
            except Facture.DoesNotExist:
                logger.warning(f"Facture {facture_id} non trouvée")
                pass
        
        # Mettre à jour le coupon
        coupon.status = CouponMonnaie.Status.UTILISE
        coupon.date_utilisation = timezone.now()
        coupon.utilise_par = request.user
        if facture:
            coupon.facture_utilisation = facture
            
            # [FIX] Créer le paiement correspondant au coupon pour solder la facture
            try:
                Caisse.objects.create(
                    facture=facture,
                    mode_paiement='coupon',
                    montant=coupon.montant,
                    user=request.user,
                    statut='completee',
                    reference=f"COUPON-{coupon.numero}",
                    part_patient=None,
                    part_assurance=None
                )
                logger.info(f"Paiement Caisse créé pour le coupon #{coupon.numero} (Montant: {coupon.montant})")
            except Exception as e:
                logger.error(f"ERREUR lors de la création du paiement Caisse pour le coupon: {e}")
                # On ne bloque pas l'utilisation du coupon, mais c'est grave

        
        # Sauvegarder et rafraîchir depuis la base de données
        coupon.save()
        coupon.refresh_from_db()
        
        logger.info(f"Coupon #{coupon.numero} marqué comme utilisé (Statut après save: {coupon.status})")
        
        # Vérifier que le statut a bien été mis à jour
        if coupon.status != CouponMonnaie.Status.UTILISE:
            logger.error(f"ERREUR: Le coupon #{coupon.numero} n'a pas été correctement mis à jour (Statut: {coupon.status})")
            return Response(
                {'detail': 'Erreur lors de la mise à jour du statut du coupon'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        return Response(self.get_serializer(coupon).data)
