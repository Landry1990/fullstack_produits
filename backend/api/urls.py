from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProduitViewSet, CategorieViewSet, FournisseurViewSet, ClientViewSet,
    CommandeViewSet, CommandeProduitViewSet, FactureViewSet, FactureProduitViewSet, CaisseViewSet,
    DashboardViewSet, StatistiquesViewSet, AyantDroitViewSet, StockLotViewSet, CreanceViewSet,
    MouvementCaisseViewSet, InventaireViewSet, LigneInventaireViewSet, AvoirViewSet, LigneAvoirViewSet,
    RelationTransformationViewSet, HistoriqueTransformationViewSet,
    InvoiceConfigurationView, ClotureCaisseViewSet, StockAdjustmentViewSet,
    generer_suggestions_commande, HistoriqueVentesViewSet,
    StatsUGViewSet, StockAnalysisUnsoldView, StockAnalysisOverstockView
)
from .views.auth import verify_password
from .rapport_view import RapportViewSet
from .ordonnancier_view import OrdonnancierViewSet


# Create a router and register our viewsets with it.
router = DefaultRouter()


router.register(r'produits', ProduitViewSet, basename='produit')
router.register(r'rayons', CategorieViewSet, basename='rayon')
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
router.register(r'rapports', RapportViewSet, basename='rapport')
router.register(r'ordonnancier', OrdonnancierViewSet, basename='ordonnancier')


# The API URLs are now determined automatically by the router.
urlpatterns = [
    path('verify-password/', verify_password, name='verify-password'),
    path('stock-analysis/unsold/', StockAnalysisUnsoldView.as_view(), name='stock-analysis-unsold'),
    path('stock-analysis/overstock/', StockAnalysisOverstockView.as_view(), name='stock-analysis-overstock'),
    path('invoice-settings/', InvoiceConfigurationView.as_view(), name='invoice-settings'),
    # The API URLs are now determined automatically by the router.
    path('', include(router.urls)),
]