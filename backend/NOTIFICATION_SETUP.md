# Instructions pour configurer les notifications automatiques

## Option 1: Planificateur Windows (Task Scheduler)

### Créer une tâche planifiée quotidienne:

1. **Ouvrir le Planificateur de tâches Windows**
   - Appuyez sur `Win + R`, tapez `taskschd.msc` et appuyez sur Entrée

2. **Créer une nouvelle tâche**
   - Cliquez sur "Créer une tâche..." dans le panneau de droite
   - Nom: "Vérification Produits Périmés Pharmacie"
   - Description: "Vérification quotidienne des produits proches de la péremption"

3. **Déclencheurs**
   - Cliquez sur l'onglet "Déclencheurs" > "Nouveau..."
   - Début de la tâche: "Selon une planification"
   - Paramètres: "Tous les jours" à 8h00 (ou l'heure souhaitée)
   - Cliquez sur "OK"

4. **Actions**
   - Cliquez sur l'onglet "Actions" > "Nouveau..."
   - Action: "Démarrer un programme"
   - Programme/script: `C:\Projet Fullstack\fullstack_produits\backend\my_env01\Scripts\python.exe`
   - Ajoutez des arguments: `manage.py check_expiring_products --days 30`
   - Danscommencer: `C:\Projet Fullstack\fullstack_produits\backend`
   - Cliquez sur "OK"

5. **Conditions et Paramètres**
   - Décochez "Démarrer la tâche uniquement si l'ordinateur est sur secteur"
   - Cochez "Exécuter même si l'utilisateur n'est pas connecté" (optionnel)
   - Cliquez sur "OK" pour créer la tâche

---

## Option 2: Script Batch Simple

Créez un fichier `check_expiring.bat` dans `C:\Projet Fullstack\fullstack_produits\backend\`:

```batch
@echo off
cd /d "C:\Projet Fullstack\fullstack_produits\backend"
call my_env01\Scripts\activate
python manage.py check_expiring_products --days 30
pause
```

Puis créez une tâche planifiée qui exécute ce fichier `.bat`.

---

## Option 3: Exécution Manuelle

Pour tester ou exécuter manuellement:

```bash
cd "C:\Projet Fullstack\fullstack_produits\backend"
.\my_env01\Scripts\activate
python manage.py check_expiring_products --days 30
```

### Options disponibles:

- `--days <nombre>`: Nombre de jours à l'avance (défaut: 30)
- `--min-quantity <nombre>`: Quantité minimale pour notifier (défaut: 1)

**Exemples:**
```bash
# Vérifier les produits expirant dans 7 jours
python manage.py check_expiring_products --days 7

# Vérifier les produits expirant dans 60 jours avec au moins 10 unités
python manage.py check_expiring_products --days 60 --min-quantity 10
```

---

## Format de la Notification

La commande affichera dans la console:

```
⚠️  ALERTE: 5 lot(s) expirent dans les 30 prochains jours:

  • Paracétamol 500mg (Lot: L2025-001) - 50 unités - Expire le 15/01/2025 (15 jours)
  • Amoxicilline 1g (Lot: AX-789) - 30 unités - Expire le 04/01/2025 (4 jours)
  ...

🚨 2 lot(s) CRITIQUE(S) (≤ 7 jours)

💡 Actions recommandées:
  1. Vérifier si retour fournisseur possible
  2. Appliquer des remises pour écouler le stock
  3. Créer un Avoir (type PERIME) si applicable
  4. Utiliser "Sortir Périmés" pour destruction
```

---

## Améliorations Futures Possibles

- Envoi de notifications par email
- Intégration avec un système de messagerie (Slack, Teams, etc.)
- Export en PDF pour rapport quotidien
- Webhook vers une application mobile
