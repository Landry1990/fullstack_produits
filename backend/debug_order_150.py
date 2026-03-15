import os
import django
import json
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Commande
from api.serializers import CommandeSerializer

from datetime import date, datetime

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return str(obj)
        if isinstance(obj, (date, datetime)):
            return obj.isoformat()
        return super(DecimalEncoder, self).default(obj)

def debug_order(order_id):
    try:
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT id, numero_facture, status FROM api_commande WHERE numero_facture = 'REASSORT_AUTO'")
            rows = cursor.fetchall()
            print(f"Orders with REASSORT_AUTO: {rows}")
        
        cmd = Commande.objects.get(id=order_id)
        ser = CommandeSerializer(cmd)
        # print(json.dumps(ser.data, cls=DecimalEncoder))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    debug_order(150)
