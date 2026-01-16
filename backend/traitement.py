import pandas as pd
import difflib
import re

# --- CONFIGURATION ---
FICHIER_LABOREX = 'laborex.xlsx'
FICHIER_UBIPHARM = 'ubipharm.xlsx'
TOLERANCE_PRIX = 0.05  # 5% de différence max autorisée
SEUIL_NOM = 0.85       # 85% de ressemblance textuelle requise

def nettoyer_nom(texte):
    if not isinstance(texte, str): return ""
    # Garde seulement les lettres et chiffres, en majuscule
    texte = re.sub(r'[^A-Z0-9]', '', texte.upper())
    return texte

def nettoyer_prix(prix):
    try:
        return float(str(prix).replace(',', '.').replace(' ', ''))
    except:
        return 0.0

print("Chargement des fichiers...")
# Chargement des Excel
df_lab = pd.read_excel(FICHIER_LABOREX)
df_ubi = pd.read_excel(FICHIER_UBIPHARM)

# Normalisation des colonnes pour le traitement
df_lab['clean_name'] = df_lab['LIBELLE'].apply(nettoyer_nom)
df_lab['clean_price'] = df_lab['CESSION'].apply(nettoyer_prix)
df_ubi['clean_name'] = df_ubi['LIBELLE'].apply(nettoyer_nom)
df_ubi['clean_price'] = df_ubi['CESSION'].apply(nettoyer_prix)

# Optimisation : On crée des "buckets" de prix pour ne pas tout comparer avec tout
# On divise le prix par 100 pour grouper les produits de prix similaires
df_lab['price_bin'] = (df_lab['clean_price'] // 100).astype(int)
df_ubi['price_bin'] = (df_ubi['clean_price'] // 100).astype(int)

def trouver_cip3(row, df_source, source_name):
    # Si CIP3 existe déjà, on ne fait rien
    if pd.notna(row['CIP3']) and str(row['CIP3']).strip() != '':
        return row['CIP3']
    
    prix_cible = row['clean_price']
    nom_cible = row['clean_name']
    
    if prix_cible <= 0: return row['CIP3']

    # On cherche uniquement dans les produits ayant un prix proche (+/- 100 de bin)
    bin_actuel = int(prix_cible // 100)
    candidats = df_source[df_source['price_bin'].isin([bin_actuel-1, bin_actuel, bin_actuel+1])]
    
    if candidats.empty:
        return row['CIP3']

    # Filtre fin sur le prix (+/- 5%)
    candidats = candidats[
        (candidats['clean_price'] >= prix_cible * (1 - TOLERANCE_PRIX)) &
        (candidats['clean_price'] <= prix_cible * (1 + TOLERANCE_PRIX))
    ]
    
    if candidats.empty:
        return row['CIP3']

    # Recherche du meilleur nom similaire
    matches = difflib.get_close_matches(nom_cible, candidats['clean_name'].tolist(), n=1, cutoff=SEUIL_NOM)
    
    if matches:
        match_name = matches[0]
        # On récupère le CIP1 du produit trouvé
        produit_trouve = candidats[candidats['clean_name'] == match_name].iloc[0]
        return produit_trouve['CIP1']
    
    return row['CIP3']

print("Traitement de LABOREX (Remplissage CIP3 via UBIPHARM)...")
df_lab['CIP3'] = df_lab.apply(trouver_cip3, args=(df_ubi, 'UBIPHARM'), axis=1)

print("Traitement de UBIPHARM (Remplissage CIP3 via LABOREX)...")
df_ubi['CIP3'] = df_ubi.apply(trouver_cip3, args=(df_lab, 'LABOREX'), axis=1)

# Nettoyage des colonnes temporaires avant export
df_lab = df_lab.drop(columns=['clean_name', 'clean_price', 'price_bin'])
df_ubi = df_ubi.drop(columns=['clean_name', 'clean_price', 'price_bin'])

print("Sauvegarde des fichiers...")
df_lab.to_csv('LABOREX_traite.csv', index=False)
df_ubi.to_csv('UBIPHARM_traite.csv', index=False)

print("Terminé ! Deux fichiers '_traite.csv' ont été créés.")