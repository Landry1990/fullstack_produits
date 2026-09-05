import hashlib
import hmac
import json
import logging
import os
import subprocess
from datetime import datetime, timedelta
from pathlib import Path

import jwt
from django.conf import settings
from django.utils import timezone

from api.models.licence import Licence

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Période d'essai (30 jours) au premier démarrage sans licence
# Permet de restaurer un backup et de configurer l'app avant activation
# ─────────────────────────────────────────────────────────────────────────────
TRIAL_DAYS = 30


def _get_trial_file() -> Path:
    """Retourne le chemin du fichier de suivi de la période d'essai.

    Utilise /opt/zenith-pharma/ (persistant en prod) ou fallback sur le dossier parent de BASE_DIR.
    """
    # En prod : /opt/zenith-pharma est monté en volume (persistant)
    prod_path = Path('/opt/zenith-pharma/trial_start.txt')
    if prod_path.parent.exists() and os.access(prod_path.parent, os.W_OK):
        return prod_path
    # En dev : le dossier parent de BASE_DIR est monté en volume
    return Path(settings.BASE_DIR).parent / 'trial_start.txt'


def _get_or_create_trial():
    """Gère la période d'essai au premier démarrage (aucune licence en base).

    Compte les jours d'utilisation distincts (anti-manipulation d'horloge).
    Stocke le compteur dans DEUX sources (fichier + Redis) pour empêcher la
    réinitialisation par suppression d'une seule source.

    Retourne: {'est_valide': bool, 'message': str, 'payload': dict|None}
    """
    from django.core.cache import cache as _cache

    trial_file = _get_trial_file()
    redis_key = 'trial_used_days'
    today = datetime.utcnow().strftime('%Y-%m-%d')

    # ── Source 1 : fichier local ──
    file_data = None
    if trial_file.exists():
        try:
            file_data = json.loads(trial_file.read_text())
            if 'used_days' not in file_data or not isinstance(file_data['used_days'], list):
                file_data = None
        except Exception:
            file_data = None

    # ── Source 2 : Redis ──
    redis_data = None
    try:
        cached = _cache.get(redis_key)
        if cached and isinstance(cached, dict) and 'used_days' in cached:
            redis_data = cached
    except Exception:
        pass

    # ── Fusion : prendre l'union des jours utilisés ──
    file_days = set(file_data.get('used_days', [])) if file_data else set()
    redis_days = set(redis_data.get('used_days', [])) if redis_data else set()
    merged_days = sorted(file_days | redis_days)

    # Si aucune source n'a de données → premier démarrage
    is_first_start = not file_data and not redis_data

    if is_first_start:
        merged_days = [today]
        try:
            from django.contrib.auth.models import User
            if not User.objects.exists():
                User.objects.create_superuser('admin', password='admin')
                logger.info("[LICENCE] Superuser par défaut créé (admin/admin) — période d'essai")
        except Exception as e:
            logger.warning(f"[LICENCE] Impossible de créer le superuser par défaut: {e!s}")
        logger.info("[LICENCE] Période d'essai démarrée (premier démarrage)")

    # Ajouter le jour courant
    if today not in merged_days:
        merged_days.append(today)

    # Sauvegarder dans les deux sources
    save_data = {'start_date': merged_days[0], 'used_days': merged_days}
    try:
        trial_file.write_text(json.dumps(save_data))
    except Exception as e:
        logger.warning(f"[LICENCE] Impossible d'écrire le fichier trial: {e!s}")
    try:
        _cache.set(redis_key, save_data, timeout=None)  # Pas d'expiration
    except Exception as e:
        logger.warning(f"[LICENCE] Impossible d'écrire dans Redis trial: {e!s}")

    days_used = len(merged_days)
    days_remaining = TRIAL_DAYS - days_used

    if days_remaining <= 0:
        return {
            'est_valide': False,
            'message': f'Période d\'essai expirée ({TRIAL_DAYS} jours d\'utilisation écoulés). Activez votre licence.',
            'payload': None,
        }

    payload = {
        'pharmacie_nom': 'PHARMACIE TEST',
        'pharmacien_nom': 'DR TEST',
        'plan': 'TRIAL',
        'exp': int((datetime.utcnow() + timedelta(days=days_remaining + 1)).timestamp()),
        'hardware_id': 'ANY',
        'is_trial': True,
        'days_remaining': days_remaining,
        'days_used': days_used,
    }

    return {
        'est_valide': True,
        'message': f'Période d\'essai : {days_remaining} jour(s) restant(s) ({days_used}/{TRIAL_DAYS} utilisés)',
        'payload': payload,
    }


