import io
import csv
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from django.http import HttpResponse

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.graphics.barcode import code128

from ...models import Produit, Rayon, Forme, Groupe

class ProduitExportMixin:
    """Mixin pour les exports CSV et génération PDF/Etiquettes des produits."""

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
        response.write(u'\ufeff'.encode('utf8'))
        
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
            
        return response

    @action(detail=False, methods=['post'])
    def generate_labels(self, request):
        products_data = request.data.get('products', [])
        if not products_data:
            return Response({'error': 'No products provided'}, status=status.HTTP_400_BAD_REQUEST)

        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=letter)
        w, h = letter
        
        col_width = w / 3
        row_height = h / 8
        margin = 10
        
        x = 0
        y = h - row_height
        
        for item in products_data:
            try:
                produit = Produit.objects.get(pk=item.get('id'))
                qty = item.get('quantity', 1)
                
                for _ in range(qty):
                    c.rect(x + margin, y + margin, col_width - 2*margin, row_height - 2*margin)
                    c.setFont("Helvetica-Bold", 10)
                    c.drawString(x + margin + 5, y + row_height - margin - 15, produit.name[:25])
                    c.setFont("Helvetica-Bold", 14)
                    c.drawRightString(x + col_width - margin - 5, y + row_height - margin - 15, f"{produit.selling_price:.0f} F")
                    
                    code_value = produit.cip1 or str(produit.id).zfill(8)
                    barcode = code128.Code128(code_value, barHeight=20, barWidth=1.2)
                    barcode.drawOn(c, x + margin + 10, y + margin + 15)
                    
                    c.setFont("Helvetica", 8)
                    c.drawCentredString(x + col_width/2, y + margin + 5, code_value)
                    
                    x += col_width
                    if x >= w - 10:
                        x = 0
                        y -= row_height
                        
                    if y < 0:
                        c.showPage()
                        y = h - row_height
                        x = 0
                        
            except Produit.DoesNotExist:
                continue
                
        c.save()
        buffer.seek(0)
        
        response = HttpResponse(buffer, content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename="etiquettes.pdf"'
        return response
