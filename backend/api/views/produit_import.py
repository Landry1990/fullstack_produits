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
        from django.db import transaction
        
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
            
            # Précharger tous les produits existants en mémoire pour un matching ultra-rapide (O(1))
            # Évite d'exécuter 3 requêtes SELECT par ligne du CSV (soit 12 000+ requêtes SQL pour 4000 lignes !)
            existing_products = list(Produit.objects.all())
            
            by_cip1 = {p.cip1: p for p in existing_products if p.cip1}
            by_cip2 = {p.cip2: p for p in existing_products if p.cip2}
            by_cip3 = {p.cip3: p for p in existing_products if p.cip3}
            by_name = {p.name.lower().strip(): p for p in existing_products if p.name}
            
            # Utiliser une transaction atomique pour grouper les écritures (20x plus rapide sur PostgreSQL)
            with transaction.atomic():
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
                        
                        # Rechercher le produit existant en mémoire (O(1))
                        produit = None
                        
                        # 1. Chercher par CIP1, CIP2 ou CIP3
                        if cip1 and cip1 in by_cip1:
                            produit = by_cip1[cip1]
                        elif cip2 and cip2 in by_cip2:
                            produit = by_cip2[cip2]
                        elif cip3 and cip3 in by_cip3:
                            produit = by_cip3[cip3]
                        
                        # 2. Si pas trouvé par CIP, chercher par nom exact (insensible à la casse)
                        if not produit and nom.lower().strip() in by_name:
                            produit = by_name[nom.lower().strip()]
                        
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
                            new_produit = Produit.objects.create(
                                name=nom,
                                cost_price=prix_achat_decimal,
                                selling_price=prix_vente_decimal,
                                tva=tva_decimal,
                                cip1=cip1,
                                cip2=cip2,
                                cip3=cip3,
                                stock=quantite_int  # Stock initial = quantité du CSV
                            )
                            # Mettre à jour nos index en mémoire pour éviter les doublons au sein du même CSV
                            if cip1:
                                by_cip1[cip1] = new_produit
                            if cip2:
                                by_cip2[cip2] = new_produit
                            if cip3:
                                by_cip3[cip3] = new_produit
                            by_name[nom.lower().strip()] = new_produit
                            
                            created_count += 1
                            
                    except Exception as e:
                        errors.append(f"Ligne {row_num}: {str(e)}")
                        continue
            
            # Rapport final
            return Response({
                'success': True,
                'created': created_count,
                'imported': created_count,  # Clé additionnelle pour assurer la compatibilité frontend
                'updated': updated_count,
                'errors': errors,
                'total_processed': created_count + updated_count,
                'message': f"{created_count} produits créés, {updated_count} mis à jour."
            })
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({
                'error': f'Erreur lors du traitement du fichier: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
