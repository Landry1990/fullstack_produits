import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from django.db import connection
with connection.cursor() as cursor:
    cursor.execute("SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'auth_user' AND column_name = 'last_login'")
    row = cursor.fetchone()
    if row:
        print(f"Column: {row[0]}, Nullable: {row[1]}, Default: {row[2]}")
    else:
        print("Column not found")
