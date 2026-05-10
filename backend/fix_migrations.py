import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection
with connection.cursor() as cursor:
    cursor.execute("DELETE FROM django_migrations WHERE app='api' AND name='0179_lettrage_lignes_manytomany';")
    print('Deleted rows:', cursor.rowcount)
