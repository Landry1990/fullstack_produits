import django.core.validators
import django.db.models.deletion
from decimal import Decimal
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0281_ecriture_avoir_mouvement_links'),
    ]

    operations = [
        migrations.CreateModel(
            name='Immobilisation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nom', models.CharField(max_length=200)),
                ('date_acquisition', models.DateField()),
                ('valeur_acquisition', models.DecimalField(decimal_places=2, max_digits=14, validators=[django.core.validators.MinValueValidator(Decimal('0.01'))])),
                ('duree_annees', models.PositiveIntegerField(default=5, help_text="Durée d'amortissement linéaire en années")),
                ('valeur_residuelle', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=14, validators=[django.core.validators.MinValueValidator(Decimal('0'))])),
                ('mode_paiement', models.CharField(choices=[('especes', 'Espèces'), ('banque', 'Banque'), ('credit', 'Crédit fournisseur')], default='banque', max_length=10)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('compte_amortissement', models.ForeignKey(help_text="Compte d'amortissements (28x)", on_delete=django.db.models.deletion.PROTECT, related_name='amortissements_immobilisations', to='api.comptecomptable')),
                ('compte_immo', models.ForeignKey(help_text="Compte d'immobilisation (classe 2 : 241, 244, 245…)", on_delete=django.db.models.deletion.PROTECT, related_name='immobilisations', to='api.comptecomptable')),
            ],
            options={
                'verbose_name': 'Immobilisation',
                'ordering': ['-date_acquisition'],
            },
        ),
        migrations.CreateModel(
            name='DotationAmortissement',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('annee', models.PositiveIntegerField()),
                ('montant', models.DecimalField(decimal_places=2, max_digits=14)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('ecriture', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='dotations_amortissement', to='api.ecriturecomptable')),
                ('immobilisation', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='dotations', to='api.immobilisation')),
            ],
            options={
                'ordering': ['immobilisation', 'annee'],
                'unique_together': {('immobilisation', 'annee')},
            },
        ),
    ]
