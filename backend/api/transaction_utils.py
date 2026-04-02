# -*- coding: utf-8 -*-
"""
Utilitaires pour des transactions sécurisées.

Fournit un décorateur `@safe_transaction` et un context manager `safe_atomic()`
qui wrappent les opérations critiques dans transaction.atomic() avec :
- Logging automatique des erreurs
- Audit trail en cas d'échec
- Réponse JSON propre si utilisé dans une vue DRF
"""
import functools
import logging
import traceback

from django.db import transaction
from rest_framework import status
from rest_framework.response import Response

logger = logging.getLogger('api.business')


class TransactionError(Exception):
    """Exception levée quand une transaction sécurisée échoue."""

    def __init__(self, message, original_exception=None):
        super().__init__(message)
        self.original_exception = original_exception


def safe_transaction(operation_name=None):
    """
    Décorateur pour les méthodes de vue DRF qui effectuent des opérations critiques.
    
    Wrappe l'opération dans transaction.atomic() et :
    - Log l'erreur complète en cas d'échec
    - Retourne un Response 500 propre au frontend
    - Fait un rollback automatique de la transaction
    
    Usage:
        @safe_transaction("Validation facture")
        def validate(self, request, pk=None):
            facture = self.get_object()
            facture.status = 'VAL'
            facture.save()
            return Response(...)
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            op_name = operation_name or func.__name__
            try:
                with transaction.atomic():
                    return func(*args, **kwargs)
            except TransactionError:
                # Already handled, re-raise
                raise
            except Exception as exc:
                # Extraire request pour le logging
                request = None
                for arg in args:
                    if hasattr(arg, 'user') and hasattr(arg, 'method'):
                        request = arg
                        break

                user_info = ""
                if request and hasattr(request, 'user'):
                    user_info = f" par {request.user}"

                logger.error(
                    "Transaction échouée [%s]%s — %s\n%s",
                    op_name,
                    user_info,
                    str(exc),
                    traceback.format_exc(),
                )

                # Essayer de créer un audit log
                _log_failed_transaction(op_name, request, exc)

                return Response(
                    {
                        "error": f"Échec de l'opération : {op_name}",
                        "detail": str(exc),
                    },
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        return wrapper
    return decorator


class safe_atomic:
    """
    Context manager pour les opérations critiques hors vues DRF.
    
    Usage:
        with safe_atomic("Recalcul stock"):
            produit.stock = new_value
            produit.save()
            mouvement = MouvementStock(...)
            mouvement.save()
    
    En cas d'erreur, la transaction est rollback et l'exception est loggée
    puis re-levée.
    """

    def __init__(self, operation_name="opération"):
        self.operation_name = operation_name
        self._atomic = None

    def __enter__(self):
        self._atomic = transaction.atomic()
        self._atomic.__enter__()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            logger.error(
                "Transaction échouée [%s] — %s\n%s",
                self.operation_name,
                str(exc_val),
                traceback.format_exc(),
            )
            _log_failed_transaction(self.operation_name, None, exc_val)

        # Délègue au atomic() (qui fera le rollback si exception)
        return self._atomic.__exit__(exc_type, exc_val, exc_tb)


def _log_failed_transaction(operation_name, request, exc):
    """Tente de créer un AuditLog pour une transaction échouée."""
    try:
        from api.models.audit import AuditLog
        AuditLog.objects.create(
            user=request.user if request and hasattr(request, 'user') and request.user.is_authenticated else None,
            action=AuditLog.Action.OTHER,
            model_name='Transaction',
            description=f"Transaction échouée : {operation_name}",
            details={
                'operation': operation_name,
                'error': str(exc),
                'error_type': type(exc).__name__,
            },
        )
    except Exception:
        pass  # Ne jamais crasher le crash handler
