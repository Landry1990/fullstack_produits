"""
Import CSV pour les inventaires.

Résolution des CIP côté serveur (normalisation identique à l'ancien import
web : suppression espaces/tirets/points, majuscules, variante sans zéros de
tête) puis délégation à `bulk_lignes_inventaire` — fusion avec les lignes
existantes, une seule passe en base, et lignes affectées renvoyées pour que
le client mette à jour son état sans recharger tout l'inventaire.
"""
import csv
import io as csv_io
import re
from typing import Any

from rest_framework import status
from rest_framework.response import Response

from api.models import Inventaire, Produit
from .bulk import bulk_lignes_inventaire

_CIP_HEADERS = {'cip', 'cip1', 'cip13', 'code', 'barcode', 'ean', 'ean13'}
_QTY_HEADERS = {'quantite', 'quantité', 'qte', 'qty', 'quantity', 'quantite_physique'}

_CIP_STRIP_RE = re.compile(r'[\s\-.]')


def _normalize_cip(cip: str) -> str:
    """Normalisation miroir du frontend (InventaireEditor)."""
    return _CIP_STRIP_RE.sub('', cip.strip()).upper()


def _is_numeric(value: str) -> bool:
    try:
        float(str(value).replace(',', '.'))
        return True
    except (TypeError, ValueError):
        return False


def _build_cip_map() -> dict[str, int]:
    """
    Indexe tous les CIP produits (normalisés + variante sans zéros de tête)
    en une seule requête — évite un lookup SQL par ligne du fichier.
    """
    cip_map: dict[str, int] = {}
    rows = Produit.objects.filter(is_active=True).values_list(
        'id', 'cip1', 'cip2', 'cip3', 'cip4'
    )
    for pid, cip1, cip2, cip3, cip4 in rows:
        for raw in (cip1, cip2, cip3, cip4):
            normalized = _normalize_cip(raw or '')
            if not normalized:
                continue
            cip_map[normalized] = pid  # dernier gagne, comme le frontend
            stripped = normalized.lstrip('0')
            if stripped and stripped not in cip_map:
                cip_map[stripped] = pid
    return cip_map


def _parse_int_quantity(value: str, row_num: int) -> int:
    """Quantité entière >= 0 ou lève ValueError avec message métier."""
    value = str(value).strip()
    if not value:
        raise ValueError("Quantité manquante.")
    try:
        quantite = float(value.replace(',', '.'))
    except ValueError:
        raise ValueError(f"Quantité invalide '{value}'.")
    # Rejette 'nan', 'inf', les décimaux non entiers ('1.5') et les négatifs
    if not quantite.is_integer():
        raise ValueError(f"Quantité invalide '{value}' (nombre entier attendu).")
    quantite = int(quantite)
    if quantite < 0:
        raise ValueError(f"Quantité négative interdite '{value}'.")
    return quantite


def import_csv_inventaire(inventaire: Inventaire, uploaded_file) -> Response:
    """
    Importe des lignes d'inventaire depuis un fichier CSV.

    Formats acceptés :
      - avec en-têtes : colonnes cip|code|barcode|ean + quantite|qte|qty
      - sans en-tête : positionnel `cip;quantite` (ou virgule)

    Returns:
        Response DRF : status, imported, errors, lignes (sérialisées via le
        bulk), not_found (CIP non reconnus pour rapport téléchargeable),
        total_rows_processed
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

        if not decoded_file.strip():
            return Response(
                {'error': 'Le fichier est vide.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Détection du délimiteur (le sniffer échoue souvent sur 1-2 lignes)
        content_sample = decoded_file[:1024]
        delimiter = ';' if ';' in content_sample else ','

        rows = [
            row for row in csv.reader(csv_io.StringIO(decoded_file), delimiter=delimiter)
            if row and any(str(c).strip() for c in row)
        ]
        if not rows:
            return Response(
                {'error': 'Le fichier est vide.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # En-tête présent si un nom de colonne connu est trouvé, ou si la
        # 2ᵉ colonne de la 1ʳᵉ ligne n'est pas numérique (ex: « quantite »).
        header = [
            str(c).strip().lower().replace('﻿', '')
            for c in rows[0]
        ]
        cip_idx = next((i for i, h in enumerate(header) if h in _CIP_HEADERS), -1)
        qty_idx = next((i for i, h in enumerate(header) if h in _QTY_HEADERS), -1)
        has_header = (
            cip_idx >= 0 or qty_idx >= 0
            or (len(rows[0]) >= 2 and not _is_numeric(rows[0][1]))
        )
        data_rows = rows[1:] if has_header else rows

        cip_map = _build_cip_map()
        lignes_data: list[dict[str, Any]] = []
        errors: list[str] = []
        not_found: list[dict[str, Any]] = []
        processed = 0

        for offset, row in enumerate(data_rows):
            row_num = (2 if has_header else 1) + offset
            processed += 1
            try:
                if has_header:
                    cip_val = row[cip_idx] if 0 <= cip_idx < len(row) else ''
                    qty_val = row[qty_idx] if 0 <= qty_idx < len(row) else ''
                else:
                    cip_val = row[0]
                    qty_val = row[1] if len(row) > 1 else '1'

                cip = str(cip_val).strip()
                if not cip:
                    raise ValueError("Colonne 'cip' ou 'code' manquante.")
                quantite = _parse_int_quantity(qty_val, row_num)

                normalized = _normalize_cip(cip)
                produit_id = cip_map.get(normalized)
                if produit_id is None:
                    stripped = normalized.lstrip('0')
                    produit_id = cip_map.get(stripped) if stripped else None

                if produit_id is None:
                    not_found.append({'cip': cip, 'quantite': quantite})
                else:
                    lignes_data.append({
                        'produit': produit_id,
                        'quantite_physique': quantite,
                        'stock_lot': None,
                    })
            except ValueError as e:
                errors.append(f"Ligne {row_num}: {e!s}")
            except Exception as e:
                errors.append(f"Ligne {row_num}: Erreur inattendue: {e!s}")

        # Fusion + persistance via le bulk optimisé (retourne les lignes
        # sérialisées pour mise à jour client sans refetch).
        bulk_response = bulk_lignes_inventaire(inventaire, lignes_data)
        data = dict(bulk_response.data) if isinstance(bulk_response.data, dict) else {}
        data['status'] = 'Import CSV terminé'
        data['errors'] = errors + list(data.get('errors') or [])
        data['not_found'] = not_found
        data['total_rows_processed'] = processed

        return Response(data, status=bulk_response.status_code)

    except csv.Error as e:
        return Response(
            {'error': f'Erreur de format CSV: {e!s}'},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        return Response(
            {'error': f'Erreur lors du traitement: {e!s}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
