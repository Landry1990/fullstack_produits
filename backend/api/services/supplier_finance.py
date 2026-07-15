import calendar
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import DecimalField, F, OuterRef, Subquery, Sum, Value
from django.db.models.functions import Coalesce

from api.models import Commande, CommandeProduit, PaiementFournisseur


def annotate_supplier_debt(queryset):
    commandes_total = CommandeProduit.objects.filter(
        commande__fournisseur=OuterRef('pk'),
        commande__status=Commande.Status.CLOTUREE,
        commande__is_active=True,
    ).values('commande__fournisseur').annotate(
        total=Sum(F('quantity') * F('price_cost'), output_field=DecimalField())
    ).values('total')
    paiements_total = PaiementFournisseur.objects.filter(
        fournisseur=OuterRef('pk')
    ).values('fournisseur').annotate(
        total=Sum('montant', output_field=DecimalField())
    ).values('total')

    return queryset.annotate(
        total_du_annotated=Coalesce(
            Subquery(commandes_total[:1], output_field=DecimalField()),
            Value(Decimal('0.00'), output_field=DecimalField()),
        ),
        total_paye_annotated=Coalesce(
            Subquery(paiements_total[:1], output_field=DecimalField()),
            Value(Decimal('0.00'), output_field=DecimalField()),
        ),
    ).annotate(solde_dette_annotated=F('total_du_annotated') - F('total_paye_annotated'))


def payment_status(days_remaining):
    if days_remaining < 0:
        return 'EN RETARD'
    if days_remaining == 0:
        return "AUJOURD'HUI"
    return 'À VENIR'


def statement_periods(year, month, period_days):
    _, last_day = calendar.monthrange(year, month)
    periods = []
    day = 1
    while day <= last_day:
        end_day = min(day + period_days - 1, last_day)
        periods.append((date(year, month, day), date(year, month, end_day)))
        day = end_day + 1
    return periods


def get_closed_orders(fournisseur_ids):
    order_total = CommandeProduit.objects.filter(
        commande=OuterRef('pk')
    ).values('commande').annotate(
        total=Sum(F('quantity') * F('price_cost'), output_field=DecimalField())
    ).values('total')[:1]

    return Commande.objects.filter(
        fournisseur_id__in=fournisseur_ids,
        status=Commande.Status.CLOTUREE,
        is_active=True,
    ).annotate(
        total_value=Coalesce(
            Subquery(order_total, output_field=DecimalField()),
            Value(Decimal('0.00'), output_field=DecimalField()),
        )
    ).order_by('date_cloture', 'id')


def get_payments_by_supplier(fournisseur_ids):
    payments = PaiementFournisseur.objects.filter(
        fournisseur_id__in=fournisseur_ids
    ).values('fournisseur_id').annotate(
        total=Sum('montant', output_field=DecimalField())
    )
    return {
        payment['fournisseur_id']: payment['total'] or Decimal('0.00')
        for payment in payments
    }


def build_supplier_schedule(fournisseurs):
    fournisseurs = list(fournisseurs)
    if not fournisseurs:
        return []

    today = date.today()
    fournisseur_ids = [fournisseur.id for fournisseur in fournisseurs]
    orders_by_supplier = defaultdict(list)
    for order in get_closed_orders(fournisseur_ids):
        orders_by_supplier[order.fournisseur_id].append(order)
    payments_by_supplier = get_payments_by_supplier(fournisseur_ids)

    deadlines = []
    for fournisseur in fournisseurs:
        orders = orders_by_supplier.get(fournisseur.id, [])
        if not orders:
            continue
        total_paid = payments_by_supplier.get(fournisseur.id, Decimal('0.00'))
        if fournisseur.type_reglement == 'RELEVE':
            deadlines.extend(_build_statement_deadlines(fournisseur, orders, total_paid, today))
        else:
            deadlines.extend(_build_invoice_deadlines(fournisseur, orders, total_paid, today))

    return sorted(deadlines, key=lambda deadline: deadline['jours_restants'])


def build_supplier_detailed_schedule(fournisseur):
    orders = list(get_closed_orders([fournisseur.id]))
    if not orders:
        return []
    total_paid = get_payments_by_supplier([fournisseur.id]).get(fournisseur.id, Decimal('0.00'))
    today = date.today()
    if fournisseur.type_reglement == 'RELEVE':
        return _build_statement_deadlines(fournisseur, orders, total_paid, today, detailed=True)
    return _build_invoice_deadlines(fournisseur, orders, total_paid, today, detailed=True)


