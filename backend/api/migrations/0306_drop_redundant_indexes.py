# Suppression des index redondants détectés par `manage.py audit_indexes`
# (2026-11-25) : chaque index supprimé a ses colonnes en préfixe strict d'un
# index plus large sur la même table (ex. FK facture_id ⊂ (facture_id,
# produit_id)) — les requêtes restent servies par l'index couvrant, le coût
# en écriture et le volume disque disparaissent.
#
# atomic = False : DROP INDEX CONCURRENTLY est interdit dans une transaction.
# Les opérations d'état (RemoveIndex / AlterField is_active) alignent les
# modèles sur la base : les index implicites de FK restent db_index=True —
# leur absence est volontaire et couverte par l'index composite.

from django.db import migrations, models


# (index, table, colonnes pour le reverse)
DROPS = [
    ('api_caisse_date_pa_7ed591_idx', 'api_caisse', 'date_paiement'),
    ('api_caisse_facture_id_865a820f', 'api_caisse', 'facture_id'),
    ('api_challengeequipe_challenge_id_ea583187', 'api_challengeequipe', 'challenge_id'),
    ('api_challengepointtier_challenge_id_19938c85', 'api_challengepointtier', 'challenge_id'),
    ('api_commande_is_active_a51040ce', 'api_commande', 'is_active'),
    ('api_depotclient_client_id_587def87', 'api_depotclient', 'client_id'),
    ('api_dotationamortissement_immobilisation_id_d86a3d3e', 'api_dotationamortissement', 'immobilisation_id'),
    ('api_druginteraction_substance_a_id_90487461', 'api_druginteraction', 'substance_a_id'),
    ('api_ecriturecomptable_exercice_id_c79e27f5', 'api_ecriturecomptable', 'exercice_id'),
    ('api_facture_client_id_c9a6fa40', 'api_facture', 'client_id'),
    ('api_facture_created_by_id_efa8b3df', 'api_facture', 'created_by_id'),
    ('api_facture_poste_caisse_id_88b6bf53', 'api_facture', 'poste_caisse_id'),
    ('api_factureproduit_facture_id_12b9f77f', 'api_factureproduit', 'facture_id'),
    ('api_ligneecriture_compte_id_0566b99d', 'api_ligneecriture', 'compte_id'),
    ('api_ligneinventaire_inventaire_id_bcbf7cc0', 'api_ligneinventaire', 'inventaire_id'),
    ('api_ligneinventaire_produit_id_b6da1bb4', 'api_ligneinventaire', 'produit_id'),
    ('api_ligneinventaire_stock_lot_id_fd29dce0', 'api_ligneinventaire', 'stock_lot_id'),
    ('api_mouvementstock_produit_id_bd2521ee', 'api_mouvementstock', 'produit_id'),
    ('api_paiemois_employe_id_16b019f6', 'api_paiemois', 'employe_id'),
    ('api_produit_rayon_id_093c7f2a', 'api_produit', 'rayon_id'),
    ('api_produit_stock_a2a21e_idx', 'api_produit', 'stock'),
    ('api_promotionpackitem_promotion_id_aba2a58a', 'api_promotionpackitem', 'promotion_id'),
    ('api_relationtransformation_produit_source_id_208f18da', 'api_relationtransformation', 'produit_source_id'),
    ('api_rupturefournisseur_produit_id_8516be52', 'api_rupturefournisseur', 'produit_id'),
    ('api_shiftassignment_schedule_id_434101d3', 'api_shiftassignment', 'schedule_id'),
    ('api_stockadjustment_produit_id_b6317684', 'api_stockadjustment', 'produit_id'),
    ('api_stockadjustment_user_id_debe107f', 'api_stockadjustment', 'user_id'),
    ('api_stocklo_produit_315126_idx', 'api_stocklot', 'produit_id, quantity_remaining'),
    ('api_stocklot_produit_id_e66442b9', 'api_stocklot', 'produit_id'),
    ('api_stockobligation_facture_id_12d63a36', 'api_stockobligation', 'facture_id'),
    ('api_stockobligation_produit_id_62faac9a', 'api_stockobligation', 'produit_id'),
    ('api_stockobligation_promis_id_6c8e7876', 'api_stockobligation', 'promis_id'),
    ('api_stockobligationresolution_obligation_id_5f563fd3', 'api_stockobligationresolution', 'obligation_id'),
    ('api_userdailysession_user_id_b3fee823', 'api_userdailysession', 'user_id'),
]


class Migration(migrations.Migration):

    atomic = False  # DROP INDEX CONCURRENTLY ne peut pas être dans une transaction

    dependencies = [
        ('api', '0305_regularisations_provisions_paie'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=f'DROP INDEX CONCURRENTLY IF EXISTS {name};',
                    reverse_sql=(
                        f'CREATE INDEX CONCURRENTLY IF NOT EXISTS {name} '
                        f'ON {table} ({cols});'),
                )
                for name, table, cols in DROPS
            ],
            state_operations=[
                migrations.RemoveIndex(
                    model_name='caisse',
                    name='api_caisse_date_pa_7ed591_idx',
                ),
                migrations.RemoveIndex(
                    model_name='produit',
                    name='api_produit_stock_a2a21e_idx',
                ),
                migrations.RemoveIndex(
                    model_name='stocklot',
                    name='api_stocklo_produit_315126_idx',
                ),
                migrations.AlterField(
                    model_name='commande',
                    name='is_active',
                    field=models.BooleanField(
                        default=True,
                        help_text='Commande active (non supprimée dans la corbeille)'),
                ),
            ],
        ),
    ]
