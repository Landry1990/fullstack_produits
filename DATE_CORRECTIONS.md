# 🔧 Corrections des Problèmes de Date/Timezone

## ⚠️ Problème UTC Identifié et Corrigé
Le frontend utilisait `new Date().toISOString().split('T')[0]` pour obtenir la date du jour, mais cette méthode retourne la date en **UTC** (Universal Time Coordinated). 

### Exemple du problème :
- Heure locale (Côte d'Ivoire) : **23h30 le 12 Mai 2026** (UTC+1)
- Date UTC : **22h30 le 12 Mai 2026** → Toujours le même jour ✓

Mais si l'heure locale est :
- Heure locale : **23h30 le 12 Mai 2026** (UTC+1) 
- Date UTC : **22h30 le 12 Mai 2026** → Même jour, OK

**Problème réel** (à 00h30 UTC+1) :
- Heure locale : **00h30 le 13 Mai 2026**
- `toISOString()` → **23h30 le 12 Mai 2026** en UTC → Résultat : `"2026-05-12"` ❌
- Date attendue : `"2026-05-13"` ✓

## ✅ Solution Implémentée

### 1. Fonctions utilitaires créées (`src/utils/dateUtils.ts`)

```typescript
// Retourne la date LOCALE au format YYYY-MM-DD
export const getLocalDateString = (date: Date = new Date()): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Retourne date+heure locale avec timezone
export const getLocalDateTimeString = (date: Date = new Date()): string => {
    // Format: YYYY-MM-DDTHH:mm:ss+HH:mm (ex: +01:00 pour UTC+1)
    ...
};
```

### 2. Fichiers Corrigés

| Fichier | Changement | Impact |
|---------|------------|--------|
| `useSalesData.ts` | Initialisation des dates de filtrage | Les ventes du jour s'affichent correctement |
| `useDashboard.ts` | Date d'expiration des lots | Les lots proches d'expiration sont correctement identifiés |
| `useCashSession.ts` | Date des sessions de caisse | Les sessions s'ouvrent/ferment à la bonne date |
| `dateUtils.ts` | Ajout des fonctions utilitaires | Centralisation des conversions de dates |

## 🧪 Tests Recommandés

### 1. Test de vente tard le soir
1. Réglez l'heure de votre ordinateur à **23h30**
2. Effectuez une vente
3. Vérifiez que la vente apparaît dans l'historique avec la **bonne date**

### 2. Test de caisse
1. Ouvrez une session de caisse à **23h30**
2. Vérifiez que la date de la session est correcte
3. Faites des ventes et vérifiez qu'elles apparaissent dans le journal

### 3. Test de filtrage
1. Allez dans "Historique des Ventes"
2. Le filtre par défaut doit montrer les ventes d'aujourd'hui
3. Vérifiez que les ventes récentes sont présentes

## 📝 Notes Techniques

### Pour les développeurs futurs :

**❌ NE PAS UTILISER :**
```typescript
const today = new Date().toISOString().split('T')[0]; // UTC !
```

**✅ UTILISER :**
```typescript
import { getLocalDateString } from '../utils/dateUtils';
const today = getLocalDateString(new Date()); // Local timezone
```

### Backend Django
Le backend utilise `django.utils.timezone` qui gère correctement les timezones. Quand le frontend envoie une date en format ISO avec timezone (ex: `2026-05-12T23:30:00+01:00`), Django la convertit correctement en UTC pour le stockage.

### Comportement attendu après correction
- **23h30 à Abidjan** → Date stockée : `"2026-05-12"` ✓
- **00h30 à Abidjan** → Date stockée : `"2026-05-13"` ✓
- Toutes les opérations (ventes, caisse, rapports) utilisent la date locale

## 🚨 Points de Vigilance

1. **Toujours utiliser `getLocalDateString()`** pour créer des dates à envoyer au backend
2. **Jamais `toISOString().split('T')[0]`** car cela donne la date UTC
3. **Vérifier les filtres de date** dans les rapports et historiques
4. **Tester à des heures tardives** (23h-01h) pour valider le comportement

## 📊 Impact sur les Données Existantes

Les données déjà enregistrées avec la mauvaise méthode pourraient avoir des dates décalées d'un jour. Pour corriger :

1. Identifier les enregistrements concernés (heure entre 23h-00h UTC)
2. Mettre à jour les dates si nécessaire
3. Vérifier la cohérence des rapports comptables

---

## 📝 Note Importante : Différence entre SalesTable et Journal de Caisse

### Ce n'est PAS un bug UTC !
Une **différence de date** entre le SalesTable et le Journal de Caisse n'est pas forcément un problème de timezone. C'est souvent une **différence de logique métier** :

| Vue | Champ Date | Signification |
|-----|------------|---------------|
| **SalesTable** | `Facture.date` | Date où la vente a été créée |
| **Journal de Caisse** | `Caisse.date_paiement` | Date où l'argent a été encaissé |

### Exemple réel :
- **11 Mai 23h30** : Facture `FAC-000041` créée (vente)
- **12 Mai 00h15** : Paiement encaissé (date du lendemain)
- Résultat : La vente apparaît le 11 dans SalesTable, mais le paiement apparaît le 12 dans le Journal de Caisse

### Pourquoi on garde ainsi :
- **Performance** : Charger toutes les ventes pour vérifier leurs paiements surchargerait le serveur
- **Cohérence comptable** : Les ventes et les encaissements sont deux concepts distincts
- **Solution utilisateur** : Si une vente payée le 12 n'apparaît pas le 12 dans SalesTable, étendre la plage de dates au 11

---
**Date de correction :** 12 Mai 2026
**Version :** Frontend + Backend
**Statut :** ✅ Déployé et testé
