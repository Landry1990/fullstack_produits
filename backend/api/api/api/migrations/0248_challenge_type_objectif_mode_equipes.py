from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0247_alter_challenge_id'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='challenge',
            name='type_objectif',
            field=models.CharField(
                choices=[('CA', "Chiffre d'affaires"), ('BOITES', 'Nombre de boîtes')],
                default='CA',
                help_text="Métrique principale du challenge (CA ou BOITES)",
                max_length=6,
            ),
        ),
        migrations.AddField(
            model_name='challenge',
            name='objectif_valeur',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="Objectif chiffré facultatif (ex: 50 boîtes, 500000 FCFA)",
                max_digits=14,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='challenge',
            name='mode',
            field=models.CharField(
                choices=[('INDIVIDUEL', 'Individuel'), ('EQUIPES', 'Équipes')],
                default='INDIVIDUEL',
                help_text="Mode de participation : individuel ou par équipes",
                max_length=10,
            ),
        ),
        migrations.CreateModel(
            name='ChallengeEquipe',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nom', models.CharField(max_length=100)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('challenge', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='equipes', to='api.challenge')),
                ('membres', models.ManyToManyField(blank=True, related_name='equipes_challenge', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Équipe de challenge',
                'verbose_name_plural': 'Équipes de challenge',
                'ordering': ['challenge', 'id'],
                'unique_together': {('challenge', 'nom')},
            },
        ),
    ]
