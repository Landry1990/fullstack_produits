"""
Ajout des champs dénormalisés pour le solde client (optimisation 12 postes)
"""
from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):
    """
    Ajoute des champs dénormalisés dans Client pour éviter les calculs lourds:
    - solde_factures: total des factures impayées
    - nombre_factures_impayees: nombre de factures non réglées
    - derniere_mise_a_jour_solde: timestamp de la dernière mise à jour
    """
    
    dependencies = [
        ('api', '0168_performance_indexes'),
    ]

    operations = [
        # Champ solde_factures (dénormalisé)
        migrations.AddField(
            model_name='client',
            name='solde_factures',
            field=models.DecimalField(
                decimal_places=2,
                default=0.0,
                help_text='Solde total des factures impayées (denormalisé)',
                max_digits=12,
                verbose_name='Solde factures'
            ),
        ),
        
        # Champ nombre_factures_impayees (dénormalisé)
        migrations.AddField(
            model_name='client',
            name='nombre_factures_impayees',
            field=models.IntegerField(
                default=0,
                help_text='Nombre de factures non réglées (denormalisé)',
                verbose_name='Factures impayées'
            ),
        ),
        
        # Champ derniere_mise_a_jour_solde (timestamp)
        migrations.AddField(
            model_name='client',
            name='derniere_mise_a_jour_solde',
            field=models.DateTimeField(
                blank=True,
                help_text='Dernière mise à jour du solde',
                null=True,
                verbose_name='Mise à jour solde'
            ),
        ),
        
        # Index sur le solde pour les requêtes de filtrage rapide
        migrations.AddIndex(
            model_name='client',
            index=models.Index(
                fields=['solde_factures'],
                name='idx_client_solde',
                condition=models.Q(solde_factures__gt=0),
            ),
        ),
    ]
