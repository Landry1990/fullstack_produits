# Rapport d'audit i18n — Textes en dur

**Total fichiers concernés :** 309

## Fichiers prioritaires (top 50)

| Fichier | Nb textes |
|---------|-----------|
| src\hooks\reports\queries.ts | 185 |
| src\components\SimplePrintLabelsModal.tsx | 82 |
| src\components\GestionUtilisateurs.tsx | 80 |
| src\components\CaisseCentralisee.tsx | 58 |
| src\hooks\reports\utils.ts | 51 |
| src\hooks\useCommandesState.ts | 49 |
| src\components\Sidebar.tsx | 46 |
| src\components\ModuleFinancier.tsx | 41 |
| src\components\Corbeille.tsx | 40 |
| src\hooks\useCentreRapports.ts | 35 |
| src\components\HistoriqueClotures.tsx | 33 |
| src\components\Maintenance.tsx | 33 |
| src\types\labels.ts | 33 |
| src\components\dashboard\PerformanceOverview.tsx | 31 |
| src\components\compta\Comptabilite.tsx | 28 |
| src\components\Commandes\OrderSchedulingModal.tsx | 27 |
| src\components\__tests__\Ventes.test.tsx | 26 |
| src\components\ImportDCIPage.tsx | 25 |
| src\components\Produit.tsx | 25 |
| src\components\__tests__\Dashboard.test.tsx | 25 |
| src\components\RapportMensuel.tsx | 24 |
| src\components\__tests__\Facturation.test.tsx | 23 |
| src\components\Login.tsx | 22 |
| src\components\Transformations.tsx | 22 |
| src\components\__tests__\Commandes.test.tsx | 22 |
| src\hooks\index.ts | 22 |
| src\components\ProduitFormModal.tsx | 21 |
| src\hooks\useFacturationActions.ts | 21 |
| src\services\__tests__\creanceService.test.ts | 21 |
| src\components\AnalyseABC.tsx | 20 |
| src\components\caisse\CouponPanel.tsx | 20 |
| src\components\caisse\JournalCaisseTable.tsx | 20 |
| src\components\CatalogDCI.tsx | 20 |
| src\components\Commandes\ScheduledOrdersListModal.tsx | 20 |
| src\components\BestCashierMetric.tsx | 19 |
| src\components\PointageReleveModal.tsx | 19 |
| src\hooks\inventaire\useInventaireEditor.ts | 19 |
| src\utils\print\printHelpers.ts | 18 |
| src\components\facturation\ActionButtons.tsx | 17 |
| src\components\Facturation.tsx | 17 |
| src\components\EcheancierFournisseursModal.tsx | 16 |
| src\hooks\useDashboard.ts | 16 |
| src\hooks\useSaleCompletion.ts | 16 |
| src\services\produitService.ts | 16 |
| src\utils\print\relevePdf.ts | 16 |
| src\components\facturation\ProductSearchSection.tsx | 15 |
| src\components\JournalAudit.tsx | 15 |
| src\components\LicenceNotifications.tsx | 15 |
| src\hooks\useInvoiceActions.tsx | 15 |
| src\hooks\useJournalCaisse.ts | 15 |


## Détails par fichier

### src\hooks\reports\queries.ts

- L6: `Rapport Mensuel`
- L7: `CA, marges, créances pour un mois donné`
- L10: `Mois`
- L16: `CA par Période`
- L17: `Chiffre d\`
- L20: `Date début`
- L21: `Date fin`
- L27: `Alertes Stock`
- L28: `Stock < Rotation Moyenne OU Stock <= Seuil Minimum`
- L35: `Produits Périmés / Proches`
- L36: `Produits périmés ou proches de la péremption`
- L39: `Jours avant péremption`
- L45: `Créances en Cours (Détail)`
- L46: `Liste détaillée des factures non soldées`
- L53: `Synthèse Créances par Client`
- L54: `Total des dettes regroupées par client`
- L57: `Depuis`
- L58: `Jusqu\`
- L58: `, type: `
- L64: `Ventes par Tranche Horaire`
- ... et 165 autres

### src\components\SimplePrintLabelsModal.tsx

- L57: `📦`
- L58: `📍`
- L59: `▮▯▮▯`
- L60: `💰`
- L61: `🏥`
- L62: `🚚`
- L63: `📅`
- L65: `📋`
- L66: `🏷️`
- L67: `🧾`
- L81: `30x15`
- L81: `30x15`
- L83: `40x20`
- L96: `CODE128`
- L129: `40x20`
- L129: `30x15`
- L133: `30x15`
- L141: `0.5mm 1mm`
- L141: `0.8mm 1.2mm`
- L142: `0.3px solid #ccc`
- ... et 62 autres

