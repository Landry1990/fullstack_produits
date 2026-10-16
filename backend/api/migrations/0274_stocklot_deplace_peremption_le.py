# Étagère « proches péremption » : champ timestamp nullable (NULL = lot en
# rayon normal). AddField sans index (colonne nullable, pas de défaut → ALTER
# TABLE rapide) puis index en CREATE INDEX CONCURRENTLY → atomic = False.

from django.db import migrations, models


class Migration(migrations.Migration):

    atomic = False

    dependencies = [
        ('api', '0273_profile_must_change_password'),
    ]

    operations = [
        migrations.AddField(
            model_name='stocklot',
            name='deplace_peremption_le',
            field=models.DateTimeField(blank=True, help_text="Lot déplacé sur l'étagère « proches péremption »", null=True),
        ),
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='CREATE INDEX CONCURRENTLY IF NOT EXISTS stocklot_deplace_per_idx ON api_stocklot (deplace_peremption_le);',
                    reverse_sql='DROP INDEX IF EXISTS stocklot_deplace_per_idx;',
                ),
            ],
            state_operations=[
                migrations.AddIndex(
                    model_name='stocklot',
                    index=models.Index(fields=['deplace_peremption_le'], name='stocklot_deplace_per_idx'),
                ),
            ],
        ),
    ]
