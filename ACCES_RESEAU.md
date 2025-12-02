# 📱 Guide d'Accès Multi-Appareils - PharmaStock

## ✅ Configuration Terminée !

Votre application est maintenant accessible depuis **n'importe quel appareil** sur votre réseau local.

---

## 🌐 Adresses d'Accès

### Depuis votre PC actuel :
- **Frontend :** http://localhost:3000
- **Backend API :** http://localhost:8000

### Depuis Mobile/Tablette/Autre PC (même réseau WiFi) :
- **Frontend :** http://192.168.1.192:3000
- **Backend API :** http://192.168.1.192:8000

---

## 🚀 Démarrage des Serveurs

### 1. Backend Django
```bash
cd c:\Projet Fullstack\fullstack_produits\backend
python manage.py runserver 0.0.0.0:8000
```

### 2. Frontend Vite
```bash
cd c:\Projet Fullstack\fullstack_produits\frontend\frontend
npm run dev
```

---

## 📋 Checklist de Connexion

Avant de vous connecter depuis un autre appareil, vérifiez :

- [ ] **Même réseau WiFi** - Les deux appareils doivent être sur le même réseau
- [ ] **Serveurs démarrés** - Backend (port 8000) et Frontend (port 3000) doivent tourner
- [ ] **Pare-feu** - Windows Firewall peut bloquer les connexions (voir ci-dessous)

---

## 🔥 Configuration du Pare-feu Windows

Si vous ne pouvez pas accéder depuis un autre appareil :

### Option 1 : Autoriser les ports (Recommandé)
```powershell
# Ouvrir PowerShell en Administrateur
New-NetFirewallRule -DisplayName "Vite Dev Server" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Django Dev Server" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
```

### Option 2 : Désactiver temporairement le pare-feu (Non recommandé)
Panneau de configuration → Pare-feu Windows → Désactiver

---

## 📱 Test depuis Mobile

1. **Connectez votre mobile au même WiFi** que votre PC
2. **Ouvrez le navigateur** (Chrome, Safari, etc.)
3. **Accédez à :** `http://192.168.1.192:3000`
4. **Connectez-vous** avec vos identifiants

---

## 🎯 Interface Responsive

L'application s'adapte automatiquement :
- **Mobile** : Menu hamburger (☰) en haut à gauche
- **Tablette** : Layout adapté
- **Desktop** : Interface complète

---

## ⚠️ Important

### En Production
Les configurations actuelles sont pour le **développement uniquement** :
- `ALLOWED_HOSTS = ['*']` - À restreindre en production
- `CORS_ALLOW_ALL_ORIGINS = True` - À désactiver en production
- `host: '0.0.0.0'` - OK pour production avec reverse proxy

### Sécurité
- Ne partagez pas votre adresse IP publique
- Ces configurations ne fonctionnent que sur votre réseau local
- En production, utilisez HTTPS et des configurations sécurisées

---

## 🔧 Dépannage

### Problème : "ERR_CONNECTION_REFUSED"
**Solution :** Vérifiez que les serveurs sont bien démarrés

### Problème : "ERR_CONNECTION_TIMED_OUT"
**Solution :** Vérifiez le pare-feu Windows

### Problème : "CORS Error"
**Solution :** Les serveurs doivent être redémarrés après modification de settings.py

### Problème : Page blanche
**Solution :** Vérifiez la console du navigateur (F12)

---

## 📞 Support

Si vous rencontrez des problèmes :
1. Vérifiez que les deux appareils sont sur le **même réseau**
2. Testez d'abord depuis votre PC : http://localhost:3000
3. Vérifiez les logs des serveurs pour les erreurs
4. Assurez-vous que le pare-feu autorise les ports 3000 et 8000

---

## 🎉 Profitez de votre Application !

Vous pouvez maintenant :
- ✅ Consulter les ventes depuis votre mobile
- ✅ Faire des factures depuis une tablette
- ✅ Gérer le stock depuis n'importe quel appareil
- ✅ Travailler en mobilité dans votre pharmacie
