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
    tzdata \
    && rm -rf /var/lib/apt/lists/*

# Définir le fuseau horaire local (Africa/Douala = UTC+1)
ENV TZ=Africa/Douala
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Copier les fichiers de dépendances
COPY requirements.txt .

# Installer les dépendances Python
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install gunicorn python-dotenv

# Clé temporaire pour le build (sera remplacée au runtime)
ENV DJANGO_SECRET_KEY=build-temp-key-not-for-production

# Copier le reste du code de l'application
COPY . .

# Collecter les fichiers statiques
RUN python manage.py collectstatic --noinput

# Copier le script d'entrée et le rendre exécutable
RUN chmod +x entrypoint.sh

# Exposer le port que Gunicorn utilisera
EXPOSE 8000

# Utiliser le script d'entrée pour démarrer
ENTRYPOINT ["./entrypoint.sh"]
