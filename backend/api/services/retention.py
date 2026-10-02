"""
Construction du plan de rétention des données.

Factorise le calcul des querysets/cutoffs partagé entre la commande
`run_retention` et l'endpoint `maintenance/retention_preview/`.

Chaque entrée du plan est un dict :
    key           identifiant stable (ex: 'audit_log', 'trash_produit')
    label         libellé affiché
    kind          'simple' (delete en masse) | 'trash' (corbeille, item par item sur PROTECT)
    queryset      queryset à compter/purger (None si résolution impossible)
    cutoff        datetime de coupure (affiché via .date())
    deferred      True = opt-in explicite (--include-stock-movements)
    model         modèle concerné (kind='trash')
    extra_filter  filtre additionnel (kind='trash', ex: statuts facture)
    msg           template de la ligne de comptage ({label}, {total}, {cutoff})
    deferred_msg  template affiché quand une entrée deferred n'est pas incluse ({total})
    skipped_msg   template du warning PROTECT (kind='trash', {skipped})
    warn          préfixe du warning en cas d'échec (entrées optionnelles)
    error         exception de résolution (queryset indisponible)
"""
from datetime import timedelta

from django.apps import apps

from ..models import (
    ActivityLog,
    AuditLog,
    Avoir,
    Client,
    Commande,
    Facture,
    Fournisseur,
    Inventaire,
    MouvementStock,
    Produit,
    Promis,
    SmsLog,
    TelegramLog,
    WhatsAppLog,
)

# Modèles concernés par le nettoyage de la corbeille (soft-delete :
# is_active=False + deleted_at). Facture est traitée à part car il faut en plus
# exclure les statuts comptablement protégés.
TRASH_MODELS = [Produit, Client, Fournisseur, Commande, Avoir, Inventaire, Promis]

SIMPLE_MSG = "  {label}: {total} ligne(s) antérieure(s) au {cutoff}"


def _axes_models():
    """Modèles django-axes disponibles (AccessLog / AccessFailureLog / AccessAttempt)."""
    models = []
    for name in ('AccessLog', 'AccessFailureLog', 'AccessAttempt'):
        try:
            model = apps.get_model('axes', name)
        except LookupError:
            continue
        if model is not None:
            models.append(model)
    return models


def build_retention_plan(pharmacy_settings, now):
    """
    Retourne la liste ordonnée des catégories de rétention avec leur queryset
    et leur cutoff, calculés depuis PharmacySettings et l'instant `now`.
    """
    plan = []

    def add(key, label, queryset, cutoff, kind='simple', deferred=False,
            model=None, extra_filter=None, msg=None, deferred_msg=None,
            skipped_msg=None, warn=None, error=None):
        plan.append({
            'key': key,
            'label': label,
            'kind': kind,
            'queryset': queryset,
            'cutoff': cutoff,
            'deferred': deferred,
            'model': model,
            'extra_filter': extra_filter,
            'msg': msg or SIMPLE_MSG,
            'deferred_msg': deferred_msg,
            'skipped_msg': skipped_msg,
            'warn': warn,
            'error': error,
        })

    # ── 1. Journaux techniques ───────────────────────────────────────
    cutoff = now - timedelta(days=pharmacy_settings.retention_audit_days)
    add('audit_log', 'AuditLog', AuditLog.objects.filter(timestamp__lt=cutoff), cutoff)

    cutoff = now - timedelta(days=pharmacy_settings.retention_activity_days)
    add('activity_log', 'ActivityLog', ActivityLog.objects.filter(timestamp__lt=cutoff), cutoff)

    cutoff = now - timedelta(days=pharmacy_settings.retention_message_log_days)
    add('sms_log', 'SmsLog', SmsLog.objects.filter(created_at__lt=cutoff), cutoff)
    add('whatsapp_log', 'WhatsAppLog', WhatsAppLog.objects.filter(created_at__lt=cutoff), cutoff)
    add('telegram_log', 'TelegramLog', TelegramLog.objects.filter(created_at__lt=cutoff), cutoff)

    # ── 2. Sessions Django expirées ──────────────────────────────────
    try:
        from django.contrib.sessions.models import Session
        add('session', 'Session (expirées)',
            Session.objects.filter(expire_date__lt=now), now,
            warn='Sessions Django: ignorées')
    except Exception as e:
        add('session', 'Session (expirées)', None, now,
            warn='Sessions Django: ignorées', error=e)

    # ── 3. Logs axes (brute-force) ───────────────────────────────────
    cutoff = now - timedelta(days=pharmacy_settings.retention_session_days)
    for model in _axes_models():
        add(f'axes_{model.__name__}', f'axes.{model.__name__}',
            model.objects.filter(attempt_time__lt=cutoff), cutoff,
            warn=f'axes.{model.__name__}: ignoré')

    # ── 4. Factures brouillon anciennes ──────────────────────────────
    # Statut BROU uniquement — les VALIDEE/PAYEE/ANNULEE ne sont JAMAIS purgées.
    cutoff = now - timedelta(days=pharmacy_settings.retention_draft_invoice_days)
    add('draft_invoices', 'Factures brouillon',
        Facture.objects.filter(status=Facture.Status.BROUILLON, date__lt=cutoff), cutoff)

    # ── 5. Corbeille (is_active=False depuis > retention_trash_days) ──
    cutoff = now - timedelta(days=pharmacy_settings.retention_trash_days)
    for model in TRASH_MODELS:
        add(f'trash_{model.__name__.lower()}', f'Corbeille {model.__name__}',
            model.objects.filter(is_active=False, deleted_at__lt=cutoff), cutoff,
            kind='trash', model=model,
            msg="  {label}: {total} élément(s) en corbeille depuis avant le {cutoff}",
            skipped_msg="    {skipped} élément(s) conservé(s) (encore référencés — PROTECT)")

    # Factures en corbeille : même garde-fou que la purge — whitelist
    # BROU/PROF uniquement, jamais de VALIDEE / PAYEE / ANNULEE
    # (traçabilité comptable).
    add('trash_facture', 'Corbeille Facture (BROU/PROF uniquement)',
        Facture.objects.filter(
            is_active=False,
            deleted_at__lt=cutoff,
            status__in=[Facture.Status.BROUILLON, Facture.Status.PROFORMA],
        ),
        cutoff, kind='trash', model=Facture,
        extra_filter={'status__in': [Facture.Status.BROUILLON, Facture.Status.PROFORMA]},
        msg="  {label}: {total} élément(s)",
        skipped_msg="    {skipped} facture(s) conservée(s) (encore référencées — PROTECT)")

    # ── 6. Mouvements de stock (opt-in explicite) ────────────────────
    cutoff = now - timedelta(days=pharmacy_settings.retention_mouvement_stock_days)
    add('stock_movements', 'MouvementStock',
        MouvementStock.objects.filter(date__lt=cutoff), cutoff,
        deferred=True,
        deferred_msg="  MouvementStock: {total} ligne(s) concernée(s) — ignorées "
                     "(utilisez --include-stock-movements pour les inclure)")

    return plan
