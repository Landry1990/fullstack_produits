"""
Module d'actions pour les inventaires.

Ce module regroupe toutes les opérations complexes du ViewSet Inventaire:
- pdf: Génération de documents PDF
- csv_import: Import de fichiers CSV
- bulk: Opérations en masse (bulk)
- merge: Fusion d'inventaires
- stats: Statistiques et audit
- validation: Validation d'inventaire
"""

from .pdf import generate_ecarts_pdf, generate_etat_pdf, get_print_data
from .csv_import import import_csv_inventaire
from .bulk import bulk_delete_lignes_inventaire, bulk_lignes_inventaire
from .merge import merge_inventaires, merge_duplicate_lines
from .stats import get_inventaire_stats, audit_discrepancies
from .validation import validate_inventaire
from .listing_excel import generate_listing_excel

__all__ = [
    # PDF
    'generate_ecarts_pdf',
    'generate_etat_pdf',
    'get_print_data',
    # Import CSV
    'import_csv_inventaire',
    # Bulk
    'bulk_delete_lignes_inventaire',
    'bulk_lignes_inventaire',
    # Merge
    'merge_inventaires',
    'merge_duplicate_lines',
    # Stats
    'get_inventaire_stats',
    'audit_discrepancies',
    # Validation
    'validate_inventaire',
    # Listing Excel
    'generate_listing_excel',
]
