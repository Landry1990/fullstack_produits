

from pathlib import Path
import os
from dotenv import load_dotenv
from django.core.exceptions import ImproperlyConfigured

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Charger le fichier .env depuis la racine du backend
load_dotenv(BASE_DIR / '.env')

# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/

# SECURITY: Clé secrète chargée depuis .env — jamais en dur dans le code
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')
if not SECRET_KEY:
    raise ImproperlyConfigured("DJANGO_SECRET_KEY manquant ! Ajoutez-le dans backend/.env")

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.getenv('DJANGO_DEBUG', 'False').lower() == 'true'

# Enable Django Silk profiler (default: False in production/pre-prod)
ENABLE_SILK = os.getenv('ENABLE_SILK', 'False').lower() == 'true'

ALLOWED_HOSTS = os.getenv('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1,backend,frontend,*').split(',')

# Support pour les proxys comme Nginx/ngrok
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True
USE_X_FORWARDED_PORT = True

# Password hashing: Argon2 (fast + secure) instead of PBKDF2 (1M iterations = ~12s on this CPU)
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
]


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.postgres',  # Support pour index GIN et Trigrammes
    'api.apps.ApiConfig',  # Custom app for API
    'rest_framework',  # Django REST framework
    'rest_framework.authtoken', # Token Auth
    'django_filters',  # Django Filter (templates & backends)
    'corsheaders',
]

if ENABLE_SILK:
    INSTALLED_APPS.append('silk')

MIDDLEWARE = [
    'api.middleware.allow_private_ips.AllowPrivateIPsMiddleware',  # DOIT ÊTRE EN PREMIER - Autorise IPs privées réseau local
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
]

if ENABLE_SILK:
    MIDDLEWARE.append('silk.middleware.SilkyMiddleware')

MIDDLEWARE += [
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'api.middleware_licence.LicenceMiddleware',   # Vigile de la Licence système
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'backend.wsgi.application'

 
# Django REST Framework settings
REST_FRAMEWORK = {
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
    ],
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    # Throttling désactivé en pré-prod pour éviter les erreurs 429
    # 'DEFAULT_THROTTLE_CLASSES': [
    #     'rest_framework.throttling.AnonRateThrottle',
    #     'rest_framework.throttling.UserRateThrottle',
    # ],
    # 'DEFAULT_THROTTLE_RATES': {
    #     'anon': os.getenv('DJANGO_THROTTLE_ANON', '100/day'),
    #     'user': os.getenv('DJANGO_THROTTLE_USER', '100000/day'),
    #     'auth': os.getenv('DJANGO_THROTTLE_AUTH', '60/min'),
    # },
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
    'PAGE_SIZE_QUERY_PARAM': 'page_size',
    'MAX_PAGE_SIZE': 10000,
    'EXCEPTION_HANDLER': 'api.exceptions.custom_exception_handler',
}

# Database
# https://docs.djangoproject.com/en/5.2/ref/settings/#databases

# DATABASES = {
#     'default': {
#        'ENGINE': 'django.db.backends.sqlite3',
#        'NAME': BASE_DIR / 'db.sqlite3',
#    }
# }