### src\components\GestionUtilisateurs.tsx

- L47: `sidebar:dashboard`
- L48: `sidebar:manager_sidebar`
- L51: `sidebar:ventes.title`
- L53: `sidebar:ventes.consultation`
- L54: `sidebar:ventes.historique`
- L55: `sidebar:ventes.journal`
- L56: `sidebar:ventes.clotures`
- L57: `sidebar:ventes.ordonnancier`
- L58: `sidebar:ventes.promotions`
- L59: `sidebar:ventes.caisse_centralisee`
- L62: `sidebar:facturation`
- L63: `sidebar:produits`
- L64: `sidebar:vitrine`
- L67: `sidebar:commandes.local_title`
- L69: `sidebar:commandes.new_current`
- L70: `sidebar:commandes.history`
- L75: `sidebar:commandes.direct_title`
- L77: `sidebar:commandes.new_current`
- L78: `sidebar:commandes.history`
- L81: `sidebar:fournisseurs.title`
- ... et 60 autres

### src\components\CaisseCentralisee.tsx

- L72: `BROU,VAL`
- L83: `Erreur lors du chargement des factures en attente:`
- L94: `Erreur lors du chargement des coupons:`
- L124: `coupons/`
- L136: `Erreur génération coupon:`
- L167: `Erreur initialisation page:`
- L217: `Erreur utilisation coupon:`
- L237: `Erreur recherche coupon:`
- L308: `Escape`
- L316: `Escape`
- L327: `ArrowDown`
- L330: `ArrowUp`
- L335: `Enter`
- L343: ` || e.key === `
- L350: ` || e.key === `
- L357: `Escape`
- L364: ` && e.key <= `
- L472: `Client de passage`
- L477: `Mixte`
- L514: `Erreur lors du paiement:`
- ... et 38 autres

### src\hooks\reports\utils.ts

- L7: `Client`
- L8: `Type`
- L9: `Nb Ventes`
- L10: `CA TTC`
- L11: `Panier Moy.`
- L12: `Nom`
- L13: `Produit`
- L15: `Montant Total`
- L16: `Stock`
- L17: `Rayon`
- L18: `Fournisseur`
- L19: `Mode Règl.`
- L20: `Référence`
- L21: `Valeur`
- L23: `Vendeur`
- L24: `Nb Ventes`
- L25: `Total`
- L26: `Statut`
- L27: `Dernière Vente`
- L28: `Date Annulation`
- ... et 31 autres

### src\hooks\useCommandesState.ts

- L162: `Erreur lors du chargement de la commande via navigation:`
- L185: `produits/for_import/`
- L186: `commandes/`
- L187: `fournisseurs/`
- L536: `Auto-save error:`
- L545: `, coeff: `
- L670: `Delete`
- L677: `Escape`
- L711: `${rowIndex}`
- L724: `${rowIndex}`
- L724: `${fieldsConfig[nextFieldIndex].name}`
- L743: `${rowIndex}`
- L743: `${fieldsConfig[prevFieldIndex].name}`
- L751: `Enter`
- L752: `Tab`
- L753: `ArrowDown`
- L761: `${nextRow}`
- L761: `${fieldName}`
- L771: `ArrowUp`
- L779: `${prevRow}`
- ... et 29 autres

### src\components\Sidebar.tsx

- L23: ` d=`
- L26: ` d=`
- L32: ` d=`
- L45: ` d=`
- L48: ` d=`
- L51: ` d=`
- L54: ` d=`
- L60: ` d=`
- L71: ` d=`
- L79: ` d=`
- L85: ` d=`
- L93: ` d=`
- L99: ` d=`
- L120: ` d=`
- L138: ` d=`
- L146: ` d=`
- L158: ` d=`
- L158: ` /><path strokeLinecap=`
- L158: ` strokeLinejoin=`
- L158: ` strokeWidth=`
- ... et 26 autres

### src\components\ModuleFinancier.tsx

