import jwt
import hashlib
import subprocess
import os
from datetime import datetime, timedelta
from django.utils import timezone
from api.models.licence import Licence

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
        payload = jwt.decode(licence_obj.cle, CLE_PUBLIQUE, algorithms=["RS256"])

        # Vérifier si c'est une licence à vie (pas de champ 'exp')
        if 'exp' not in payload:
            return True, payload, None, True  # Licence à vie

        # Calculer les jours restants
        exp_timestamp = payload['exp']
        exp_date = datetime.utcfromtimestamp(exp_timestamp)
        now = datetime.utcnow()

        if now >= exp_date:
            return False, payload, 0, False  # Expirée

        days_remaining = (exp_date - now).days
        return True, payload, days_remaining, False

    except jwt.ExpiredSignatureError:
        return False, None, 0, False
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
        return cached_result['est_valide'], cached_result['message'], cached_result['payload']

    licence_obj = Licence.objects.last()
    if not licence_obj:
        return False, "Aucune licence installée.", None
        
    try:
        # 1. Décryptage (Vérifie la signature ET la date d'expiration 'exp')
        payload = jwt.decode(licence_obj.cle, CLE_PUBLIQUE, algorithms=["RS256"])
        
        # 2. Anti-Clonage (Empreinte Matérielle)
        # Optimisation: Mettre en cache l'ID matériel (il ne change jamais)
        hw_cache_key = "system_hardware_id"
        hw_id = cache.get(hw_cache_key)
        if not hw_id:
            hw_id = get_hardware_id()
            cache.set(hw_cache_key, hw_id, timeout=86400) # Cache 24h
            
        if payload.get('hardware_id') != "ANY" and payload.get('hardware_id') != hw_id:
            return False, "Matériel non reconnu (Clonage détecté).", None
            
        # 3. Anti-Fraude Temporelle
        maintenant = timezone.now()
        if maintenant < licence_obj.derniere_verification:
            return False, "L'horloge système a été reculée (Fraude !).", None
            
        # Mise à jour de la dernière date connue (limitée à une fois par heure pour éviter les row locks continus)
        if (maintenant - licence_obj.derniere_verification).total_seconds() > 3600:
            licence_obj.derniere_verification = maintenant
            licence_obj.save(update_fields=['derniere_verification'])
        
        # Mettre en cache pour 1 heure pour réduire la charge DB
        # Le middleware vérifie le JWT localement entre les vérifications DB
        result_dict = {'est_valide': True, 'message': "Licence valide.", 'payload': payload}
        cache.set(cache_key, result_dict, timeout=3600)  # 1 heure
        
        return True, "Licence valide.", payload
        
    except jwt.ExpiredSignatureError:
        return False, "Licence expirée.", None
    except jwt.InvalidSignatureError:
        return False, "Clé corrompue ou falsifiée.", None
    except Exception as e:
        return False, f"Erreur système: {str(e)}", None
