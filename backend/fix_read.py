import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models.communication import InternalMessage
from django.contrib.auth.models import User

# let's count messages and read_by
total = InternalMessage.objects.count()
print(f"Total messages: {total}")

for msg in InternalMessage.objects.all():
    print(f"Msg {msg.id} from {msg.sender.username} to {msg.recipient.username if msg.recipient else 'Tous'} - read by {msg.read_by.count()}")

# For nkaha: calculate unread count
user = User.objects.filter(username__icontains='nkaha').first()
if user:
    from django.db.models import Q
    count = InternalMessage.objects.filter(
        Q(recipient=user) | Q(recipient__isnull=True)
    ).exclude(sender=user).exclude(read_by=user).distinct().count()
    print(f"\nUnread count for {user.username}: {count}")
