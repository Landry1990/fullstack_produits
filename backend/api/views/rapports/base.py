from decimal import Decimal
from datetime import timedelta
from django.db.models import Sum, F, DecimalField, Q, Count, Value, Min, Max
from django.db.models.functions import Coalesce
from api.models import Facture, FactureProduit, FactureProduitAllocation, Caisse, CouponMonnaie, CommandeProduit, MouvementCaisse

class RapportBaseMixin:
    """
    Méthodes utilitaires de calcul partagées entre les différents domaines de rapports.
    """
    
    def _get_factures_periode(self, date_debut, date_fin):
        return Facture.objects.filter(
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
            date__gte=date_debut,
            date__lt=date_fin
        ).prefetch_related('produits', 'produits__produit', 'paiements')

    def _calculate_ca_stats(self, factures):
        from django.db.models import OuterRef, Subquery

        # Sous-requête pour calculer le montant des produits is_divers par facture
        divers_total_sub = FactureProduitAllocation.objects.filter(
            facture_produit__facture=OuterRef('pk'),
            stock_lot__is_divers=True
        ).values('facture_produit__facture').annotate(
            total_divers=Coalesce(
                Sum(F('selling_price') * F('quantity'), output_field=DecimalField()),
                Decimal('0.00')
            )
        ).values('total_divers')

        # Agréger les factures en excluant le montant is_divers
        factures_annotated = factures.annotate(
            divers_amount=Coalesce(
                Subquery(divers_total_sub, output_field=DecimalField()),
                Decimal('0.00')
            ),
            adjusted_ttc=F('total_ttc') - F('divers_amount'),
            adjusted_ht=F('total_ht') - F('divers_amount')
        )

        ca_stats = factures_annotated.aggregate(
            ca_ttc=Coalesce(Sum('adjusted_ttc'), Decimal('0.00')),
            ca_ht=Coalesce(Sum('adjusted_ht'), Decimal('0.00')),
            total_remises_global=Coalesce(Sum('remise'), Decimal('0.00')),
            total_remises_fidelite=Coalesce(Sum('montant_fidelite'), Decimal('0.00')),
            part_client=Coalesce(Sum('part_client'), Decimal('0.00'))
        )

        # Les remises lignes ne concernent que les produits non is_divers
        prod_stats = FactureProduit.objects.filter(
            facture__in=factures
        ).exclude(
            allocations__stock_lot__is_divers=True
        ).aggregate(
            total_remises_lignes=Coalesce(Sum(F('discount') * F('quantity'), output_field=DecimalField()), Decimal('0.00'))
        )

        return {
            'ca_ttc': ca_stats['ca_ttc'],
            'ca_ht': ca_stats['ca_ht'],
            'total_remises': (
                ca_stats['total_remises_global'] +
                ca_stats['total_remises_fidelite'] +
                prod_stats['total_remises_lignes']
            ),
            'total_remises_detail': {
                'global': ca_stats['total_remises_global'],
                'fidelite': ca_stats['total_remises_fidelite'],
                'lignes': prod_stats['total_remises_lignes'],
            },
            'part_assurance': ca_stats['ca_ttc'] - ca_stats['part_client'],
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
        # Sous-requête pour calculer le montant des produits is_divers par facture
        from django.db.models import OuterRef, Subquery

        divers_total_sub = FactureProduitAllocation.objects.filter(
            facture_produit__facture=OuterRef('pk'),
            stock_lot__is_divers=True
        ).values('facture_produit__facture').annotate(
            total_divers=Coalesce(
                Sum(F('selling_price') * F('quantity'), output_field=DecimalField()),
                Decimal('0.00')
            )
        ).values('total_divers')

        stats = Facture.objects.filter(
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).annotate(
            divers_amount=Coalesce(
                Subquery(divers_total_sub, output_field=DecimalField()),
                Decimal('0.00')
            ),
            adjusted_total=F('total_ttc') - F('divers_amount'),
            paid_amount=Coalesce(
                Sum('paiements__montant', filter=Q(paiements__statut='completee') & ~Q(paiements__mode_paiement='en_compte')),
                Value(0, output_field=DecimalField())
            ),
            reste=F('adjusted_total') - F('paid_amount')
        ).filter(reste__gt=0.5).aggregate(
            total=Coalesce(Sum('reste'), Decimal('0.00')),
            nb_factures=Count('id')
        )
        return {'total': stats['total'], 'nb_factures': stats['nb_factures']}

    def _calculate_ca_par_tva(self, factures):
        ca_par_tva_stats = {}
        lignes = FactureProduit.objects.filter(
            facture__in=factures
        ).exclude(
            allocations__stock_lot__is_divers=True
        ).values(
            'tva', 'facture__id', 'facture__remise'
        ).annotate(
            ligne_brut_ttc=Sum(F('quantity') * (F('selling_price') - Coalesce(F('discount'), Value(0, output_field=DecimalField()))), output_field=DecimalField())
        )
        
        from collections import defaultdict
        facture_totals = defaultdict(Decimal)
        for ligne in lignes:
            facture_totals[ligne['facture__id']] += ligne['ligne_brut_ttc']
            
        for ligne in lignes:
            taux = ligne['tva']
            ttc_net = ligne['ligne_brut_ttc'] - (ligne['facture__remise'] * (ligne['ligne_brut_ttc'] / facture_totals[ligne['facture__id']] if facture_totals[ligne['facture__id']] > 0 else Decimal('0.00')))
            if taux > 0:
                ht_net = (ttc_net / (1 + taux / Decimal('100.00'))).quantize(Decimal('0.01'))
                tva_montant = ttc_net - ht_net
            else:
                ht_net = ttc_net
                tva_montant = Decimal('0.00')
            if taux not in ca_par_tva_stats:
                ca_par_tva_stats[taux] = {'ca_ht': Decimal('0.00'), 'montant_tva': Decimal('0.00'), 'ca_ttc': Decimal('0.00')}
            ca_par_tva_stats[taux]['ca_ht'] += ht_net
            ca_par_tva_stats[taux]['montant_tva'] += tva_montant
            ca_par_tva_stats[taux]['ca_ttc'] += ttc_net

        return [{'taux': float(t), 'ca_ht': s['ca_ht'], 'montant_tva': s['montant_tva'], 'ca_ttc': s['ca_ttc']} for t, s in sorted(ca_par_tva_stats.items(), key=lambda x: x[0], reverse=True)]

    def _calculate_achats_fournisseurs(self, date_debut, date_fin):
        from api.models import Commande, Avoir
        achats_stats = {}
        for c in Commande.objects.filter(date__gte=date_debut, date__lt=date_fin, status='CLOT').exclude(type='DIV').prefetch_related('produits'):
            if not c.fournisseur: continue
            fid = c.fournisseur.id
            if fid not in achats_stats:
                achats_stats[fid] = {'fournisseur_id': fid, 'fournisseur_nom': c.fournisseur.name, 'montant_total': Decimal('0.00'), 'nb_commandes': 0, 'nb_avoirs': 0, 'montant_avoirs': Decimal('0.00')}
            achats_stats[fid]['montant_total'] += sum(cp.quantity * cp.price for cp in c.produits.all())  # type: ignore[attr-defined]
            achats_stats[fid]['nb_commandes'] += 1
            
        for a in Avoir.objects.filter(date__gte=date_debut.date(), date__lt=date_fin.date(), status='VALIDEE'):
            if not a.fournisseur: continue
            fid = a.fournisseur.id
            if fid not in achats_stats:
                achats_stats[fid] = {'fournisseur_id': fid, 'fournisseur_nom': a.fournisseur.name, 'montant_total': Decimal('0.00'), 'nb_commandes': 0, 'nb_avoirs': 0, 'montant_avoirs': Decimal('0.00')}
            achats_stats[fid]['montant_total'] -= a.total_ht
            achats_stats[fid]['montant_avoirs'] += a.total_ht
            achats_stats[fid]['nb_avoirs'] += 1
        return sorted(achats_stats.values(), key=lambda x: x['montant_total'], reverse=True)

    def _calculate_clients_pro(self, factures):
        from django.db.models import OuterRef, Subquery

        pro_factures = factures.filter(client__client_type='PROFESSIONNEL')

        # Sous-requête pour exclure is_divers du CA des clients pro
        divers_total_sub = FactureProduitAllocation.objects.filter(
            facture_produit__facture=OuterRef('pk'),
            stock_lot__is_divers=True
        ).values('facture_produit__facture').annotate(
            total_divers=Coalesce(
                Sum(F('selling_price') * F('quantity'), output_field=DecimalField()),
                Decimal('0.00')
            )
        ).values('total_divers')

        pro_factures_annotated = pro_factures.annotate(
            divers_amount=Coalesce(
                Subquery(divers_total_sub, output_field=DecimalField()),
                Decimal('0.00')
            ),
            adjusted_ttc=F('total_ttc') - F('divers_amount')
        )

        billing_stats = pro_factures_annotated.values('client__id', 'client__name').annotate(total_billed=Sum('adjusted_ttc'), nb_factures=Count('id'))
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
        ugs = CommandeProduit.objects.filter(commande__date__gte=date_debut, commande__date__lt=date_fin, commande__status='CLOT', unites_gratuites__gt=0).exclude(commande__type='DIV').select_related('produit')
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
