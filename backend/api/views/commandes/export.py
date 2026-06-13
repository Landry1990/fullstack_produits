"""
Export des commandes fournisseurs avec gestion des CIP
- Permet de choisir entre CIP1 (principal) et CIP3 (secondaire)
- Génère un fichier texte avec les produits sans CIP
"""
import csv
import io
from datetime import datetime
from django.http import HttpResponse, JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from api.models import Commande, CommandeProduit, Produit, Fournisseur


class ExportCommandeView(APIView):
    """
    Exporte une commande au format CSV avec choix du CIP
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, commande_id):
        """
        Paramètres:
        - cip_field: 'cip1' ou 'cip3' (défaut: cip1)
        - format: 'csv' ou 'txt' (défaut: csv)
        """
        cip_field = request.query_params.get('cip_field', 'cip1')
        export_format = request.query_params.get('format', 'csv')
        
        if cip_field not in ['cip1', 'cip3']:
            return JsonResponse(
                {'error': 'cip_field doit être cip1 ou cip3'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            commande = Commande.objects.select_related('fournisseur').get(id=commande_id)
        except Commande.DoesNotExist:
            return JsonResponse(
                {'error': 'Commande non trouvée'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Récupérer les lignes de commande avec les produits
        lignes = CommandeProduit.objects.filter(
            commande=commande
        ).select_related('produit')
        
        # Séparer les produits avec et sans CIP
        produits_avec_cip = []
        produits_sans_cip = []
        
        for ligne in lignes:
            produit = ligne.produit
            cip_value = getattr(produit, cip_field, None)
            
            if cip_value:
                produits_avec_cip.append({
                    'cip': cip_value,
                    'libelle': produit.libelle or produit.name,
                    'quantite': ligne.quantity,
                    'unites_gratuites': ligne.unites_gratuites or 0,
                    'prix': ligne.price,
                })
            else:
                produits_sans_cip.append({
                    'libelle': produit.libelle or produit.name,
                    'quantite': ligne.quantity,
                    'unites_gratuites': ligne.unites_gratuites or 0,
                })
        
        # Générer la réponse
        if export_format == 'txt' and produits_sans_cip:
            # Fichier texte avec les produits sans CIP
            return self._generate_txt_file(produits_sans_cip, commande, cip_field)
        else:
            # Fichier CSV avec les produits ayant le CIP
            return self._generate_csv_file(produits_avec_cip, produits_sans_cip, commande, cip_field)
    
    def _generate_csv_file(self, produits_avec_cip, produits_sans_cip, commande, cip_field):
        """Génère un fichier CSV avec les produits"""
        output = io.StringIO()
        writer = csv.writer(output, delimiter=';', quoting=csv.QUOTE_MINIMAL)
        
        # En-tête
        cip_label = 'CIP1' if cip_field == 'cip1' else 'CIP3'
        writer.writerow([cip_label, 'Libellé', 'Quantité', 'UG', 'Prix'])
        writer.writerow([])  # Ligne vide
        
        # Données
        for produit in produits_avec_cip:
            writer.writerow([
                produit['cip'],
                produit['libelle'],
                produit['quantite'],
                produit['unites_gratuites'],
                produit['prix']
            ])
        
        # Section des produits sans CIP
        if produits_sans_cip:
            writer.writerow([])
            writer.writerow(['--- PRODUITS SANS CIP ---'])
            writer.writerow(['Libellé', 'Quantité', 'UG'])
            for produit in produits_sans_cip:
                writer.writerow([
                    produit['libelle'],
                    produit['quantite'],
                    produit['unites_gratuites']
                ])
        
        # Préparer la réponse
        output.seek(0)
        response = HttpResponse(
            output.getvalue(),
            content_type='text/csv; charset=utf-8-sig'
        )
        
        filename = f"commande_{commande.id}_{cip_field}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        return response
    
    def _generate_txt_file(self, produits_sans_cip, commande, cip_field):
        """Génère un fichier texte avec les produits sans CIP"""
        lines = []
        lines.append(f"Commande #{commande.id} - Fournisseur: {commande.fournisseur.name}")
        lines.append(f"Date: {datetime.now().strftime('%d/%m/%Y %H:%M')}")
        lines.append(f"CIP demandé: {'CIP1' if cip_field == 'cip1' else 'CIP3'}")
        lines.append("")
        lines.append("PRODUITS SANS CIP (à saisir manuellement):")
        lines.append("=" * 60)
        lines.append("")
        
        for i, produit in enumerate(produits_sans_cip, 1):
            lines.append(f"{i}. {produit['libelle']}")
            lines.append(f"   Quantité: {produit['quantite']}")
            if produit['unites_gratuites'] > 0:
                lines.append(f"   UG: {produit['unites_gratuites']}")
            lines.append("")
        
        content = "\n".join(lines)
        
        response = HttpResponse(
            content,
            content_type='text/plain; charset=utf-8'
        )
        
        filename = f"commande_{commande.id}_sans_{cip_field}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        return response


class ExportCommandePreviewView(APIView):
    """
    Preview de l'export avant téléchargement
    Retourne les statistiques et la liste des produits
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, commande_id):
        cip_field = request.query_params.get('cip_field', 'cip1')
        
        if cip_field not in ['cip1', 'cip3']:
            return JsonResponse(
                {'error': 'cip_field doit être cip1 ou cip3'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            commande = Commande.objects.select_related('fournisseur').get(id=commande_id)
        except Commande.DoesNotExist:
            return JsonResponse(
                {'error': 'Commande non trouvée'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        lignes = CommandeProduit.objects.filter(
            commande=commande
        ).select_related('produit')
        
        produits_avec_cip = []
        produits_sans_cip = []
        
        for ligne in lignes:
            produit = ligne.produit
            cip_value = getattr(produit, cip_field, None)
            
            if cip_value:
                produits_avec_cip.append({
                    'id': produit.id,
                    'cip': cip_value,
                    'libelle': produit.libelle or produit.name,
                    'quantite': ligne.quantity,
                    'unites_gratuites': ligne.unites_gratuites or 0,
                })
            else:
                produits_sans_cip.append({
                    'id': produit.id,
                    'libelle': produit.libelle or produit.name,
                    'quantite': ligne.quantity,
                    'unites_gratuites': ligne.unites_gratuites or 0,
                })
        
        return JsonResponse({
            'commande_id': commande.id,
            'fournisseur': commande.fournisseur.name,
            'cip_field': cip_field,
            'cip_label': 'CIP1 (Principal)' if cip_field == 'cip1' else 'CIP3 (Secondaire)',
            'stats': {
                'total_produits': len(produits_avec_cip) + len(produits_sans_cip),
                'avec_cip': len(produits_avec_cip),
                'sans_cip': len(produits_sans_cip),
            },
            'produits_avec_cip': produits_avec_cip,
            'produits_sans_cip': produits_sans_cip,
        })
