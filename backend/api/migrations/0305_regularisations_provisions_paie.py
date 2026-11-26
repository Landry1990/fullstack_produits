from decimal import Decimal

import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


COMPTES = (
    ('119000', 'Report à nouveau (débiteur)', 'ACTIF'),
    ('129000', 'Résultat de l\'exercice (déficit)', 'PASSIF'),
    ('481000', 'Charges constatées d\'avance', 'ACTIF'),
    ('482000', 'Charges à payer', 'PASSIF'),
    ('486000', 'Produits constatés d\'avance', 'PASSIF'),
    ('487000', 'Produits à recevoir', 'ACTIF'),
)


def seed_comptes(apps, schema_editor):
    Compte = apps.get_model('api', 'CompteComptable')
    alias = schema_editor.connection.alias
    for numero, libelle, type_ in COMPTES:
        compte, created = Compte.objects.using(alias).get_or_create(
            numero=numero, defaults={'libelle': libelle, 'type': type_, 'is_active': True})
        # Les comptes 481/486 ont pu être créés à la volée par _compte() avec
        # le libellé générique « Régularisation » — on corrige le libellé.
        if not created and compte.libelle == 'Régularisation':
            compte.libelle = libelle
            compte.save(update_fields=['libelle'])


class Migration(migrations.Migration):
    dependencies = [('api', '0304_facture_arrondi_cinq_francs')]

    operations = [
        migrations.RunPython(seed_comptes, migrations.RunPython.noop),
        migrations.CreateModel(
            name='Employe',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nom', models.CharField(max_length=200)),
                ('poste', models.CharField(blank=True, max_length=100)),
                ('salaire_brut', models.DecimalField(decimal_places=2, default=Decimal('0.00'),
                    help_text='Brut mensuel de référence pré-rempli à la saisie', max_digits=14)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={'verbose_name': 'Employé', 'ordering': ['nom']},
        ),
        migrations.CreateModel(
            name='Regularisation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('type', models.CharField(choices=[('CCA', "Charge constatée d'avance"), ('PCA', "Produit constaté d'avance"), ('CAP', 'Charge à payer'), ('PAR', 'Produit à recevoir')], max_length=3)),
                ('montant', models.DecimalField(decimal_places=2, max_digits=14, validators=[django.core.validators.MinValueValidator(Decimal('0.01'))])),
                ('date', models.DateField()),
                ('description', models.CharField(max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('compte', models.ForeignKey(help_text='Compte de charge (CCA/CAP) ou de produit (PCA/PAR)', on_delete=django.db.models.deletion.PROTECT, related_name='regularisations', to='api.comptecomptable')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('ecriture', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='regularisations', to='api.ecriturecomptable')),
                ('extourne_ecriture', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='regularisations_extournees', to='api.ecriturecomptable')),
            ],
            options={'verbose_name': 'Régularisation', 'ordering': ['-date', '-created_at']},
        ),
        migrations.CreateModel(
            name='CreanceDouteuse',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('montant', models.DecimalField(decimal_places=2, max_digits=14, validators=[django.core.validators.MinValueValidator(Decimal('0.01'))])),
                ('statut', models.CharField(choices=[('douteuse', 'Douteuse'), ('recouvree', 'Recouvrée'), ('irrecouvrable', 'Irrécouvrable')], default='douteuse', max_length=15)),
                ('commentaire', models.CharField(blank=True, max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('client', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='creances_douteuses', to='api.client')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('dotation_ecriture', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='depreciations_clients', to='api.ecriturecomptable')),
                ('sortie_ecriture', models.ForeignKey(blank=True, help_text='OD de reprise (recouvrement ou perte)', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='sorties_depreciations_clients', to='api.ecriturecomptable')),
            ],
            options={'verbose_name': 'Créance douteuse', 'ordering': ['-created_at']},
        ),
        migrations.CreateModel(
            name='DepreciationStock',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('libelle', models.CharField(max_length=255)),
                ('montant', models.DecimalField(decimal_places=2, max_digits=14, validators=[django.core.validators.MinValueValidator(Decimal('0.01'))])),
                ('statut', models.CharField(choices=[('dotee', 'Dotée'), ('reprise', 'Reprise')], default='dotee', max_length=10)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('dotation_ecriture', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='depreciations_stock', to='api.ecriturecomptable')),
                ('reprise_ecriture', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reprises_depreciations_stock', to='api.ecriturecomptable')),
            ],
            options={'verbose_name': 'Dépréciation de stock', 'ordering': ['-created_at']},
        ),
        migrations.CreateModel(
            name='PaieMois',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('mois', models.DateField(help_text='Toujours le 1er du mois')),
                ('brut', models.DecimalField(decimal_places=2, max_digits=14, validators=[django.core.validators.MinValueValidator(Decimal('0'))])),
                ('cotisations_salariales', models.DecimalField(decimal_places=2, default=Decimal('0.00'),
                    help_text='Part salariale CNPS et assimilées', max_digits=14,
                    validators=[django.core.validators.MinValueValidator(Decimal('0'))])),
                ('irpp', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=14,
                    validators=[django.core.validators.MinValueValidator(Decimal('0'))])),
                ('charges_patronales', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=14,
                    validators=[django.core.validators.MinValueValidator(Decimal('0'))])),
                ('statut', models.CharField(choices=[('brouillon', 'Brouillon'), ('comptabilisee', 'Comptabilisée')], default='brouillon', max_length=15)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('ecriture', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='paies', to='api.ecriturecomptable')),
                ('employe', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='paies', to='api.employe')),
            ],
            options={'verbose_name': 'Paie mensuelle', 'ordering': ['-mois', 'employe__nom'], 'unique_together': {('employe', 'mois')}},
        ),
    ]
