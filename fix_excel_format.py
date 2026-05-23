import pandas as pd
import numpy as np

def format_cip(val):
    if pd.isna(val) or val == '':
        return ''
    try:
        # Convert float to integer string to remove '.0' and scientific notation
        return str(int(float(val)))
    except:
        return str(val)

print("Fixing Ubipharm file...")
ubi_path = r'c:\Projet Fullstack\fullstack_produits\Listing_Ubipharm_Mapped_V2.xlsx'
df_ubi = pd.read_excel(ubi_path)
for col in ['cip1', 'cip2', 'cip3']:
    if col in df_ubi.columns:
        df_ubi[col] = df_ubi[col].apply(format_cip)
# Save to a new file to avoid PermissionError if open
ubi_out = r'c:\Projet Fullstack\fullstack_produits\Listing_Ubipharm_Mapped_FINAL.xlsx'
df_ubi.to_excel(ubi_out, index=False)

print("Fixing Laborex file...")
lab_path = r'c:\Projet Fullstack\fullstack_produits\Listing_Laborex_Mapped.xlsx'
df_lab = pd.read_excel(lab_path)
for col in ['cip_ean', 'cip_ubipharm']:
    if col in df_lab.columns:
        df_lab[col] = df_lab[col].apply(format_cip)
# Save to a new file to avoid PermissionError if open
lab_out = r'c:\Projet Fullstack\fullstack_produits\Listing_Laborex_Mapped_FINAL.xlsx'
df_lab.to_excel(lab_out, index=False)

print("Done formatting!")
