# Tailscale Funnel — Spécifications du conteneur

## Présentation

Le conteneur `tailscale` expose l'application **fullstack-produits** publiquement via **Tailscale Funnel** (HTTPS), sans avoir besoin d'ouvrir de ports sur le pare-feu ni de configurer un reverse proxy externe.

---

## Architecture

```
Internet (HTTPS)
      │
      ▼
https://<hostname>.ts.net:443
      │
   Tailscale Funnel (conteneur Docker)
      │  (proxy interne)
      ▼
http://frontend:80  (conteneur Docker interne)
```

---

## Fichiers

| Fichier | Rôle |
|---|---|
| `docker-compose.prod.yml` → service `tailscale` | Définition du conteneur |
| `tailscale/tailscale-serve.json` | Configuration du Funnel (ports, proxy, handlers) |
| `.env` | Variables d'environnement sensibles (auth key, hostname) |

---

## Configuration du conteneur (`docker-compose.prod.yml`)

```yaml
tailscale:
  image: tailscale/tailscale:latest
  hostname: ${TAILSCALE_HOSTNAME:-fullstack-app}
  environment:
    - TS_AUTHKEY=${TAILSCALE_AUTHKEY}          # Clé d'authentification Tailscale
    - TS_STATE_DIR=/var/lib/tailscale           # Répertoire d'état persistant
    - TS_SERVE_CONFIG=/config/tailscale-serve.json  # Config Funnel
    - TS_USERSPACE=false                        # Mode kernel (plus performant)
  volumes:
    - tailscale_data:/var/lib/tailscale         # Persistance de l'état (évite ré-auth)
    - ./tailscale:/config                       # Montage du fichier serve config
    - /dev/net/tun:/dev/net/tun                 # Interface TUN (réseau virtuel)
  cap_add:
    - NET_ADMIN    # Requis pour gérer les interfaces réseau
    - SYS_MODULE   # Requis pour charger les modules noyau (WireGuard)
  depends_on:
    - frontend
  restart: always
  networks:
    - app-network
```

---

## Configuration Funnel (`tailscale-serve.json`)

```json
{
  "TCP": {
    "443": { "HTTPS": true }        // Écoute HTTPS sur le port 443
  },
  "Web": {
    "${TS_CERT_DOMAIN}:443": {
      "Handlers": {
        "/": {
          "Proxy": "http://frontend:80"  // Proxy vers le conteneur frontend
        }
      }
    }
  },
  "AllowFunnel": {
    "${TS_CERT_DOMAIN}:443": true    // Autorise l'accès depuis Internet (pas seulement le tailnet)
  }
}
```

> `${TS_CERT_DOMAIN}` est automatiquement résolu par Tailscale au démarrage du conteneur avec le FQDN du nœud (ex: `fullstack-app.votre-tailnet.ts.net`).

---

## Variables d'environnement (`.env`)

| Variable | Obligatoire | Description | Exemple |
|---|---|---|---|
| `TAILSCALE_AUTHKEY` | ✅ Oui | Auth key générée sur le dashboard Tailscale | `tskey-auth-xxxxx` |
| `TAILSCALE_HOSTNAME` | Non | Nom du nœud sur le tailnet (défaut: `fullstack-app`) | `ma-pharmacie` |

---

## Prérequis

### 1. Compte Tailscale
Créer un compte gratuit sur [tailscale.com](https://tailscale.com).

### 2. Générer une Auth Key
1. Aller sur [login.tailscale.com/admin/settings/keys](https://login.tailscale.com/admin/settings/keys)
2. Cliquer **Generate auth key**
3. Cocher :
   - ✅ **Reusable** (pour permettre les redémarrages)
   - ✅ **Ephemeral** (le nœud disparaît si le conteneur s'arrête) — ou décocher pour persistance
4. Copier la clé générée → l'ajouter dans `.env`

### 3. Activer Tailscale Funnel
1. Console Tailscale → **DNS** → section **HTTPS Certificates** → activer
2. Console Tailscale → **Access controls** → vérifier que Funnel est autorisé pour votre tailnet

### 4. Prérequis système (Linux uniquement)
```bash
# Activer le forwarding IP
echo 'net.ipv4.ip_forward = 1' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

---

## Démarrage

### Démarrer uniquement le conteneur Tailscale
```bash
docker compose -f docker-compose.prod.yml up -d tailscale
```

### Voir les logs (vérifier l'authentification)
```bash
docker compose -f docker-compose.prod.yml logs -f tailscale
```

### Vérifier le statut Tailscale depuis le conteneur
```bash
docker compose -f docker-compose.prod.yml exec tailscale tailscale status
```

### Vérifier que Funnel est actif
```bash
docker compose -f docker-compose.prod.yml exec tailscale tailscale funnel status
```

---

## URL d'accès

Une fois démarré, l'application est accessible sur :

```
https://<TAILSCALE_HOSTNAME>.<votre-tailnet>.ts.net
```

Exemple avec `TAILSCALE_HOSTNAME=fullstack-app` et tailnet `ma-pharmacie` :
```
https://fullstack-app.ma-pharmacie.ts.net
```

---

## Comparaison avec ngrok

| Critère | Tailscale Funnel | ngrok |
|---|---|---|
| URL stable | ✅ Toujours la même | ❌ Change à chaque redémarrage (plan gratuit) |
| Coût | ✅ Gratuit | ⚠️ Limité (plan gratuit) |
| Authentification | Auth key | Auth token |
| Protocole | WireGuard (VPN mesh) | Tunnel HTTP(S) |
| Accès VPN privé | ✅ Oui (tailnet) | ❌ Non |
| Fonnel public | ✅ Oui | ✅ Oui |

---

## Dépannage

### Le conteneur démarre mais ne s'authentifie pas
→ Vérifier que `TAILSCALE_AUTHKEY` est bien défini dans `.env`
→ La clé auth est peut-être expirée → en regénérer une

### Erreur `/dev/net/tun: no such file or directory`
→ Linux : vérifier que le module TUN est chargé : `sudo modprobe tun`
→ Windows/Docker Desktop : ce device n'existe pas, utiliser `TS_USERSPACE=true` dans `.env`

### Funnel non accessible depuis Internet
→ Vérifier que Funnel est activé sur le tailnet (console Tailscale → DNS)
→ Vérifier les ACL Tailscale

### `TS_USERSPACE=false` ne fonctionne pas sur Windows
Ajouter dans `.env` :
```
TS_USERSPACE=true
```
Et retirer le volume `/dev/net/tun` du `docker-compose.prod.yml` (ou le laisser, il sera ignoré).
