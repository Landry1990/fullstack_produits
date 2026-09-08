from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0213_custom_payment_modes'),
    ]

    operations = [
        migrations.AddField(
            model_name='pharmacysettings',
            name='last_stock_analytics_run',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
