# Guide d'installation des postes clients — Zenith Pharma

## Accès au serveur via Tailscale

Ce guide explique comment configurer un poste client (PC, tablette, téléphone) pour accéder au serveur Zenith Pharma via l'adresse **`http://zenith-pharma`** (ou `https://zenith-pharma` depuis l'extérieur).

---

## Prérequis : Configuration du serveur (à faire une seule fois)

Sur le serveur Ubuntu, le conteneur Tailscale est déjà configuré. Vérifiez qu'il est bien connecté :

```bash
# Vérifier le statut Tailscale
docker exec zenith-pharma-tailscale tailscale status

# Si "Logged out", se connecter avec :
docker exec zenith-pharma-tailscale tailscale up --hostname=zenith-pharma
```

Suivez le lien affiché pour autoriser le serveur dans votre compte Tailscale (https://login.tailscale.com).

---

## Étape 1 : Créer un compte Tailscale (gratuit)

1. Rendez-vous sur **https://login.tailscale.com**
2. Créez un compte (Google, Microsoft, GitHub, ou email)
3. C'est **gratuit** jusqu'à 100 appareils (largement suffisant)

> **Important** : Utilisez le **même compte** pour le serveur et tous les postes clients d'une même pharmacie.

---

## Étape 2 : Installer Tailscale sur le poste client

### Windows (PC de caisse)

1. Téléchargez Tailscale : **https://tailscale.com/download/windows**
2. Exécutez l'installateur (`tailscale-setup.exe`)
3. Une icône Tailscale apparaît dans la zone de notification (bas à droite)
4. Cliquez sur l'icône → **Log in**
5. Connectez-vous avec le **même compte** que le serveur
6. L'appareil apparaît automatiquement dans votre réseau Tailscale

### Android (téléphone/tablette)

1. Installez **Tailscale** depuis le Play Store
2. Ouvrez l'app → **Sign in**
3. Connectez-vous avec le **même compte** que le serveur

### iOS (iPhone/iPad)

1. Installez **Tailscale** depuis l'App Store
2. Ouvrez l'app → **Sign in**
3. Connectez-vous avec le **même compte** que le serveur

### Linux (Ubuntu)

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

---

## Étape 3 : Accéder à Zenith Pharma

Une fois Tailscale connecté sur le poste client, ouvrez simplement le navigateur :

| Accès | Adresse |
|---|---|
| **Réseau local (LAN)** | `http://zenith-pharma` ou `http://zenith-pharma.local` |
| **Extérieur (4G, autre Wi-Fi)** | `https://zenith-pharma` (via Tailscale Funnel) |

### Ajouter un raccourci sur le bureau (Windows)

1. Clic droit sur le bureau → **Nouveau** → **Raccourci**
2. Emplacement : `http://zenith-pharma`
3. Nom : `Zenith Pharma`
4. Cliquez sur **Terminer**

---

## Étape 4 : Vérifier que ça fonctionne

1. Ouvrez le navigateur
2. Allez sur `http://zenith-pharma`
3. La page de connexion de Zenith Pharma doit s'afficher
4. Connectez-vous avec vos identifiants habituels

---

## FAQ

### Le nom `zenith-pharma` ne fonctionne pas

1. Vérifiez que Tailscale est bien connecté (icône verte dans la zone de notification)
2. Essayez `http://zenith-pharma.local` ou l'IP Tailscale (visible dans l'app Tailscale)
3. Sur le serveur, vérifiez : `docker exec zenith-pharma-tailscale tailscale status`

### Plusieurs pharmacies avec le même nom

Chaque pharmacie a son **propre compte Tailscale** (tailnet privé). Le nom `zenith-pharma` ne se résout que dans votre réseau — **aucun conflit possible** entre pharmacies.

### Le pharmacien veut accéder depuis son téléphone en déplacement

1. Installer Tailscale sur le téléphone
2. Se connecter au **même compte** que le serveur de sa pharmacie
3. Accéder à `https://zenith-pharma` — fonctionne en 4G, Wi-Fi public, etc.

### Combien d'appareils peut-on connecter ?

**100 appareils gratuits** par compte Tailscale. Suffisant pour plusieurs pharmacies avec leurs postes et téléphones.

### Est-ce sécurisé ?

Oui — Tailscale chiffre tout le trafic de bout en bout (WireGuard). Aucun port n'est ouvert sur internet. Seuls les appareils de votre compte peuvent accéder au serveur.

---

## Résumé visuel

```
┌─────────────────────────────────────────────┐
│              Compte Tailscale                │
│              (pharmacie X)                   │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Serveur  │  │ Poste    │  │ Téléphone│  │
│  │ Ubuntu   │←→│ caisse 1 │  │ pharmacien│  │
│  │zenith-   │←→│          │  │          │  │
│  │pharma    │←→│ Poste    │  │ Tablette │  │
│  │          │  │ caisse 2 │  │          │  │
│  └──────────┘  └──────────┘  └──────────┘  │
│                                              │
│  → Tous accèdent à http://zenith-pharma     │
│  → Réseau privé, chiffré, isolé             │
└─────────────────────────────────────────────┘
```
