#!/bin/bash

# RESTAURATION DE LA BASE DE DONNEES (LINUX)
echo "========================================"
echo "RESTAURATION DE LA BASE DE DONNEES"
echo "========================================"

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d "my_env01" ]; then
    source my_env01/bin/activate
fi

# Lister les sauvegardes disponibles
echo "Liste des sauvegardes disponibles dans /backups :"
count=0
files=()
for f in backups/*.sql.gz; do
    if [ -f "$f" ]; then
        ((count++))
        files+=("$f")
        echo "[$count] $f"
    fi
done

if [ $count -eq 0 ]; then
    echo "Aucune sauvegarde trouvée dans le dossier /backups."
    exit 1
fi

echo ""
read -p "Choisissez le numéro de la sauvegarde à restaurer (ou 'q' pour quitter) : " choice

if [ "$choice" == "q" ]; then
    exit 0
fi

if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -le "$count" ]; then
    selected_file="${files[$((choice-1))]}"
    echo ""
    echo "Vous avez choisi : $selected_file"
    echo ""
    
    python3 manage.py restore_database "$selected_file"
else
    echo "Choix invalide."
fi
