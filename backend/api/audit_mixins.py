"""
Mixin d'audit automatique pour les ModelViewSet CRUD.

Journalise create/update/destroy dans AuditLog avec une description lisible.
Se place AVANT ModelViewSet dans l'héritage. Les actions métier fines
(@action) gardent leurs log_audit explicites — ce mixin ne couvre que le CRUD.
"""
from .audit_helpers import log_audit
from .models import AuditLog

_VERBS = {
    AuditLog.Action.CREATE: 'Création',
    AuditLog.Action.UPDATE: 'Modification',
    AuditLog.Action.DELETE: 'Suppression',
}


class AuditedViewSetMixin:
    """
    Journalise create/update/destroy dans AuditLog.

    - `audit_model_name` : surcharge le nom du modèle tracé
      (défaut : le modèle du queryset).
    - UPDATE : `details['fields']` liste les champs validés modifiés.
    - Si le ViewSet définit déjà perform_* sans audit, ajouter l'appel
      `self._audit_log(...)` ou `log_audit(...)` directement plutôt que
      de s'en remettre au mixin (la méthode locale prend le dessus).
    """

    audit_model_name = None

    def _audit_model_name(self):
        if self.audit_model_name:
            return self.audit_model_name
        model = getattr(getattr(self, 'queryset', None), 'model', None)
        if model is not None:
            return model.__name__
        get_qs = getattr(self, 'get_queryset', None)
        if get_qs is not None:
            try:
                return get_qs().model.__name__
            except Exception:
                pass
        return self.__class__.__name__

    def _audit_log(self, action, instance, details=None):
        model_name = self._audit_model_name()
        pk = getattr(instance, 'pk', None)
        try:
            label = f' « {instance} »' if instance is not None else ''
        except Exception:
            label = ''
        log_audit(
            user=getattr(getattr(self, 'request', None), 'user', None),
            action=action,
            model_name=model_name,
            object_id=pk,
            description=f"{_VERBS.get(action, action)} {model_name}{label} (#{pk})",
            details=details,
            request=getattr(self, 'request', None),
        )

    def perform_create(self, serializer):
        instance = serializer.save()
        self._audit_log(AuditLog.Action.CREATE, instance)
        return instance

    def perform_update(self, serializer):
        fields = sorted(serializer.validated_data.keys())
        instance = serializer.save()
        self._audit_log(
            AuditLog.Action.UPDATE,
            instance,
            details={'fields': fields},
        )
        return instance

    def perform_destroy(self, instance):
        # Tracé AVANT la suppression : str(instance)/pk doivent être capturés
        # tant que l'objet est intact, et une tentative reste visible même si
        # la suppression échoue ensuite.
        self._audit_log(AuditLog.Action.DELETE, instance)
        super().perform_destroy(instance)
