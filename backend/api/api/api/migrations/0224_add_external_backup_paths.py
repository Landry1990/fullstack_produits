# Generated manually on 2026-07-23

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0223_add_deleted_by_deleted_at'),
    ]

    operations = [
        migrations.AddField(
            model_name='pharmacysettings',
            name='external_backup_path_1',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Destination externe 1 (ex: USB: D:\\Backups, disque dur: E:\\Backups, réseau: \\\\NAS\\backups)',
                max_length=500,
            ),
        ),
        migrations.AddField(
            model_name='pharmacysettings',
            name='external_backup_path_2',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Destination externe 2 (ex: autre USB, disque dur, dossier partagé réseau)',
                max_length=500,
            ),
        ),
        migrations.AddField(
            model_name='pharmacysettings',
            name='external_backup_path_3',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Destination externe 3 (ex: dossier partagé d\'une autre machine \\\\192.168.1.50\\backups)',
                max_length=500,
            ),
        ),
    ]