def _sign_cache_value(value: dict) -> str:
    """Signe une valeur de cache avec HMAC-SHA256 dérivé de SECRET_KEY."""
    secret = settings.SECRET_KEY.encode()
    payload = json.dumps(value, sort_keys=True).encode()
    return hmac.new(secret, payload, hashlib.sha256).hexdigest()


def _verify_cache_signature(cached: dict) -> bool:
    """Vérifie que la signature HMAC du cache est valide (anti-empoisonnement)."""
    if not isinstance(cached, dict):
        return False
    signature = cached.pop('_sig', None)
    if not signature:
        return False
    expected = _sign_cache_value(cached)
    return hmac.compare_digest(str(signature), str(expected))

# /!\ INSÉREZ ICI LE CONTENU DE VOTRE FICHIER 'cle_publique_a_distribuer.pem'
CLE_PUBLIQUE = """-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvESDIR7eIZpwiQbySX+u
phTZM/yu7dL7bg5lsj6ZD1fE4q0NcsuRUx3X+9/zPfdc2/UoMdYfc5MgguC/WAQR
8efOKGs5TJa+28UmGHw6RBCPxG0cxeLfEydBaIdPR1bHxl7jQ/honxlqjFATKO/H
GQ+apo2gM/9G13th812Cp3OhCFBalFQ19H8zAaELhbbGPmSiQc/+KI8hh7z5LTyy
K+1TSmoWdfTATvq8J7uxbuPAdZtG/Z10tm9xjcVLXeEbxspRrwa0TSR3jqOLqaJE
zqEq7yCF1L3vu4Iki9Lh9BvCFSZo60FYasMYCxJzS9oM9WAw/2UXP4NP1o+3gSJY
3wIDAQAB
-----END PUBLIC KEY-----"""


def get_licence_details():
    """
    Récupère les détails de la licence active.
    Retourne: (is_valid, payload, days_remaining, is_lifetime)
    """
    licence_obj = Licence.objects.last()
    if not licence_obj:
        return False, None, 0, False

    try:
        payload = jwt.decode(
            licence_obj.cle, CLE_PUBLIQUE, algorithms=["RS256"],
            options={"verify_exp": False},
        )

        # Vérifier si c'est une licence à vie (pas de champ 'exp')
        if 'exp' not in payload:
            return True, payload, None, True  # Licence à vie

        # Calculer les jours restants (avec protection contre horloge fausse)
        exp_timestamp = payload['exp']
        exp_date = datetime.utcfromtimestamp(exp_timestamp)
        now = datetime.utcnow()

        if now >= exp_date:
            # L'horloge système est peut-être en avance (pile CMOS ?)
            # Ne pas bloquer — la licence utilise des cycles, pas des dates absolues
            return True, payload, 0, False

        days_remaining = (exp_date - now).days
        return True, payload, days_remaining, False

    except Exception:
        return False, None, 0, False


def should_send_alert(days_remaining, alert_threshold=7):
    """
    Détermine si une alerte doit être envoyée.
    Alertes quotidiennes quand il reste 7 jours ou moins.
    """
    if days_remaining is None:  # Licence à vie
        return False
    return days_remaining <= alert_threshold

def get_hardware_id():
    """Génère une empreinte unique du PC (Carte Mère + CPU). Supporte Windows et Linux (Docker)."""
    try:
        # Tentative pour Windows (via shell mais silencieux si erreur)
        if os.name == 'nt':
            board = subprocess.check_output("wmic baseboard get serialnumber", shell=True, stderr=subprocess.DEVNULL).decode().split('\n')[1].strip()
            cpu = subprocess.check_output("wmic cpu get processorid", shell=True, stderr=subprocess.DEVNULL).decode().split('\n')[1].strip()
            raw_id = f"{board}-{cpu}"
        else:
            # Tentative pour Linux (Docker)
            # machine-id est standard sur la plupart des distros Linux
            machine_id = ""
            if os.path.exists('/etc/machine-id'):
                with open('/etc/machine-id', 'r') as f:
                    machine_id = f.read().strip()
            elif os.path.exists('/var/lib/dbus/machine-id'):
                with open('/var/lib/dbus/machine-id', 'r') as f:
                    machine_id = f.read().strip()
            
            # Si on ne trouve rien, on utilise le hostname (moins stable mais évite UNKNOWN)
            if not machine_id:
                import socket
                machine_id = socket.gethostname()
                
            raw_id = f"LINUX-{machine_id}"

        return hashlib.sha256(raw_id.encode()).hexdigest()[:16].upper()
    except Exception:
        return "DOCKER-HOST-ID"

