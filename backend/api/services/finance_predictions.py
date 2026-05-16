# -*- coding: utf-8 -*-
"""
Algorithmes de prédiction pour les statistiques financières.
"""
import statistics


def moving_average(data, window=3):
    """
    Moyenne mobile simple sur les N derniers points.
    """
    if len(data) >= window:
        last = data[-window:]
        ma = sum(last) / window
        return [round(ma, 0)] * 3
    avg = sum(data) / len(data) if data else 0
    return [round(avg, 0)] * 3


def linear_regression(data, steps=3):
    """
    Régression linéaire simple pour prédire les 'steps' prochaines valeurs.
    """
    if len(data) < 2:
        return moving_average(data, 3)

    n = len(data)
    x_mean = (n - 1) / 2
    y_mean = sum(data) / n

    numerator = sum((i - x_mean) * (data[i] - y_mean) for i in range(n))
    denominator = sum((i - x_mean) ** 2 for i in range(n))

    slope = numerator / denominator if denominator != 0 else 0
    intercept = y_mean - slope * x_mean

    predictions = []
    for i in range(steps):
        pred = intercept + slope * (n + i)
        predictions.append(max(0, round(pred, 0)))
    return predictions


def combined_prediction(ma_preds, lr_preds):
    """
    Combine les prédictions MA et RL par moyenne.
    """
    return [
        round((ma_preds[i] + lr_preds[i]) / 2, 0)
        for i in range(len(ma_preds))
    ]


def compute_trend(data):
    """
    Détermine la tendance : 'hausse', 'baisse', 'stable'.
    """
    if len(data) < 3:
        return 'stable'
    recent = data[-3:]
    older = data[-6:-3] if len(data) >= 6 else data[:3]
    recent_avg = sum(recent) / len(recent)
    older_avg = sum(older) / len(older) if older else recent_avg

    if recent_avg > older_avg * 1.05:
        return 'hausse'
    if recent_avg < older_avg * 0.95:
        return 'baisse'
    return 'stable'


def compute_confidence(data):
    """
    Calcule la confiance basée sur le coefficient de variation.
    Retourne: 'haute', 'moyenne', 'faible'.
    """
    if len(data) < 3:
        return 'faible'
    try:
        stdev = statistics.stdev(data)
        mean = statistics.mean(data)
        cv = (stdev / mean * 100) if mean > 0 else 0
        if cv < 15:
            return 'haute'
        if cv < 30:
            return 'moyenne'
        return 'faible'
    except statistics.StatisticsError:
        return 'moyenne'
