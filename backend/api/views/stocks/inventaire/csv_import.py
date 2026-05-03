"""
Import CSV pour les inventaires.
"""
import csv
import io as csv_io
from typing import List, Dict, Any, Tuple
from django.db import transaction
from rest_framework.response import Response
from rest_framework import status

from api.models import Inventaire, Produit, LigneInventaire


def import_csv_inventaire(inventaire: Inventaire, uploaded_file) -> Response:
    """
    Importe des lignes d'inventaire depuis un fichier CSV.
    Format attendu: cip;quantite (cip obligatoire, quantite obligatoire)

    Args:
        inventaire: Instance de l'inventaire cible
        uploaded_file: Fichier CSV uploadé

    Returns:
        Response DRF avec le résultat de l'import
    """
    if inventaire.status != Inventaire.Status.EN_COURS:
        return Response(
            {'error': 'L\'inventaire doit être EN_COURS pour importer des lignes.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        try:
            decoded_file = uploaded_file.read().decode('utf-8')
        except UnicodeDecodeError:
            uploaded_file.seek(0)
            decoded_file = uploaded_file.read().decode('latin-1')

        # Plus de robustesse pour la détection du dialecte
        content_sample = decoded_file[:1024]
        try:
            if not content_sample.strip():
                return Response(
                    {'error': 'Le fichier est vide.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            dialect = csv.Sniffer().sniff(content_sample, delimiters=";,")
        except Exception:
            # Fallback si le sniffer échoue (souvent le cas avec très peu de lignes)
            if ';' in content_sample:
                dialect = 'excel'
            else:
                dialect = 'excel-tab' if '\t' in content_sample else 'excel'

        # On utilise DictReader avec un séparateur explicite
        delimiter = ';' if ';' in content_sample else ','
        csv_reader = csv.DictReader(
            csv_io.StringIO(decoded_file),
            delimiter=delimiter
        )

        # Nettoyage des en-têtes (strip, minuscule, suppression BOM)
        if csv_reader.fieldnames:
            csv_reader.fieldnames = [
                field.strip().lower().replace('\ufeff', '')
                for field in csv_reader.fieldnames
            ]
        else:
            return Response(
                {'error': 'En-têtes CSV manquants.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        imported_count = 0
        errors: List[str] = []
        lignes_a_creer: List[LigneInventaire] = []
        row_num = 0

        for row_num, row in enumerate(csv_reader, start=2):
            try:
                result = _process_csv_row(row, inventaire, row_num)
                if result:
                    lignes_a_creer.append(result)
                    imported_count += 1
                else:
                    # result is None when there's an error already logged
                    pass
            except Exception as e:
                errors.append(f"Ligne {row_num}: Erreur inattendue: {str(e)}")

        if lignes_a_creer:
            LigneInventaire.objects.bulk_create(lignes_a_creer)

        return Response({
            'status': 'Import CSV terminé',
            'imported': imported_count,
            'errors': errors,
            'total_rows_processed': row_num - 1 if row_num > 0 else 0
        }, status=status.HTTP_201_CREATED if imported_count > 0 else status.HTTP_400_BAD_REQUEST)

    except csv.Error as e:
        return Response(
            {'error': f'Erreur de format CSV: {str(e)}'},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        return Response(
            {'error': f'Erreur lors du traitement: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


def _process_csv_row(
    row: Dict[str, Any],
    inventaire: Inventaire,
    row_num: int
) -> LigneInventaire | None:
    """
    Traite une ligne du CSV et retourne une LigneInventaire ou None si erreur.

    Args:
        row: Dictionnaire représentant une ligne CSV
        inventaire: Instance de l'inventaire cible
        row_num: Numéro de ligne pour les messages d'erreur

    Returns:
        LigneInventaire instance ou None si la ligne doit être ignorée

    Raises:
        Exception: Si erreur inattendue
    """
    # Recherche des colonnes flexibles
    cip = row.get('cip') or row.get('code') or row.get('barcode') or ''
    quantite_str = row.get('quantite') or row.get('qte') or row.get('qty') or ''

    cip = str(cip).strip()
    quantite_str = str(quantite_str).strip()

    if not cip:
        # On saute les lignes vides sans erreur bloquante
        if not any(row.values()):
            return None
        raise ValueError("Colonne 'cip' ou 'code' manquante.")

    if not quantite_str:
        raise ValueError("Quantité manquante.")

    try:
        quantite = float(quantite_str.replace(',', '.'))
        if quantite.is_integer():
            quantite = int(quantite)
    except ValueError:
        raise ValueError(f"Quantité invalide '{quantite_str}'.")

    produit = (
        Produit.objects.filter(cip1=cip).first()
        or Produit.objects.filter(cip2=cip).first()
        or Produit.objects.filter(cip3=cip).first()
    )

    if not produit:
        raise ValueError(f"Produit '{cip}' introuvable.")

    stock_theorique = produit.stock
    return LigneInventaire(
        inventaire=inventaire,
        produit=produit,
        stock_lot=None,
        stock_theorique=stock_theorique,
        quantite_physique=quantite,
        ecart=quantite - stock_theorique,
        pmp_snapshot=produit.pmp or produit.cost_price or 0
    )
