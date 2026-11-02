import os


def format_currency(amount, symbol=None):
    """Formate un montant avec la devise configurée."""
    if symbol is None:
        from api.models.settings import PharmacySettings
        try:
            ps = PharmacySettings.objects.first()
            symbol = ps.currency_symbol if ps else 'FCFA'
        except Exception:
            symbol = 'FCFA'
    
    try:
        val = int(amount)
        # Format avec séparateur de milliers
        formatted_val = f"{val:,}".replace(',', ' ')
    except Exception:
        formatted_val = str(amount)
        
    return f"{formatted_val} {symbol}"

def get_pharmacy_name():
    """Récupère le nom de la pharmacie : licence active > paramètres > défaut.

    Le nom affiché sur les documents doit être celui de la licence
    (``pharmacie_nom``), comme dans ``PharmacySettingsSerializer``. Le champ
    ``PharmacySettings.pharmacy_name`` a 'ZENITH' (nom du logiciel) comme
    valeur par défaut : il n'est utilisé que s'il a été personnalisé.
    """
    try:
        from api.utils_licence import valider_licence_systeme
        valide, _msg, payload = valider_licence_systeme()
        if valide and payload and payload.get('pharmacie_nom'):
            return payload['pharmacie_nom']
    except Exception:
        pass
    from api.models.settings import PharmacySettings
    try:
        ps = PharmacySettings.objects.first()
        if ps and ps.pharmacy_name and ps.pharmacy_name != 'ZENITH':
            return ps.pharmacy_name
    except Exception:
        pass
    return os.getenv('DEFAULT_PHARMACY_NAME', 'Ma Pharmacie')
