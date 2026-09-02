from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0243_mouvementstock_avoir_client'),
    ]

    operations = [
        migrations.CreateModel(
            name='LoyaltyHistory',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('type_transaction', models.CharField(choices=[('GAIN', 'Gain (vente)'), ('UTILISATION', 'Utilisation (vente)'), ('REMISE_AUTO', 'Remise automatique'), ('AJUSTEMENT', 'Ajustement manuel')], max_length=20)),
                ('points', models.IntegerField(help_text='Points gagnés (positif) ou utilisés (négatif)')),
                ('solde_apres', models.IntegerField(default=0, help_text='Solde de points après la transaction')),
                ('montant', models.DecimalField(default=0, decimal_places=2, max_digits=10, help_text='Valeur monétaire (FCFA) si applicable')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('notes', models.TextField(blank=True, default='')),
                ('client', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='loyalty_history', to='api.client')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='auth.user')),
                ('facture', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='loyalty_history', to='api.facture')),
            ],
            options={
                'verbose_name': 'Historique fidélité',
                'verbose_name_plural': 'Historiques fidélité',
                'ordering': ['-created_at'],
            },
        ),
    ]
