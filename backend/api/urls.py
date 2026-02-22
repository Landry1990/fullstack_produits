from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProduitViewSet, CategorieViewSet, FournisseurViewSet, ClientViewSet,
    CommandeViewSet, CommandeProduitViewSet, FactureViewSet, FactureProduitViewSet, CaisseViewSet,
    DashboardViewSet, StatistiquesViewSet, AyantDroitViewSet, StockLotViewSet, CreanceViewSet,
    MouvementCaisseViewSet, InventaireViewSet, LigneInventaireViewSet, AvoirViewSet, LigneAvoirViewSet,
    RelationTransformationViewSet, HistoriqueTransformationViewSet,
    InvoiceConfigurationView, ClotureCaisseViewSet, StockAdjustmentViewSet,
    generer_suggestions_commande, HistoriqueVentesViewSet, HistoriqueAchatsViewSet,
    StatsUGViewSet, StockAnalysisUnsoldView, StockAnalysisOverstockView, StockAnalysisShortageView,
    PharmacySettingsView, ProductImportView, ConfigurationOptionViewSet,
    AuditLogViewSet, LoyaltySettingViewSet, UserViewSet, CustomAuthToken,
    CategoriesListView, CategoriesDetailView, PromisViewSet,
    PromotionViewSet, TVAViewSet
)
from .views.formes import FormeViewSet
from .views.paiements import PaiementFournisseurViewSet
from .views.coupons import CouponMonnaieViewSet
from .views.groupes import GroupeViewSet
from .views.auth import verify_password
from .views.etat_inventaire import EtatInventairePDFView
from .rapport_view import RapportViewSet
from .ordonnancier_view import OrdonnancierViewSet
from .views.communication import SmsViewSet, SmsTemplateViewSet
from .views.finance_stats import FinanceStatsViewSet
from .views.objectifs import ObjectifViewSet
from .views.temporal_analysis import TemporalAnalysisViewSet


# Create a router and register our viewsets with it.
router = DefaultRouter()

router.register(r'users', UserViewSet, basename='user')
router.register(r'produits', ProduitViewSet, basename='produit')
router.register(r'rayons', CategorieViewSet, basename='rayon')
router.register(r'categories-raw', CategorieViewSet, basename='categorie')
router.register(r'fournisseurs', FournisseurViewSet, basename='fournisseur')
router.register(r'clients', ClientViewSet, basename='client')
router.register(r'ayants-droit', AyantDroitViewSet, basename='ayantdroit')
router.register(r'commandes', CommandeViewSet, basename='commande')
router.register(r'commande-produits', CommandeProduitViewSet, basename='commandeproduit')
router.register(r'factures', FactureViewSet, basename='facture')
router.register(r'facture-produits', FactureProduitViewSet, basename='factureproduit')
router.register(r'caisse', CaisseViewSet, basename='caisse')
router.register(r'dashboard', DashboardViewSet, basename='dashboard')
router.register(r'statistiques', StatistiquesViewSet, basename='statistiques')
router.register(r'rapports', RapportViewSet, basename='rapports')
router.register(r'stock-lots', StockLotViewSet, basename='stocklot')
router.register(r'creances', CreanceViewSet, basename='creance')
router.register(r'mouvements-caisse', MouvementCaisseViewSet, basename='mouvementcaisse')
router.register(r'inventaires', InventaireViewSet, basename='inventaire')
router.register(r'lignes-inventaire', LigneInventaireViewSet, basename='ligneinventaire')
router.register(r'avoirs', AvoirViewSet, basename='avoir')
router.register(r'ligne-avoirs', LigneAvoirViewSet, basename='ligneavoir')
router.register(r'stats-ug', StatsUGViewSet, basename='statsug')
router.register(r'relations-transformation', RelationTransformationViewSet, basename='relationtransformation')
router.register(r'historique-transformation', HistoriqueTransformationViewSet, basename='historiquetransformation')
router.register(r'clotures-caisse', ClotureCaisseViewSet, basename='cloturecaisse')
router.register(r'stock-adjustments', StockAdjustmentViewSet, basename='stockadjustment')
router.register(r'historique-ventes', HistoriqueVentesViewSet, basename='historiqueventes')
router.register(r'historique-achats', HistoriqueAchatsViewSet, basename='historiqueachats')
router.register(r'ordonnancier', OrdonnancierViewSet, basename='ordonnancier')
router.register(r'audit-logs', AuditLogViewSet, basename='audit-log')
router.register(r'loyalty-settings', LoyaltySettingViewSet, basename='loyaltysetting')
router.register(r'formes', FormeViewSet, basename='forme')
router.register(r'groupes', GroupeViewSet, basename='groupe')
router.register(r'coupons', CouponMonnaieViewSet, basename='coupon')
router.register(r'sms', SmsViewSet, basename='sms')
router.register(r'sms-templates', SmsTemplateViewSet, basename='smstemplate')
router.register(r'paiements-fournisseurs', PaiementFournisseurViewSet, basename='paiementfournisseur')
router.register(r'configuration-options', ConfigurationOptionViewSet, basename='configurationoption')
router.register(r'promis', PromisViewSet, basename='promis')
router.register(r'promotions', PromotionViewSet, basename='promotion')
router.register(r'finance-stats', FinanceStatsViewSet, basename='finance-stats')
router.register(r'objectifs-commerciaux', ObjectifViewSet, basename='objectif-commercial')
router.register(r'temporal-analysis', TemporalAnalysisViewSet, basename='temporal-analysis')
router.register(r'tva', TVAViewSet, basename='tva')


# The API URLs are now determined automatically by the router.
urlpatterns = [
    path('auth/token/', CustomAuthToken.as_view(), name='token-auth'),
    path('verify-password/', verify_password, name='verify-password'),
    path('categories/', CategoriesListView.as_view(), name='categories-list'),
    path('categories/<int:pk>/', CategoriesDetailView.as_view(), name='categories-detail'),
    path('stock-analysis/unsold/', StockAnalysisUnsoldView.as_view(), name='stock-analysis-unsold'),
    path('stock-analysis/overstock/', StockAnalysisOverstockView.as_view(), name='stock-analysis-overstock'),
    path('stock-analysis/shortage/', StockAnalysisShortageView.as_view(), name='stock-analysis-shortage'),
    path('invoice-settings/', InvoiceConfigurationView.as_view(), name='invoice-settings'),
    path('pharmacy-settings/', PharmacySettingsView.as_view(), name='pharmacy-settings'),
    path('products/import/', ProductImportView.as_view(), name='product-import'),
    path('generer-suggestions/', generer_suggestions_commande, name='generer-suggestions'),
    path('produits/etat-inventaire/pdf/', EtatInventairePDFView.as_view(), name='etat-inventaire-pdf'),
    path('', include(router.urls)),
]