DATABASES = {
    'default': {
        'ENGINE': os.getenv('DB_ENGINE', 'django.db.backends.postgresql'),
        'NAME': os.getenv('DB_NAME', 'MyDatabase'),
        'USER': os.getenv('DB_USER', 'postgres'),
        'PASSWORD': os.getenv('DB_PASSWORD', '123456'),
        'HOST': os.getenv('DB_HOST', 'localhost'),
        'PORT': os.getenv('DB_PORT', '5432'),
        
        # Connection pooling configuration
        # Garde les connexions ouvertes pour réutilisation (évite reconnexions fréquentes)
        # Valeur en secondes, None = connexions persistantes, 0 = fermeture après chaque requête
        'CONN_MAX_AGE': int(os.getenv('DB_CONN_MAX_AGE', '600')),  # 10 minutes par défaut
        
        # Options PostgreSQL pour optimiser les performances et éviter les deadlocks
        'OPTIONS': {
            # Psycopg3 utilise automatiquement READ COMMITTED par défaut
            # Pas besoin de spécifier isolation_level explicitement
            
            # Timeouts pour éviter les deadlocks (en millisecondes)
            # statement_timeout: annule les requêtes qui prennent trop de temps
            # lock_timeout: annule si l'attente de verrou est trop longue
            'options': '-c client_encoding=UTF8 -c statement_timeout=30000 -c lock_timeout=5000',
            
            # Connection pooling côté client (optionnel, pour pgBouncer)
            # 'server_side_binding': False,  # Décommenter si vous utilisez pgBouncer
        },
        
        # Pool de connexions (pour environnements avec beaucoup de workers)
        # Note: Django ne gère pas nativement un pool, mais garde les connexions ouvertes
        # Pour un vrai pool, utiliser pgBouncer ou django-db-pool
        'CONN_HEALTH_CHECKS': True,  # Django 4.1+ : Vérifie la santé des connexions
    }
}




# Password validation
# https://docs.djangoproject.com/en/5.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/5.2/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'Africa/Douala'

USE_I18N = True

USE_TZ = False  # Désactivé pour travailler avec l'heure locale du système


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.2/howto/static-files/

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Media files (Uploaded by users)
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Whitenoise configuration for static files
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

# CORS / CSRF configuration
# Inclut les ports dev (3000, 5173) et production (80)
# Option: CORS_ALLOW_ALL=true pour autoriser tous les origines (réseau local uniquement)
CORS_ALLOW_ALL_ORIGINS = os.getenv('CORS_ALLOW_ALL', 'False').lower() == 'true'

if not CORS_ALLOW_ALL_ORIGINS:
    CORS_ALLOWED_ORIGINS = os.getenv(
        'CORS_ALLOWED_ORIGINS', 
        'http://localhost,http://localhost:3000,http://localhost:5173,http://127.0.0.1,http://127.0.0.1:3000,http://192.168.1.192,http://192.168.1.192:3000,http://Odessa1988'
    ).split(',')

CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = os.getenv(
    'CSRF_TRUSTED_ORIGINS', 
    'http://localhost,http://localhost:3000,http://127.0.0.1,http://127.0.0.1:3000,http://192.168.1.192,http://192.168.1.192:3000,http://Odessa1988'
).split(',')

# Security cookies in production
if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'
    SECURE_REFERRER_POLICY = 'same-origin'
    SECURE_HSTS_SECONDS = int(os.getenv('DJANGO_SECURE_HSTS_SECONDS', '31536000'))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

# Default primary key field type
# https://docs.djangoproject.com/en/5.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Cache Configuration
# Utilise Redis si REDIS_URL est défini, sinon Ram-based cache pour le dév
REDIS_URL = os.getenv('REDIS_URL')

if REDIS_URL:
    CACHES = {
        'default': {
            'BACKEND': 'django_redis.cache.RedisCache',
            'LOCATION': REDIS_URL,
            'OPTIONS': {
                'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            }
        }
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'unique-snowflake',
        }
    }


# ──────────────────────────────────────────────
# Logging Configuration
# ──────────────────────────────────────────────
# Concurrent Logging Handler for Windows/Multi-process (Fixes PermissionError during rotation)
try:
    from concurrent_log_handler import ConcurrentRotatingFileHandler
except ImportError:
    # Fallback to standard handler if not installed
    from logging.handlers import RotatingFileHandler as ConcurrentRotatingFileHandler

