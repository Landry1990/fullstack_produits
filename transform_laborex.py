#!/usr/bin/env python3
"""
Transforme le fichier Excel LABOREX pour import dans l'application
"""
import pandas as pd
import sys

# Chemins
input_file = r'C:\Users\nkaha\Desktop\Listing laborex.xlsx'
output_file = r'C:\Users\nkaha\Desktop\Listing_laborex_import.csv'

print(f'📖 Lecture de: {input_file}')
df = pd.read_excel(input_file)

print(f'📊 {len(df)} lignes trouvées')
print(f'📋 Colonnes source: {list(df.columns)}')

# Gestion des doublons CIP
df['cip1_clean'] = df['cip1'].astype(str).str.strip()

# Ajouter suffixe pour les doublons
duplicate_mask = df.duplicated('cip1_clean', keep=False)
if duplicate_mask.any():
    duplicate_cips = set(df.loc[duplicate_mask, 'cip1_clean'].tolist())
    counts = {}
    new_cips = []
    for idx, row in df.iterrows():
        cip = row['cip1_clean']
        if cip in counts:
            counts[cip] += 1
            new_cips.append(f"{cip}_{counts[cip]}")
        else:
            counts[cip] = 0
            if cip in duplicate_cips:
                new_cips.append(f"{cip}_1")
            else:
                new_cips.append(cip)
    df['cip1_clean'] = new_cips
    print(f'⚠️  {duplicate_mask.sum()} doublons détectés et corrigés avec suffixe')

# Mapping des colonnes pour l'import UI (noms FRANÇAIS attendus)
df_transforme = pd.DataFrame({
    'cip1': df['cip1_clean'],
    'cip2': df['CIP2'].astype(str).str.strip(),
    'nom': df['LIBART'].str.strip(),
    'prix_achat': df['CESSIO'],
    'prix_vente': df['PUBLIC'],
    'tva': df['CODTVA'].apply(lambda x: 0 if x == 0 else 19.25),  # 0% ou 19.25%
    'quantite': 0
})

# Sauvegarde en CSV avec point-virgule (format attendu par le backend)
df_transforme.to_csv(output_file, index=False, sep=';', encoding='utf-8')

print(f'\n✅ Fichier transformé sauvegardé:')
print(f'   {output_file}')
print(f'\n📊 {len(df_transforme)} produits prêts à importer')
print(f'\n📝 Colonnes finales:')
for col in df_transforme.columns:
    print(f'   - {col}')

print(f'\n👀 Aperçu des 3 premières lignes:')
print(df_transforme.head(3).to_string(index=False))

print(f'\n💡 Fichier CSV prêt pour import via l\'interface web:')
print(f'   {output_file}')
print(f'\n   Colonnes: nom, prix_achat, prix_vente, tva, quantite, cip1, cip2')
