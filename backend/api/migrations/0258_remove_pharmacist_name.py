from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0257_pharmacist_name_documents'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='pharmacysettings',
            name='pharmacist_name',
        ),
    ]
