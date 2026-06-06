# Generated manually on 2026-06-06

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0200_add_cloud_backup_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='pharmacysettings',
            name='google_drive_backup_path',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Chemin du dossier Google Drive monté (ex: /mnt/gdrive) pour copie automatique',
                max_length=500,
            ),
        ),
    ]
