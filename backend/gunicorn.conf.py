"""
Gunicorn configuration — Zenith Pharma
Optimisé pour 12-15 postes simultanés sur mini-PC 4-6 cœurs
"""
import multiprocessing
import os

# ── Workers ──────────────────────────────────────────────────────
# Formule recommandée : 2 × CPU + 1
# Sur 4 cœurs → 9 workers  |  Sur 6 cœurs → 13 workers
workers = int(os.getenv("GUNICORN_WORKERS", multiprocessing.cpu_count() * 2 + 1))

# Threads par worker — augmente la capacité sans multiplier les processus
# 4 threads × 9 workers = 36 requêtes simultanées théoriques
threads = int(os.getenv("GUNICORN_THREADS", 4))

# Worker class : gthread (sync + threads) — compatible Django 100%
# Alternative : "gevent" si vous installez gevent (encore plus de capacité)
worker_class = "gthread"

# ── Réseau ───────────────────────────────────────────────────────
bind = os.getenv("GUNICORN_BIND", "0.0.0.0:8000")

# Nombre max de connexions en attente dans la file OS
backlog = 512

# ── Timeouts ─────────────────────────────────────────────────────
# Durée max d'une requête avant kill du worker (secondes)
timeout = int(os.getenv("GUNICORN_TIMEOUT", 60))

# Garde les connexions HTTP ouvertes (évite le handshake à chaque requête)
keepalive = 5

# Délai de grâce à l'arrêt (laisse les requêtes en cours se terminer)
graceful_timeout = 30

# ── Mémoire & stabilité ──────────────────────────────────────────
# Redémarre un worker après N requêtes — évite les fuites mémoire progressives
# Valeur augmentée pour production (évite latence due aux redémarrages fréquents)
max_requests = 5000
max_requests_jitter = 500  # Évite que tous les workers redémarrent en même temps

# ── Logs ─────────────────────────────────────────────────────────
accesslog = "-"           # stdout
errorlog  = "-"           # stderr
loglevel  = os.getenv("GUNICORN_LOG_LEVEL", "warning")  # "info" en debug
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s %(D)sµs'

# ── Performance ──────────────────────────────────────────────────
# DISABLED: preload_app causes PostgreSQL connection sharing between
# forked workers → deadlocks and "SSL SYSCALL error: EOF detected".
# CONN_MAX_AGE in Django keeps connections open; forked workers inherit
# the same socket file descriptor → multiple processes write to one conn.
preload_app = False

def post_fork(server, worker):
    """Close inherited DB connections after fork to prevent sharing."""
    from django.db import connection
    connection.close()

# Reduce Python GIL contention
worker_tmp_dir = "/dev/shm" if os.path.exists("/dev/shm") else None
