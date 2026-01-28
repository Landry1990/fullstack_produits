from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from ..models import CouponMonnaie, Facture, Caisse, AuditLog
from ..serializers import CouponMonnaieSerializer
from ..audit_helpers import log_audit

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
        Si 'search' contient uniquement des chiffres, on fait une correspondance exacte sur le numéro.
        """
        queryset = super().get_queryset()
        status_param = self.request.query_params.get('status')
        if status_param:
            # Filtrer par statut AVANT la recherche
            queryset = queryset.filter(status=status_param)
        
        # Si le paramètre search est un numéro, faire une recherche exacte
        search_param = self.request.query_params.get('search')
        if search_param:
            # Nettoyer le numéro (enlever # si présent)
            clean_numero = search_param.strip().lstrip('#')
            # Si c'est un numéro (que des chiffres), chercher exactement ce numéro
            if clean_numero.isdigit():
                queryset = queryset.filter(numero=clean_numero)
        
        return queryset
    
    def perform_create(self, serializer):
        """
        Associe l'utilisateur actuel comme créateur et log l'audit.
        """
        coupon = serializer.save(cree_par=self.request.user)
        
        # Log Audit
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.OTHER, # We should ideally have a COUPON_CREATE action
            model_name='CouponMonnaie',
            object_id=coupon.id,
            description=f"Création coupon #{coupon.numero}: {coupon.montant} F",
            details={
                'numero': coupon.numero,
                'montant': float(coupon.montant),
                'notes': coupon.notes,
                'facture_origine': coupon.facture_origine.id if coupon.facture_origine else None
            },
            request=self.request
        )
    
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
            # Note: Le coupon réduit le montant à payer, il n'est PAS un paiement
            # Le frontend doit déduire le montant du coupon du total à encaisser
            logger.info(f"Coupon #{coupon.numero} associé à la facture {facture.id} - Montant: {coupon.montant} F")

        
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
