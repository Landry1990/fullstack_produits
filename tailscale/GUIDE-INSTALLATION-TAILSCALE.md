# Guide d'installation Tailscale Funnel chez un client

Ce guide décrit chaque étape pour rendre l'application accessible depuis internet
via Tailscale Funnel, sans ouvrir de ports sur le pare-feu du client.

---

## Phase 1 — Préparation (depuis ton PC, avant d'aller chez le client)

### 1.1 Se connecter au dashboard Tailscale

Aller sur https://login.tailscale.com/admin

> Si tu n'as pas encore de compte, en créer un (gratuit, jusqu'à 100 devices).

---

### 1.2 Générer une auth key

Aller sur **Settings → Keys → Generate auth key**.

```
Settings à cocher :
  ✅ Reusable        → la clé peut servir pour plusieurs clients
  ❌ Ephemeral       → décocher (le nœud doit persister chez le client)
  Expiration : 90 jours (ou 180)
```

Copier la clé générée : `tskey-auth-xxxxxxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

> La clé réutilisable permet d'installer plusieurs clients avec la même clé.
> Une fois expirée, les clients déjà installés ne sont pas affectés — il faudra
> juste en générer une nouvelle pour les NOUVEAUX clients.

---

### 1.3 Activer HTTPS Certificates

Aller sur **DNS → HTTPS Certificates** → cliquer **Enable**.

> Permet à Tailscale d'émettre automatiquement des certificats HTTPS
> pour les nœuds du tailnet (via ACME/Let's Encrypt).

---

### 1.4 Activer Funnel dans les Access Controls

Aller sur **Access Controls** (éditeur JSON).

Ajouter le bloc `nodeAttrs` dans le fichier ACL :

```json
"nodeAttrs": [
  {
    "target": ["*"],
    "attr":   ["funnel"]
  }
]
```

> `"target": ["*"]` = autorise tous les nœuds du tailnet à utiliser Funnel.
> `"attr": ["funnel"]` = active la fonctionnalité Funnel (accès depuis internet).
> Cliquer **Save**.

---

### 1.5 Noter le nom du tailnet

Le nom du tailnet est visible en haut du dashboard : `taila455c9.ts.net`

> L'URL finale du client sera : `https://<hostname>.taila455c9.ts.net`

---

## Phase 2 — Configuration du serveur client (sur place ou en SSH)

### 2.1 Se connecter au serveur

```bash
ssh landry@<ip-du-serveur>
```

> Remplacer `<ip-du-serveur>` par l'IP du serveur du client.

---

### 2.2 Activer le forwarding IP

```bash
# Ajoute le forwarding IPv4 (requis par Tailscale pour le routage)
echo 'net.ipv4.ip_forward = 1' | sudo tee -a /etc/sysctl.conf

# Applique la configuration immédiatement (sans redémarrage)
sudo sysctl -p
```

> Le forwarding IP permet au conteneur Tailscale de router le trafic
> entre internet et le conteneur frontend.

---

### 2.3 Charger le module TUN

```bash
# Charge le module kernel TUN (interface réseau virtuelle pour WireGuard)
sudo modprobe tun
```

> TUN est requis par Tailscale pour créer l'interface réseau virtuelle.
> Si la commande ne retourne rien, c'est normal — le module est chargé en silence.

---

### 2.4 Rendre le module TUN persistant (au redémarrage)

```bash
# Ajoute "tun" à /etc/modules pour qu'il se charge automatiquement au boot
echo 'tun' | sudo tee -a /etc/modules
```

> Sans cette étape, après un redémarrage du serveur, Tailscale ne pourra
> pas démarrer car le module TUN ne sera plus chargé.

---

### 2.5 Aller dans le dossier du projet

```bash
cd /opt/zenith-pharma
```

> C'est le dossier où se trouvent `docker-compose.prod.yml` et `.env`.
> Docker Compose cherche le `.env` dans le dossier courant.

---

### 2.6 Vérifier que le `.env` existe

```bash
ls -la .env
```

> Doit afficher : `-rw-rw-r-- ... .env`
> Si le fichier n'existe pas, le copier depuis `.env.example` :
> `cp .env.example .env`

---

### 2.7 Ajouter les variables Tailscale dans le `.env`