def build_supplier_statement(fournisseur, start_date=None, end_date=None):
    orders = get_closed_orders([fournisseur.id])
    total_paid = get_payments_by_supplier([fournisseur.id]).get(fournisseur.id, Decimal('0.00'))
    remaining_payment = total_paid
    invoices = []
    total_remaining = Decimal('0.00')

    for order in orders:
        total_order = order.total_value
        if remaining_payment >= total_order:
            remaining_payment -= total_order
            continue

        paid_amount = remaining_payment
        remaining_amount = total_order - paid_amount
        remaining_payment = Decimal('0.00')
        closed_date = order.date_cloture.date() if order.date_cloture else None
        if (start_date and (not closed_date or closed_date < start_date)) or (
            end_date and (not closed_date or closed_date > end_date)
        ):
            continue

        total_remaining += remaining_amount
        invoices.append({
            'id': order.id,
            'numero_facture': order.numero_facture or f'CMD-{order.id}',
            'date_cloture': order.date_cloture.isoformat() if order.date_cloture else None,
            'montant': float(remaining_amount),
            'montant_total': float(total_order),
            'montant_paye': float(paid_amount),
            'montant_reste': float(remaining_amount),
        })

    return invoices, total_remaining


def _build_invoice_deadlines(fournisseur, orders, total_paid, today, detailed=False):
    remaining_payment = total_paid
    deadlines = []
    for order in orders:
        total_order = order.total_value
        if remaining_payment >= total_order:
            remaining_payment -= total_order
            continue
        amount_due = total_order - remaining_payment
        paid_amount = remaining_payment
        remaining_payment = Decimal('0.00')
        base_date = order.date_cloture.date() if order.date_cloture else today
        deadline_date = base_date + timedelta(days=fournisseur.delai_paiement_jours)
        days_remaining = (deadline_date - today).days
        deadline = {
            'fournisseur_id': fournisseur.id,
            'fournisseur_nom': fournisseur.name,
            'type_reglement': 'FACTURE',
            'commande_id': order.id,
            'numero_facture': order.numero_facture or f'CMD-{order.id}',
            'montant_total': float(total_order),
            'montant_paye': float(paid_amount),
            'montant_reste': float(amount_due),
            'date_echeance': deadline_date.isoformat(),
            'jours_restants': days_remaining,
            'status': payment_status(days_remaining),
        }
        if not detailed:
            deadline['montant_du'] = float(amount_due)
        deadlines.append(deadline)
    return deadlines


def _build_statement_deadlines(fournisseur, orders, total_paid, today, detailed=False):
    period_days = max(fournisseur.periode_releve_jours, 1)
    months = set()
    for order in orders:
        order_date = order.date_cloture.date() if order.date_cloture else today
        months.add((order_date.year, order_date.month))

    periods = []
    for year, month in sorted(months):
        periods.extend(statement_periods(year, month, period_days))
    totals = {period: Decimal('0.00') for period in periods}
    for order in orders:
        order_date = order.date_cloture.date() if order.date_cloture else today
        for period in periods:
            if period[0] <= order_date <= period[1]:
                totals[period] += order.total_value
                break

    remaining_payment = total_paid
    deadlines = []
    for period in periods:
        total_period = totals[period]
        if total_period <= Decimal('0.00'):
            continue
        if remaining_payment >= total_period:
            remaining_payment -= total_period
            continue
        amount_due = total_period - remaining_payment
        paid_amount = remaining_payment
        remaining_payment = Decimal('0.00')
        deadline_date = period[1] + timedelta(days=fournisseur.delai_paiement_jours)
        days_remaining = (deadline_date - today).days
        deadline = {
            'fournisseur_id': fournisseur.id,
            'fournisseur_nom': fournisseur.name,
            'type_reglement': 'RELEVE',
            'numero_facture': f"Relevé {period[0].strftime('%d/%m')}→{period[1].strftime('%d/%m/%Y')}",
            'montant_total': float(total_period),
            'montant_paye': float(paid_amount),
            'montant_reste': float(amount_due),
            'date_echeance': deadline_date.isoformat(),
            'jours_restants': days_remaining,
            'status': payment_status(days_remaining),
        }
        if detailed:
            deadline['status'] = payment_status(days_remaining)
        else:
            deadline.update({
                'commande_id': None,
                'montant_du': float(amount_due),
                'periode_jours': period_days,
                'date_fin_tranche': period[1].isoformat(),
            })
        deadlines.append(deadline)
    return deadlines
