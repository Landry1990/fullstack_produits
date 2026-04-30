# Guide : Mise à jour automatique Zenith PMS

## Principe

Chaque serveur en pharmacie se met à jour **seul** chaque nuit via un cron job.
Il vérifie si une nouvelle version est disponible sur GitHub, puis pull + rebuild + redémarre.

---

## Installation initiale sur un nouveau serveur

### 1. Cloner le dépôt

```bash
sudo mkdir -p /opt/zenith
cd /opt/zenith
git clone https://github.com/TON_COMPTE/fullstack_produits.git
cd fullstack_produits
```

### 2. Rendre le script exécutable

```bash
chmod +x deployment/auto_update.sh
```

### 3. Adapter les chemins dans le script (si nécessaire)

Ouvrir `deployment/auto_update.sh` et vérifier :
- `APP_DIR` : chemin vers le dépôt (défaut : `/opt/zenith/fullstack_produits`)
- `VENV_PATH` : chemin vers le virtualenv Python
- `BACKEND_SERVICE` : nom du service systemd du backend (défaut : `zenith-backend`)

### 4. Planifier la mise à jour automatique (cron)

```bash
sudo crontab -e
```

Ajouter cette ligne (mise à jour chaque nuit à 2h00) :

```
0 2 * * * /opt/zenith/fullstack_produits/deployment/auto_update.sh >> /var/log/zenith_update.log 2>&1
```

### 5. Tester manuellement

```bash
sudo /opt/zenith/fullstack_produits/deployment/auto_update.sh
tail -f /var/log/zenith_update.log
```

---

## Déployer une mise à jour (depuis ton PC de développement)

1. Faire les modifications dans le code
2. Mettre à jour le fichier `VERSION` à la racine (ex: `2.9.0`)
3. Mettre à jour `frontend/src/components/Changelog.tsx` (ajouter la nouvelle version dans `VERSIONS`)
4. Mettre à jour les fichiers `public/locales/fr/changelog.json` et `public/locales/en/changelog.json`
5. Commit + push sur la branche `main`

```bash
git add .
git commit -m "v2.9.0 — Description de la mise à jour"
git push origin main
```

Les serveurs en pharmacie récupéreront la mise à jour **automatiquement la nuit suivante**.

---

## Vérification

- Les logs sont dans `/var/log/zenith_update.log`
- La version installée est visible sur la page **🚀 Quoi de neuf ?** dans l'application
- L'API expose la version : `GET /api/version/`

---

## Rollback (retour arrière)

En cas de problème après une mise à jour :

```bash
cd /opt/zenith/fullstack_produits
git tag           # lister les tags de sauvegarde (backup-YYYYMMDD-HHMMSS)
git checkout backup-20260430-020000   # revenir à cette version
# Puis redémarrer le service
sudo systemctl restart zenith-backend
```
