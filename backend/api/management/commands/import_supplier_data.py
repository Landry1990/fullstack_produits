#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Commande Django pour importer les données d'un fournisseur spécifique.
Usage: python manage.py import_supplier_data --supplier FOURNISSEUR1
"""

import os
import json
import glob
from pathlib import Path
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from api.models import Produit, Fournisseur, Substance, Forme, Groupe, Rayon


class Command(BaseCommand):
    help = 'Importe les données produits depuis un fournisseur spécifique'

    def add_arguments(self, parser):
        parser.add_argument(
            '--supplier',
            type=str,
            required=True,
            help='Nom du dossier fournisseur (ex: FOURNISSEUR1, FOURNISSEUR2)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Simule l\'import sans sauvegarder'
        )

    def handle(self, *args, **options):
        supplier_name = options['supplier']
        dry_run = options['dry_run']
        
        # Chercher le dossier du fournisseur
        base_dir = Path(__file__).resolve().parent.parent.parent.parent
        supplier_dirs = [
            base_dir / 'supplier_data' / supplier_name,
            base_dir / 'fournisseurs' / supplier_name,
            base_dir / 'donnees mysql',
        ]
        
        supplier_dir = None
        for d in supplier_dirs:
            if d.exists():
                supplier_dir = d
                break
        
        if not supplier_dir:
            raise CommandError(
                f"Fournisseur '{supplier_name}' non trouvé. "
                f"Créez le dossier dans supplier_data/{supplier_name}/"
            )
        
        self.stdout.write(f"📦 Import depuis: {supplier_dir}")
        
        # Chercher les fichiers JSON ou SQL
        json_files = list(supplier_dir.glob('*.json'))
        sql_files = list(supplier_dir.glob('*.sql'))
        mysql_files = list(supplier_dir.glob('*.MYD'))
        
        if json_files:
            self.import_json(json_files[0], dry_run)
        elif sql_files:
            self.import_sql(sql_files[0], dry_run)
        elif mysql_files:
            self.import_mysql_files(supplier_dir, dry_run)
        else:
            raise CommandError("Aucun fichier de données trouvé (JSON, SQL ou MySQL)")
    
    def import_json(self, filepath, dry_run):
        """Importe depuis un fichier JSON"""
        self.stdout.write(f"🔄 Import JSON: {filepath}")
        
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        count = 0
        with transaction.atomic():
            for item in data:
                if dry_run:
                    count += 1
                    continue
                    
                # Créer ou mettre à jour le produit
                produit, created = Produit.objects.update_or_create(
                    code=item.get('code', ''),
                    defaults={
                        'nom': item.get('nom', ''),
                        'prix_achat': item.get('prix_achat', 0),
                        'prix_vente': item.get('prix_vente', 0),
                        'stock': item.get('stock', 0),
                    }
                )
                count += 1
        
        action = "SIMULATION" if dry_run else "IMPORT"
        self.stdout.write(self.style.SUCCESS(
            f"✅ {action} terminé: {count} produits traités"
        ))
    
    def import_sql(self, filepath, dry_run):
        """Importe depuis un fichier SQL"""
        self.stdout.write(f"🔄 Import SQL: {filepath}")
        # Implémentation selon le format SQL
        self.stdout.write(self.style.WARNING(
            "Import SQL non encore implémenté - utilisez JSON"
        ))
    
    def import_mysql_files(self, directory, dry_run):
        """Importe depuis des fichiers MySQL bruts (.MYD, .MYI, .frm)"""
        self.stdout.write(f"🔄 Détection fichiers MySQL dans: {directory}")
        
        files = list(directory.glob('*.MYD'))
        self.stdout.write(f"📁 {len(files)} tables trouvées")
        
        for f in files:
            table_name = f.stem
            self.stdout.write(f"  - {table_name}")
        
        self.stdout.write(self.style.WARNING(
            "⚠️  Les fichiers MySQL bruts nécessitent MySQL pour être lus.\n"
            "   Options:\n"
            "   1. Exporter en JSON/SQL depuis MySQL\n"
            "   2. Utiliser un script de conversion Python\n"
            "   3. Créer un convertisseur personnalisé"
        ))
        
        self.stdout.write("\n💡 Suggestion: Convertissez d'abord avec:")
        self.stdout.write("   mysqldump -u USER -p DB_NAME > dump.sql")
        self.stdout.write("   ou")
        self.stdout.write("   python -c \"convert_mysql_to_json()\"")


if __name__ == '__main__':
    from django.core.management import execute_from_command_line
    execute_from_command_line()
