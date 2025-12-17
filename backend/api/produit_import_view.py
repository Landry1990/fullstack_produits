import csv
import io
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from api.models import Produit
from decimal import Decimal


class ProduitImportViewSet(viewsets.ViewSet):
    """
    ViewSet pour l'import CSV de produits.
    """
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'])
    def import_csv(self, request):
        """
        Importe des produits depuis un fichier CSV.
        Format attendu: cip1;cip2;cip3;nom;prix_achat;prix_vente;tva;quantite
        
        - CIP1, CIP2, CIP3 : optionnels
        - Nom, prix_achat, prix_vente, tva, quantite : obligatoires
        
        Logique:
        - Si le produit existe (match par CIP ou nom), mise à jour des prix et ajout de la quantité au stock
        - Sinon, création avec le stock initial = quantité
        """
        if 'file' not in request.FILES:
            return Response({
                'error': 'Aucun fichier fourni. Utilisez le champ "file".'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        uploaded_file = request.FILES['file']
        
        # Lire le fichier CSV
        try:
            # Décoder en UTF-8 avec fallback
            try:
                decoded_file = uploaded_file.read().decode('utf-8')
            except UnicodeDecodeError:
                uploaded_file.seek(0)
                decoded_file = uploaded_file.read().decode('latin-1')
            
            csv_reader = csv.DictReader(io.StringIO(decoded_file), delimiter=';')
            
            created_count = 0
            updated_count = 0
            errors = []
            
            for row_num, row in enumerate(csv_reader, start=2):  # start=2 car ligne 1 = en-têtes
                try:
                    # Validation des champs obligatoires
                    nom = row.get('nom', '').strip()
                    prix_achat = row.get('prix_achat', '').strip()
                    prix_vente = row.get('prix_vente', '').strip()
                    tva = row.get('tva', '').strip()
                    quantite = row.get('quantite', '').strip()
                    
                    if not nom:
                        errors.append(f"Ligne {row_num}: Le nom est obligatoire")
                        continue
                    if not prix_achat:
                        errors.append(f"Ligne {row_num}: Le prix d'achat est obligatoire")
                        continue
                    if not prix_vente:
                        errors.append(f"Ligne {row_num}: Le prix de vente est obligatoire")
                        continue
                    if not tva:
                        errors.append(f"Ligne {row_num}: La TVA est obligatoire")
                        continue
                    if not quantite:
                        errors.append(f"Ligne {row_num}: La quantité est obligatoire")
                        continue
                    
                    # Conversion des valeurs
                    try:
                        prix_achat_decimal = Decimal(prix_achat.replace(',', '.'))
                        prix_vente_decimal = Decimal(prix_vente.replace(',', '.'))
                        tva_decimal = Decimal(tva.replace(',', '.'))
                        quantite_int = int(quantite)
                    except (ValueError, TypeError) as e:
                        errors.append(f"Ligne {row_num}: Erreur de conversion des prix/TVA/quantité - {str(e)}")
                        continue
                    
                    # CIP optionnels
                    cip1 = row.get('cip1', '').strip() or None
                    cip2 = row.get('cip2', '').strip() or None
                    cip3 = row.get('cip3', '').strip() or None
                    
                    # Rechercher le produit existant
                    produit = None
                    
                    # 1. Chercher par CIP1, CIP2 ou CIP3
                    if cip1:
                        produit = Produit.objects.filter(cip1=cip1).first()
                    if not produit and cip2:
                        produit = Produit.objects.filter(cip2=cip2).first()
                    if not produit and cip3:
                        produit = Produit.objects.filter(cip3=cip3).first()
                    
                    # 2. Si pas trouvé par CIP, chercher par nom exact
                    if not produit:
                        produit = Produit.objects.filter(name__iexact=nom).first()
                    
                    # Mise à jour ou création
                    if produit:
                        # Mise à jour
                        produit.name = nom
                        produit.cost_price = prix_achat_decimal
                        produit.selling_price = prix_vente_decimal
                        produit.tva = tva_decimal
                        
                        # Ajouter la quantité au stock existant
                        produit.stock = (produit.stock or 0) + quantite_int
                        
                        # Mettre à jour les CIP s'ils sont fournis
                        if cip1:
                            produit.cip1 = cip1
                        if cip2:
                            produit.cip2 = cip2
                        if cip3:
                            produit.cip3 = cip3
                        
                        produit.save()
                        updated_count += 1
                    else:
                        # Création
                        produit = Produit.objects.create(
                            name=nom,
                            cost_price=prix_achat_decimal,
                            selling_price=prix_vente_decimal,
                            tva=tva_decimal,
                            cip1=cip1,
                            cip2=cip2,
                            cip3=cip3,
                            stock=quantite_int  # Stock initial = quantité du CSV
                        )
                        created_count += 1
                        
                except Exception as e:
                    errors.append(f"Ligne {row_num}: {str(e)}")
                    continue
            
            # Rapport final
            return Response({
                'success': True,
                'created': created_count,
                'updated': updated_count,
                'errors': errors,
                'total_processed': created_count + updated_count,
                'message': f"{created_count} produits créés, {updated_count} mis à jour."
            })
            
        except Exception as e:
            return Response({
                'error': f'Erreur lors du traitement du fichier: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
