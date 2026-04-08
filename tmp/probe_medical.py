import os

def probe_myisam(file_path):
    print(f"Probing: {file_path}")
    if not os.path.exists(file_path):
        print(f" [!] File not found at {file_path}")
        return
    
    try:
        with open(file_path, 'rb') as f:
            data = f.read(20000) # Read first 20KB
            import string
            # Find sequence of printable characters
            printable_bytes = set(string.printable.encode('ascii'))
            found_strings = []
            current = bytearray()
            for b in data:
                if b in printable_bytes and b > 31: # Skip control chars
                    current.append(b)
                else:
                    if len(current) > 8: # Only significant text
                        try:
                            found_strings.append(current.decode('ascii'))
                        except:
                            pass
                    current = bytearray()
            
            print(f" [+] Found {len(found_strings)} text fragments.")
            for s in found_strings[:15]:
                print(f"   - {s}")
    except Exception as e:
        print(f" [!] Error reading file: {e}")

if __name__ == "__main__":
    # Current working directory check
    print(f"CWD: {os.getcwd()}")
    base = "backend/donnees mysql"
    target_files = ["MQ_MONOG.MYD", "MQ_INTER.MYD", "MQ_CLASS.MYD"]
    for tf in target_files:
        probe_myisam(os.path.join(base, tf))
