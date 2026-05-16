# Guide d'Installation Zenith Pharma — 3 Étapes

> Installation d'une pharmacie sur **Ubuntu Desktop** en une seule commande.

---

## 1. Prérequis

- PC/Mini-PC avec **Ubuntu 22.04+ Desktop**
- **8 Go RAM minimum** (16 Go recommandé)
- **128 Go SSD minimum**
- Connexion Internet stable

---

## 2. Installer Zenith Pharma (UNE SEULE COMMANDE)

Ouvrir un terminal (Ctrl+Alt+T) et coller :

```bash
curl -fsSL https://raw.githubusercontent.com/TON_COMPTE/fullstack_produits/main/install.sh | bash
```

> Remplace `TON_COMPTE` par ton nom d'utilisateur GitHub avant de coller.

Ce script automatise **tout** :
- Mise à jour Ubuntu
- Installation Docker, Git, Python
- Clonage du projet dans `/opt/zenith-pharma`
- Création du fichier `.env` avec clés auto-générées
- Construction et démarrage des conteneurs
- Migrations Django
- Création du superutilisateur **admin / admin123**
- Installation des services systemd (webhook + watchdog)
- Installation de Portainer (interface web Docker)

**Durée totale : 5-10 minutes** selon la connexion.

### À la fin du script, note ces informations affichées à l'écran :

| Information | Valeur | À faire |
|-------------|--------|---------|
| **DJANGO_SECRET_KEY** | affiché dans le terminal | 🔒 La garder secrète |
| **DEPLOY_SECRET** | affiché dans le terminal | 📋 À copier dans GitHub |
| **Superutilisateur** | `admin` / `admin123` | 🔑 À changer immédiatement |
| **Application** | http://localhost/ | 🏥 Ouvrir dans Firefox |
| **Portainer** | http://localhost:9000/ | 🐳 Gérer les conteneurs |

---

## 3. Configurer le webhook GitHub (déploiement auto)

1. Aller sur : `https://github.com/TON_COMPTE/fullstack_produits/settings/hooks`
2. Cliquer **Add webhook**
3. **Payload URL** : `http://IP_PUBLIQUE_DU_SERVEUR:9000/deploy`
4. **Content type** : `application/json`
5. **Secret** : coller la valeur `DEPLOY_SECRET` affichée à l'étape 2
6. **Which events?** : Just the `push` event
7. **Active** : cocher
8. Cliquer **Add webhook**

> **Trouver l'IP publique du serveur** : `curl ifconfig.me` dans le terminal.

---

## 4. Tester le déploiement automatique

Depuis ton PC Windows :

```bash
git commit --allow-empty -m "test: webhook deploy"
git push origin main
```

Sur le serveur, vérifier les logs :
```bash
sudo journalctl -u zenith-webhook -f
```

---

## 5. Accès à distance (optionnel mais recommandé)

Pour administrer le PC sans s'y déplacer :

### TeamViewer (recommandé — traverse les pare-feu)
```bash
# Télécharger le .deb depuis teamviewer.com, puis :
sudo dpkg -i teamviewer_*.deb
sudo apt-get install -f
# Ouvrir TeamViewer depuis le menu Applications
```

### AnyDesk (alternative légère)
```bash
wget -qO - https://keys.anydesk.com/repos/DEB-GPG-KEY | sudo apt-key add -
echo "deb http://deb.anydesk.com/ all main" | sudo tee /etc/apt/sources.list.d/anydesk-stable.list
sudo apt update && sudo apt install anydesk
```

---

## Commandes utiles

| Commande | Description |
|----------|-------------|
| `cd /opt/zenith-pharma && sudo docker compose -f docker-compose.prod.yml ps` | Voir les conteneurs |
| `sudo docker logs fullstack_produits-backend-1 --tail 50` | Logs backend |
| `sudo systemctl status zenith-webhook` | Statut webhook |
| `sudo systemctl status zenith-watchdog` | Statut watchdog |
| `sudo journalctl -u zenith-webhook -f` | Logs webhook temps réel |
| `./backup-db.sh` | Backup manuel |
| `./rollback.sh --force` | Rollback manuel |

---

## Checklist finale

- [ ] PC Ubuntu Desktop 22.04+ avec 8 Go RAM
- [ ] Commande `install.sh` exécutée sans erreur
- [ ] Application accessible sur http://localhost/
- [ ] Superutilisateur changé (`admin123` → mot de passe fort)
- [ ] Webhook GitHub configuré avec le bon `DEPLOY_SECRET`
- [ ] Test de push réussi
- [ ] Backup DB testé (`./backup-db.sh`)
- [ ] Accès à distance configuré (TeamViewer/AnyDesk)

---

## Support

En cas de problème :
1. Vérifier les logs : `sudo docker logs fullstack_produits-backend-1 --tail 100`
2. Vérifier les services : `sudo systemctl status zenith-webhook zenith-watchdog`
3. Consulter : `/opt/zenith-pharma/logs/auto-deploy.log`
