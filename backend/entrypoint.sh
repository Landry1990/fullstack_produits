#!/bin/sh

# Exit immediately if a command exits with a non-zero status
set -e

echo "🚀 Starting backend entrypoint..."

# Wait for database to be ready if needed (optional but recommended)
# while ! curl http://db:5432/ 2>&1 | grep "52" > /dev/null; do
#   echo "Waiting for database..."
#   sleep 1
# done

echo "📥 Running database migrations..."
python manage.py migrate --noinput

echo "📂 Collecting static files..."
python manage.py collectstatic --noinput

echo "🔥 Starting Gunicorn..."
exec gunicorn --bind 0.0.0.0:8000 --workers 3 backend.wsgi:application
