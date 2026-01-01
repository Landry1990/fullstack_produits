# Scripts de Développement et Maintenance

Ce dossier contient les scripts de test, debug, analyse et vérification utilisés pendant le développement.

## Structure

### 📝 tests/ (16 scripts)
Scripts de test unitaires et d'intégration :
- `test_*.py` - Tests divers des fonctionnalités
- `run_test.py` - Lanceur de tests
- `tests_manual.py` - Tests manuels

### 🐛 debug/ (8 scripts)
Scripts de débogage :
- `debug_*.py` - Scripts pour déboguer des problèmes spécifiques

### 📊 analysis/ (3 scripts)
Scripts d'analyse de données :
- `analyze_ca_discrepancy.py` - Analyse des écarts de CA
- `analyze_creances.py` - Analyse des créances
- `analyze_paiements.py` - Analyse des paiements

### ✅ verification/ (14 scripts)
Scripts de vérification et de contrôle :
- `verify_*.py` - Vérifications diverses
- `check_*.py` - Contrôles de cohérence
- `compare_creances.py` - Comparaison des créances
- `verification_finale.py` - Vérification finale

### 🔧 utils/ (3 scripts)
Scripts utilitaires de maintenance :
- `recalculate_totals.py` - Recalcul des totaux
- `delete_corrupted_invoices.py` - Suppression de factures corrompues
- `migrate_tva_data.py` - Migration des données TVA

## Utilisation

Pour utiliser un script, activez d'abord le virtualenv :
```bash
# Windows
..\activate_env.bat

# Puis exécutez le script
python scripts/tests/test_data.py
```

## Notes

- Ces scripts sont conservés pour référence et débogage futur
- Ils ne sont pas nécessaires au fonctionnement de l'application en production
- Certains scripts peuvent nécessiter des ajustements selon l'environnement
