
import unicodedata
import os

def remove_accents(input_str):
    if not input_str:
        return ""
    # Normalize unicode to decompose accents
    nfkd_form = unicodedata.normalize('NFKD', input_str)
    # Filter out non-spacing mark (accents)
    return "".join([c for c in nfkd_form if not unicodedata.combining(c)])

def clean_text(text):
    if not text:
        return ""
    # Remove accents, uppercase, strip
    return remove_accents(text).upper().strip()

def unify_data(cis_path, compo_path, output_path):
    print(f"Reading {cis_path}...")
    cis_data = {}
    
    # Try different encodings
    encodings = ['utf-8', 'latin-1', 'cp1252']
    
    cis_success = False
    for enc in encodings:
        try:
            with open(cis_path, 'r', encoding=enc) as f:
                for line in f:
                    parts = line.strip().split('\t')
                    if len(parts) >= 2:
                        cis_code = parts[0].strip()
                        name = clean_text(parts[1])
                        form = clean_text(parts[2]) if len(parts) > 2 else ""
                        cis_data[cis_code] = {
                            'nom': name,
                            'forme': form,
                            'substances': []
                        }
            print(f"Successfully read CIS.txt with {enc}")
            cis_success = True
            break
        except Exception as e:
            print(f"Failed with {enc}: {e}")
            continue
            
    if not cis_success:
        print("ERROR: Could not read CIS.txt")
        return

    print(f"Reading {compo_path}...")
    compo_success = False
    for enc in encodings:
        try:
            with open(compo_path, 'r', encoding=enc) as f:
                for line in f:
                    parts = line.strip().split('\t')
                    if len(parts) >= 4:
                        cis_code = parts[0].strip()
                        if cis_code in cis_data:
                            substance = clean_text(parts[3])
                            dosage = clean_text(parts[4]) if len(parts) > 4 else ""
                            unit = clean_text(parts[5]) if len(parts) > 5 else ""
                            cis_data[cis_code]['substances'].append(f"{substance} {dosage}".strip())
            print(f"Successfully read COMPO.txt with {enc}")
            compo_success = True
            break
        except Exception as e:
            print(f"Failed with {enc}: {e}")
            continue

    if not compo_success:
        print("ERROR: Could not read COMPO.txt")
        return

    print(f"Writing unified data to {output_path}...")
    with open(output_path, 'w', encoding='utf-8') as f:
        # Header
        f.write("cis\tnom\tforme\tsubstances\n")
        for cis, data in cis_data.items():
            # Join substances with a semicolon
            substances_str = "; ".join(sorted(list(set(data['substances']))))
            f.write(f"{cis}\t{data['nom']}\t{data['forme']}\t{substances_str}\n")
            
    print("Done!")

if __name__ == "__main__":
    base_dir = r"c:\Projet Fullstack\fullstack_produits"
    unify_data(
        os.path.join(base_dir, "CIS.txt"),
        os.path.join(base_dir, "COMPO.txt"),
        os.path.join(base_dir, "unified_meds.txt")
    )
