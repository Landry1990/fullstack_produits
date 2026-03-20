import sys

def analyze_structure(filename, max_sample=1000000):
    with open(filename, 'rb') as f:
        data = f.read(max_sample)
    
    if len(data) < 100:
        print("Fichier trop petit.")
        return

    # Recherche de répétitions de motifs (ex: octets de début de record)
    # Dans les fichiers MyISAM fixes, chaque record commence souvent par 0x01 ou 0xFD
    potential_starts = [0x01, 0xFD, 0xFE, 0xAA]
    
    for start_byte in potential_starts:
        indices = [i for i, b in enumerate(data) if b == start_byte]
        if len(indices) < 2: continue
        
        diffs = {}
        for i in range(len(indices)-1):
            d = indices[i+1] - indices[i]
            diffs[d] = diffs.get(d, 0) + 1
        
        # Filtrer les distances les plus fréquentes
        sorted_diffs = sorted(diffs.items(), key=lambda x: x[1], reverse=True)
        if sorted_diffs and sorted_diffs[0][1] > len(indices) * 0.1:
            print(f"Structure potentielle détectée avec header {hex(start_byte)} :")
            for dist, count in sorted_diffs[:5]:
                print(f"  Distance {dist} octets (Apparitions: {count})")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        analyze_structure(sys.argv[1])
