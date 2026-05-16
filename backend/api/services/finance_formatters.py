# -*- coding: utf-8 -*-
"""
Utilitaires de formatage des données pour les graphiques Recharts.
"""
from dateutil.relativedelta import relativedelta

MONTH_NAMES_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
                  'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']


def build_monthly_labels(start_date, end_date):
    """
    Génère les labels mensuels au format 'Mmm AA' entre deux dates.
    """
    labels = []
    current = start_date
    while current <= end_date:
        labels.append(f"{MONTH_NAMES_FR[current.month - 1]} {current.year % 100}")
        current = current + relativedelta(months=1)
    return labels


def fill_monthly_series(data_map, start_date, end_date, default=0):
    """
    Remplit une série de données mensuelles en interpolant les valeurs manquantes.
    data_map: dict {YYYY-MM: value}
    Retourne: (labels, values)
    """
    labels = []
    values = []
    current = start_date
    while current <= end_date:
        key = current.strftime('%Y-%m')
        labels.append(f"{MONTH_NAMES_FR[current.month - 1]} {current.year % 100}")
        values.append(data_map.get(key, default))
        current = current + relativedelta(months=1)
    return labels, values


def build_prediction_labels(start_date, months=3):
    """
    Génère les labels pour les prédictions futures.
    """
    labels = []
    current = start_date
    for _ in range(months):
        labels.append(f"{MONTH_NAMES_FR[current.month - 1]} {current.year % 100}")
        current = current + relativedelta(months=1)
    return labels
