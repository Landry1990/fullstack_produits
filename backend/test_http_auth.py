import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from rest_framework.authtoken.models import Token
import requests

token = Token.objects.first()
if not token:
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user = User.objects.first()
    if user:
        token, _ = Token.objects.get_or_create(user=user)

if token:
    print(f"Using token: {token.key} for user: {token.user.username}")
    url = "http://127.0.0.1:80/api/factures/mobile/"
    headers = {"Authorization": f"Token {token.key}"}
    payload = {
        "uuid": "test-uuid",
        "client": "Test Client",
        "items": [], # empty items to trigger standard validation
        "total": 0
    }
    response = requests.post(url, headers=headers, json=payload)
    print("Status Code:", response.status_code)
    print("Headers:", dict(response.headers))
    print("Content:", response.text[:1000])
else:
    print("No user/token found in database!")
