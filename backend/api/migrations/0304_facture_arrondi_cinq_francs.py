from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('api', '0303_seed_amortissement_accounts')]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='ALTER TABLE api_facture ADD COLUMN IF NOT EXISTS arrondi_5f boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS ecart_arrondi numeric(12, 2) NOT NULL DEFAULT 0',
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
            state_operations=[
                migrations.AddField(model_name='facture', name='arrondi_5f', field=models.BooleanField(default=True)),
                migrations.AddField(model_name='facture', name='ecart_arrondi', field=models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))),
            ],
        ),
    ]
