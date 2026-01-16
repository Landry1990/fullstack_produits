import csv
import io

# Read the original file
with open('UBIPHARM_traite.csv', 'r', encoding='utf-8') as f:
    content = f.read()

# First pass: Remove outer quotes from each line
# The format is: "CIP1,CIP2,CIP3,""LIBELLE with comma"",TVCODE,CESSION,PUBLIC"
lines = content.strip().split('\n')
cleaned_lines = []

for line in lines:
    line = line.strip('\r\n')
    # Remove outer quotes if present
    if line.startswith('"') and line.endswith('"'):
        line = line[1:-1]
    # Replace "" with " (CSV escape for quotes)
    line = line.replace('""', '"')
    cleaned_lines.append(line)

# Parse with CSV reader
cleaned_content = '\n'.join(cleaned_lines)
reader = csv.reader(io.StringIO(cleaned_content))
rows = list(reader)

print(f'Nombre de lignes lues: {len(rows)}')

# Check for parsing issues
errors = []
for i, row in enumerate(rows):
    if len(row) != 7:
        errors.append(f"Ligne {i+1}: {len(row)} colonnes au lieu de 7 - {row[:3]}...")

if errors:
    print(f"\n{len(errors)} lignes avec problemes:")
    for e in errors[:10]:
        print(e)
else:
    print("Toutes les lignes ont 7 colonnes!")

# Process rows - clean CIP3
output_rows = []
for i, row in enumerate(rows):
    if len(row) != 7:
        continue  # Skip malformed rows
        
    if i == 0:
        output_rows.append(row)
    else:
        # CIP3 is the 3rd column (index 2)
        cip3 = row[2]
        if cip3 and '.' in cip3:
            cip3 = cip3.split('.')[0]
        row[2] = cip3
        output_rows.append(row)

# Write cleaned file
with open('UBIPHARM_traite_clean.csv', 'w', encoding='utf-8', newline='') as f:
    writer = csv.writer(f)
    writer.writerows(output_rows)

print(f'\nFichier nettoye cree: UBIPHARM_traite_clean.csv')
print(f'Lignes valides: {len(output_rows)}')

# Verify some lines with commas in names
print('\n=== Verification des lignes avec virgules ===')
for row in output_rows[1:100]:
    if ',' in row[3]:
        print(f"LIBELLE: {row[3]}")
        break
