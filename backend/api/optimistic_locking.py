"""
Optimistic Locking Utility - Remplace select_for_update pour 12 postes

Principe: Au lieu de verrouiller la ligne en DB (bloquant),
on vérifie que la version n'a pas changé depuis la lecture.
Si conflit: retry automatique ou erreur explicite.
"""
from django.db import transaction, models
from django.db.models import F
from rest_framework.response import Response
from rest_framework import status
from typing import TypeVar, Type, Callable, Any, Optional
import logging
import time

logger = logging.getLogger(__name__)

T = TypeVar('T', bound=models.Model)


class ConcurrentModificationError(Exception):
    """Exception levée quand la version a changé (conflit de concurrence)"""
    def __init__(self, model_name: str, object_id: int, expected: int, actual: int):
        self.model_name = model_name
        self.object_id = object_id
        self.expected = expected
        self.actual = actual
        super().__init__(
            f"Concurrent modification detected on {model_name}#{object_id}: "
            f"expected version {expected}, but found {actual}"
        )


class OptimisticLockingMixin:
    """
    Mixin pour les modèles supportant l'optimistic locking.
    À ajouter aux modèles Facture, Produit, StockLot.
    """
    
    VERSION_FIELD = 'version'
    MAX_RETRIES = 3
    RETRY_DELAY = 0.1  # 100ms
    
    def refresh_with_version(self) -> None:
        """Recharge l'objet avec sa version actuelle en DB"""
        fresh = self.__class__.objects.get(pk=self.pk)
        self.version = fresh.version
        
    def check_version(self, expected_version: int) -> bool:
        """Vérifie si la version correspond (sans requête DB)"""
        return self.version == expected_version
    
    def increment_version(self) -> None:
        """Incrémente la version localement"""
        self.version += 1
    
    @classmethod
    def update_with_optimistic_lock(
        cls: Type[T],
        pk: int,
        expected_version: int,
        update_func: Callable[[T], None],
        max_retries: int = 3
    ) -> tuple[Optional[T], Optional[ConcurrentModificationError]]:
        """
        Met à jour un objet avec optimistic locking et retry automatique.
        
        Args:
            pk: ID de l'objet
            expected_version: Version attendue
            update_func: Fonction qui modifie l'objet (reçoit l'instance)
            max_retries: Nombre de tentatives avant d'abandonner
        
        Returns:
            Tuple (objet mis à jour, None) ou (None, erreur)
            
        Exemple:
            facture, error = Facture.update_with_optimistic_lock(
                pk=123,
                expected_version=5,
                update_func=lambda f: f.status = 'PAY'
            )
        """
        for attempt in range(max_retries):
            try:
                with transaction.atomic():
                    # 1. Récupérer l'objet (sans select_for_update!)
                    obj = cls.objects.get(pk=pk)
                    
                    # 2. Vérifier la version
                    if obj.version != expected_version:
                        raise ConcurrentModificationError(
                            cls.__name__, pk, expected_version, obj.version
                        )
                    
                    # 3. Appliquer les modifications
                    update_func(obj)
                    
                    # 4. Incrémenter la version
                    obj.version += 1
                    
                    # 5. Sauvegarder (UPDATE avec vérification implicite)
                    obj.save(update_fields=[
                        field for field in ['version'] + cls._meta.fields
                        if hasattr(obj, field) and field != 'id'
                    ])
                    
                    logger.info(
                        f"[OptimisticLock] {cls.__name__}#{pk} "
                        f"updated: version {expected_version} -> {obj.version}"
                    )
                    return obj, None
                    
            except ConcurrentModificationError as e:
                if attempt == max_retries - 1:
                    logger.warning(
                        f"[OptimisticLock] {cls.__name__}#{pk} "
                        f"failed after {max_retries} attempts"
                    )
                    return None, e
                
                # Retry avec backoff exponentiel
                delay = OptimisticLockingMixin.RETRY_DELAY * (2 ** attempt)
                logger.debug(
                    f"[OptimisticLock] {cls.__name__}#{pk} "
                    f"retry {attempt + 1}/{max_retries} after {delay}s"
                )
                time.sleep(delay)
                expected_version = cls.objects.get(pk=pk).version
                
        return None, ConcurrentModificationError(
            cls.__name__, pk, expected_version, -1
        )


def optimistic_update_response(
    model_class: Type[T],
    pk: int,
    expected_version: int,
    update_func: Callable[[T], None],
    success_message: str = "Mise à jour réussie"
) -> Response:
    """
    Helper pour les ViewSets DRF - retourne une Response HTTP.
    
    Exemple dans un ViewSet:
        return optimistic_update_response(
            Facture, pk, request.data['version'],
            lambda f: self._process_payment(f, montant),
            "Paiement enregistré"
        )
    """
    obj, error = OptimisticLockingMixin.update_with_optimistic_lock(
        model_class, pk, expected_version, update_func
    )
    
    if error:
        return Response({
            'detail': 'Conflit de concurrence détecté. '
                      'La ressource a été modifiée par un autre processus. '
                      'Veuillez recharger et réessayer.',
            'error_code': 'CONCURRENT_MODIFICATION',
            'model': error.model_name,
            'object_id': error.object_id,
            'expected_version': error.expected,
            'actual_version': error.actual,
        }, status=status.HTTP_409_CONFLICT)
    
    return Response({
        'detail': success_message,
        'version': obj.version,
        'object_id': obj.pk
    })


def bulk_optimistic_update(
    model_class: Type[T],
    updates: list[dict],  # [{'pk': 1, 'version': 5, 'update': func}, ...]
    max_retries: int = 3
) -> dict:
    """
    Mise à jour optimiste en lot - utile pour les opérations groupées.
    
    Returns:
        {
            'success': [obj1, obj2, ...],
            'failed': [{'pk': 1, 'error': '...'}, ...]
        }
    """
    results = {'success': [], 'failed': []}
    
    for update_info in updates:
        pk = update_info['pk']
        version = update_info['version']
        update_func = update_info['update']
        
        obj, error = OptimisticLockingMixin.update_with_optimistic_lock(
            model_class, pk, version, update_func, max_retries
        )
        
        if error:
            results['failed'].append({
                'pk': pk,
                'error': str(error),
                'expected': error.expected,
                'actual': error.actual
            })
        else:
            results['success'].append(obj)
    
    return results


class OptimisticLockingViewSetMixin:
    """
    Mixin pour ViewSets DRF - gère automatiquement la version dans les requêtes.
    
    Attend que le client envoie 'expected_version' dans le body.
    """
    
    def get_expected_version(self, request) -> Optional[int]:
        """Extrait la version attendue de la requête"""
        return request.data.get('expected_version') or request.data.get('version')
    
    def handle_optimistic_update(
        self,
        model_class: Type[T],
        instance: T,
        update_func: Callable[[T], None],
        success_message: str = "Mise à jour réussie"
    ) -> Response:
        """Wrapper pour les actions de ViewSet"""
        expected_version = self.get_expected_version(self.request)
        
        if expected_version is None:
            # Fallback: récupérer la version actuelle (moins sûr)
            expected_version = instance.version
        
        return optimistic_update_response(
            model_class, instance.pk, expected_version,
            update_func, success_message
        )
