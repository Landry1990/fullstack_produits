import pandas as pd
import re
import time
from difflib import SequenceMatcher

print("Loading data...")
df_lab = pd.read_excel(r'c:\Projet Fullstack\fullstack_produits\Listing_laborex_import.xlsx')
df_ubi = pd.read_excel(r'c:\Projet Fullstack\fullstack_produits\Listing_Ubipharm_import_v2.xlsx')

def get_tokens(name):
    if pd.isna(name): return set()
    name = str(name).upper()
    name = re.sub(r'[^A-Z0-9]', ' ', name)
    return set(name.split())

print("Tokenizing names...")
df_lab['tokens'] = df_lab['nom'].apply(get_tokens)
df_ubi['tokens'] = df_ubi['nom'].apply(get_tokens)

# Prepare a list of lab data to iterate quickly
lab_data = df_lab[['cip_ean', 'tokens', 'nom']].to_dict('records')

matches_found = 0

print("Finding fuzzy matches...")
start_time = time.time()

for idx, ubi_row in df_ubi.iterrows():
    ubi_tokens = ubi_row['tokens']
    if not ubi_tokens:
        continue
        
    # Skip if cip3 is already filled
    if pd.notna(ubi_row['cip3']) and str(ubi_row['cip3']).strip() != '':
        continue

    best_match = None
    best_score = 0.0
    
    # We want a very high intersection score to avoid false positives
    for lab_row in lab_data:
        lab_tokens = lab_row['tokens']
        if not lab_tokens:
            continue
            
        intersection = len(ubi_tokens.intersection(lab_tokens))
        union = len(ubi_tokens.union(lab_tokens))
        
        jaccard = intersection / union if union > 0 else 0
        
        # If Jaccard is high enough, we consider it a match
        if jaccard > best_score:
            best_score = jaccard
            best_match = lab_row
            
    if best_score >= 0.75: # 75% token similarity
        df_ubi.at[idx, 'cip3'] = best_match['cip_ean']
        matches_found += 1
        
    if idx % 500 == 0 and idx > 0:
        print(f"Processed {idx}/{len(df_ubi)}... Found {matches_found} matches so far.")

print(f"Total fuzzy matches found: {matches_found}")

df_ubi = df_ubi.drop(columns=['tokens'])

output_path = r'c:\Projet Fullstack\fullstack_produits\Listing_Ubipharm_Mapped_Fuzzy.xlsx'
print(f"Saving to {output_path}...")
df_ubi.to_excel(output_path, index=False)
print(f"Done in {time.time() - start_time:.2f} seconds.")
