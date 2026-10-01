"""Parsing robuste des entrées utilisateur (montants, entiers, booléens).

Chaque helper convertit une valeur brute de requête en type Python sûr et
lève ``rest_framework.exceptions.ValidationError`` (HTTP 400 avec un message
en français) au lieu de laisser une ``ValueError``/``InvalidOperation``
remonter en HTTP 500.

Note couche service : les services métier (``SaleFinalizer``, ``SaleModifier``…)
signalent leurs erreurs via ``ValueError`` — les appelants la convertissent en
HTTP 400. Dans ce contexte, rattraper la ``ValidationError`` et la re-lever en
``ValueError`` avec ``validation_error_message(exc)``.
"""

from decimal import Decimal, InvalidOperation

from rest_framework.exceptions import ValidationError

# Bornes hautes correspondant aux DecimalField du schéma
# (évite les DataError « numeric field overflow » → 500).
MAX_DECIMAL_12_2 = Decimal('9999999999.99')   # max_digits=12, decimal_places=2
MAX_DECIMAL_10_2 = Decimal('99999999.99')     # max_digits=10, decimal_places=2
MAX_DECIMAL_5_2 = Decimal('999.99')           # max_digits=5,  decimal_places=2
MAX_INT32 = 2147483647                        # IntegerField PostgreSQL


def _fail(message):
    raise ValidationError({'detail': message})


def validation_error_message(exc):
    """Retourne le premier message lisible d'une ValidationError DRF."""
    detail = getattr(exc, 'detail', exc)
    if isinstance(detail, dict):
        detail = next(iter(detail.values()), '')
    if isinstance(detail, (list, tuple)):
        detail = detail[0] if detail else ''
    return str(detail)


def parse_decimal(value, field='montant', min_value=None, max_value=None, allow_zero=True):
    """Convertit ``value`` en ``Decimal`` fini, avec bornes optionnelles.

    Accepte ``int``, ``float``, ``str`` et ``Decimal`` ; rejette les booléens,
    ``None``, NaN et ±Infinity. ``allow_zero=False`` rend la borne basse
    exclusive (utile pour « strictement positif »).

    Retourne un ``Decimal`` ou lève ``ValidationError`` (HTTP 400).
    """
    if value is None or isinstance(value, bool):
        _fail(f"Le champ {field} est invalide.")
    try:
        result = value if isinstance(value, Decimal) else Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError, ArithmeticError):
        _fail(f"Le champ {field} est invalide.")
    if not result.is_finite():
        # Decimal('NaN')/Decimal('Infinity') passent le cast mais explosent
        # ensuite (InvalidOperation) ou se persistent en numeric.
        _fail(f"Le champ {field} est invalide.")
    if min_value is not None:
        if allow_zero:
            if result < min_value:
                _fail(f"Le champ {field} doit être supérieur ou égal à {min_value}.")
        elif result <= min_value:
            _fail(f"Le champ {field} doit être supérieur à {min_value}.")
    if max_value is not None and result > max_value:
        _fail(f"Le champ {field} doit être inférieur ou égal à {max_value}.")
    return result


def parse_positive_decimal(value, field='montant', max_value=None):
    """Raccourci : ``Decimal`` fini strictement supérieur à 0."""
    return parse_decimal(value, field=field, min_value=Decimal(0),
                         max_value=max_value, allow_zero=False)


def parse_int(value, field='quantite', min_value=None, max_value=None):
    """Convertit ``value`` en ``int`` strict (entier uniquement).

    Rejette les booléens, ``None``, NaN, ±Infinity et tout non-entier
    (``'1.5'``, ``1.5``, ``Decimal('2.5')``…). Accepte ``int``, ``str``
    entière, ``Decimal`` entière et ``float`` entier (``3.0``).

    Retourne un ``int`` ou lève ``ValidationError`` (HTTP 400).
    """
    if value is None or isinstance(value, bool):
        _fail(f"Le champ {field} est invalide.")
    if isinstance(value, int):
        result = value
    else:
        try:
            dec = value if isinstance(value, Decimal) else Decimal(str(value))
        except (InvalidOperation, ValueError, TypeError, ArithmeticError):
            _fail(f"Le champ {field} est invalide.")
        if not dec.is_finite() or dec != dec.to_integral_value():
            _fail(f"Le champ {field} doit être un nombre entier valide.")
        try:
            result = int(dec)
        except (ValueError, TypeError, OverflowError):
            _fail(f"Le champ {field} est invalide.")
    if min_value is not None and result < min_value:
        _fail(f"Le champ {field} doit être supérieur ou égal à {min_value}.")
    if max_value is not None and result > max_value:
        _fail(f"Le champ {field} doit être inférieur ou égal à {max_value}.")
    return result


def parse_id(value, field='id', required=True):
    """Convertit ``value`` en id entier positif (>= 1) — pour les FK/pk de requête.

    Un id brut passé à l'ORM (``get(id='abc')``, ``filter(id__in=['x'])``)
    lève ``ValueError``/``TypeError`` → 500. Ici : ``ValidationError`` → 400.

    ``required=False`` retourne ``None`` sur valeur absente/vide au lieu de
    lever une erreur (paramètre de filtre optionnel).
    """
    if value is None or (isinstance(value, str) and not value.strip()):
        if not required:
            return None
        _fail(f"Le champ {field} est invalide.")
    return parse_int(value, field=field, min_value=1, max_value=MAX_INT32)


def parse_date_param(value, field='date'):
    """Parse une date ISO (``AAAA-MM-JJ`` ou datetime ISO) de requête.

    Retourne ``None`` si ``value`` est absent/vide (paramètre optionnel) ;
    lève ``ValidationError`` (400) si la chaîne fournie est invalide —
    une date invalide ne doit ni filtrer en 500 ni être ignorée
    silencieusement (résultats non filtrés trompeurs).
    """
    from django.utils.dateparse import parse_date, parse_datetime

    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    if not isinstance(value, str):
        _fail(f"Le paramètre '{field}' doit être une date au format AAAA-MM-JJ.")
    parsed = parse_date(value) or parse_datetime(value)
    if parsed is None:
        _fail(f"Date invalide pour '{field}' : '{value}'. Format attendu : AAAA-MM-JJ.")
    return parsed


def parse_bool(value, default=False):
    """Interprète les représentations booléennes usuelles.

    Évite le piège classique ``bool("false") == True`` : les chaînes
    ``'true'``/``'1'``/``'yes'``/``'on'``/``'oui'`` → ``True`` et
    ``'false'``/``'0'``/``'no'``/``'off'``/``'non'``/``''`` → ``False``.
    Toute autre chaîne retourne ``default``.
    """
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in ('true', '1', 'yes', 'on', 'oui'):
            return True
        if normalized in ('false', '0', 'no', 'off', 'non', ''):
            return False
        return default
    if isinstance(value, (int, float, Decimal)):
        return bool(value)
    return default
