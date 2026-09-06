# Auto-generated duplicate migration — indexes already created by 0239/0242.
# Made no-op to avoid conflicts in test DB and production.

from django.conf import settings
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0249_challenge_source_peremption_points'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = []
