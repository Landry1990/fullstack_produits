# Utiliser une image Python officielle légère
FROM python:3.11-slim

# Définir le répertoire de travail
WORKDIR /app

# Installer les dépendances système nécessaires pour Psycopg2 et autres
# + tzdata pour le fuseau horaire local
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    curl \
    git \
    tzdata \
    postgresql-client \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Installer le client Docker CLI seul (~15MB vs docker.io ~800MB)
RUN curl -fsSL https://download.docker.com/linux/static/stable/x86_64/docker-27.0.3.tgz -o docker.tgz && \
    tar --extract --file docker.tgz --strip-components 1 --directory /usr/local/bin/ docker/docker && \
    rm docker.tgz

# Installer le plugin Docker Compose v2 (nécessaire pour nightly-update.sh qui tourne dans ce conteneur)
RUN mkdir -p /usr/local/lib/docker/cli-plugins && \
    curl -fsSL https://github.com/docker/compose/releases/download/v2.29.2/docker-compose-linux-x86_64 \
    -o /usr/local/lib/docker/cli-plugins/docker-compose && \
    chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Définir le fuseau horaire local (Africa/Douala = UTC+1)
ENV TZ=Africa/Douala
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Copier les fichiers de dépendances
COPY requirements.txt .

# Installer les dépendances Python
# --mount=type=cache : le cache pip persiste sur l'hôte entre les builds,
# évitant de tout re-télécharger depuis PyPI à chaque rebuild (utile si
# la connexion internet du serveur est instable).
RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt
RUN --mount=type=cache,target=/root/.cache/pip pip install gunicorn python-dotenv cython

# Clé temporaire pour le build (sera remplacée au runtime)
ENV DJANGO_SECRET_KEY=build-temp-key-not-for-production

# Copier le reste du code de l'application
COPY . .

# ── Compilation Cython des fichiers critiques en .so binaires ──
# Les fichiers protégés (settings.py, middleware_licence.py, utils_licence.py,
# views/licence.py, keyday.py) sont compilés en .so illisibles.
# Les .py sources sont supprimés — le client ne peut pas modifier le code.
RUN python compile_protected.py && rm -f compile_protected.py

# Copier le script d'entrée et le rendre exécutable
RUN chmod +x entrypoint.sh

# Exposer le port que Gunicorn utilisera
EXPOSE 8000

# Utiliser le script d'entrée pour démarrer
ENTRYPOINT ["./entrypoint.sh"]
