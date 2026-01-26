import pandas as pd
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import status
from django.db import transaction
from ..models import Produit
import logging

logger = logging.getLogger(__name__)

class ProductImportView(APIView):
    """
    Import de produits depuis fichier CSV/Excel.
    
    Format attendu: cip1, cip2, cip3, libellé, cession, public
    
    Logique TVA:
    - Si public = 0 -> TVA = 19.25% (produits non remboursables/parapharmacie)
    - Si public > 0 -> TVA = 0% (médicaments remboursables)
    """
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, *args, **kwargs):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': "Aucun fichier fourni"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Determine file type and read with proper separator detection
            reader = None

            if file_obj.name.lower().endswith('.csv'):
                # Sniff logic without reading whole file
                sample = file_obj.read(4096)
                file_obj.seek(0)
                
                # Detect encoding
                encoding = 'utf-8'
                try:
                    sample.decode('utf-8')
                except UnicodeDecodeError:
                    encoding = 'latin-1'
                
                # Detect separator
                try:
                    decoded_sample = sample.decode(encoding)
                    first_line = decoded_sample.split('\n')[0]
                    separator = ';' if ';' in first_line else ','
                except:
                    separator = ',' # Fallback

                # Use chunksize for CSV to avoid OOM
                reader = pd.read_csv(file_obj, sep=separator, encoding=encoding, chunksize=1000)

            elif file_obj.name.lower().endswith(('.xls', '.xlsx')):
                # Excel doesn't support chunksize in same way, but files are usually smaller
                # We wrap it in a list to treat it as a single chunk
                df = pd.read_excel(file_obj)
                reader = [df]
            else:
                return Response({'error': "Format non supporté. Utilisez CSV ou Excel."}, status=status.HTTP_400_BAD_REQUEST)

            created_count = 0
            updated_count = 0
            errors = []

            chunk_num = 0

            for df_chunk in reader:
                chunk_num += 1
                df = df_chunk
                
                # Normalize columns: remove whitespace, lowercase, remove accents
                df.columns = df.columns.str.strip().str.lower()
                # Handle accented characters in column names
                df.columns = df.columns.str.replace('é', 'e').str.replace('è', 'e').str.replace('ê', 'e')
                
                # Map pharmacy terminology to model fields
                column_mapping = {
                    # Name variations
                    'designation': 'name', 'nom': 'name', 'libelle': 'name', 'produit': 'name',

                    # Selling Price (Prix Public) variations
                    'prix_public': 'selling_price', 'pp': 'selling_price', 'public': 'selling_price',
                    'prix_vente': 'selling_price', 'prix': 'selling_price', 'pv': 'selling_price',

                    # Cost Price (Prix Cession) variations
                    'prix_cession': 'cost_price', 'cession': 'cost_price', 'pc': 'cost_price',
                    'prix_achat': 'cost_price', 'mpa': 'cost_price', 'pa': 'cost_price', 'cout': 'cost_price',

                    # Stock variations
                    'stock_actuel': 'stock', 'qte': 'stock', 'quantite': 'stock', 'stock': 'stock',
                    
                    # CIP variations - Keep cip1, cip2, cip3 as is
                    'code_cip': 'cip1', 'cip': 'cip1', 'code': 'cip1',
                    
                    # TVCODE (UBIPHARM format: 0=no TVA, 2=TVA 19.25%)
                    'tvcode': 'tvcode',
                    
                    # Other fields
                    'tva': 'tva', 'taux_tva': 'tva',
                    'rayon': 'rayon', 'emplacement': 'rayon',
                    'fournisseur': 'fournisseur',
                    'date_peremption': 'expire_date', 'date_expiration': 'expire_date', 'exp': 'expire_date'
                }
                df.rename(columns=column_mapping, inplace=True)

                # Identification of required columns (Name is absolute, Price is critical)
                if 'name' not in df.columns:
                     if chunk_num == 1:
                        return Response({'error': "Colonne manquante: 'libellé', 'Désignation' ou 'Nom' du produit est requis."}, status=status.HTTP_400_BAD_REQUEST)
                     else:
                        continue # Should be consistent but skip if bad chunk

                # Check if we have at least cost_price (cession) - selling_price can be 0
                if 'cost_price' not in df.columns and 'selling_price' not in df.columns:
                     if chunk_num == 1:
                        return Response({'error': "Colonne manquante: 'cession' ou 'public' est requis."}, status=status.HTTP_400_BAD_REQUEST)
                     else:
                        continue

                # Clean numeric data
                if 'selling_price' in df.columns:
                    df['selling_price'] = pd.to_numeric(df['selling_price'], errors='coerce').fillna(0)
                else:
                    df['selling_price'] = 0
                    
                if 'cost_price' in df.columns:
                    df['cost_price'] = pd.to_numeric(df['cost_price'], errors='coerce').fillna(0)
                else:
                    df['cost_price'] = 0

                if 'stock' in df.columns:
                    df['stock'] = pd.to_numeric(df['stock'], errors='coerce').fillna(0)

                # Process each row with savepoint for error isolation
                for index, row in df.iterrows():
                    # Use savepoint to allow individual row failures
                    sid = transaction.savepoint()
                    try:
                        name = str(row['name']).strip()
                        if not name or pd.isna(row['name']):
                            transaction.savepoint_rollback(sid)
                            continue

                        selling_price = float(row['selling_price'])
                        cost_price = float(row.get('cost_price', 0))

                        # TVA Logic:
                        # 1. If TVCODE column exists: tvcode=0 -> TVA 0%, tvcode=2 -> TVA 19.25%
                        # 2. Fallback: public=0 -> TVA 19.25%, public>0 -> TVA 0%
                        if 'tvcode' in df.columns and pd.notna(row.get('tvcode')):
                            tvcode = int(row.get('tvcode', 0))
                            tva = 19.25 if tvcode == 2 else 0
                        elif selling_price == 0:
                            tva = 19.25
                        else:
                            tva = 0

                        # Handle CIP fields - remove decimal part if present (e.g., "3019407.0" -> "3019407")
                        def clean_cip(value):
                            if pd.isna(value) or value == '' or value == '0':
                                return ''
                            cip_str = str(value).strip()[:20]
                            # Remove decimal part (.0)
                            if '.' in cip_str:
                                cip_str = cip_str.split('.')[0]
                            return cip_str

                        cip1 = clean_cip(row.get('cip1', ''))
                        cip2 = clean_cip(row.get('cip2', ''))
                        cip3 = clean_cip(row.get('cip3', ''))

                        product_data = {
                            'name': name,
                            'selling_price': selling_price,
                            'cost_price': cost_price,
                            'stock': int(row.get('stock', 0)) if 'stock' in df.columns else 0,
                            'cip1': cip1 if cip1 else None,
                            'cip2': cip2 if cip2 else None,
                            'cip3': cip3 if cip3 else None,
                            'tva': tva,
                        }
                        
                        # Handle Date
                        if 'expire_date' in row and pd.notna(row['expire_date']):
                            product_data['expire_date'] = row['expire_date']

                        # Try to find existing product by CIP1, CIP2, CIP3 then Name
                        product = None
                        if cip1:
                            product = Produit.objects.filter(cip1=cip1).first()
                        if not product and cip2:
                            product = Produit.objects.filter(cip2=cip2).first()
                        if not product and cip3:
                            product = Produit.objects.filter(cip3=cip3).first()
                        if not product:
                            product = Produit.objects.filter(name__iexact=name).first()

                        if product:
                            # Update Logic
                            product.name = name
                            product.selling_price = selling_price
                            product.cost_price = cost_price
                            product.tva = tva
                            
                            # Update CIP fields if provided
                            if cip1:
                                product.cip1 = cip1
                            if cip2:
                                product.cip2 = cip2
                            if cip3:
                                product.cip3 = cip3

                            # Only update stock if explicitly provided in file
                            if 'stock' in df.columns:
                                product.stock = int(row.get('stock', 0))

                            product.save()
                            updated_count += 1
                        else:
                            # Create Logic
                            Produit.objects.create(**product_data)
                            created_count += 1
                        
                        transaction.savepoint_commit(sid)

                    except Exception as e:
                        transaction.savepoint_rollback(sid)
                        error_msg = f"Ligne {index + 2} ({name if 'name' in dir() else 'unknown'}): {str(e)}"
                        errors.append(error_msg)
                        if len(errors) > 20:
                            errors.append("... trop d'erreurs, arrêt du rapport.")
                            break
            
            return Response({
                'message': 'Import terminé',
                'created': created_count,
                'updated': updated_count,
                'errors': errors
            })

        except Exception as e:
            logger.error(f"Import error: {e}")
            return Response({'error': f"Erreur critique lors de l'import: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
