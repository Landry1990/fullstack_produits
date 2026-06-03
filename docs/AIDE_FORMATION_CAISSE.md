# 📚 Aide & Formation - Gestion de la Caisse

> **Objectif** : Former les caissières et pharmaciens à l'utilisation simplifiée de la caisse.

---

## 👤 Profils Utilisateurs

### 🧑‍⚕️ Pharmacien (Administrateur)
- Accès à tous les rapports financiers
- Peut activer le mode sécurité
- Consulte les totaux réels

### 👩‍💼 Caissière
- Ouvre et ferme sa caisse
- Encaisse les ventes
- Ne voit pas les montaux si mode sécurité activé

---

## 🎓 Module 1 : Ouverture de Caisse

### Étape 1 - Accéder à la caisse
```
Menu latéral → "Caisse Centrale"
```

### Étape 2 - Ouvrir la caisse
```
Bouton 🔓 "Ouvrir caisse" → vert
```

### Étape 3 - Sélectionner le poste
```
┌─────────────────────────┐
│  CAISSE PRINCIPALE      │
│  👤 Disponible          │
└─────────────────────────┘

Cliquer sur le poste → "Ouvrir"
```

### Étape 4 - Fond de caisse (optionnel)
- Laisser vide si pas de fond initial
- Ou saisir un montant (ex: 50 000 F)

### ✅ Confirmation
Le bouton passe à : 🔴 "Caisse Principale - Fermer"

---

## 🎓 Module 2 : Encaissement

### Recevoir une vente
1. La vente apparaît dans la liste
2. Cliquer sur la ligne
3. Le modal de paiement s'ouvre

### Procéder au paiement
```
Mode de paiement :
☑ Espèces
☑ Carte
☑ Mobile Money

Montant perçu : [__________]
Rendu : calculé automatiquement

[ Valider le paiement ]
```

### Impression
- Ticket client : automatique
- Facture A4 : si demandé

---

## 🎓 Module 3 : Fermeture de Caisse

### Option A - Rapport complet (défaut)
```
1. Cliquer "🔴 [Caisse] - Fermer"
2. Confirmer
3. Voir le rapport avec montants
```

**Rapport affiché :**
```
📊 RAPPORT DE CLÔTURE
Caisse Principale
02/06/2026 18:30

┌──────────────┬──────────────┐
│ FOND INITIAL │  ENCAISSÉ    │
│ 50 000 F     │  125 000 F   │
└──────────────┴──────────────┘

TOTAL THÉORIQUE : 175 000 F
Transactions : 12
```

### Option B - Mode Sécurité 🔒

#### Pourquoi ?
Le pharmacien ne veut pas que la caissière connaisse le montant total.

#### Comment activer ?
```
Avant de fermer :
☑ 🔒 Masquer montants  ← COCHER
```

#### Rapport masqué :
```
🔒 MODE SÉCURITÉ

Les montants sont masqués.
Consultez le pharmacien.

     *** *** F

✓ Caisse fermée
```

#### Ce qui reste visible :
- ✅ Nombre de transactions
- ✅ Date/heure
- ✅ Confirmation fermeture

---

## 🎓 Module 4 : Dépannage

### ❌ "Impossible de vendre sans session active"
**Cause** : La caisse n'est pas ouverte.  
**Solution** : Ouvrir la caisse avant de vendre.

### ❌ "Poste déjà ouvert"
**Cause** : Quelqu'un d'autre a ouvert cette caisse.  
**Solution** : Choisir un autre poste ou fermer l'autre session.

### ❌ Session bloquée après crash
**Cause** : Le PC s'est éteint brutalement.  
**Solution** : Ouvrir sur un nouveau poste → ancienne session fermée auto.

---

## 📞 Support

En cas de problème :
1. Vérifier que la caisse est ouverte
2. Rafraîchir la page (F5)
3. Contacter le support technique

---

## ✅ Checklist Quotidienne Caissière

- [ ] Ouvrir ma caisse en début de journée
- [ ] Vérifier le fond de caisse
- [ ] Encaisser les ventes
- [ ] Fermer ma caisse en fin de journée
- [ ] Vérifier le rapport (si mode normal)

---

**Version** : 1.0  
**Date** : Juin 2026
