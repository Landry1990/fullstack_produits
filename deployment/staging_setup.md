# Guide de Mise en Place Staging (Ubuntu)

Ce guide décrit les étapes pour installer l'application **Fullstack Produits** sur un serveur Ubuntu vierge.

## 1. Pré-requis Système

Sur votre machine Ubuntu, ouvrez un terminal et exécutez :

```bash
# Mettre à jour le système
sudo apt update && sudo apt upgrade -y

# Installer Python, PostgreSQL, Nginx, Git et Node.js
sudo apt install -y python3-pip python3-venv python3-dev libpq-dev postgresql postgresql-contrib nginx curl git

# Installer Node.js (Version 20 LTS recommandée)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## 2. Base de Données (PostgreSQL)

```bash
sudo -u postgres psql
```

Dans le prompt SQL :
```sql
CREATE DATABASE fullstack_staging;
CREATE USER user_staging WITH PASSWORD 'mon_password_securise';
ALTER ROLE user_staging SET client_encoding TO 'utf8';
ALTER ROLE user_staging SET default_transaction_isolation TO 'read committed';
ALTER ROLE user_staging SET timezone TO 'Africa/Douala';
GRANT ALL PRIVILEGES ON DATABASE fullstack_staging TO user_staging;
\q
```

## 3. Installation du Projet

```bash
# Cloner le projet (remplacer par votre URL git réelle)
cd /var/www
sudo mkdir fullstack
sudo chown $USER:$USER fullstack
cd fullstack
git clone <VOTRE_URL_REPO_GIT> .
```

Si le code est déjà sur la machine (copie manuelle), placez-le simplement dans `/var/www/fullstack`.

## 4. Backend (Django)

```bash
cd /var/www/fullstack/backend

# Créer l'environnement virtuel
python3 -m venv venv
source venv/bin/activate

# Installer les dépendances
pip install -r requirements.txt
pip install gunicorn

# Configuration .env
cp .env.example .env 
# (OU créez le fichier .env avec vos infos de BDD staging)
nano .env
```

**Contenu typique `.env` staging :**
```ini
DEBUG=False
DJANGO_SECRET_KEY=votre_cle_tres_secrete_staging
ALLOWED_HOSTS=127.0.0.1,localhost,IP_DU_SERVEUR
DB_ENGINE=django.db.backends.postgresql
DB_NAME=fullstack_staging
DB_USER=user_staging
DB_PASSWORD=mon_password_securise
DB_HOST=localhost
DB_PORT=5432
```

**Sudo mode & Migrations :**
```bash
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py createdefaultsuperuser # Si script personnalisé, sinon createsuperuser
```

## 5. Frontend (React)

```bash
cd /var/www/fullstack/frontend/frontend

# Installer et builder
npm install
npm run build
```

Le build sera généré dans `/var/www/fullstack/frontend/frontend/dist`.

## 6. Configuration Gunicorn (Serveur d'Application)

Créer un fichier de service systemd :
`sudo nano /etc/systemd/system/gunicorn.service`

```ini
[Unit]
Description=gunicorn daemon
After=network.target

[Service]
User=ubuntu
Group=www-data
WorkingDirectory=/var/www/fullstack/backend
ExecStart=/var/www/fullstack/backend/venv/bin/gunicorn --access-logfile - --workers 3 --bind unix:/var/www/fullstack/backend/fullstack.sock backend.wsgi:application
Restart=always

[Install]
WantedBy=multi-user.target
```
*(Remplacez `User=ubuntu` par votre utilisateur réel)*

Activer le service :
```bash
sudo systemctl start gunicorn
sudo systemctl enable gunicorn
```

## 7. Configuration Nginx (Serveur Web)

Créer la config du site :
`sudo nano /etc/nginx/sites-available/fullstack_staging`

```nginx
server {
    listen 80;
    server_name IP_OU_DOMAINE;

    location = /favicon.ico { access_log off; log_not_found off; }
    
    # Frontend (React Build)
    location / {
        root /var/www/fullstack/frontend/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        include proxy_params;
        proxy_pass http://unix:/var/www/fullstack/backend/fullstack.sock;
    }
    
    # Django Admin
    location /admin/ {
        include proxy_params;
        proxy_pass http://unix:/var/www/fullstack/backend/fullstack.sock;
    }

    # Fichiers Statiques Django (Admin & browsable API)
    location /static/ {
        alias /var/www/fullstack/backend/staticfiles/;
    }

    # Fichiers Media Django (Uploads)
    location /media/ {
        alias /var/www/fullstack/backend/media/;
    }
}
```

Activer le site :
```bash
sudo ln -s /etc/nginx/sites-available/fullstack_staging /etc/nginx/sites-enabled
sudo nginx -t
sudo systemctl restart nginx
```

## 8. Déploiement Automatique (Script)

Utilisez le script `deployment/deploy.sh` pour mettre à jour rapidement après un `git pull`.

```bash
chmod +x deployment/deploy.sh
./deployment/deploy.sh
```

## 9. Gestion des Bugs et Maintenance

Si vous rencontrez un bug en staging (ou si vous voulez ajouter une feature), voici la procédure :

### A. Analyser le problème (Logs)
Consultez les logs pour comprendre l'erreur :
```bash
# Logs Backend (Gunicorn) - Erreurs Python
sudo journalctl -u gunicorn -n 50 -f

# Logs Nginx (Serveur Web) - Erreurs HTTP/Accès
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### B. Workflow de Correction
C'est la règle d'or : **Ne jamais modifier le code directement sur le serveur staging.**

1.  **Reproduisez** le bug sur votre machine de développement (Local).
2.  **Corrigez** le code et testez-le localement.
3.  **Poussez** les modifications sur Git :
    ```bash
    git add .
    git commit -m "Fix: description du bug"
    git push origin main
    ```

### C. Mettre à jour le Staging
Une fois le correctif poussé, connectez-vous au serveur et lancez simplement le script de déploiement :
```bash
cd /var/www/fullstack
./deployment/deploy.sh
```
Le script va récupérer votre correctif (`git pull`), mettre à jour la base de données (si besoin), recompiler le frontend et redémarrer les services.

## 10. Dépannage : "Ça marche chez moi mais pas ici !"

Si un bug persiste uniquement en staging :

### A. Base de données
*   **Migrations manquantes ?** Le script de déploiement doit les exécuter (`monitorer` la sortie).
*   **Différence de données ?** Le staging a souvent des données plus anciennes ou incomplètes.

### B. Variables d'Environnement (.env)
*   Une clé API manquante dans `/var/www/fullstack/backend/.env` ?
*   Si vous modifiez le `.env`, **redémarrez Gunicorn** : `sudo systemctl restart gunicorn`.

### C. Mode DEBUG (Dernier recours)
Pour voir l'erreur exacte ("500 Server Error") :
1.  Modifiez `.env` : `DEBUG=True`.
2.  Redémarrez Gunicorn.
3.  Reproduisez l'erreur et notez le message.
4.  **Immédiatement** remettre `DEBUG=False` et redémarrer.