- L31: `../hooks/useFinanceStats`
- L119: `📈`
- L121: `📉`
- L123: `➡️`
- L219: ` : `
- L236: `Margin Variance Report`
- L236: `Rapport de Variation de Marge`
- L239: `Analysis of profit fluctuations and data integrity`
- L239: `Analyse des fluctuations de profit et intégrité des données`
- L244: ` : `
- L257: `Current Period`
- L257: `Période Actuelle`
- L259: `Profit`
- L259: `Marge`
- L262: `Baseline`
- L262: `Référence (Hier)`
- L264: `Profit`
- L264: `Marge`
- L269: `Key Insights`
- L269: `Analyses Clés`
- ... et 21 autres

### src\components\Corbeille.tsx

- L34: `tabs.all`
- L35: `tabs.produits`
- L36: `tabs.clients`
- L37: `tabs.fournisseurs`
- L38: `tabs.commandes`
- L39: `tabs.avoirs`
- L40: `tabs.promis`
- L41: `tabs.inventaires`
- L42: `tabs.factures`
- L43: `tabs.users`
- L211: `badges.produit`
- L212: `badges.client`
- L213: `badges.fournisseur`
- L214: `badges.commande`
- L215: `badges.avoir`
- L216: `badges.promis`
- L217: `badges.inventaire`
- L218: `badges.facture`
- L219: `badges.user`
- L232: `fr-FR`
- ... et 20 autres

### src\hooks\useCentreRapports.ts

- L11: `./reports/types`
- L12: `./reports/utils`
- L13: `./reports/queries`
- L21: `./reports/utils`
- L29: `./reports/types`
- L109: `CanceledError`
- L109: `Erreur chargement clients:`
- L119: `CanceledError`
- L119: `Erreur chargement fournisseurs:`
- L129: `CanceledError`
- L129: `Erreur chargement utilisateurs:`
- L139: `CanceledError`
- L139: `Erreur chargement familles:`
- L145: `report_presets:v1`
- L214: `report_presets:v1`
- L215: `Configuration enregistrée !`
- L221: `report_presets:v1`
- L276: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- L298: `text/csv`
- L319: `Impression lancée`
- ... et 15 autres

### src\components\HistoriqueClotures.tsx

- L140: `Erreur initialisation HistoriqueClotures:`
- L175: `Erreur chargement clôtures:`
- L209: `Erreur chargement sessions:`
- L210: `Erreur lors du chargement des sessions de caisse`
- L227: `2-digit`
- L228: `2-digit`
- L230: `2-digit`
- L231: `2-digit`
- L244: `, `
- L244: `, `
- L332: ` : `
- L352: `dd/MM/yyyy`
- L371: `dd/MM/yyyy`
- L522: `ouverture d`
- L594: ` strokeLinecap=`
- L594: ` strokeLinejoin=`
- L594: ` className=`
- L594: `><path d=`
- L751: `N/A`
- L842: `aspect mais on conserve l`
- ... et 13 autres

### src\components\Maintenance.tsx

- L37: `💰`
- L42: `📦`
- L47: `📊`
- L52: `🏦`
- L57: `📋`
- L62: `🎯`
- L121: `Error loading pharmacy settings`
- L129: `Sélectionnez un fichier Excel`
- L133: `Envoi du fichier...`
- L138: `Content-Type`
- L143: `Import démarré en arrière-plan...`
- L174: `Erreur lors du lancement de l\`
- L180: `Mot de passe requis`
- L193: `Erreur lors de la purge`
- L208: `Erreur téléchargement rapport`
- L336: `Initialisation...`
- L348: `Analyse de la base de données...`
- L349: `Extraction des tables...`
- L350: `Génération du fichier SQL...`
- L351: `Compression GZip...`
- ... et 13 autres

### src\types\labels.ts

- L19: `CODE128`
- L19: `EAN13`
- L19: `CODE39`
- L89: `product.name`
- L89: `Nom du produit`
- L90: `product.code`
- L90: `Code produit`
- L91: `product.cip1`
- L91: `Code CIP1`
- L92: `product.cip2`
- L92: `Code CIP2`
- L93: `product.ppv`
- L93: `Prix de vente`
- L94: `product.cost_price`
- L94: `Prix d'achat`
- L95: `product.dci`
- L96: `product.forme`
- L96: `Forme`
- L97: `product.dosage`
- L97: `Dosage`
- ... et 13 autres

### src\components\dashboard\PerformanceOverview.tsx

