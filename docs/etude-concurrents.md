# Étude comparative — Zenith Pharma vs concurrents (Cameroun)
Date : 2026-11-01 · Marché : officines Cameroun / zone CEMAC (XAF, TVA 19,25 %, SYSCOHADA)

## Lecture du marché camerounais
Spécificités : bilinguisme officiel (fr/en — interface bilingue = avantage), Mobile Money
dominant (MTN MoMo + Orange Money), TVA 19,25 %, SYSCOHADA obligatoire, grossistes locaux
(SIAP PHARMA, UBIPHARM, LABOREX CAM…), zone CEMAC = réplication possible (Gabon, Tchad,
Congo, RCA, Guinée Éq.). La concurrence est moins installée qu'en CI : opportunité réelle.

## Forces de chaque concurrent

### VINDATA (vindataPharm) — le leader installé
- **Forces** : 20 ans de terrain (2005, Yaoundé) ; 60+ officines privées ; vendeur local
  avec formation/installation sur site ; vindataEMR dans les hôpitaux ; déployé à
  l'échelle nationale (CNLS, stocks ARV) → crédibilité institutionnelle ; réputation
  CEMAC (Pharma Expo Yaoundé).
- **Faiblesses** : architecture Java client-serveur lourde (serveur Linux + postes
  Windows à installer) ; mises à jour peu fréquentes ; interface datée ; pas de cloud
  ni PDA offline moderne. (Source partielle : page comparative Meditect — à confirmer
  sur le terrain.)
- **Contre Zenith** : l'incumbent à déloger — argument migration + modernité
  (mises à jour auto, Sudo/audit, PDA, pas de serveur coûteux).

### PHARMIS (Opesware, Douala) — le plus dangereux localement
- **Forces** : éditeur camerounais (support depuis Douala) ; écrans bilingues ; Mobile Money
  natif ; fonctionne hors ligne ; stock lots/péremptions ; registre stupéfiants ; multisite ;
  intégration hôpitaux (OPES Hospital HIS / EMR).
- **Faiblesses** : moins de pilotage/BI ; pas de gamification ; écosystème orienté santé
  globale plutôt qu'officine pure.
- **Contre Zenith** : frontalier n°1 — même terrain, mêmes arguments offline. Différencier
  sur Sudo/audit, PDA inventaire, gamification et vitesse d'évolution.

### Phénix (AS PHARM) — présent au Cameroun depuis 2025
- **Forces** : 12 500 FCFA/mois/poste tout compris ; MTN MoMo + Orange Money natifs ;
  grossistes connectés (UBIPHARM, LABOREX…) ; tiers-payant ASCOMA ; migration de données
  incluse ; support WhatsApp en français ; 12 pays, 10 ans de terrain sous-régional.
- **Faiblesses** : licence par poste (cher en multi-postes) ; pas de PDA offline ;
  pas de gamification ni audit avancé.
- **Contre Zenith** : son offre « tout compris + MoMo + grossistes » est la référence à
  battre ; sous-positionner au multi-postes.

### Meditect — leader cloud francophone
- **Forces** : le plus utilisé en Afrique subsaharienne francophone ; 6 modules intégrés
  (vente, stock, référentiel ATC, finances, pilotage, assurances) ; référentiel produits
  le plus complet ; benchmarks anonymisés entre pharmacies ; mises à jour continues.
- **Faiblesses** : cloud pur → coupure internet = comptoir arrêté ; données hors site ;
  pas de PDA inventaire offline dédié.
- **Contre Zenith** : même angle qu'en CI — offline + données chez le client.

### KiboERP — ERP SYSCOHADA camerounais
- **Forces** : SYSCOHADA-AUDCIF natif (écritures auto, bilan, compte de résultat) ; TVA
  19,25 % gérée + récap DGE/DGI ; MoMo tracé ; multi-succursales ; essai 14 jours.
- **Faiblesses** : ERP généraliste → métier officine moins poussé (périmés, promis,
  lots FEFO) ; jeune.
- **Contre Zenith** : menace si le client priorise la compta → riposte = export
  SYSCOHADA plutôt que compta intégrée.

