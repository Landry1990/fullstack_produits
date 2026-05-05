#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Convertit les fichiers MySQL bruts (.MYD) en JSON pour import Django.
Usage: python convert_mysql_to_json.py --input-dir "donnees mysql" --output supplier_data/FOURNISSEUR1/produits.json
"""

import struct
import os
import json
import argparse
from pathlib import Path
from datetime import datetime


def parse_myd_file(filepath):
    """
    Parse un fichier .MYD (MyISAM data file) basique.
    Note: Ceci est un parseur simplifié pour structure de base.
    """
    produits = []
    
    with open(filepath, 'rb') as f:
        # MyISAM .MYD format est complexe, cette version est simplifiée
        # Pour une vraie conversion, utiliser mysqldump ou un connecteur MySQL
        data = f.read()
    
    # Pour l'instant, retourne une structure vide
    # En production, utiliser: mysql-connector-python ou pymysql
    print(f"Fichier {filepath}: {len(data)} octets")
    print("⚠️  Format MyISAM binaire complexe - conversion automatique limitée")
    
    return produits


def convert_via_mysql_connector(input_dir, output_file):
    """
    Méthode recommandée: Utilise mysql-connector pour lire les tables
    et exporter en JSON.
    """
    try:
        import mysql.connector
    except ImportError:
        print("❌ mysql-connector-python non installé")
        print("   pip install mysql-connector-python")
        return False
    
    print("🔄 Connexion MySQL...")
    
    # Configuration - à adapter
    config = {
        'host': 'localhost',
        'user': 'root',
        'password': '',
        'database': 'pharmacie_db',
        'raise_on_warnings': True
    }
    
    try:
        conn = mysql.connector.connect(**config)
        cursor = conn.cursor(dictionary=True)
        
        # Récupérer les tables
        cursor.execute("SHOW TABLES")
        tables = cursor.fetchall()
        
        all_data = {}
        
        for table in tables:
            table_name = list(table.values())[0]
            print(f"📊 Export table: {table_name}")
            
            cursor.execute(f"SELECT * FROM {table_name}")
            rows = cursor.fetchall()
            
            # Convertir les données en format sérialisable
            table_data = []
            for row in rows:
                clean_row = {}
                for key, value in row.items():
                    if isinstance(value, datetime):
                        clean_row[key] = value.isoformat()
                    elif value is None:
                        clean_row[key] = None
                    else:
                        clean_row[key] = value
                table_data.append(clean_row)
            
            all_data[table_name] = table_data
        
        # Sauvegarder en JSON
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(all_data, f, indent=2, ensure_ascii=False)
        
        print(f"✅ Export terminé: {output_file}")
        print(f"📦 Tables exportées: {len(all_data)}")
        
        cursor.close()
        conn.close()
        return True
        
    except mysql.connector.Error as err:
        print(f"❌ Erreur MySQL: {err}")
        return False


def create_mock_data(output_file, supplier_name):
    """Crée des données de test pour valider le processus"""
    mock_data = {
        "fournisseur_info": {
            "nom": supplier_name,
            "import_date": datetime.now().isoformat(),
            "note": "Données de test - remplacer par vraies données"
        },
        "produits": [
            {
                "code": "PROD001",
                "nom": "Paracétamol 500mg",
                "prix_achat": 2.50,
                "prix_vente": 5.00,
                "stock": 100,
                "forme": "Comprimé",
                "dosage": "500mg",
                "laboratoire": "PharmaCorp"
            },
            {
                "code": "PROD002",
                "nom": "Ibuprofène 400mg",
                "prix_achat": 3.00,
                "prix_vente": 6.50,
                "stock": 75,
                "forme": "Comprimé",
                "dosage": "400mg",
                "laboratoire": "MediPharm"
            }
        ]
    }
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(mock_data, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Données mock créées: {output_file}")
    return True


def main():
    parser = argparse.ArgumentParser(
        description='Convertit les données fournisseur en JSON'
    )
    parser.add_argument(
        '--input-dir', '-i',
        help='Dossier contenant les fichiers MySQL (.MYD)'
    )
    parser.add_argument(
        '--output', '-o',
        required=True,
        help='Fichier JSON de sortie'
    )
    parser.add_argument(
        '--supplier', '-s',
        help='Nom du fournisseur (pour données mock)'
    )
    parser.add_argument(
        '--mock',
        action='store_true',
        help='Créer des données de test'
    )
    
    args = parser.parse_args()
    
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    if args.mock:
        create_mock_data(args.output, args.supplier or "FOURNISSEUR_TEST")
    elif args.input_dir:
        # Essayer la conversion MySQL
        success = convert_via_mysql_connector(args.input_dir, args.output)
        if not success:
            print("\n💡 Alternative: Utilisez --mock pour créer des données de test")
            print("   ou installez MySQL et utilisez mysqldump")
    else:
        print("❌ Spécifiez --input-dir ou --mock")


if __name__ == '__main__':
    main()
