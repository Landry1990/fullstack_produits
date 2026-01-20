from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, F, DecimalField, Q
from django.utils import timezone
from datetime import datetime
from decimal import Decimal
from api.models import Facture, FactureProduitAllocation, Caisse, FactureProduit


class RapportViewSet(viewsets.ViewSet):
    """
    API endpoint pour les rapports mensuels.
    """
    permission_classes = [IsAuthenticated]

    def _get_rapport_data(self, date_debut, date_fin, mois_str):
        """
        Méthode helper pour calculer toutes les données du rapport.
        Retourne un dictionnaire prêt à être sérialisé ou utilisé pour le PDF.
        """
        # 1. Récupérer les factures du mois (validées ou payées)
        factures = Facture.objects.filter(
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
            date__gte=date_debut,
            date__lt=date_fin
        ).prefetch_related('produits', 'produits__produit')
        
        # 2. Calculer CA TTC et HT
        ca_ttc = Decimal('0.00')
        ca_ht = Decimal('0.00')
        nb_ventes = factures.count()
        
        for facture in factures:
            ca_ttc += facture.total_ttc
            # Soustraire la remise du HT pour être cohérent avec le TTC
            ca_ht += (facture.total_ht - facture.remise)
        
        # 3. Calculer marge via allocations FIFO
        allocations = FactureProduitAllocation.objects.filter(
            facture_produit__facture__in=factures
        )
        
        cout_achat_total = Decimal('0.00')
        for alloc in allocations:
            cout_achat_total += alloc.cost_price * alloc.quantity
        
        marge_brute = ca_ht - cout_achat_total
        marge_pct = (marge_brute / ca_ht * 100) if ca_ht > 0 else Decimal('0.00')
        
        # 4. Encaissements réels effectués pendant le mois
        encaissements = Caisse.objects.filter(
            date_paiement__gte=date_debut,
            date_paiement__lt=date_fin,
            statut='completee'
        ).exclude(
            mode_paiement='en_compte'
        ).values('mode_paiement').annotate(
            total=Sum('montant')
        ).order_by('-total')
        
        encaissements_data = [
            {
                'mode': enc['mode_paiement'],
                'mode_label': dict(Caisse.MODES_PAIEMENT).get(enc['mode_paiement'], enc['mode_paiement']),
                'montant': enc['total']
            }
            for enc in encaissements
        ]
        
        # 5. Créances à percevoir (GLOBAL : toutes les factures avec reste à payer)
        # Alignement avec CreanceViewSet : inclure VALIDEE et PAYEE
        factures_avec_reste = Facture.objects.filter(
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).prefetch_related('paiements')
        
        total_creances = Decimal('0.00')
        nb_factures_impayees = 0
        for f in factures_avec_reste:
            # Somme des paiements reçus (exclure en_compte, inclure uniquement les paiements completee)
            paye = f.paiements.filter(statut='completee').exclude(mode_paiement='en_compte').aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
            reste = f.total_ttc - paye
            if reste > 0:
                total_creances += reste
                nb_factures_impayees += 1
        
        # 6. CA par taux de TVA (avec répartition proportionnelle)
        ca_par_tva_stats = {} 
        for facture in factures:
            facture_ttc_brut = Decimal('0.00')
            lignes_stats = {}
            for ligne in facture.produits.all():
                taux = ligne.tva
                montant_ligne_ttc = Decimal(str(ligne.quantity)) * Decimal(str(ligne.selling_price))
                if taux not in lignes_stats: lignes_stats[taux] = Decimal('0.00')
                lignes_stats[taux] += montant_ligne_ttc
                facture_ttc_brut += montant_ligne_ttc
            
            remise_facture = facture.remise
            for taux, montant_ttc_brut in lignes_stats.items():
                ratio = montant_ttc_brut / facture_ttc_brut if facture_ttc_brut > 0 else Decimal('0.00')
                part_remise = remise_facture * ratio
                ttc_net = montant_ttc_brut - part_remise
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

        ca_par_tva = []
        for taux in sorted(ca_par_tva_stats.keys(), reverse=True):
            stats = ca_par_tva_stats[taux]
            ca_par_tva.append({
                'taux': float(taux),
                'ca_ht': stats['ca_ht'],
                'montant_tva': stats['montant_tva'],
                'ca_ttc': stats['ca_ttc']
            })

        # 7. Achats par fournisseur (Commandes - Avoirs)
        from api.models import Commande, Avoir
        
        # A. Commandes validées (Entrées)
        commandes_mois = Commande.objects.filter(
            date__gte=date_debut,
            date__lt=date_fin,
            status='CLOT'
        )
        achats_stats = {}
        for commande in commandes_mois:
            if not commande.fournisseur: continue
            fid = commande.fournisseur.id
            if fid not in achats_stats:
                achats_stats[fid] = {
                    'fournisseur_id': fid,
                    'fournisseur_nom': commande.fournisseur.name,
                    'montant_total': Decimal('0.00'),
                    'nb_commandes': 0,
                    'nb_avoirs': 0,
                    'montant_avoirs': Decimal('0.00')
                }
            # Utiliser le coût effectif (avec UG) ou le prix d'achat simple ? 
            # Pour stats finacières: Montant facture fournisseur = Qty * Price
            cout_cmd = sum(cp.quantity * cp.price for cp in commande.produits.all())
            achats_stats[fid]['montant_total'] += cout_cmd
            achats_stats[fid]['nb_commandes'] += 1
            
        # B. Avoirs validés (Retours)
        # Convertir les datetime en date pour la comparaison si nécessaire, 
        # mais Django gère généralement bien la comparaison DateTime vs Date
        avoirs_mois = Avoir.objects.filter(
            date__gte=date_debut.date(),
            date__lt=date_fin.date(),
            status='VALIDEE'
        )
        
        for avoir in avoirs_mois:
            if not avoir.fournisseur: continue
            fid = avoir.fournisseur.id
            if fid not in achats_stats:
                # Cas rare: Avoir sans commande ce mois-ci
                achats_stats[fid] = {
                    'fournisseur_id': fid,
                    'fournisseur_nom': avoir.fournisseur.name,
                    'montant_total': Decimal('0.00'),
                    'nb_commandes': 0,
                    'nb_avoirs': 0,
                    'montant_avoirs': Decimal('0.00')
                }
            
            # Calcul montant HT de l'avoir
            montant_avoir = avoir.total_ht
            
            # Soustraire du total (Net Purchases)
            achats_stats[fid]['montant_total'] -= montant_avoir
            achats_stats[fid]['montant_avoirs'] += montant_avoir
            achats_stats[fid]['nb_avoirs'] += 1
            
        achats_par_fournisseur = sorted(achats_stats.values(), key=lambda x: x['montant_total'], reverse=True)

        # 8. Clients Pro - Aligned with créances calculation
        factures_pro = factures.filter(client__client_type='PROFESSIONNEL').prefetch_related('paiements')
        ca_pro_total = sum(f.total_ttc for f in factures_pro)
        
        # Calculate paid amount using same logic as créances
        montant_paye_pro = Decimal('0.00')
        for f in factures_pro:
            paye = f.paiements.filter(statut='completee').exclude(mode_paiement='en_compte').aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
            montant_paye_pro += paye
        
        reste_a_payer_pro = ca_pro_total - montant_paye_pro
        taux_recouvrement_pro = (montant_paye_pro / ca_pro_total * 100) if ca_pro_total > 0 else Decimal('0.00')
        
        clients_pro_stats = {}
        for f in factures_pro:
            cid = f.client.id
            if cid not in clients_pro_stats:
                clients_pro_stats[cid] = {'client_id': cid, 'client_nom': f.client.name, 'ca_total': Decimal('0.00'), 'montant_paye': Decimal('0.00')}
            clients_pro_stats[cid]['ca_total'] += f.total_ttc
            # Same logic as créances - filter by statut='completee' and exclude 'en_compte'
            paye_f = f.paiements.filter(statut='completee').exclude(mode_paiement='en_compte').aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
            clients_pro_stats[cid]['montant_paye'] += paye_f
            
        top_clients_pro = []
        for c in clients_pro_stats.values():
            c['reste_a_payer'] = c['ca_total'] - c['montant_paye']
            top_clients_pro.append(c)
        top_clients_pro.sort(key=lambda x: x['reste_a_payer'], reverse=True)  # Sort by reste_a_payer instead
        top_clients_pro = top_clients_pro[:10]

        # 9. UG
        from api.models import CommandeProduit
        commandes_produits_ug = CommandeProduit.objects.filter(
            commande__date__gte=date_debut,
            commande__date__lt=date_fin,
            commande__status='CLOT',
            unites_gratuites__gt=0
        )
        valeur_ug_total = Decimal('0.00')
        qty_ug_total = 0
        ug_par_produit = {}
        for cp in commandes_produits_ug:
            qty_gratuite = cp.unites_gratuites
            valeur = qty_gratuite * cp.produit.selling_price
            valeur_ug_total += valeur
            qty_ug_total += qty_gratuite
            pid = cp.produit.id
            if pid not in ug_par_produit: ug_par_produit[pid] = {'produit_id': pid, 'produit_nom': cp.produit.name, 'quantite_gratuite': 0, 'valeur_totale': Decimal('0.00')}
            ug_par_produit[pid]['quantite_gratuite'] += qty_gratuite
            ug_par_produit[pid]['valeur_totale'] += valeur
        
        top_ug = sorted(ug_par_produit.values(), key=lambda x: x['valeur_totale'], reverse=True)[:10]
        pct_ug_du_ca = (valeur_ug_total / ca_ttc * 100) if ca_ttc > 0 else Decimal('0.00')

        # 10. Mouvements Caisse
        from api.models import MouvementCaisse
        mouvements = MouvementCaisse.objects.filter(date__gte=date_debut, date__lt=date_fin).select_related('user')
        total_entrees_caisse = Decimal('0.00')
        total_sorties_caisse = Decimal('0.00')
        mouvements_data = []
        for mvt in mouvements:
            if mvt.type == 'ENTREE': total_entrees_caisse += mvt.montant
            else: total_sorties_caisse += mvt.montant
            mouvements_data.append({
                'id': mvt.id, 'date': mvt.date, 'type': mvt.type, 
                'montant': mvt.montant, 'motif': mvt.motif, 
                'user': mvt.user.get_full_name() if mvt.user else 'Inconnu'
            })

        return {
            'mois': mois_str,
            'periode': {
                'debut': date_debut.isoformat(),
                'fin': date_fin.isoformat()
            },
            'ca': {
                'ca_ttc': ca_ttc,
                'ca_ht': ca_ht,
                'nb_ventes': nb_ventes
            },
            'marge': {
                'cout_achat': cout_achat_total,
                'marge_brute': marge_brute,
                'marge_pct': round(marge_pct, 2)
            },
            'encaissements': encaissements_data,
            'creances_a_percevoir': total_creances,
            'creances': {
                'total': total_creances,
                'nb_factures': nb_factures_impayees
            },
            'ca_par_tva': ca_par_tva,
            'achats_par_fournisseur': achats_par_fournisseur,
            'clients_professionnels': {
                'ca_total': ca_pro_total,
                'montant_paye': montant_paye_pro,
                'reste_a_payer': reste_a_payer_pro,
                'taux_recouvrement_pct': round(taux_recouvrement_pro, 2),
                'nb_factures': factures_pro.count(),
                'top_clients': top_clients_pro
            },
            'unites_gratuites': {
                'valeur_totale': valeur_ug_total,
                'quantite_totale': qty_ug_total,
                'pct_du_ca': round(pct_ug_du_ca, 2),
                'nb_produits_distincts': len(ug_par_produit),
                'top_produits': top_ug
            },
            'mouvements_caisse': {
                'total_entrees': total_entrees_caisse,
                'total_sorties': total_sorties_caisse,
                'solde': total_entrees_caisse - total_sorties_caisse,
                'liste': mouvements_data
            }
        }

    @action(detail=False, methods=['get'])
    def rapport_mensuel(self, request):
        mois = request.query_params.get('mois')
        if not mois: return Response({'detail': 'Mois requis'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            date_debut = datetime.strptime(f"{mois}-01", '%Y-%m-%d')
            if date_debut.month == 12: date_fin = date_debut.replace(year=date_debut.year + 1, month=1, day=1)
            else: date_fin = date_debut.replace(month=date_debut.month + 1, day=1)
            date_debut = timezone.make_aware(date_debut)
            date_fin = timezone.make_aware(date_fin)
        except ValueError: return Response({'detail': 'Format mois invalide'}, status=status.HTTP_400_BAD_REQUEST)
        
        data = self._get_rapport_data(date_debut, date_fin, mois)
        return Response(data)

    @action(detail=False, methods=['get'])
    def rapport_mensuel_pdf(self, request):
        """
        Génère le PDF du rapport mensuel.
        """
        mois = request.query_params.get('mois')
        if not mois: return Response({'detail': 'Mois requis'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            date_debut = datetime.strptime(f"{mois}-01", '%Y-%m-%d')
            if date_debut.month == 12: date_fin = date_debut.replace(year=date_debut.year + 1, month=1, day=1)
            else: date_fin = date_debut.replace(month=date_debut.month + 1, day=1)
            date_debut = timezone.make_aware(date_debut)
            date_fin = timezone.make_aware(date_fin)
        except ValueError: return Response({'detail': 'Format mois invalide'}, status=status.HTTP_400_BAD_REQUEST)
        
        # 1. Calculer les données
        data = self._get_rapport_data(date_debut, date_fin, mois)
        
        # 2. Générer le PDF COMPACT (une seule page)
        from django.http import HttpResponse
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import cm, mm
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.lib.enums import TA_CENTER, TA_RIGHT
        from io import BytesIO
        from api.pdf_utils import (
            get_pharma_styles, draw_pharma_header, draw_pharma_footer,
            format_currency, PharmaColors
        )
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=15, leftMargin=15,
            topMargin=80, bottomMargin=40  # Marges réduites
        )
        
        story = []
        styles = get_pharma_styles()
        
        # Style compact pour les titres de section
        compact_title = ParagraphStyle(
            'CompactTitle',
            fontSize=9,
            fontName='Helvetica-Bold',
            textColor=PharmaColors.GREEN,
            spaceAfter=3,
            spaceBefore=6,
        )
        
        # Style de tableau compact
        def compact_table_style():
            return [
                ('BACKGROUND', (0, 0), (-1, 0), PharmaColors.GREEN),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 8),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 7),
                ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 2),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
                ('LEFTPADDING', (0, 0), (-1, -1), 4),
                ('RIGHTPADDING', (0, 0), (-1, -1), 4),
                ('GRID', (0, 0), (-1, -1), 0.5, PharmaColors.GRAY_LIGHT),
            ]
        
        # Titre principal
        story.append(Paragraph(
            f"<b>RAPPORT MENSUEL - {datetime.strptime(mois, '%Y-%m').strftime('%B %Y').upper()}</b>",
            ParagraphStyle('MainTitle', fontSize=12, fontName='Helvetica-Bold', 
                          textColor=PharmaColors.GREEN, alignment=TA_CENTER, spaceAfter=8)
        ))
        
        # === SECTION 1: KPIs PRINCIPAUX (Ligne horizontale) ===
        kpi_data = [[
            f"CA TTC\n{format_currency(data['ca']['ca_ttc'])}",
            f"CA HT\n{format_currency(data['ca']['ca_ht'])}",
            f"Marge ({data['marge']['marge_pct']}%)\n{format_currency(data['marge']['marge_brute'])}",
            f"Ventes\n{data['ca']['nb_ventes']}",
            f"Créances\n{format_currency(data['creances']['total'])}"
        ]]
        t_kpi = Table(kpi_data, colWidths=[3.5*cm, 3.5*cm, 3.5*cm, 2.5*cm, 3.5*cm])
        t_kpi.setStyle([
            ('BACKGROUND', (0, 0), (-1, -1), PharmaColors.GREEN_LIGHT),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOX', (0, 0), (-1, -1), 1, PharmaColors.GREEN),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, PharmaColors.GREEN),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ])
        story.append(t_kpi)
        story.append(Spacer(1, 6))
        
        # === LAYOUT 2 COLONNES ===
        # Colonne gauche: Encaissements + Mouvements
        # Colonne droite: TVA + Fournisseurs
        
        # Encaissements
        story.append(Paragraph("Encaissements", compact_title))
        enc_rows = [['Mode', 'Montant']]
        for enc in data['encaissements'][:4]:  # Limiter à 4 lignes max
            enc_rows.append([enc['mode_label'], format_currency(enc['montant'])])
        total_enc = sum(e['montant'] for e in data['encaissements'])
        enc_rows.append(['TOTAL', format_currency(total_enc)])
        t_enc = Table(enc_rows, colWidths=[5*cm, 3*cm])
        t_enc.setStyle(compact_table_style())
        story.append(t_enc)
        story.append(Spacer(1, 4))
        
        # Mouvements Caisse (si existants)
        if data['mouvements_caisse']['total_entrees'] > 0 or data['mouvements_caisse']['total_sorties'] > 0:
            story.append(Paragraph("Mouvements Caisse", compact_title))
            mvt_data = [
                ['Entrées', format_currency(data['mouvements_caisse']['total_entrees'])],
                ['Sorties', format_currency(data['mouvements_caisse']['total_sorties'])],
                ['Solde', format_currency(data['mouvements_caisse']['solde'])]
            ]
            t_mvt = Table(mvt_data, colWidths=[5*cm, 3*cm])
            t_mvt.setStyle(compact_table_style())
            story.append(t_mvt)
            story.append(Spacer(1, 4))
        
        # TVA
        story.append(Paragraph("Analyse TVA", compact_title))
        tva_rows = [['Taux', 'HT', 'TVA', 'TTC']]
        for t in data['ca_par_tva']:
            tva_rows.append([
                f"{t['taux']}%",
                format_currency(t['ca_ht']),
                format_currency(t['montant_tva']),
                format_currency(t['ca_ttc'])
            ])
        t_tva = Table(tva_rows, colWidths=[2*cm, 4*cm, 3*cm, 4*cm])
        t_tva.setStyle(compact_table_style())
        story.append(t_tva)
        story.append(Spacer(1, 4))
        
        # Fournisseurs (Top 3)
        if data['achats_par_fournisseur']:
            story.append(Paragraph("Top 3 Fournisseurs", compact_title))
            achats_rows = [['Fournisseur', 'Cmd', 'Montant']]
            for a in data['achats_par_fournisseur'][:3]:
                achats_rows.append([
                    a['fournisseur_nom'][:20],  # Tronquer le nom
                    str(a['nb_commandes']),
                    format_currency(a['montant_total'])
                ])
            t_achats = Table(achats_rows, colWidths=[6*cm, 1.5*cm, 3.5*cm])
            t_achats.setStyle(compact_table_style())
            story.append(t_achats)
            story.append(Spacer(1, 4))
        
        # Clients Pro (résumé compact)
        pro_data = data['clients_professionnels']
        if pro_data['ca_total'] > 0:
            story.append(Paragraph("Clients Professionnels", compact_title))
            p_rows = [
                ['CA Pro', format_currency(pro_data['ca_total']), 'Payé', format_currency(pro_data['montant_paye'])],
                ['Reste', format_currency(pro_data['reste_a_payer']), 'Taux', f"{pro_data['taux_recouvrement_pct']}%"]
            ]
            t_pro = Table(p_rows, colWidths=[2.5*cm, 4*cm, 2.5*cm, 4*cm])
            t_pro.setStyle(compact_table_style())
            story.append(t_pro)
        
        # Build PDF
        doc.build(
            story,
            onFirstPage=lambda c, d: [draw_pharma_header(c, d, title="RAPPORT"), draw_pharma_footer(c, d)],
            onLaterPages=lambda c, d: [draw_pharma_header(c, d, title="RAPPORT"), draw_pharma_footer(c, d)]
        )
        
        pdf = buffer.getvalue()
        buffer.close()
        
        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="rapport_mensuel_{mois}.pdf"'
        response.write(pdf)
        return response