```bash
# Ajoute la clé d'authentification Tailscale à la fin du .env
# Remplacer tskey-auth-xxx par ta clé réelle
echo 'TAILSCALE_AUTHKEY=tskey-auth-xxxxxxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' >> .env

# Ajoute le hostname (nom du nœud sur le tailnet)
# Changer "pharmacie-test" par le nom du client (ex: pharmacie-douala)
echo 'TAILSCALE_HOSTNAME=pharmacie-test' >> .env
```

> Le hostname détermine l'URL d'accès : `https://pharmacie-test.taila455c9.ts.net`
> Chaque client doit avoir un hostname unique.

---

### 2.8 Vérifier que les variables sont bien dans le `.env`

```bash
# Affiche les lignes TAILSCALE du .env (doit être sans # devant)
grep TAILSCALE .env
```

> Doit afficher :
> ```
> TAILSCALE_AUTHKEY=tskey-auth-xxxxxxxx...
> TAILSCALE_HOSTNAME=pharmacie-test
> ```
> Si tu vois `#TAILSCALE_AUTHKEY=...`, retirer le `#` :
> `sed -i 's/^#TAILSCALE_AUTHKEY=/TAILSCALE_AUTHKEY=/' .env`

---

### 2.9 Vérifier que Docker Compose lit bien les variables

```bash
# Affiche la configuration résolue par Docker Compose
# TS_AUTHKEY doit contenir ta clé (pas vide)
docker compose -f docker-compose.prod.yml config | grep TS_AUTHKEY
```

> Doit afficher : `TS_AUTHKEY: tskey-auth-xxxxxxxx...`
> Si tu vois `TS_AUTHKEY: ""`, le `.env` n'est pas chargé — voir section dépannage.

---

### 2.10 Démarrer le conteneur Tailscale

```bash
# Démarre uniquement le service tailscale (les autres services tournent déjà)
docker compose -f docker-compose.prod.yml up -d tailscale
```

> Le conteneur va :
> 1. Démarrer tailscaled (le daemon Tailscale)
> 2. S'authentifier avec la clé d'auth
> 3. Demander un certificat HTTPS via ACME
> 4. Configurer le proxy vers `frontend:80`

---

### 2.11 Vérifier les logs (authentification + certificat)

```bash
# Suit les logs en temps réel (Ctrl+C pour quitter)
docker compose -f docker-compose.prod.yml logs -f tailscale
```

> Lignes importantes à vérifier :
> - `active login: ton@email.com` → authentification réussie
> - `Switching ipn state Starting -> Running` → connecté au tailnet
> - `cert("pharmacie-test.taila455c9.ts.net"): got cert` → certificat HTTPS obtenu
> - `listening on 100.x.x.x:443` → Funnel actif
>
> Si tu vois `To authenticate, visit: https://login.tailscale.com/a/...`
> → la clé d'auth n'est pas utilisée (TS_AUTHKEY est vide, voir étape 2.9)

---

### 2.12 Vérifier le statut Tailscale

```bash
# Affiche le statut du nœud (IP tailnet, peers connectés)
docker compose -f docker-compose.prod.yml exec tailscale tailscale status
```

> Doit afficher quelque chose comme :
> ```
> 100.123.231.111 pharmacie-test  linux   active; ...
> ```

---

### 2.13 Vérifier que le Funnel est actif

```bash
# Affiche le statut du Funnel (proxy HTTPS)
docker compose -f docker-compose.prod.yml exec tailscale tailscale funnel status
```

> Doit afficher :
> ```
> https://pharmacie-test.taila455c9.ts.net (Funnel on)
> |-- / proxy http://frontend:80
> ```

---

## Phase 3 — Test d'accès

### 3.1 Tester depuis un navigateur

Ouvrir sur n'importe quel appareil (PC, téléphone, tablette) :

```
https://pharmacie-test.taila455c9.ts.net
```

> L'application doit s'afficher avec un cadenas HTTPS (certificat valide).
> Aucune installation de client Tailscale n'est nécessaire sur l'appareil
> qui consulte — Funnel expose l'application sur internet public.

---

### 3.2 Tester depuis un autre réseau (4G, autre WiFi)

