#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Import de données produits depuis Excel ou CSV.
Usage: 
    python manage.py import_excel_csv --file produits.xlsx --sheet 0
    python manage.py import_excel_csv --file produits.csv --encoding utf-8
"""

import csv
import json
from pathlib import Path
from decimal import Decimal
from datetime import datetime
from django.utils import timezone
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from api.models import Produit, Fournisseur, Forme, Groupe, Rayon


class Command(BaseCommand):
    help = 'Importe des produits depuis Excel (.xlsx, .xls) ou CSV'

    def add_arguments(self, parser):
        parser.add_argument('--file', '-f', required=True, help='Chemin du fichier Excel ou CSV')
        parser.add_argument('--sheet', '-s', type=int, default=0, help='Index de la feuille Excel (0= première)')
        parser.add_argument('--encoding', '-e', default='utf-8', help='Encodage du fichier CSV')
        parser.add_argument('--delimiter', '-d', default=';', help='Délimiteur CSV (défaut: ;)')
        parser.add_argument('--dry-run', action='store_true', help='Simulation sans sauvegarder')
        parser.add_argument('--skip-header', type=int, default=1, help='Lignes d\'en-tête à sauter')
        parser.add_argument('--limit', '-l', type=int, help='Nombre max de lignes à importer')

    def handle(self, *args, **options):
        filepath = Path(options['file'])
        
        if not filepath.exists():
            raise CommandError(f"Fichier non trouvé: {filepath}")
        
        suffix = filepath.suffix.lower()
        
        if suffix in ['.xlsx', '.xls']:
            data = self.read_excel(filepath, options['sheet'], options['skip_header'])
        elif suffix == '.csv':
            data = self.read_csv(filepath, options['encoding'], options['delimiter'], options['skip_header'])
        elif suffix == '.json':
            data = self.read_json(filepath)
        else:
            raise CommandError(f"Format non supporté: {suffix}. Utilisez .xlsx, .xls, .csv ou .json")
        
        if options['limit']:
            data = data[:options['limit']]
        
        self.stdout.write(f"📊 {len(data)} lignes à importer")
        
        # Import
        stats = self.import_data(data, options['dry_run'])
        
        action = "SIMULATION" if options['dry_run'] else "IMPORT"
        self.stdout.write(self.style.SUCCESS(
            f"\n✅ {action} terminé:\n"
            f"   • Créés: {stats['created']}\n"
            f"   • Mis à jour: {stats['updated']}\n"
            f"   • Erreurs: {stats['errors']}"
        ))

    def read_excel(self, filepath, sheet_index, skip_header):
        """Lit un fichier Excel avec pandas"""
        try:
            import pandas as pd
        except ImportError:
            raise CommandError("pandas requis. Installez: pip install pandas openpyxl")
        
        self.stdout.write(f"📖 Lecture Excel: {filepath.name} (feuille {sheet_index})")
        
        df = pd.read_excel(filepath, sheet_name=sheet_index, header=skip_header-1 if skip_header > 0 else None)
        df = df.where(pd.notnull(df), None)  # Remplacer NaN par None
        
        return df.to_dict('records')

    def read_csv(self, filepath, encoding, delimiter, skip_header):
        """Lit un fichier CSV"""
        self.stdout.write(f"📖 Lecture CSV: {filepath.name} (encoding={encoding})")
        
        data = []
        with open(filepath, 'r', encoding=encoding) as f:
            reader = csv.DictReader(f, delimiter=delimiter)
            for i, row in enumerate(reader):
                if skip_header > 1 and i < skip_header - 1:
                    continue
                # Nettoyer les valeurs vides
                row = {k: (v if v and v.strip() else None) for k, v in row.items()}
                data.append(row)
        
        return data

    def read_json(self, filepath):
        """Lit un fichier JSON"""
        self.stdout.write(f"📖 Lecture JSON: {filepath.name}")
        
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Si c'est un dict avec une clé 'produits', extraire la liste
        if isinstance(data, dict):
            for key in ['produits', 'products', 'data', 'items']:
                if key in data:
                    return data[key]
        
        return data if isinstance(data, list) else [data]

    def import_data(self, data, dry_run):
        """Importe les données dans la base"""
        stats = {'created': 0, 'updated': 0, 'errors': 0}
        
        with transaction.atomic():
            for idx, row in enumerate(data, 1):
                try:
                    result = self.process_row(row, dry_run)
                    if result == 'created':
                        stats['created'] += 1
                    elif result == 'updated':
                        stats['updated'] += 1
                        
                    # Afficher progression
                    if idx % 100 == 0:
                        self.stdout.write(f"   ... {idx}/{len(data)}")
                        
                except Exception as e:
                    stats['errors'] += 1
                    self.stdout.write(self.style.ERROR(f"   ❌ Ligne {idx}: {e}"))
        
        return stats

    def process_row(self, row, dry_run):
        """Traite une ligne de données"""
        # Normaliser les noms de colonnes (lowercase, strip)
        row = {str(k).lower().strip(): v for k, v in row.items() if k}
        
        # Mapping des colonnes courantes
        code = self.get_value(row, ['code', 'cip', 'cip1', 'code_cip', 'id'])
        nom = self.get_value(row, ['nom', 'name', 'libelle', 'produit', 'designation'])
        
        if not code and not nom:
            return None  # Ligne vide
        
        cost_price = self.parse_decimal(self.get_value(row, ['prix_achat', 'cost_price', 'pa', 'prix_achat_ht']))
        selling_price = self.parse_decimal(self.get_value(row, ['prix_vente', 'selling_price', 'pv', 'prix_vente_ttc']))
        stock = self.parse_int(self.get_value(row, ['stock', 'quantite', 'qty', 'quantity']))
        
        # Créer ou récupérer fournisseur
        fournisseur_nom = self.get_value(row, ['fournisseur', 'supplier', 'labo', 'laboratoire'])
        fournisseur = None
        if fournisseur_nom and not dry_run:
            fournisseur, _ = Fournisseur.objects.get_or_create(
                nom__iexact=fournisseur_nom,
                defaults={'nom': fournisseur_nom}
            )
        
        # Créer ou récupérer forme
        forme_nom = self.get_value(row, ['forme', 'form', 'type'])
        forme = None
        if forme_nom and not dry_run:
            forme, _ = Forme.objects.get_or_create(
                nom__iexact=forme_nom,
                defaults={'nom': forme_nom}
            )
        
        # Créer ou récupérer groupe
        groupe_nom = self.get_value(row, ['groupe', 'group', 'categorie', 'famille'])
        groupe = None
        if groupe_nom and not dry_run:
            groupe, _ = Groupe.objects.get_or_create(
                nom__iexact=groupe_nom,
                defaults={'nom': groupe_nom}
            )
        
        if dry_run:
            return 'created'
        
        # Créer ou mettre à jour le produit
        defaults = {
            'name': nom or code,
            'cost_price': cost_price or 0,
            'selling_price': selling_price or 0,
            'stock': stock or 0,
        }
        
        if fournisseur:
            defaults['fournisseur'] = fournisseur
        if forme:
            defaults['forme'] = forme
        if groupe:
            defaults['groupe'] = groupe
        
        # Champs optionnels
        if 'stock_alert' in row or 'alerte' in row:
            defaults['stock_alert'] = self.parse_int(self.get_value(row, ['stock_alert', 'alerte'])) or 0
        if 'stock_minimum' in row or 'minimum' in row:
            defaults['stock_minimum'] = self.parse_int(self.get_value(row, ['stock_minimum', 'minimum'])) or 0
        if 'tva' in row:
            defaults['tva'] = self.parse_decimal(self.get_value(row, ['tva', 'tva%'])) or 0
        if 'description' in row or 'descr' in row:
            defaults['description'] = self.get_value(row, ['description', 'descr', 'commentaire'])
        if 'substance_active' in row or 'substance' in row:
            defaults['substance_active'] = self.get_value(row, ['substance_active', 'substance', 'dci'])
        
        # Identifier par CIP ou nom
        identifier = code or nom
        if not identifier:
            return None
        
        # Chercher produit existant
        produit = None
        if code:
            produit = Produit.objects.filter(cip1=code).first() or \
                     Produit.objects.filter(cip2=code).first() or \
                     Produit.objects.filter(cip3=code).first()
        
        if not produit and nom:
            produit = Produit.objects.filter(name__iexact=nom).first()
        
        if produit:
            # Mise à jour
            for key, value in defaults.items():
                setattr(produit, key, value)
            produit.save()
            return 'updated'
        else:
            # Création
            defaults['cip1'] = code or ''
            Produit.objects.create(**defaults)
            return 'created'

    def get_value(self, row, keys):
        """Récupère la première valeur trouvée parmi les clés"""
        for key in keys:
            if key in row and row[key] is not None:
                val = str(row[key]).strip()
                return val if val else None
        return None

    def parse_decimal(self, value):
        """Parse un nombre décimal"""
        if value is None:
            return None
        try:
            # Gérer les formats: 1.234,56 ou 1,234.56
            val = str(value).replace(' ', '').replace('€', '')
            if ',' in val and '.' in val:
                # Format US: 1,234.56
                val = val.replace(',', '')
            elif ',' in val:
                # Format FR: 1.234,56 -> 1234.56
                val = val.replace('.', '').replace(',', '.')
            return Decimal(val) if val else None
        except:
            return None

    def parse_int(self, value):
        """Parse un entier"""
        if value is None:
            return None
        try:
            return int(float(str(value).replace(' ', '')))
        except:
            return None
