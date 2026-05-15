# Déploiement DCI / Substances — Multi Pharmacie

## Contexte

Les modèles `Substance`, `DrugInteraction`, `MedicamentReference` et les champs DCI sur `Produit` existent déjà en local (migrations 0083 et 0183).
Chaque pharmacie a sa propre base de données, mais les données de référence (substances, médicaments ANSM) sont **identiques**. On les exporte une seule fois, puis on les réimporte partout.

---

## Workflow multi-pharmacie (recommandé)

### Étape 1 — Générer le fichier référence (une seule fois)

Sur ton environnement de développement (où tu as déjà importé les substances et les médicaments) :

```bash
python manage.py export_dci_data --output dci_data.json
```

Cela produit un fichier `dci_data.json` (~2–5 Mo) contenant **toutes les substances + médicaments de référence**.

→ Commit ce fichier dans le repo ou place-le à la racine du projet.

### Étape 2 — Déployer dans chaque pharmacie

Pour chaque nouvelle pharmacie / instance prod :

```bash
# 1. Migrations (si pas encore faites)
docker exec <container-backend> python manage.py migrate

# 2. Import des données DCI réutilisables
docker cp dci_data.json <container-backend>:/app/dci_data.json
docker exec <container-backend> python manage.py import_dci_data --input dci_data.json

# 3. Auto-link des produits de CETTE pharmacie
docker exec <container-backend> python manage.py link_dci_produits
```

Ou tout d'un coup avec le déploiement automatique :

```powershell
# Copier le fichier JSON dans le conteneur avant le deploy
docker cp dci_data.json fullstack_produits-backend-1:/app/dci_data.json

# Déployer backend + frontend
.\deploy.ps1 -Target backend-full
```

---

## Commandes disponibles

### `setup_dci_prod` — Setup from scratch
Pour la **première pharmacie** uniquement (parse COMPO.txt + unified_meds.txt) :

```bash
python manage.py setup_dci_prod
# Options : --skip-substances --skip-med-ref --skip-link --compo-file PATH --meds-file PATH
```

### `export_dci_data` — Exporter en JSON
```bash
python manage.py export_dci_data --output dci_data.json
```

### `import_dci_data` — Importer depuis JSON
```bash
python manage.py import_dci_data --input dci_data.json
# Options : --skip-existing (ignore si PK existe), --link-produits (lance auto-link après)
```

### `link_dci_produits` — Lier les produits de la pharmacie
```bash
python manage.py link_dci_produits
# Option : --dry-run (simulation, n'écrit rien)
```

---

## Déploiement automatique (deploy.ps1)

Le script `deploy.ps1` a été mis à jour :

```powershell
.\deploy.ps1 -Target backend-full
```

Ce script :
1. Copie `products.py`, `serializers.py`, `urls.py`, `substances.py`, `meds_reference.py`, `produits.py`
2. Exécute `makemigrations` + `migrate`
3. Copie et lance `setup_dci_prod` (charge COMPO.txt + unified_meds.txt + auto-link)
4. Redémarre le conteneur

Pour le mode multi-pharmacie avec JSON, ajoute manuellement l'étape d'import :

```powershell
docker cp dci_data.json fullstack_produits-backend-1:/app/dci_data.json
docker exec fullstack_produits-backend-1 python manage.py import_dci_data --input dci_data.json
docker exec fullstack_produits-backend-1 python manage.py link_dci_produits
```

---

## Vérification

```bash
# Nombre de substances
docker exec <backend> python -c "from api.models import Substance; print(Substance.objects.count())"

# Médicaments de référence
docker exec <backend> python -c "from api.models import MedicamentReference; print(MedicamentReference.objects.count())"

# Produits liés à une DCI
docker exec <backend> python -c "from api.models import Produit; print(Produit.objects.exclude(dci_reference__isnull=True).count())"
```

---

## Troubleshooting

**"Fichier non trouvé : dci_data.json"**  
→ Le fichier JSON n'est pas monté dans le conteneur. Copie-le avec `docker cp`.

**"Aucune substance créée" (setup_dci_prod)**  
→ Vérifie que `COMPO.txt` est présent à la racine du projet.

**Les produits n'apparaissent pas dans le Catalogue DCI**  
→ Vérifie que `link_dci_produits` a bien été exécuté sur cette pharmacie.
