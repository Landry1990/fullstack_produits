# -*- coding: utf-8 -*-
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
    """Récupère le nom configuré de la pharmacie, ou un fallback par défaut."""
    from api.models.settings import PharmacySettings
    try:
        ps = PharmacySettings.objects.first()
        if ps and ps.pharmacy_name:
            return ps.pharmacy_name
    except Exception:
        pass
    return os.getenv('DEFAULT_PHARMACY_NAME', 'Ma Pharmacie')
