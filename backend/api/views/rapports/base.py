from datetime import timedelta
from decimal import Decimal

from django.db.models import (
    DecimalField,
    Max,
    Min,
    Q,
    Sum,
    Value,
)
from django.db.models.functions import Coalesce

from api.models import (
    Caisse,
    CommandeProduit,
    CouponMonnaie,
    Facture,
    MouvementCaisse,
)


class RapportBaseMixin:
    """
    Méthodes utilitaires de calcul partagées entre les différents domaines de rapports.
    """
    
    def _get_factures_periode(self, date_debut, date_fin):
        return Facture.objects.filter(
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
            is_active=True,
            date__gte=date_debut,
            date__lt=date_fin
        ).prefetch_related('produits', 'produits__produit', 'paiements')

    def _calculate_ca_stats(self, factures):
        from api.services.ventes_lots import collect_sales_records

        # CA hors produits divers (lot is_divers ou fournisseur divers en repli)
        records = collect_sales_records(invoices=factures)
        pharma = [r for r in records if not r['is_divers']]
        remises_lignes = sum((r['discount'] * r['qte'] for r in pharma), Decimal('0.00'))

        ca_stats = factures.aggregate(
            total_remises_global=Coalesce(Sum('remise'), Decimal('0.00')),
            total_remises_fidelite=Coalesce(Sum('montant_fidelite'), Decimal('0.00')),
            part_client=Coalesce(Sum('part_client'), Decimal('0.00'))
        )

        ca_ttc = sum((r['vente'] for r in pharma), Decimal('0.00'))
        ca_ht = sum((r['vente_ht'] for r in pharma), Decimal('0.00'))

        return {
            'ca_ttc': ca_ttc,
            'ca_ht': ca_ht,
            'total_remises': (
                ca_stats['total_remises_global'] +
                ca_stats['total_remises_fidelite'] +
                remises_lignes
            ),
            'total_remises_detail': {
                'global': ca_stats['total_remises_global'],
                'fidelite': ca_stats['total_remises_fidelite'],
                'lignes': remises_lignes,
            },
            'part_assurance': ca_ttc - ca_stats['part_client'],
            'part_client': ca_stats['part_client'],
            'nb_ventes': factures.count()
        }

    def _calculate_margin(self, factures):
        from api.services.margin_service import MarginService
        
        # Get date range from factures
        date_debut = factures.aggregate(min_date=Min('date'))['min_date']
        date_fin = factures.aggregate(max_date=Max('date'))['max_date']
        
        if not date_debut or not date_fin:
            return {
                'cout_achat': Decimal('0.00'),
                'marge_brute': Decimal('0.00'),
                'marge_pct': 0.0
            }
        
        # Use centralized margin calculation with discounts
        margin_stats = MarginService.calculate_period_margin_with_discounts(
            date_debut=date_debut,
            date_fin=date_fin + timedelta(days=1),  # Make it exclusive
            factures_qs=factures,
            exclude_is_divers=True  # Monthly reports exclude is_divers
        )
        
        return {
            'cout_achat': margin_stats['cout_achat_total'],
            'marge_brute': margin_stats['marge_brute'],
            'marge_pct': float(margin_stats['marge_pct'])
        }

    def _calculate_encaissements(self, date_debut, date_fin, factures):
        recouvrement_q = Q(mode_paiement='recouvrement') | Q(reference__icontains='[RECOUV]')
        encaissements_qs = Caisse.objects.filter(
            date_paiement__gte=date_debut,
            date_paiement__lt=date_fin,
            statut='completee'
        ).exclude(
            recouvrement_q | Q(mode_paiement__in=['en_compte', 'coupon', 'depot'])
        ).values('mode_paiement').annotate(total=Sum('montant'))
        
        results_map = {enc['mode_paiement']: enc['total'] for enc in encaissements_qs}
        modes_a_afficher = ['especes', 'momo', 'om', 'carte', 'virement', 'cheque']
        encaissements_data = []
        caisse_modes_dict = dict(Caisse.MODES_PAIEMENT)
        
        for m in modes_a_afficher:
            encaissements_data.append({
                'mode': m,
                'mode_label': caisse_modes_dict.get(m, m.replace('_', ' ').title()),
                'montant': results_map.get(m, Decimal('0.00'))
            })
            
        for m_code, m_total in results_map.items():
            if m_code not in modes_a_afficher:
                encaissements_data.append({
                    'mode': m_code,
                    'mode_label': caisse_modes_dict.get(m_code, m_code),
                    'montant': m_total
                })

        recouvrements_total = Caisse.objects.filter(
            recouvrement_q,
            date_paiement__gte=date_debut, date_paiement__lt=date_fin,
            statut='completee'
        ).aggregate(total=Sum('montant'))['total'] or Decimal('0.00')

        ventes_credit = Caisse.objects.filter(
            date_paiement__gte=date_debut, date_paiement__lt=date_fin,
            statut='completee', mode_paiement='en_compte'
        ).aggregate(total=Sum('montant'))['total'] or Decimal('0.00')

        depots_total = Caisse.objects.filter(
            date_paiement__gte=date_debut, date_paiement__lt=date_fin,
            statut='completee', mode_paiement='depot'
        ).aggregate(total=Sum('montant'))['total'] or Decimal('0.00')

        coupons_total = CouponMonnaie.objects.filter(
            facture_utilisation__in=factures, status='UTILISE'
        ).aggregate(total=Sum('montant'))['total'] or Decimal('0.00')
        
        return {
            'encaissements': encaissements_data,
            'recouvrements_total': recouvrements_total,
            'ventes_credit': ventes_credit,
            'depots_total': depots_total,
            'coupons_total': coupons_total
        }

    def _calculate_creances(self):
        # Stock global des créances ; non limité à la période du rapport.
        from api.services.ventes_lots import collect_sales_records, factures_retenues

        base = factures_retenues()
        divers_par_facture = {}
        for r in collect_sales_records(invoices=base):
            if r['is_divers']:
                divers_par_facture[r['facture_id']] = (
                    divers_par_facture.get(r['facture_id'], Decimal('0.00')) + r['vente']
                )

        stats = base.values('id', 'total_ttc').annotate(
            paid_amount=Coalesce(
                Sum('paiements__montant', filter=Q(paiements__statut='completee') & ~Q(paiements__mode_paiement='en_compte')),
                Value(0, output_field=DecimalField())
            ),
        )
        total = Decimal('0.00')
        nb_factures = 0
        for f in stats:
            reste = (f['total_ttc'] or Decimal('0.00')) - divers_par_facture.get(f['id'], Decimal('0.00')) - f['paid_amount']
            if reste > Decimal('0.5'):
                total += reste
                nb_factures += 1
        return {'total': total, 'nb_factures': nb_factures}

    def _calculate_ca_par_tva(self, factures):
        from api.services.ventes_lots import collect_sales_records

        # Ventilation par taux de TVA, hors produits divers
        # (lot is_divers ou fournisseur divers en repli), remises réparties.
        ca_par_tva_stats = {}
        for r in collect_sales_records(invoices=factures):
            if r['is_divers']:
                continue
            taux = r['tva']
            if taux not in ca_par_tva_stats:
                ca_par_tva_stats[taux] = {
                    'ca_ht': Decimal('0.00'), 'montant_tva': Decimal('0.00'), 'ca_ttc': Decimal('0.00'),
                }
            ca_par_tva_stats[taux]['ca_ttc'] += r['vente']
            ca_par_tva_stats[taux]['ca_ht'] += r['vente_ht']
            ca_par_tva_stats[taux]['montant_tva'] += r['vente'] - r['vente_ht']

        return [
            {
                'taux': float(t),
                'ca_ht': s['ca_ht'].quantize(Decimal('0.01')),
                'montant_tva': s['montant_tva'].quantize(Decimal('0.01')),
                'ca_ttc': s['ca_ttc'],
            }
            for t, s in sorted(ca_par_tva_stats.items(), key=lambda x: x[0], reverse=True)
        ]

    def _calculate_achats_fournisseurs(self, date_debut, date_fin):
        from api.models import Avoir, Commande
        achats_stats = {}
        for c in Commande.objects.filter(
            date__gte=date_debut, date__lt=date_fin, status='CLOT',
            is_active=True, fournisseur__is_active=True
        ).exclude(type='DIV').prefetch_related('produits'):
            if not c.fournisseur: continue
            fid = c.fournisseur.id
            if fid not in achats_stats:
                achats_stats[fid] = {'fournisseur_id': fid, 'fournisseur_nom': c.fournisseur.name, 'montant_total': Decimal('0.00'), 'nb_commandes': 0, 'nb_avoirs': 0, 'montant_avoirs': Decimal('0.00')}
            achats_stats[fid]['montant_total'] += sum(cp.quantity * cp.price for cp in c.produits.all())  # type: ignore[attr-defined]
            achats_stats[fid]['nb_commandes'] += 1

        for a in Avoir.objects.filter(
            date__gte=date_debut.date(), date__lt=date_fin.date(), status='VALIDEE',
            is_active=True, fournisseur__is_active=True
        ):
            if not a.fournisseur: continue
            fid = a.fournisseur.id
            if fid not in achats_stats:
                achats_stats[fid] = {'fournisseur_id': fid, 'fournisseur_nom': a.fournisseur.name, 'montant_total': Decimal('0.00'), 'nb_commandes': 0, 'nb_avoirs': 0, 'montant_avoirs': Decimal('0.00')}
            achats_stats[fid]['montant_total'] -= a.total_ht
            achats_stats[fid]['montant_avoirs'] += a.total_ht
            achats_stats[fid]['nb_avoirs'] += 1
        return sorted(achats_stats.values(), key=lambda x: x['montant_total'], reverse=True)

    def _calculate_clients_pro(self, factures):
        pro_factures = factures.filter(
            client__client_type='PROFESSIONNEL',
            client__is_active=True
        )

        # CA hors produits divers (lot is_divers ou fournisseur divers en repli)
        from api.services.ventes_lots import collect_sales_records
        divers_par_facture = {}
        for r in collect_sales_records(invoices=pro_factures):
            if r['is_divers']:
                divers_par_facture[r['facture_id']] = (
                    divers_par_facture.get(r['facture_id'], Decimal('0.00')) + r['vente']
                )

        billing_stats = pro_factures.values('id', 'client__id', 'client__name', 'total_ttc')
        clients_map = {}
        for f in billing_stats:
            cid = f['client__id']
            entry = clients_map.setdefault(cid, {
                'client__id': cid, 'client__name': f['client__name'],
                'total_billed': Decimal('0.00'), 'nb_factures': 0,
            })
            entry['total_billed'] += (f['total_ttc'] or Decimal('0.00')) - divers_par_facture.get(f['id'], Decimal('0.00'))
            entry['nb_factures'] += 1
        billing_stats = clients_map.values()
        payments_map = {p['facture__client__id']: p['total_paid'] for p in Caisse.objects.filter(facture__in=pro_factures, statut='completee').exclude(mode_paiement='en_compte').values('facture__client__id').annotate(total_paid=Sum('montant'))}
        
        results = []
        ca_total = paid_total = 0
        for b in billing_stats:
            cid, billed, paid = b['client__id'], b['total_billed'] or 0, payments_map.get(b['client__id'], 0)
            ca_total += billed; paid_total += paid
            results.append({'client_id': cid, 'client_nom': b['client__name'], 'ca_total': billed, 'montant_paye': paid, 'reste_a_payer': billed - paid})
        
        results.sort(key=lambda x: x['reste_a_payer'], reverse=True)
        return {'ca_total': ca_total, 'montant_paye': paid_total, 'reste_a_payer': ca_total - paid_total, 'taux_recouvrement_pct': round(paid_total/ca_total*100, 2) if ca_total > 0 else 0, 'nb_factures': sum(b['nb_factures'] for b in billing_stats), 'top_clients': results[:10]}

    def _calculate_unites_gratuites(self, date_debut, date_fin):
        ugs = CommandeProduit.objects.filter(
            commande__date__gte=date_debut, commande__date__lt=date_fin,
            commande__status='CLOT', commande__is_active=True,
            unites_gratuites__gt=0
        ).exclude(commande__type='DIV').select_related('produit')
        total_val = sum(cp.unites_gratuites * cp.produit.selling_price for cp in ugs)
        ug_map = {}
        for cp in ugs:
            pid = cp.produit.id
            if pid not in ug_map: ug_map[pid] = {'produit_id': pid, 'produit_nom': cp.produit.name, 'quantite_gratuite': 0, 'valeur_totale': Decimal('0.00')}
            ug_map[pid]['quantite_gratuite'] += cp.unites_gratuites
            ug_map[pid]['valeur_totale'] += cp.unites_gratuites * cp.produit.selling_price
        return {'valeur_totale': total_val, 'quantite_totale': sum(cp.unites_gratuites for cp in ugs), 'pct_du_ca': 0, 'nb_produits_distincts': len(ug_map), 'top_produits': sorted(ug_map.values(), key=lambda x: x['valeur_totale'], reverse=True)[:10]}

    def _calculate_mouvements_caisse(self, date_debut, date_fin):
        mvts = MouvementCaisse.objects.filter(date__gte=date_debut, date__lt=date_fin).select_related('user')
        total_e = sum(m.montant for m in mvts if m.type == 'ENTREE')
        total_s = sum(m.montant for m in mvts if m.type == 'SORTIE')
        return {'total_entrees': total_e, 'total_sorties': total_s, 'solde': total_e - total_s, 'liste': [{'id': m.id, 'date': m.date, 'type': m.type, 'montant': m.montant, 'motif': m.motif, 'user': m.user.get_full_name() if m.user else 'Inconnu'} for m in mvts]}

    def _get_rapport_data(self, date_debut, date_fin, mois_str):
        """
        Méthode principale de calcul (Orchestration).
        """
        factures = self._get_factures_periode(date_debut, date_fin)
        ca_stats = self._calculate_ca_stats(factures)
        marge = self._calculate_margin(factures)
        encaissements = self._calculate_encaissements(date_debut, date_fin, factures)
        creances = self._calculate_creances()
        ca_par_tva = self._calculate_ca_par_tva(factures)
        achats = self._calculate_achats_fournisseurs(date_debut, date_fin)
        clients_pro = self._calculate_clients_pro(factures)
        ug = self._calculate_unites_gratuites(date_debut, date_fin)
        mouvements = self._calculate_mouvements_caisse(date_debut, date_fin)

        if ca_stats['ca_ttc'] > 0:
            ug['pct_du_ca'] = round((ug['valeur_totale'] / ca_stats['ca_ttc'] * 100), 2)

        return {
            'mois': mois_str,
            'periode': {'debut': date_debut.isoformat(), 'fin': date_fin.isoformat()},
            'ca': ca_stats, 'marge': marge,
            'encaissements': encaissements['encaissements'],
            'recouvrements_total': encaissements['recouvrements_total'],
            'ventes_credit': encaissements['ventes_credit'],
            'coupons_total': encaissements['coupons_total'],
            'creances_a_percevoir': creances['total'],
            'creances': {'total': creances['total'], 'nb_factures': creances['nb_factures']},
            'depots_total': encaissements['depots_total'],
            'ca_par_tva': ca_par_tva,
            'achats_par_fournisseur': achats,
            'clients_professionnels': clients_pro,
            'unites_gratuites': ug,
            'mouvements_caisse': mouvements
        }
