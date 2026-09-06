from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):
    dependencies = [
        ('api', '0245_alter_loyaltyhistory_id'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]
    operations = [
        migrations.CreateModel(
            name='Challenge',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('nom', models.CharField(max_length=200)),
                ('description', models.TextField(blank=True, default='')),
                ('date_debut', models.DateField()),
                ('date_fin', models.DateField()),
                ('statut', models.CharField(choices=[('BROU', 'Brouillon'), ('ENC', 'En cours'), ('CLO', 'Clôturé'), ('ANN', 'Annulé')], default='BROU', max_length=4)),
                ('is_active', models.BooleanField(db_index=True, default=True)),
                ('all_users', models.BooleanField(default=True, help_text='Si True, tous les vendeurs participent')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='challenges_created', to=settings.AUTH_USER_MODEL)),
                ('participants', models.ManyToManyField(blank=True, help_text='Vendeurs ciblés si all_users=False', related_name='challenges_participating', to=settings.AUTH_USER_MODEL)),
                ('produits', models.ManyToManyField(blank=True, help_text='Produits concernés par le challenge', related_name='challenges', to='api.produit')),
            ],
            options={
                'verbose_name': 'Challenge',
                'verbose_name_plural': 'Challenges',
                'ordering': ['-date_debut', '-id'],
            },
        ),
        migrations.AddField(
            model_name='profile',
            name='can_manage_challenges',
            field=models.BooleanField(default=False, help_text='Peut créer/modifier des challenges commerciaux'),
        ),
    ]
