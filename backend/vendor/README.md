# Binaires vendorisés pour le build Docker (optionnel)

Sur un serveur à connexion instable, déposer ici les binaires que le
Dockerfile télécharge normalement depuis Internet. S'ils sont présents,
le build les utilise en local **sans re-télécharger** ; sinon il retombe
sur `curl` (HTTP/1.1 + retries).

| Fichier attendu            | Source                                                            |
|----------------------------|-------------------------------------------------------------------|
| `docker-27.0.3.tgz`        | https://download.docker.com/linux/static/stable/x86_64/docker-27.0.3.tgz |
| `docker-compose`           | https://github.com/docker/compose/releases/download/v2.29.2/docker-compose-linux-x86_64 |

Téléchargement résilient sur le serveur (reprend en cas de coupure) :

```bash
cd /opt/zenith-pharma/backend/vendor
curl -fL --http1.1 -C - --retry 20 --retry-all-errors --retry-delay 5 \
  -o docker-compose \
  https://github.com/docker/compose/releases/download/v2.29.2/docker-compose-linux-x86_64
```

Les binaires sont ignorés par git (voir `.gitignore`) — ne pas les commiter.
