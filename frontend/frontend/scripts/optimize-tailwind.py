#!/usr/bin/env python3
"""
Script pour optimiser les classes Tailwind:
- Remplace w-N h-N par size-N (quand les valeurs sont identiques)
"""
import re
import sys
from pathlib import Path

# Extensions à traiter
EXTENSIONS = {'.tsx', '.ts', '.jsx', '.js'}

# Regex: match w-X h-X (même valeur) avec word boundaries
# Gère: w-4 h-4, w-3.5 h-3.5, w-px h-px, etc.
# Ne matche PAS si d'autres caractères sont entre les deux
PATTERN = re.compile(
    r'\bw-(\d+(?:\.\d+)?|px|full|screen|min|max|fit)\s+h-\1\b'
)


def optimize_file(filepath: Path) -> tuple[int, list[str]]:
    """Remplace w-N h-N par size-N dans un fichier. Retourne (nb_remplacements, lignes_modifiées)."""
    content = filepath.read_text(encoding='utf-8')
    original = content
    
    # Compteur de remplacements
    count = 0
    modified_lines = []
    
    def replace_match(match: re.Match) -> str:
        nonlocal count
        size_val = match.group(1)
        count += 1
        return f'size-{size_val}'
    
    new_content = PATTERN.sub(replace_match, content)
    
    if count > 0:
        filepath.write_text(new_content, encoding='utf-8')
        # Trouver les lignes modifiées
        for i, (old, new) in enumerate(zip(original.splitlines(), new_content.splitlines()), 1):
            if old != new:
                modified_lines.append(f"  Ligne {i}: {old.strip()[:100]}...")
    
    return count, modified_lines


def main():
    src_dir = Path(__file__).parent.parent / 'src'
    if not src_dir.exists():
        print(f"ERREUR: Dossier src non trouvé: {src_dir}")
        sys.exit(1)
    
    total_files = 0
    total_replacements = 0
    
    print("🔍 Recherche des patterns w-N h-N à optimiser...\n")
    
    for filepath in sorted(src_dir.rglob('*')):
        if filepath.suffix not in EXTENSIONS:
            continue
        
        count, modified = optimize_file(filepath)
        
        if count > 0:
            total_files += 1
            total_replacements += count
            rel_path = filepath.relative_to(src_dir.parent)
            print(f"✅ {rel_path}: {count} remplacement(s)")
            for line in modified[:3]:  # Afficher max 3 lignes
                print(line)
            if len(modified) > 3:
                print(f"  ... et {len(modified) - 3} autres lignes")
    
    print(f"\n{'='*60}")
    print(f"📊 RÉSULTAT: {total_replacements} remplacements dans {total_files} fichiers")
    print(f"{'='*60}")


if __name__ == '__main__':
    main()
