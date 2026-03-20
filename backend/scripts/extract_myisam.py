import sys
import re

def extract_records(filename, record_size, limit=100):
    with open(filename, 'rb') as f:
        # Sauter l'en-tête (souvent les premiers octets ne sont pas des données)
        # On va chercher le premier octet de record (0x01 ou 0xFD)
        data = f.read()
        
    # Heuristique : on cherche le premier 0x01 ou 0xFD suivi d'un autre à distance record_size
    first_record_pos = -1
    for i in range(len(data) - record_size):
        if data[i] in [0x01, 0xFD] and data[i + record_size] == data[i]:
            first_record_pos = i
            break
    
    if first_record_pos == -1:
        print("Début des données non trouvé.")
        return

    print(f"Extraction à partir de l'offset {first_record_pos}...")
    
    for i in range(limit):
        pos = first_record_pos + (i * record_size)
        if pos + record_size > len(data): break
        
        record = data[pos:pos+record_size]
        # Extraire les chaînes ASCII du record
        strings = re.findall(b'[a-zA-Z0-9_]{3,}', record)
        decoded = [s.decode('ascii', errors='ignore') for s in strings]
        if decoded:
            print(f"Rec {i}: {' | '.join(decoded)}")

if __name__ == "__main__":
    if len(sys.argv) > 2:
        extract_records(sys.argv[1], int(sys.argv[2]))