- L80: ` : `
- L80: `}${stats.revenue?.change || 0}% ${t(`
- L196: ` y1=`
- L196: ` x2=`
- L196: ` y2=`
- L202: `hsl(var(--bc) / 0.6)`
- L203: `hsl(var(--bc) / 0.5)`
- L204: `hsl(var(--wa))`
- L206: `Ventes`
- L207: `hsl(var(--b1))`
- L207: `1px solid hsl(var(--bc) / 0.1)`
- L207: `12px`
- L207: `0 10px 25px -5px rgba(0,0,0,.2)`
- L207: `10px 14px`
- L208: `hsl(var(--bc))`
- L209: `hsl(var(--bc) / 0.5)`
- L219: `hsl(var(--b1))`
- L220: `hsl(var(--b1))`
- L231: `hsl(var(--b1))`
- L261: ` y1=`
- ... et 11 autres

### src\components\compta\Comptabilite.tsx

- L116: `• `
- L153: `scale-110`
- L530: `, libelle: `
- L530: `, type: `
- L621: `opacity-50`
- L662: `Modifier le compte`
- L662: `Nouveau compte`
- L724: `Enregistrer`
- L724: `Créer`
- L754: `Supprimer`
- L824: `Loyer (Bail)`
- L824: `🏢`
- L825: `Eau & Électricité (ENEO/CAMWATER)`
- L826: `Salaires du personnel`
- L826: `👥`
- L827: `Impôts et Taxes`
- L827: `🏛️`
- L828: `Internet & Téléphone`
- L828: `🌐`
- L829: `Fournitures de bureau`
- ... et 8 autres

### src\components\Commandes\OrderSchedulingModal.tsx

- L104: `Veuillez sélectionner un fournisseur valide`
- L110: `La fréquence doit être d'au moins 1 semaine`
- L116: `Sélectionnez au moins un jour d'activation`
- L123: `Format d'heure invalide (HH:MM attendu, ex: 14:30)`
- L134: `La date de début ne peut pas être dans le passé`
- L140: `Précisez la logique AND/OR pour les conditions min montant et min articles`
- L162: `Planning mis à jour !`
- L165: `Planning créé avec succès !`
- L176: `Erreur lors de l'enregistrement du planning`
- L184: `, full: `
- L185: `, full: `
- L186: `, full: `
- L187: `, full: `
- L188: `, full: `
- L189: `, full: `
- L190: `, full: `
- L205: `Veuillez d'abord sélectionner un fournisseur`
- L211: `Le budget maximum doit être un nombre valide`
- L218: `Les dates de début et fin sont requises pour ce mode`
- L222: `La date de début doit être antérieure à la date de fin`
- ... et 7 autres

### src\components\__tests__\Ventes.test.tsx

- L28: `../hooks/usePharmacySettings`
- L31: `Pharmacie Test`
- L32: `123 Rue Test`
- L38: `Ventes Component`
- L43: `FAC-001`
- L44: `Jean Dupont`
- L45: `2023-01-01T10:00:00`
- L47: `Validée`
- L51: `Doliprane`
- L56: `FAC-002`
- L57: `Marie Curie`
- L58: `2023-01-02T11:00:00`
- L60: `Annulée`
- L63: `Erreur de saisie Motif: Erreur`
- L79: `Client Test`
- L86: `renders correctly and fetches factures`
- L105: `handles filtering`
- L131: `searches for invoices`
- L140: `Jean`
- L160: `opens product details modal`
- ... et 6 autres

### src\components\ImportDCIPage.tsx

- L88: `Content-Type`
- L345: ` strokeLinecap=`
- L345: ` strokeLinejoin=`
- L345: `><path d=`
- L348: ` strokeLinecap=`
- L348: ` strokeLinejoin=`
- L348: `><path d=`
- L351: ` strokeLinecap=`
- L351: ` strokeLinejoin=`
- L351: `><path d=`
- L354: ` strokeLinecap=`
- L354: ` strokeLinejoin=`
- L354: `><path d=`
- L357: ` strokeLinecap=`
- L357: ` strokeLinejoin=`
- L357: `><path d=`
- L357: ` y1=`
- L357: ` x2=`
- L357: ` y2=`
- L360: ` strokeLinecap=`
- ... et 5 autres

### src\components\Produit.tsx

- L27: `../hooks/useProduits`
- L142: `[Pagination Debug] count:`
- L142: `pages:`
- L163: `, stock: `
- L163: `, cost_price: `
- L163: `, selling_price: `
- L163: `, cip1: `
- L163: `, cip2: `
- L163: `, cip3: `
- L164: `, stock_alert: `
- L164: `, stock_minimum: `
- L164: `, stock_maximum: `
- L164: `, tva: `
- L165: `, fournisseur: `
- L165: `, forme: `
- L167: `, min_rayon: `
- L167: `, message_alerte: `
- L178: `, message: `
- L298: `⚠️ `
- L337: ` : `
- ... et 5 autres

