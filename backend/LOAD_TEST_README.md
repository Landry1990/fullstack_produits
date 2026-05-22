# 🧪 Guide de Test de Charge Multi-Caisses

Ce dossier contient des scripts pour tester les limites du serveur avec envois simultanés depuis plusieurs postes de caisse.

---

## 📋 Prérequis

### Option 1: Avec aiohttp (asynchrone, recommandé)
```bash
pip install aiohttp
```

### Option 2: Avec requests (synchrone, plus simple)
```bash
pip install requests
```

---

## 🚀 Utilisation

### Test de base (15 clients, 60 secondes)
```bash
python load_test.py
```

### Test intensif (30 clients, 2 minutes)
```bash
python load_test.py --clients 30 --duration 120
```

### Test avec ramp-up progressif
```bash
python load_test.py --clients 20 --duration 90 --ramp-up 20
```

### Test sur serveur distant
```bash
python load_test.py --url http://192.168.1.100:8000/api --clients 15
```

---

## 📊 Comprendre les Résultats

### Métriques clés :

| Métrique | Bon | À surveiller | Critique |
|----------|-----|--------------|----------|
| **Taux de succès** | >99% | 95-99% | <95% |
| **Requêtes/sec** | >50 | 20-50 | <20 |
| **Temps moyen** | <500ms | 500ms-1s | >1s |
| **Temps P95** | <1s | 1-2s | >2s |

### Scénarios de test recommandés :

1. **Test standard** : 15 clients, 60s (simulation réelle)
2. **Test pic** : 30 clients, 30s (Black Friday)
3. **Test endurance** : 10 clients, 300s (stabilité)
4. **Test ramp-up** : 50 clients progressifs (découverte limite)

---

## 🔧 Dépannage

### Erreur "Connection refused"
- Vérifie que le serveur backend tourne
- Vérifie l'URL et le port

### Erreur "Module not found"
```bash
pip install aiohttp aiofiles
```

### Timeouts fréquents
- Augmente `--ramp-up` pour étaler les connexions
- Vérifie les logs Docker pour les erreurs

---

## 📈 Interprétation

### 🟢 Résultat excellent
```
Requêtes/sec: 85.42
Temps moyen: 234.56ms
Taux de succès: 99.8%
```
→ Le serveur gère la charge sans problème

### 🟡 Résultat acceptable
```
Requêtes/sec: 35.21
Temps moyen: 890.12ms
Taux de succès: 97.3%
```
→ Ralentissements mais fonctionnel

### 🔴 Résultat critique
```
Requêtes/sec: 8.45
Temps moyen: 3456.78ms
Taux de succès: 73.2%
```
→ Problèmes majeurs à résoudre avant déploiement

---

## 🎯 Objectifs pour Déploiement Client

Pour **12-15 postes de caisse simultanés** :

- **Minimum acceptable** : 50 requêtes/sec, 95% succès
- **Objectif** : 80 requêtes/sec, <500ms moyenne
- **Excellence** : 100+ requêtes/sec, <300ms moyenne

---

## 🐳 Test avec Docker

Si tu veux tester dans l'environnement Docker :

```bash
# Entrer dans le container backend
docker exec -it fullstack_produits-backend-1 /bin/bash

# Installer les dépendances
pip install aiohttp

# Lancer le test
python load_test.py --url http://localhost:8000/api --clients 15
```

---

## 📝 Ressources Monitoring

Pendant le test, surveille dans un autre terminal :

```bash
# Stats Docker
docker stats

# Logs backend en temps réel
docker logs -f fullstack_produits-backend-1

# Connexions DB (si psql disponible)
docker exec -it fullstack_produits-db-1 psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"
```

---

**Bon test ! 🚀**
