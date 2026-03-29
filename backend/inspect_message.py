import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models.communication import InternalMessage
from api.serializers import InternalMessageSerializer
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

factory = APIRequestFactory()
msg = InternalMessage.objects.first()
if msg:
    serializer = InternalMessageSerializer(msg)
    print(json.dumps(serializer.data, indent=2))
else:
    print("No messages found")