```
# Désactiver le WiFi du téléphone et tester en 4G
# Ouvrir : https://pharmacie-test.taila455c9.ts.net
```

> Si ça marche en 4G, c'est que Funnel fonctionne depuis internet.
> Si ça ne marche qu'en local, le Funnel n'est pas bien activé (voir dépannage).

---

## Phase 4 — Rendre Tailscale persistant au redémarrage

### 4.1 Vérifier que le conteneur redémarre automatiquement

```bash
# Vérifier la politique de restart
docker inspect zenith-pharma-tailscale | grep RestartPolicy
```

> Doit afficher `"Name": "always"` — le conteneur redémarre automatiquement
> après un reboot du serveur. C'est déjà configuré dans `docker-compose.prod.yml`.

---

### 4.2 Vérifier que le module TUN se charge au boot

```bash
# Vérifier que "tun" est bien dans /etc/modules
cat /etc/modules | grep tun
```

> Si rien ne s'affiche, l'ajouter (voir étape 2.4).
> Sans TUN au boot, Tailscale ne pourra pas démarrer après un redémarrage.

---

## Résumé — Checklist pour chaque nouveau client

```
□ 1. Générer/réutiliser une auth key Tailscale (réutilisable)
□ 2. Choisir un hostname unique (ex: pharmacie-douala)
□ 3. Sur le serveur : activer ip_forward + modprobe tun + /etc/modules
□ 4. Ajouter TAILSCALE_AUTHKEY + TAILSCALE_HOSTNAME dans .env (sans #)
□ 5. Vérifier : grep TAILSCALE .env (pas de # devant)
□ 6. Vérifier : docker compose config | grep TS_AUTHKEY (pas vide)
□ 7. Démarrer : docker compose up -d tailscale
□ 8. Vérifier logs : "active login" + "got cert" + "listening on :443"
□ 9. Tester : https://<hostname>.taila455c9.ts.net
□ 10. Tester en 4G (depuis un autre réseau)
□ 11. Vérifier : /etc/modules contient "tun"
```

---

## Dépannage

### `WARN: The "TAILSCALE_AUTHKEY" variable is not set`

| Cause | Solution |
|-------|----------|
| Ligne commentée dans `.env` | `sed -i 's/^#TAILSCALE_AUTHKEY=/TAILSCALE_AUTHKEY=/' .env` |
| Pas dans le bon dossier | `cd /opt/zenith-pharma` avant la commande |
| Caractères Windows (CRLF) | `sed -i 's/\r$//' .env` |
| `.env` ailleurs | `docker compose --env-file .env -f docker-compose.prod.yml up -d tailscale` |

### Tailscale demande une URL d'authentification

→ `TS_AUTHKEY` arrive vide dans le conteneur.
→ Vérifier : `docker compose -f docker-compose.prod.yml config | grep TS_AUTHKEY`
→ Si vide, voir la section ci-dessus.

### `Erreur /dev/net/tun: no such file or directory`

```bash
sudo modprobe tun
```

> Si ça ne marche pas, le kernel du serveur ne supporte pas TUN.
> Solution alternative : mettre `TS_USERSPACE=true` dans `.env` (mode userspace,
> moins performant mais ne nécessite pas TUN).

### Funnel non accessible depuis internet

1. Vérifier que Funnel est activé dans les ACL (étape 1.4)
2. Vérifier que HTTPS Certificates est activé (étape 1.3)
3. Vérifier : `docker compose exec tailscale tailscale funnel status`
4. Tester en 4G (pas depuis le même réseau que le serveur)

### Le certificat HTTPS n'est pas obtenu

→ Vérifier que HTTPS Certificates est activé sur le dashboard Tailscale
→ Vérifier que le hostname ne contient pas d'espaces ni caractères spéciaux
→ Attendre 1-2 minutes (le premier certificat peut prendre du temps)

### Le conteneur redémarre en boucle

```bash
# Voir les logs pour identifier la cause
docker compose -f docker-compose.prod.yml logs tailscale
```

Causes fréquentes :
- Auth key expirée ou invalide → en générer une nouvelle
- Module TUN non chargé → `sudo modprobe tun`
- `/dev/net/tun` non accessible → vérifier les permissions