### src\components\__tests__\Dashboard.test.tsx

- L42: `../../hooks/useDashboard`
- L58: `../../context/PharmacySettingsContext`
- L60: `Test`
- L60: `, low_stock_threshold_days: 15, dormant_stock_days: 90, locale: `
- L65: `../../context/AuthContext`
- L72: `Dashboard Component`
- L90: `Lun`
- L90: `Mar`
- L90: `Mer`
- L95: `Paracétamol`
- L96: `Ibuprofène`
- L101: `Fournisseur A`
- L106: `Produit Rare`
- L106: `Jean Dupont`
- L110: `Sirop`
- L110: `LOT123`
- L114: `08h`
- L115: `09h`
- L123: `Pharma Distrib`
- L133: `FACT-001`
- ... et 5 autres

### src\components\RapportMensuel.tsx

- L174: `Erreur lors du chargement du rapport`
- L192: ` d=`
- L214: ` d=`
- L230: `Erreur génération PDF:`
- L243: ` d=`
- L280: `tab-active !bg-primary !text-white`
- L284: ` d=`
- L289: `tab-active !bg-primary !text-white`
- L293: ` d=`
- L328: `📅`
- L330: `📆`
- L331: `🗓️`
- L332: `✏️`
- L406: ` d=`
- L459: ` d=`
- L526: ` d=`
- L577: ` d=`
- L674: ` d=`
- L691: ` : `
- L713: `badge-success badge-outline`
- ... et 4 autres

### src\components\__tests__\Facturation.test.tsx

- L15: `../../hooks/useCart`
- L16: `../../hooks/useFacturationClients`
- L17: `../../hooks/useProductSearch`
- L18: `../../context/AuthContext`
- L19: `../../hooks/usePharmacySettings`
- L20: `../../hooks/usePendingSales`
- L22: `@tanstack/react-query`
- L29: `../LotSelectionModal`
- L30: `../OrdonnanceModal`
- L31: `./printing/TicketTemplate`
- L34: `../facturation/PaymentModal`
- L42: `../facturation/CartTable`
- L52: `../facturation/TotalsSection`
- L56: `../facturation/ActionButtons`
- L62: `CLICKED ENCAISSER, onPayment is:`
- L67: `Valid`
- L67: `Invalid`
- L75: `Facturation Integration`
- L101: `, phone: `
- L171: `Doliprane`
- ... et 3 autres

### src\components\Login.tsx

- L36: `Error fetching users:`
- L103: `Login error:`
- L122: `Êtes-vous sûr de vouloir supprimer la licence actuelle ? Le système se verrouillera à nouveau.`
- L127: `Error resetting licence:`
- L134: `Bonjour`
- L134: `Bon après-midi`
- L134: `Bonsoir`
- L145: `Zenith`
- L182: `Zenith`
- L215: `Sélectionner un utilisateur`
- L218: `rotate(180deg)`
- L218: `rotate(0)`
- L219: `transform 0.3s ease`
- L236: `100%`
- L237: `rgba(255,255,255,0.05)`
- L238: `1px solid rgba(255,255,255,0.1)`
- L239: `0.75rem`
- L240: `0.6rem 1rem`
- L242: `0.8rem`
- L357: `1.5rem`
- ... et 2 autres

### src\components\Transformations.tsx

- L109: ` clipRule=`
- L127: ` d=`
- L182: ` d=`
- L240: `Erreur fetch:`
- L333: ` d=`
- L390: ` d=`
- L423: ` d=`
- L492: ` d=`
- L502: ` d=`
- L517: ` d=`
- L529: ` d=`
- L542: ` d=`
- L570: ` d=`
- L607: ` d=`
- L610: `accent/10`
- L611: `primary/5`
- L612: `success/10`
- L624: ` d=`
- L645: ` d=`
- L655: ` d=`
- ... et 2 autres

### src\components\__tests__\Commandes.test.tsx

- L18: `../../context/AuthContext`
- L22: `../../hooks/usePharmacySettings`
- L26: `../../hooks/useProduits`
- L31: `../../hooks/useConfirm`
- L37: `CMD-001`
- L37: `Fournisseur A`
- L38: `CMD-002`
- L38: `Fournisseur B`
- L41: `../../hooks/useCommandes`
- L52: `../../hooks/useProductSearch`
- L61: `../SimplePrintLabelsModal`
- L62: `../SuggestionCommandeModal`
- L63: `../ProduitFormModal`
- L64: `../PasswordConfirmModal`
- L65: `../Commandes/TransferCommandeModal`
- L66: `../Commandes/MergeCommandesModal`
- L68: `../Commandes/CommandeList`
- L76: `../Commandes/CommandeForm`
- L78: `../../hooks/useCommandeActions`
- L93: `../../hooks/useKeyboardNavigation`
- ... et 2 autres

