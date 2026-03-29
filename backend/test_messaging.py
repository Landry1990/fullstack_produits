import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models.communication import InternalMessage
from api.serializers import InternalMessageSerializer
from django.contrib.auth.models import User
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

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
