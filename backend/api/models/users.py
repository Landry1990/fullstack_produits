"""
User-related models: Profile and user signals.
"""
from django.contrib.auth.models import User
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver


# Droits gérés par groupe : les valeurs effectives restent matérialisées sur
# Profile.can_*/max_discount_rate (lus par tout le code existant) ;
# GroupePermissions + derogations ne servent qu'à les recalculer.
PERMISSION_FIELDS = [
    'can_do_returns', 'can_sell_negative_stock', 'can_cash_out',
    'can_delete_product', 'can_adjust_stock', 'can_delete_fournisseur',
    'can_delete_commande', 'can_close_commande', 'can_generate_coupon',
    'can_cancel_invoice', 'can_modify_invoice', 'can_cancel_promis',
    'can_manage_perimes', 'can_manage_avoirs', 'can_create_client_credit',
    'can_manage_challenges', 'can_validate_zero_amount', 'can_validate_sales',
    'can_view_cash_sessions', 'can_view_cash_totals',
    'can_modify_price', 'can_do_remise',
]


class GroupePermissions(models.Model):
    """Groupe de droits : base commune + dérogations individuelles sur Profile."""
    name = models.CharField(max_length=50, unique=True, verbose_name='Nom')
    description = models.TextField(blank=True, default='', verbose_name='Description')
    is_system = models.BooleanField(
        default=False,
        help_text='Groupe de base : modifiable mais non supprimable.',
    )
    # None = le groupe ne touche pas aux menus des membres
    allowed_menus = models.JSONField(null=True, blank=True, default=None)

    can_do_returns = models.BooleanField(default=False)
    can_sell_negative_stock = models.BooleanField(default=False)
    can_cash_out = models.BooleanField(default=True)
    can_delete_product = models.BooleanField(default=False)
    can_adjust_stock = models.BooleanField(default=False)
    can_delete_fournisseur = models.BooleanField(default=False)
    can_delete_commande = models.BooleanField(default=False)
    can_close_commande = models.BooleanField(default=False)
    can_generate_coupon = models.BooleanField(default=False)
    can_cancel_invoice = models.BooleanField(default=False)
    can_modify_invoice = models.BooleanField(default=False)
    can_cancel_promis = models.BooleanField(default=False)
    can_manage_perimes = models.BooleanField(default=False)
    can_manage_avoirs = models.BooleanField(default=False)
    can_create_client_credit = models.BooleanField(default=False)
    can_manage_challenges = models.BooleanField(default=False)
    can_validate_zero_amount = models.BooleanField(default=False)
    can_validate_sales = models.BooleanField(default=False)
    can_view_cash_sessions = models.BooleanField(default=False)
    can_view_cash_totals = models.BooleanField(default=True)
    can_modify_price = models.BooleanField(default=False)
    can_do_remise = models.BooleanField(default=False)
    max_discount_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Groupe de permissions'
        verbose_name_plural = 'Groupes de permissions'
        ordering = ['name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Répercuter les droits du groupe sur tous les membres.
        for profile in self.membres.all():
            profile.recompute_permissions()


class Profile(models.Model):
    """Extended user profile with permissions and role."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    allowed_menus = models.JSONField(default=list, blank=True)
    can_do_returns = models.BooleanField(default=False)
    can_sell_negative_stock = models.BooleanField(default=False)
    can_cash_out = models.BooleanField(default=True, help_text="Autorisé à encaisser (si mode centralisé actif)")
    
    # Granular Permissions
    can_delete_product = models.BooleanField(default=False, verbose_name="Supprimer des produits")
    can_adjust_stock = models.BooleanField(default=False, verbose_name="Ajuster le stock manuellement")
    can_delete_fournisseur = models.BooleanField(default=False, verbose_name="Supprimer des fournisseurs")
    can_delete_commande = models.BooleanField(default=False, verbose_name="Supprimer des commandes")
    can_close_commande = models.BooleanField(default=False, verbose_name="Clôturer des commandes")
    can_generate_coupon = models.BooleanField(default=False, verbose_name="Générer des coupons")
    
    # New Sudo-Specific Permissions
    can_cancel_invoice = models.BooleanField(default=False, verbose_name="Annuler des factures")
    can_modify_invoice = models.BooleanField(default=False, verbose_name="Modifier des factures (Caisse)")
    can_cancel_promis = models.BooleanField(default=False, verbose_name="Annuler des promis")
    can_manage_perimes = models.BooleanField(default=False, verbose_name="Gérer les produits périmés")
    can_manage_avoirs = models.BooleanField(default=False, verbose_name="Gérer les avoirs fournisseurs")
    can_create_client_credit = models.BooleanField(default=False, verbose_name="Créer des avoirs clients")
    can_manage_challenges = models.BooleanField(default=False, help_text="Peut créer/modifier des challenges commerciaux")
    can_validate_zero_amount = models.BooleanField(default=False, verbose_name="Valider des ventes à montant nul ou négatif")
    can_validate_sales = models.BooleanField(default=False, verbose_name="Valider les ventes")
    can_view_cash_sessions = models.BooleanField(default=False, verbose_name="Voir l'historique des sessions de caisse")
    can_view_cash_totals = models.BooleanField(default=True, verbose_name="Voir les totaux du journal de caisse")
    is_terminal_account = models.BooleanField(
        default=False,
        verbose_name="Compte poste de vente partagé",
        help_text="Si coché, ce compte représente un poste de vente physique. Le vrai vendeur doit s'identifier par mot de passe à chaque vente."
    )

    # Price & Discount Control
    can_modify_price = models.BooleanField(default=False, verbose_name="Modifier le prix de vente")
    can_do_remise = models.BooleanField(default=False, verbose_name="Appliquer des remises")
    max_discount_rate = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        default=0, 
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        verbose_name="Remise maximum (%)"
    )

    ROLE_CHOICES = [
        ('PHARMACIEN', 'Pharmacien'),
        ('VENDEUR', 'Vendeur'),
        ('CAISSIER', 'Caissier'),
        ('COMPTABLE', 'Comptable'),
    ]
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='VENDEUR')

    # Groupe de droits : les can_* du profil matérialisent les valeurs
    # effectives (groupe + dérogations). Hors groupe → champs propres.
    groupe = models.ForeignKey(
        GroupePermissions, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='membres',
        verbose_name='Groupe de permissions',
    )
    derogations = models.JSONField(
        default=dict, blank=True,
        help_text='Écarts par rapport au groupe : {"can_do_remise": true, ...}',
    )

    # Compte créé avec un mot de passe attribué (défaut ou par un admin) :
    # l'utilisateur doit définir son propre mot de passe au prochain login.
    must_change_password = models.BooleanField(
        default=False,
        verbose_name="Changement de mot de passe obligatoire",
    )

    def __str__(self):
        return f"Profile of {self.user.username}"

    def recompute_permissions(self):
        """Réécrit can_*/max_discount_rate/allowed_menus = groupe + dérogations.

        Hors groupe : les champs propres restent la source (rien à faire).
        """
        if not self.groupe_id:
            return
        groupe = self.groupe
        derog = self.derogations or {}
        update_fields = []
        for f in PERMISSION_FIELDS:
            new_val = derog.get(f, getattr(groupe, f))
            if getattr(self, f) != new_val:
                setattr(self, f, new_val)
            update_fields.append(f)
        rate = derog.get('max_discount_rate', groupe.max_discount_rate)
        self.max_discount_rate = rate
        update_fields.append('max_discount_rate')
        if 'allowed_menus' in derog:
            self.allowed_menus = derog['allowed_menus']
            update_fields.append('allowed_menus')
        elif groupe.allowed_menus is not None:
            self.allowed_menus = groupe.allowed_menus
            update_fields.append('allowed_menus')
        self.save(update_fields=update_fields)


class Team(models.Model):
    """Équipe de travail (regroupement d'utilisateurs pour le planning)."""
    SHIFT_TYPE_CHOICES = [
        ('MATIN', 'Matin'),
        ('NUIT', 'Nuit'),
        ('GARDE', 'Garde'),
        ('REPOS', 'Repos'),
    ]
    name = models.CharField(max_length=100, verbose_name="Nom")
    members = models.ManyToManyField(
        User, related_name='teams', blank=True, verbose_name="Membres"
    )
    default_shift = models.CharField(
        max_length=10, choices=SHIFT_TYPE_CHOICES, default='MATIN',
        verbose_name="Poste par défaut (mode équipe fixe)"
    )
    color = models.CharField(max_length=7, default='#3B82F6', verbose_name="Couleur")
    ordering = models.PositiveIntegerField(default=0, verbose_name="Ordre")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['ordering', 'name']
        verbose_name = "Équipe"
        verbose_name_plural = "Équipes"

    def __str__(self):
        return self.name


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)


@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    if not hasattr(instance, 'profile') or instance.profile is None:
        Profile.objects.get_or_create(user=instance)
    else:
        instance.profile.save()
