# Generated manually — traçabilité des substances ajoutées par link_generic

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0275_alter_auditlog_action'),
    ]

    operations = [
        migrations.AddField(
            model_name='produit',
            name='generic_link_substances',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='Ids des substances ajoutées par le lien générique déclaré (unlink_generic ne retire que celles-là, jamais les liens pré-existants)',
            ),
        ),
    ]
