"""
Mixin pour utiliser automatiquement les serializers optimisés selon le contexte.
"""
from rest_framework import viewsets
from rest_framework import serializers  # Import serializers specifically



class OptimizedSerializerMixin:
    """
    Mixin pour utiliser automatiquement des serializers différents
    selon l'action (list vs detail).
    
    Usage:
        class ProduitViewSet(OptimizedSerializerMixin, viewsets.ModelViewSet):
            serializer_class = ProduitSerializer  # Serializer par défaut
            list_serializer_class = ProduitListSerializer  # Pour les listes
            detail_serializer_class = ProduitDetailSerializer  # Pour les détails
    
    Ou plus simplement:
        class ProduitViewSet(OptimizedSerializerMixin, viewsets.ModelViewSet):
            serializer_class = ProduitSerializer
            serializer_classes = {
                'list': ProduitListSerializer,
                'retrieve': ProduitDetailSerializer,
                'create': ProduitDetailSerializer,
                'update': ProduitDetailSerializer,
            }
    """
    
    # Attributs optionnels pour définir les serializers par action
    list_serializer_class = None
    detail_serializer_class = None
    create_serializer_class = None
    update_serializer_class = None
    serializer_classes = None  # Dictionnaire {action: SerializerClass}
    
    def get_serializer_class(self):
        """
        Retourne le serializer approprié selon l'action.
        
        Ordre de priorité:
        1. serializer_classes[action] si défini
        2. {action}_serializer_class si défini
        3. serializer_class par défaut
        """
        # Si un dictionnaire de mapping est fourni, l'utiliser en priorité
        if self.serializer_classes and self.action in self.serializer_classes:
            return self.serializer_classes[self.action]
        
        # Sinon, utiliser les attributs spécifiques
        if self.action == 'list' and self.list_serializer_class:
            return self.list_serializer_class
        
        elif self.action == 'retrieve' and self.detail_serializer_class:
            return self.detail_serializer_class
        
        elif self.action == 'create' and self.create_serializer_class:
            return self.create_serializer_class
        
        elif self.action in ['update', 'partial_update'] and self.update_serializer_class:
            return self.update_serializer_class
        
        # Par défaut, utiliser le serializer de base
        return super().get_serializer_class()


class ReadOnlyOptimizedSerializerMixin(OptimizedSerializerMixin):
    """
    Version simplifiée pour les ViewSets en lecture seule.
    Utilise automatiquement list_serializer pour list et detail_serializer pour retrieve.
    
    Usage:
        class MyReadOnlyViewSet(ReadOnlyOptimizedSerializerMixin, viewsets.ReadOnlyModelViewSet):
            serializer_class = MySerializer
            list_serializer_class = MyListSerializer
    """
    
    def get_serializer_class(self):
        """
        Pour les ViewSets en lecture seule, on a seulement besoin de list et retrieve.
        """
        if self.action == 'list' and self.list_serializer_class:
            return self.list_serializer_class
        
        # Pour retrieve et toutes les autres actions, utiliser le serializer par défaut
        return super(OptimizedSerializerMixin, self).get_serializer_class()


class DynamicFieldsSerializerMixin:
    """
    Mixin pour permettre la sélection dynamique des champs via query params.
    
    Usage:
        GET /api/produits/?fields=id,name,stock
        
    Dans le ViewSet:
        class ProduitViewSet(DynamicFieldsSerializerMixin, viewsets.ModelViewSet):
            serializer_class = ProduitSerializer
    """
    
    def get_serializer(self, *args, **kwargs):
        """
        Override pour passer les champs demandés au serializer.
        """
        serializer_class = self.get_serializer_class()
        kwargs.setdefault('context', self.get_serializer_context())
        
        # Récupérer les champs demandés depuis les query params
        fields = self.request.query_params.get('fields')
        if fields:
            kwargs['fields'] = fields.split(',')
        
        return serializer_class(*args, **kwargs)


class DynamicFieldsSerializer(serializers.Serializer):
    """
    Serializer de base qui supporte la sélection dynamique de champs.
    
    Usage:
        class MySerializer(DynamicFieldsSerializer, serializers.ModelSerializer):
            class Meta:
                model = MyModel
                fields = '__all__'
    
    Ensuite dans l'API:
        GET /api/mymodel/?fields=id,name,description
    """
    
    def __init__(self, *args, **kwargs):
        # Récupérer les champs demandés
        fields = kwargs.pop('fields', None)
        
        # Initialiser le serializer normalement
        super().__init__(*args, **kwargs)
        
        # Si des champs spécifiques sont demandés, supprimer les autres
        if fields is not None:
            # Convertir en set pour performance
            allowed = set(fields)
            existing = set(self.fields.keys())
            
            # Supprimer les champs non demandés
            for field_name in existing - allowed:
                self.fields.pop(field_name)