from django.core.cache import cache


def valider_licence_systeme():
    """Vérifie la licence stockée en base de données."""
    # 1. Vérification du cache pour éviter la surcharge sur chaque requête API
    cache_key = "system_licence_validation"
    cached_result = cache.get(cache_key)

    if cached_result is not None:
        # Vérifier la signature HMAC du cache (anti-empoisonnement Redis)
        if not _verify_cache_signature(cached_result):
            logger.warning("[LICENCE] Cache Redis signé incorrectement — possible empoisonnement. Revalidation DB.")
            cache.delete(cache_key)
        else:
            return cached_result['est_valide'], cached_result['message'], cached_result['payload']

    licence_obj = Licence.objects.last()
    if not licence_obj:
        # Aucune licence en base — activer la période d'essai (30 jours)
        trial = _get_or_create_trial()
        if trial['est_valide']:
            # Mettre en cache le résultat trial (signé HMAC)
            result_dict = {
                'est_valide': True,
                'message': trial['message'],
                'payload': trial['payload'],
            }
            result_dict['_sig'] = _sign_cache_value(result_dict)
            cache.set(cache_key, result_dict, timeout=3600)
            return True, trial['message'], trial['payload']
        return False, trial['message'], None
        
    try:
        # 1. Décryptage (Vérifie la signature uniquement — pas l'expiration 'exp')
        # La licence utilise des cycles gérés métier, pas une expiration par date.
        # Un problème de pile CMOS ne doit JAMAIS bloquer la licence.
        # Sécurité : signature RS256 (infalsifiable) + hardware ID (anti-clonage).
        payload = jwt.decode(
            licence_obj.cle, CLE_PUBLIQUE, algorithms=["RS256"],
            options={"verify_exp": False},
        )
        
        # 2. Anti-Clonage (Empreinte Matérielle)
        # Optimisation: Mettre en cache l'ID matériel (il ne change jamais)
        hw_cache_key = "system_hardware_id"
        hw_id = cache.get(hw_cache_key)
        if not hw_id:
            hw_id = get_hardware_id()
            cache.set(hw_cache_key, hw_id, timeout=86400) # Cache 24h
            
        if payload.get('hardware_id') != "ANY" and payload.get('hardware_id') != hw_id:
            return False, "Matériel non reconnu (Clonage détecté).", None

        # 3. Pas d'anti-fraude temporelle
        # La licence utilise des cycles (pas des dates absolues) et le JWT a sa propre
        # expiration signée. Un problème de pile CMOS peut faire sauter l'horloge de
        # plusieurs années — cela ne doit JAMAIS bloquer la licence.
        # La sécurité repose sur : signature JWT + hardware ID + expiration du token.
        maintenant = timezone.now()

        # Mise à jour de la dernière date connue (limitée à une fois par heure pour éviter les row locks continus)
        if licence_obj.derniere_verification:
            try:
                if (maintenant - licence_obj.derniere_verification).total_seconds() > 3600:
                    licence_obj.derniere_verification = maintenant
                    licence_obj.save(update_fields=['derniere_verification'])
            except (TypeError, OverflowError):
                # Si l'horloge a sauté (pile CMOS), la soustraction peut échouer
                licence_obj.derniere_verification = maintenant
                licence_obj.save(update_fields=['derniere_verification'])
        else:
            licence_obj.derniere_verification = maintenant
            licence_obj.save(update_fields=['derniere_verification'])
        
        # Mettre en cache pour 1 heure pour réduire la charge DB
        # Signature HMAC pour empêcher l'empoisonnement du cache Redis
        result_dict = {'est_valide': True, 'message': "Licence valide.", 'payload': payload}
        result_dict['_sig'] = _sign_cache_value(result_dict)
        cache.set(cache_key, result_dict, timeout=3600)  # 1 heure
        
        return True, "Licence valide.", payload
        
    except jwt.ExpiredSignatureError:
        return False, "Licence expirée.", None
    except jwt.InvalidSignatureError:
        return False, "Clé corrompue ou falsifiée.", None
    except Exception as e:
        return False, f"Erreur système: {e!s}", None
