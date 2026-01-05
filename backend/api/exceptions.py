from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from django.db.models import ProtectedError
import re

def custom_exception_handler(exc, context):
    # Call REST framework's default exception handler first,
    # to get the standard error response.
    response = exception_handler(exc, context)

    # If an unexpected exception occurs (like ProtectedError), response will be None.
    if response is None:
        if isinstance(exc, ProtectedError):
            # Extract models from ProtectedError if possible for a better message
            # The message looks like: ("Cannot delete some instances of model 'Fournisseur' because they are referenced through protected foreign keys: 'Commande.fournisseur', 'StockLot.fournisseur'.", ...)
            msg = str(exc.args[0]) if exc.args else "Cet élément ne peut pas être supprimé car il est utilisé ailleurs dans le système."
            
            # French friendly message if we recognize specific patterns
            if "referenced through protected foreign keys" in msg.lower():
                # Try to extract referenced models
                matches = re.findall(r"'([^']+)\.", msg)
                if matches:
                    models_list = ", ".join(list(set(matches)))
                    msg = f"Impossible de supprimer cet élément car il est lié à des {models_list} existants."
            
            return Response(
                {"message": msg, "error_code": "protected_resource"},
                status=status.HTTP_400_BAD_REQUEST
            )

    return response
