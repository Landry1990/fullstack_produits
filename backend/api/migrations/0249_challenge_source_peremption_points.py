from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0248_challenge_type_objectif_mode_equipes'),
    ]

    operations = [
        # Étendre les choices de type_objectif pour ajouter POINTS
        migrations.AlterField(
            model_name='challenge',
            name='type_objectif',
            field=models.CharField(
                choices=[
                    ('CA', "Chiffre d'affaires"),
                    ('BOITES', 'Nombre de boîtes'),
                    ('POINTS', 'Points bonus'),
                ],
                default='CA',
                help_text="Métrique principale du challenge (CA, BOITES ou POINTS)",
                max_length=6,
            ),
        ),
        migrations.AddField(
            model_name='challenge',
            name='source_produits',
            field=models.CharField(
                choices=[('MANUEL', 'Manuel'), ('AUTO_PEREMPTION', 'Auto péremption')],
                default='MANUEL',
                help_text="Source de la liste des produits : manuelle ou auto-calculée par péremption",
                max_length=15,
            ),
        ),
        migrations.AddField(
            model_name='challenge',
            name='peremption_mois',
            field=models.IntegerField(
                blank=True,
                null=True,
                help_text="Seuil en mois pour l'auto-peuplement (ex: 6 = produits péremptibles dans ≤6 mois)",
            ),
        ),
        migrations.CreateModel(
            name='ChallengePointTier',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('mois_max', models.IntegerField(help_text='Seuil en mois (ex: 1 = ≤1 mois, 3 = ≤3 mois)')),
                ('points', models.IntegerField(help_text='Points par boîte vendue')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('challenge', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='point_tiers', to='api.challenge')),
            ],
            options={
                'verbose_name': 'Barème de points',
                'verbose_name_plural': 'Barèmes de points',
                'ordering': ['challenge', 'mois_max'],
                'unique_together': {('challenge', 'mois_max')},
            },
        ),
    ]
