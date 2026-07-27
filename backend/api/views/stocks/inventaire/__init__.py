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

from .bulk import bulk_delete_lignes_inventaire, bulk_lignes_inventaire
from .csv_import import import_csv_inventaire
from .listing_excel import generate_listing_excel
from .merge import merge_duplicate_lines, merge_inventaires
from .pdf import generate_ecarts_pdf, generate_etat_pdf, get_print_data
from .stats import audit_discrepancies, get_inventaire_stats
from .validation import validate_inventaire

__all__ = [
    'audit_discrepancies',
    # Bulk
    'bulk_delete_lignes_inventaire',
    'bulk_lignes_inventaire',
    # PDF
    'generate_ecarts_pdf',
    'generate_etat_pdf',
    # Listing Excel
    'generate_listing_excel',
    # Stats
    'get_inventaire_stats',
    'get_print_data',
    # Import CSV
    'import_csv_inventaire',
    'merge_duplicate_lines',
    # Merge
    'merge_inventaires',
    # Validation
    'validate_inventaire',
]
