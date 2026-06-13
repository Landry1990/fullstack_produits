# Migration pour créer la table des seuils par produit-fournisseur

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('api', '0203_add_date_premiere_vente'),
    ]

    operations = [
        migrations.CreateModel(
            name='ProduitFournisseurSeuil',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('stock_minimum', models.IntegerField(default=0, help_text='Seuil minimum calculé ou manuel')),
                ('stock_maximum', models.IntegerField(default=0, help_text='Seuil maximum calculé ou manuel')),
                ('is_auto_calculated', models.BooleanField(default=True, help_text='True=calculé auto, False=manuel par pharmacien')),
                ('calculated_at', models.DateTimeField(blank=True, null=True, help_text='Date du dernier calcul')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('fournisseur', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='produit_seuils', to='api.fournisseur')),
                ('produit', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='fournisseur_seuils', to='api.produit')),
            ],
            options={
                'unique_together': {('produit', 'fournisseur')},
            },
        ),
    ]
