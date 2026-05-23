import pandas as pd
import re
from difflib import SequenceMatcher
from pathlib import Path
import time

print("Loading data...")
df_lab = pd.read_excel(r'c:\Projet Fullstack\fullstack_produits\Listing_laborex_import.xlsx')
df_ubi = pd.read_excel(r'c:\Projet Fullstack\fullstack_produits\Listing_Ubipharm_import_v2.xlsx')

def normalize_name(name):
    if pd.isna(name): return ""
    name = str(name).upper()
    # Remove special characters, keep alphanumeric and spaces
    name = re.sub(r'[^A-Z0-9\s]', ' ', name)
    # Remove extra spaces
    name = re.sub(r'\s+', ' ', name).strip()
    return name

print("Normalizing names...")
df_lab['norm_nom'] = df_lab['nom'].apply(normalize_name)
df_ubi['norm_nom'] = df_ubi['nom'].apply(normalize_name)

# Create a dictionary for fast exact lookups
lab_exact_dict = dict(zip(df_lab['norm_nom'], df_lab['cip_ean']))

matches_exact = 0
matches_fuzzy = 0

print("Finding matches...")
start_time = time.time()

for idx, row in df_ubi.iterrows():
    norm_ubi = row['norm_nom']
    if not norm_ubi:
        continue
        
    # Skip if cip3 is already filled with a valid code
    if pd.notna(row['cip3']) and str(row['cip3']).strip() != '':
        continue

    # 1. Try Exact Match
    if norm_ubi in lab_exact_dict:
        df_ubi.at[idx, 'cip3'] = lab_exact_dict[norm_ubi]
        matches_exact += 1
        continue
        
    # 2. Try Fuzzy Match (Optional, commented out if too slow, but let's try for a small subset or do it smartly)
    # To be fast, we'll skip full fuzzy match across 8000x8000 rows unless necessary.
    # Let's do a fast word intersection check before SequenceMatcher
    
# We will do a second pass for fuzzy matching if needed, but exact normalized is safe.
print(f"Exact normalized matches found: {matches_exact}")

df_ubi = df_ubi.drop(columns=['norm_nom'])

output_path = r'c:\Projet Fullstack\fullstack_produits\Listing_Ubipharm_Mapped.xlsx'
print(f"Saving to {output_path}...")
df_ubi.to_excel(output_path, index=False)
print(f"Done in {time.time() - start_time:.2f} seconds.")