### AppSwite — petit gestionnaire local
- **Forces** : simple, sans engagement, config rapide ; stock + seuils + ventes.
- **Faiblesses** : pas de profondeur officine (promis, périmés workflow, Sudo, multi-rayon).
- **Contre Zenith** : pas un vrai concurrent pour une officine sérieuse.

## Matrice comparée
| Critère | Zenith | PHARMIS | Phénix | Meditect | KiboERP | AppSwite |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Caisse + facturation | ● | ● | ● | ● | ● | ● |
| Stock lots/FEFO/périmés | ● | ● | ● | ● | ◐ | ◐ |
| Promis / crédit client | ● | ◐ | ◐ | ◐ | ◐ | ✗ |
| Offline (coupure réseau) | ● | ● | ◐ | ✗ | ◐ | ◐ |
| Inventaire PDA offline | ● | ◐ | ✗ | ◐ | ✗ | ✗ |
| Mobile vente terrain | ● | ◐ | ◐ | ◐ | ✗ | ✗ |
| Sudo + audit granulaire | ● | ◐ | ◐ | ◐ | ◐ | ✗ |
| Temps réel (WebSocket) | ● | ◐ | ✗ | ● | ◐ | ✗ |
| Mises à jour auto | ● | ◐ | ◐ | ● | ◐ | ◐ |
| Interface bilingue fr/en | ◐ | ● | ◐ | ◐ | ◐ | ◐ |
| Mobile Money (MTN/OM) | ◐ | ● | ● | ● | ● | ◐ |
| Tiers-payant/assurances | ◐ | ● | ● | ● | ◐ | ✗ |
| Grossistes connectés | ◐ | ◐ | ● | ◐ | ◐ | ✗ |
| SYSCOHADA / TVA 19,25 % | ◐ | ◐ | ◐ | ◐ | ● | ✗ |
| Gamification équipe | ● | ✗ | ✗ | ✗ | ✗ | ✗ |
| Données chez le client | ● | ● | ◐ | ✗ | ◐ | ◐ |
| Support sur place (Cameroun) | ● | ● | ● | ◐ | ◐ | ● |
● fort ◐ partiel/présent ✗ absent

## Vos forces à vendre en priorité (Cameroun)
1. **Contrôle interne unique** : Sudo par permission + audit complet — le discours
   « maîtrisez vos employés » est le plus différenciant sur ce marché.
2. **Terrain offline** : PDA inventaire + mobile-facturation — ni PHARMIS ni Phénix
   n'ont un équivalent complet.
3. **Zéro serveur métier** : Docker on-premise + Tailscale = accès distant sécurisé,
   données chez le client, pas d'abonnement cloud.
4. **Déjà en prod** : licence/keyday + watchdog + mises à jour auto prouvés sur site.

## Gaps à combler (ordre d'impact commercial Cameroun)
1. **Mobile Money natif** (MTN MoMo + Orange Money) — moyen de paiement n°1 au comptoir.
2. **Tiers-payant local** (assureurs/mutuelles CM) — bloquant pour une large part d'officines.
3. **Bilinguisme complet** : i18n fr/en existe — vérifier que tous les écrans métier sont
   couverts (argument face à PHARMIS).
4. **Connecteurs grossistes locaux** (SIAP PHARMA en priorité — déjà présent dans la base).
5. **Export SYSCOHADA** + récap TVA 19,25 % pour le comptable.

## Stratégie recommandée
- **Discours** : « Le logiciel qui contrôle vos employés ET fonctionne sans internet » —
  aucun concurrent camerounais ne cumule Sudo/audit + offline terrain.
- **Cible 1** : officines de Douala/Yaoundé non équipées ou sur Excel/AppSwite.
- **Cible 2** : groupes 2-5 pharmacies (audit centralisé + dashboard temps réel).
- **Prix** : 10 000–12 500 FCFA/mois/poste, installation + formation sur site payante ;
  sous-positionner Phénix dès le 2ᵉ poste.
- **Leverage CEMAC** : une fois établi au Cameroun, réplication Gabon/Tchad/Congo
  où la concurrence est quasi nulle.

