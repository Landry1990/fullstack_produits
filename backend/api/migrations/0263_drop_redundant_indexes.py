# Suppression des index redondants avec les index FK auto de Django.
#
# Les Meta.indexes (produit) / (facture) de FactureProduit et (fournisseur)
# de Produit doublonnaient les index B-tree créés automatiquement pour les
# ForeignKey — chaque ligne de facture payait 2 écritures d'index inutiles.
#
# atomic = False : requis pour DROP INDEX CONCURRENTLY (PostgreSQL l'interdit
# dans une transaction). Un DROP par RunSQL pour la même raison que 0262.

from django.db import migrations


class Migration(migrations.Migration):

    atomic = False  # DROP INDEX CONCURRENTLY ne peut pas être dans une transaction

    dependencies = [
        ('api', '0262_perf_indexes'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='DROP INDEX CONCURRENTLY IF EXISTS api_facture_produit_4b65b3_idx',
                    reverse_sql=migrations.RunSQL.noop,
                ),
                migrations.RunSQL(
                    sql='DROP INDEX CONCURRENTLY IF EXISTS api_facture_facture_cf998d_idx',
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
            state_operations=[
                migrations.RemoveIndex(
                    model_name='factureproduit',
                    name='api_facture_produit_4b65b3_idx',
                ),
                migrations.RemoveIndex(
                    model_name='factureproduit',
                    name='api_facture_facture_cf998d_idx',
                ),
            ],
        ),
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='DROP INDEX CONCURRENTLY IF EXISTS api_produit_fournis_5607f1_idx',
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
            state_operations=[
                migrations.RemoveIndex(
                    model_name='produit',
                    name='api_produit_fournis_5607f1_idx',
                ),
            ],
        ),
    ]
