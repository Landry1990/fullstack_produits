import csv

from django.http import HttpResponse
from rest_framework.decorators import action

from ...audit_helpers import log_audit
from ...models import AuditLog, Forme, Groupe, Produit, Rayon


class ProduitExportMixin:
    """Mixin pour les exports CSV des produits."""

    @action(detail=False, methods=['get'])
    def export_csv(self, request):
        rayon_id = request.query_params.get('rayon')
        forme_id = request.query_params.get('forme')
        groupe_id = request.query_params.get('groupe')
        
        queryset = Produit.objects.all()
        parts = ["export"]
        
        if rayon_id:
            queryset = queryset.filter(rayon_id=rayon_id)
            try:
                rayon = Rayon.objects.get(id=rayon_id)
                parts.append(f"rayon_{rayon.name.replace(' ', '_')}")
            except Rayon.DoesNotExist: pass
        if forme_id:
            queryset = queryset.filter(forme_id=forme_id)
            try:
                forme = Forme.objects.get(id=forme_id)
                parts.append(f"forme_{forme.nom.replace(' ', '_')}")
            except Forme.DoesNotExist: pass
        if groupe_id:
            queryset = queryset.filter(groupe_id=groupe_id)
            try:
                groupe = Groupe.objects.get(id=groupe_id)
                parts.append(f"groupe_{groupe.nom.replace(' ', '_')}")
            except Groupe.DoesNotExist: pass
            
        filename = "_".join(parts) + ".csv"

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response.write('\ufeff'.encode('utf8'))
        
        writer = csv.writer(response, delimiter=';')
        writer.writerow(['ID', 'Nom', 'CIP1', 'Stock', 'Prix Achat', 'Prix Vente', 'TVA'])
        
        products = list(queryset[:5000])
        
        for p in products:
            writer.writerow([
                p.id,
                p.name,
                p.cip1 or '',
                str(p.stock).replace('.', ','),
                str(p.cost_price).replace('.', ','),
                str(p.selling_price).replace('.', ','),
                str(p.tva).replace('.', ',')
            ])

        log_audit(
            user=request.user, action=AuditLog.Action.EXPORT,
            model_name='Produit', object_id=0,
            description=f"Export CSV des produits ({len(products)} lignes) — {filename}",
            details={
                'count': len(products), 'filename': filename,
                'rayon_id': rayon_id, 'forme_id': forme_id, 'groupe_id': groupe_id,
            }, request=request
        )
        return response
