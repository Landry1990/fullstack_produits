import json
import os

import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from rest_framework.test import APIRequestFactory

from api.models.communication import InternalMessage
from api.serializers import InternalMessageSerializer

factory = APIRequestFactory()
msg = InternalMessage.objects.first()
if msg:
    serializer = InternalMessageSerializer(msg)
    print(json.dumps(serializer.data, indent=2))
else:
    print("No messages found")
