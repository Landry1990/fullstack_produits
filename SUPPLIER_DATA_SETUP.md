# 📦 Configuration des Données Fournisseurs

Ce système permet de choisir quelle base de données fournisseur importer au démarrage de l'application.

## Structure des dossiers

```
backend/supplier_data/
├── FOURNISSEUR1/
│   ├── produits.xlsx       # Excel
│   ├── produits.csv        # CSV
│   └── produits.json       # JSON
├── FOURNISSEUR2/
│   └── produits.xlsx
└── README.md
```

## 🚀 Utilisation

### Option 1: Import automatique au démarrage Docker

Définissez la variable d'environnement `SUPPLIER_DATA`:

```bash
# Créer un fichier .env à la racine
echo "SUPPLIER_DATA=FOURNISSEUR1" >> .env

# Ou l'exporter directement
export SUPPLIER_DATA=FOURNISSEUR1

# Lancer Docker
docker-compose -f docker-compose.prod.yml up -d
```

L'import ne se fera que si la base est vide (0 produits).

### Option 2: Import manuel après démarrage

```bash
# Se connecter au container backend
docker exec -it fullstack_produits-backend-1 /bin/sh

# Importer les données
python manage.py import_supplier_data --supplier FOURNISSEUR1

# Mode simulation (sans sauvegarder)
python manage.py import_supplier_data --supplier FOURNISSEUR1 --dry-run
```

### Option 3: Conversion des données MySQL

Si vous avez des fichiers MySQL bruts (`.MYD`, `.MYI`, `.frm`):

```bash
# Installer le connecteur MySQL
pip install mysql-connector-python

# Convertir en JSON
python scripts/convert_mysql_to_json.py \
    --output supplier_data/FOURNISSEUR1/produits.json \
    --mock  # Crée des données de test

# Ou depuis une vraie base MySQL
python scripts/convert_mysql_to_json.py \
    --input-dir "donnees mysql" \
    --output supplier_data/FOURNISSEUR1/produits.json
```

## � Import Excel ou CSV

### Format Excel (.xlsx, .xls)

Colonnes supportées (noms flexibles):
| Champ | Noms alternatifs | Exemple |
|-------|-----------------|---------|
| **code** | cip, cip1, code_cip, id | `3400930001234` |
| **nom** | name, libelle, produit, designation | `Paracétamol 500mg` |
| **prix_achat** | cost_price, pa, prix_achat_ht | `2.50` |
| **prix_vente** | selling_price, pv, prix_vente_ttc | `5.00` |
| **stock** | quantite, qty, quantity | `100` |
| **fournisseur** | supplier, labo, laboratoire | `PharmaCorp` |
| **forme** | form, type | `Comprimé` |
| **groupe** | group, categorie, famille | `Antalgiques` |
| **stock_alert** | alerte | `10` |
| **tva** | tva% | `20` |
| **substance_active** | substance, dci | `Paracétamol` |

### Commande d'import

```bash
# Import Excel
docker exec -it fullstack_produits-backend-1 sh
python manage.py import_excel_csv --file supplier_data/FOURNISSEUR1/produits.xlsx

# Import CSV avec délimiteur personnalisé
python manage.py import_excel_csv --file supplier_data/FOURNISSEUR1/produits.csv --delimiter ';'

# Import avec encodage Windows (pour fichiers Excel FR)
python manage.py import_excel_csv --file produits.csv --encoding 'latin-1' --delimiter ';'

# Mode simulation (test sans sauvegarder)
python manage.py import_excel_csv --file produits.xlsx --dry-run --limit 10
```

### Créer un fichier Excel simple

```excel
| code        | nom                  | prix_achat | prix_vente | stock | fournisseur | forme    |
|-------------|----------------------|------------|------------|-------|-------------|----------|
| 3400930001  | Paracétamol 500mg    | 2.50       | 5.00       | 100   | PharmaCorp  | Comprimé |
| 3400930002  | Ibuprofène 400mg     | 3.00       | 6.50       | 75    | MediPharm   | Comprimé |
```

## � Format JSON attendu

```json
{
  "fournisseur_info": {
    "nom": "Nom du Fournisseur",
    "import_date": "2024-01-15T10:30:00",
    "note": "Description optionnelle"
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
    }
  ]
}
```

## 🔧 Commandes utiles

```bash
# Vérifier le nombre de produits
docker exec fullstack_produits-backend-1 python -c "
from api.models import Produit
print(f'{Produit.objects.count()} produits')
"

# Supprimer tous les produits (ATTENTION)
docker exec fullstack_produits-backend-1 python -c "
from api.models import Produit
Produit.objects.all().delete()
print('Base vidée')
"

# Relancer l'import après vidage
docker-compose -f docker-compose.prod.yml restart backend
```

## ⚠️ Notes importantes

- ✅ Formats supportés: **Excel (.xlsx, .xls)**, **CSV**, **JSON**
- L'import automatique ne se fait qu'une seule fois (base vide)
- Pour changer de fournisseur, videz d'abord la base
- Les données sont importées dans PostgreSQL (container `db`)
- Conservez vos fichiers source pour réimport futur

## 📞 Besoin d'aide ?

```bash
# Voir l'aide de la commande Excel/CSV
python manage.py import_excel_csv --help

# Tester avec un fichier
cp ton_fichier.xlsx backend/supplier_data/FOURNISSEUR1/
docker exec -it fullstack_produits-backend-1 sh
python manage.py import_excel_csv --file supplier_data/FOURNISSEUR1/ton_fichier.xlsx --dry-run --limit 5
```
