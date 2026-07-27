import os

import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth.models import User
from rest_framework.test import APIRequestFactory

from api.serializers import InternalMessageSerializer

factory = APIRequestFactory()
user = User.objects.first()
request = factory.get('/')
request.user = user

data = {
    'recipient': None,
    'content': 'Test message from script'
}

serializer = InternalMessageSerializer(data=data, context={'request': request})
if serializer.is_valid():
    msg = serializer.save(sender=user)
    print(f"Created message ID: {msg.id}")
    print(f"Content: {msg.content}")
    print(f"Sender: {msg.sender.username}")
else:
    print(f"Errors: {serializer.errors}")
