# Generated manually
from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('api', '0191_add_performance_indexes'),
    ]

    operations = [
        migrations.AddField(
            model_name='pharmacysettings',
            name='hide_cash_totals',
            field=models.BooleanField(default=False, help_text='Masquer les montants dans le rapport de clôture de caisse (mode sécurité)'),
        ),
    ]
