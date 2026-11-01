# Étude de commerciabilité — Zenith Pharma
Date : 2026-11-01 · Marché visé : officines d'Afrique francophone (Côte d'Ivoire, zone OHADA)

## 1. Le produit
Application full-stack de gestion d'officine : caisse + facturation, stock lots/FEFO avec
péremptions, promis (crédit client), commandes fournisseurs (télétransmission), périmés avec
workflow de sortie sécurisé (Sudo + audit), inventaire PDA offline, transformations,
dashboard temps réel (WebSocket), rapports, gamification opérateurs, import DCI,
mobile-facturation, licence/keyday, mises à jour auto, déploiement Docker sur site.

## 2. Le marché
- ~1 400 officines en Côte d'Ivoire, croissance démographique forte ; digitalisation en cours.
- Prix de marché observés : 12 500–15 000 FCFA/mois/poste (Phénix, Madata) ; abonnements
  premium supérieurs chez les acteurs historiques.
- Attentes clés acheteurs : tiers-payant/assurances, grossistes connectés (UBIPHARM, LABOREX,
  DPCI, SIAP), Mobile Money, fonctionnement hors-ligne, support terrain rapide.

## 3. Concurrents
| Concurrent | Forces | Faiblesses / angle d'attaque |
|---|---|---|
| Mediciel | Historique, complet, installé | Interface vieillissante, serveur local |
| Meditect | Cloud, gestion à distance, mises à jour fréquentes | Dépendance internet, peu de PDA offline |
| ANGEPHARMA | Ivoirien, +200 pharmacies, IA, multisite | Support critiqué, stack lourde |
| Phénix (AS PHARM) | Grossistes connectés, Mobile Money, prix clair | Licence par poste, peu de gamification/PDA |
| Madata | SYSCOHADA, offline caisse, prix bas | Récent, compta > pharma pur |

## 4. Positionnement de Zenith Pharma
**Atouts différenciants mesurables**
- PWA + Docker : zéro serveur métier, installation < 1 jour, mise à jour auto (watchdog).
- Inventaire PDA offline natif + mobile-facturation : argument fort vs Mediciel/Phénix.
- Sécurité/audit granulaire (Sudo par permission, journal d'audit) : rare sur ce marché,
  vendable aux propriétaires multi-employés (contrôle interne, vols, remises abusives).
- Temps réel WebSocket (stock, périmés) : perception "logiciel vivant" vs batch.
- Gamification des opérateurs : différenciant RH quasi unique.
- Architecture moderne (React 19/Django 5) : vélocité d'évolution supérieure.

**Faiblesses à traiter avant vente large**
- Tiers-payant/assurances : à vérifier vs couverture ASCOMA etc. (points de friction #1).
- Pas de compta SYSCOHADA intégrée (Madata l'a) — partenariat ou module à prévoir.
- Connecteurs catalogues grossistes (UBIPHARM, DPCI) : existent partiellement (DCI),
  à industrialiser.
- Une seule langue de déploiement testée ; support terrain à organiser.

## 5. Recommandation commerciale
- **Cible** : officines indépendantes + groupes 2-10 pharmacies, Abidjan puis intérieur.
- **Prix indicatif** : 12 000–15 000 FCFA/mois par poste, installation payante optionnelle,
  PDA en option matériel. Sous-positionner de 10-15 % vs Phénix pour pénétrer.
- **Arguments #1** : offline PDA + audit/Sudo + cloud-on-premise (données chez le client,
  contrairement au cloud pur — sensible côté données santé).
- **Blocages à lever** : tiers-payant local, Mobile Money en caisse, formation incluse.
- **Verdict** : produit commercialisable dès maintenant pour les pharmacies orientées
  contrôle interne ; fenêtre favorable avant consolidation cloud des acteurs (12–18 mois).