LOG_DIR = (BASE_DIR / 'logs').resolve()
LOG_DIR.mkdir(exist_ok=True)

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,

    'formatters': {
        'verbose': {
            'format': '[{asctime}] {levelname:<8} {name:<30} | {message}',
            'style': '{',
            'datefmt': '%Y-%m-%d %H:%M:%S',
        },
        'simple': {
            'format': '{levelname:<8} {name:<20} | {message}',
            'style': '{',
        },
    },

    'handlers': {
        # Console (dev & prod)
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'simple' if DEBUG else 'verbose',
            'level': 'DEBUG' if DEBUG else 'INFO',
        },
        # Fichier applicatif (tout le flux INFO+)
        'file_app': {
            '()': ConcurrentRotatingFileHandler,
            'filename': str(LOG_DIR / 'app.log'),
            'maxBytes': 10 * 1024 * 1024,  # 10 MB
            'backupCount': 5,
            'formatter': 'verbose',
            'level': 'INFO',
            'encoding': 'utf-8',
        },
        # Fichier erreurs uniquement (ERROR+)
        'file_error': {
            '()': ConcurrentRotatingFileHandler,
            'filename': str(LOG_DIR / 'error.log'),
            'maxBytes': 10 * 1024 * 1024,  # 10 MB
            'backupCount': 10,
            'formatter': 'verbose',
            'level': 'ERROR',
            'encoding': 'utf-8',
        },
        # Fichier operations metier critiques
        'file_business': {
            '()': ConcurrentRotatingFileHandler,
            'filename': str(LOG_DIR / 'business.log'),
            'maxBytes': 10 * 1024 * 1024,  # 10 MB
            'backupCount': 10,
            'formatter': 'verbose',
            'level': 'INFO',
            'encoding': 'utf-8',
        },
    },

    'loggers': {
        # Django framework
        'django': {
            'handlers': ['console', 'file_app'],
            'level': 'INFO',
            'propagate': False,
        },
        # Erreurs HTTP (4xx, 5xx)
        'django.request': {
            'handlers': ['console', 'file_error'],
            'level': 'ERROR',
            'propagate': False,
        },
        # Code applicatif API
        'api': {
            'handlers': ['console', 'file_app', 'file_error'],
            'level': 'DEBUG' if DEBUG else 'INFO',
            'propagate': False,
        },
        # Operations metier critiques
        'api.business': {
            'handlers': ['console', 'file_business', 'file_error'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}


# Silk Configuration
SILK_PYTHON_PROFILER = False  # Désactivé - cause des deadlocks PostgreSQL
SILK_AUTHENTICATION = True
SILK_AUTHORISATION = True

# Exclusions pour éviter les deadlocks sur opérations intensives
SILKY_EXCLUDE_URLS = [
    r'^/api/rapports/.*',  # Rapports lourds
    r'^/api/factures/.*',  # Ventes fréquentes
    r'^/api/stock-lots/.*',  # Mouvements stock
    r'^/api/inventaires/.*',  # Inventaires
]

# Limiter la rétention pour réduire la taille de la table silk_response
SILKY_MAX_RECORDED_REQUESTS = 1000
SILKY_MAX_RESPONSE_BODY_SIZE = 1024  # 1KB max
SILKY_MAX_REQUEST_BODY_SIZE = 1024  # 1KB max

# Sentry Configuration
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration
from sentry_sdk.integrations.logging import LoggingIntegration

SENTRY_DSN = os.getenv('SENTRY_DSN')

if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[
            DjangoIntegration(),
        ],
        # Disable LoggingIntegration entirely to prevent Python 3.13 formatting crashes
        # The monkey-patch on Logger.callHandlers causes issues with %s style messages
        disabled_integrations=[LoggingIntegration],
        
        # Set traces_sample_rate to 1.0 to capture 100%
        # of transactions for performance monitoring.
        # We recommend adjusting this value in production.
        traces_sample_rate=1.0 if DEBUG else 0.2,
        
        # If you wish to associate users to errors (assuming you are using
        # django.contrib.auth) you may enable sending PII data.
        send_default_pii=True,
        
        # Set profiles_sample_rate to 1.0 to profile 100%
        # of sampled transactions.
        # We recommend adjusting this value in production.
        profiles_sample_rate=1.0 if DEBUG else 0.2,
    )

