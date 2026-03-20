import sys
import re

def extract_strings(filename):
    with open(filename, 'rb') as f:
        content = f.read()
    
    # Simple regex to find ASCII strings (length >= 3)
    strings = re.findall(b'[a-zA-Z0-9_]{3,}', content)
    for s in strings:
        print(s.decode('ascii', errors='ignore'))

if __name__ == "__main__":
    if len(sys.argv) > 1:
        extract_strings(sys.argv[1])