### src\hooks\index.ts

- L6: `./useAudit`
- L7: `./useCart`
- L8: `./useClinicalCheck`
- L9: `./useCommandeActions`
- L10: `./useCommandes`
- L11: `./useDashboard`
- L12: `./useFacturationClients`
- L13: `./usePendingSales`
- L14: `./usePharmacySettings`
- L15: `./useProductSearch`
- L16: `./useProduits`
- L17: `./useStockLots`
- L18: `./useTemporalAnalysis`
- L21: `./useConfirm`
- L22: `./useKeyboardNavigation`
- L23: `./useSearchNavigation`
- L26: `./usePrint`
- L37: `./usePrint`
- L40: `./useSaleCompletion`
- L44: `./useSaleCompletion`
- ... et 2 autres

### src\components\ProduitFormModal.tsx

- L44: `, stock: `
- L44: `, cost_price: `
- L44: `, selling_price: `
- L44: `, cip1: `
- L44: `, cip2: `
- L44: `, cip3: `
- L45: `, stock_alert: `
- L45: `, stock_minimum: `
- L45: `, stock_maximum: `
- L45: `, tva: `
- L46: `, fournisseur: `
- L46: `, description: `
- L46: `, unite_mesure: `
- L47: `, groupe: `
- L50: `, min_rayon: `
- L89: `, `
- L93: ` | `
- L142: ` | `
- L395: ` || !p.capacite_rayon)) ? `
- L395: ` : p.capacite_rayon, min_rayon: (checked && (p.min_rayon === `
- ... et 1 autres

### src\hooks\useFacturationActions.ts

- L90: `Proforma généré avec succès`
- L101: `Erreur lors de la création du proforma`
- L109: `Le panier est vide`
- L125: `Généré via Bon de Livraison`
- L160: `Bon de livraison généré - Document prêt pour validation`
- L162: `Erreur inconnue`
- L170: `Aucune facture à imprimer.`
- L178: `Erreur lors de l'impression de la facture`
- L208: `Veuillez sélectionner un client`
- L212: `Veuillez ajouter au moins un produit`
- L237: `Ticket envoyé par WhatsApp !`
- L239: `Erreur lors de l'envoi WhatsApp`
- L275: `🔢`
- L277: `Aucun produit dans le panier pour appliquer une quantité`
- L306: `clients divers`
- L340: `Impossible de mettre en attente une vente vide`
- L344: `Maximum 4 ventes en attente atteint`
- L370: `Vente mise en attente`
- L389: `Le panier actuel n\`
- L413: `Voulez-vous vraiment supprimer cette vente en attente ?`
- ... et 1 autres

### src\services\__tests__\creanceService.test.ts

- L6: `../api`
- L13: `creanceService - Bulk Payment with Partial Amount`
- L22: `Règlement effectué. 2 factures traitées.`
- L24: `REL-20240512-001`
- L31: `FAC-001`
- L40: `FAC-002`
- L56: `Paiement client`
- L85: `Règlement effectué. 2 factures traitées.`
- L87: `REL-20240512-002`
- L94: `FAC-001`
- L103: `FAC-002`
- L119: `Chèque 12345`
- L137: `Le montant (20000.00) dépasse le total des dettes (15000.00).`
- L147: `Trop percu`
- L161: `Paiement enregistré avec succès.`
- L165: `FAC-001`
- L176: `OM123456`
- L194: `FAC-001`
- L195: `FAC-002`
- L219: `FAC-001`
- ... et 1 autres

### src\components\AnalyseABC.tsx

- L19: ` | `
- L19: ` | `
- L64: ` | `
- L64: ` | `
- L64: `>(`
- L77: `Erreur chargement filtres:`
- L97: `Erreur analyse ABC:`
- L145: `\t`
- L145: `\t`
- L145: `\n`
- L153: `Failed to copy:`
- L171: ` d=`
- L240: ` d=`
- L244: `, `
- L281: ` ? `
- L281: ` : `
- L287: ` ? `
- L287: ` : `
- L293: ` ? `
- L293: ` : `

