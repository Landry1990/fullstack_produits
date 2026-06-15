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
from django.conf import settings
from api.models import Produit, Fournisseur, Forme, Groupe, Rayon
try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False


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
        
        # Générer le rapport
        if not options['dry_run']:
            self.generate_report(stats, filepath)

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
        """Importe les données dans la base - une transaction par ligne"""
        stats = {'created': 0, 'updated': 0, 'errors': 0, 'success_rows': [], 'error_rows': []}
        
        for idx, row in enumerate(data, 1):
            try:
                with transaction.atomic():
                    result = self.process_row(row, dry_run)
                if result == 'created':
                    stats['created'] += 1
                    stats['success_rows'].append({'ligne': idx, 'statut': 'Créé', **{str(k): v for k, v in row.items()}})
                elif result == 'updated':
                    stats['updated'] += 1
                    stats['success_rows'].append({'ligne': idx, 'statut': 'Mis à jour', **{str(k): v for k, v in row.items()}})
                    
                # Afficher progression
                if idx % 100 == 0:
                    self.stdout.write(f"   ... {idx}/{len(data)}")
                    
            except Exception as e:
                stats['errors'] += 1
                stats['error_rows'].append({'ligne': idx, 'erreur': str(e), **{str(k): v for k, v in row.items()}})
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

    def generate_report(self, stats, source_filepath):
        """Génère un rapport texte + Excel (si pandas dispo) avec succès et échecs"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        reports_dir = Path(settings.REPORTS_DIR)
        reports_dir.mkdir(parents=True, exist_ok=True)

        # --- Rapport texte (toujours généré) ---
        txt_path = reports_dir / f"rapport_import_{timestamp}.txt"
        total = stats['created'] + stats['updated'] + stats['errors']
        with open(str(txt_path), 'w', encoding='utf-8') as f:
            f.write(f"RAPPORT D'IMPORT — {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}\n")
            f.write("=" * 60 + "\n")
            f.write(f"  Total traité   : {total}\n")
            f.write(f"  Créés          : {stats['created']}\n")
            f.write(f"  Mis à jour     : {stats['updated']}\n")
            f.write(f"  Échecs         : {stats['errors']}\n")
            f.write("=" * 60 + "\n\n")

            if stats['error_rows']:
                f.write(f"LIGNES EN ÉCHEC ({len(stats['error_rows'])}):\n")
                f.write("-" * 60 + "\n")
                for row in stats['error_rows']:
                    f.write(f"  Ligne {row.get('ligne','?')} — {row.get('erreur','?')}\n")
                    nom = row.get('nom') or row.get('name') or row.get('designation') or ''
                    code = row.get('code') or row.get('cip') or row.get('cip1') or ''
                    if nom or code:
                        f.write(f"    Produit: {nom} | Code: {code}\n")
            else:
                f.write("Aucun échec.\n")

        import sys
        print(f"\n📄 Rapport texte : {txt_path}", file=sys.stderr, flush=True)
        self.stdout.write(self.style.SUCCESS(f"\n📄 Rapport texte : {txt_path}"))

        # --- Rapport Excel (si pandas dispo) ---
        if not PANDAS_AVAILABLE:
            return

        try:
            xlsx_path = reports_dir / f"rapport_import_{timestamp}.xlsx"
            with pd.ExcelWriter(str(xlsx_path), engine='openpyxl') as writer:
                pd.DataFrame({
                    'Indicateur': ['Total traité', 'Créés', 'Mis à jour', 'Échecs'],
                    'Valeur': [total, stats['created'], stats['updated'], stats['errors']]
                }).to_excel(writer, sheet_name='Résumé', index=False)

                success_df = pd.DataFrame(stats['success_rows']) if stats['success_rows'] \
                    else pd.DataFrame([{'info': 'Aucun enregistrement'}])
                success_df.to_excel(writer, sheet_name='Succès', index=False)

                error_df = pd.DataFrame(stats['error_rows']) if stats['error_rows'] \
                    else pd.DataFrame([{'info': 'Aucun échec'}])
                error_df.to_excel(writer, sheet_name='Échecs', index=False)

            self.stdout.write(self.style.SUCCESS(f"📊 Rapport Excel  : {xlsx_path}"))
        except Exception as e:
            self.stdout.write(self.style.WARNING(f"⚠ Rapport Excel non généré: {e}"))

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
