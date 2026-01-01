import subprocess
import sys

result = subprocess.run([sys.executable, 'test_data.py'], capture_output=True, text=True, cwd=r'c:\Projet Fullstack\fullstack_produits\backend')
output = result.stdout + result.stderr

with open(r'c:\Projet Fullstack\fullstack_produits\backend\test_results.txt', 'w', encoding='utf-8') as f:
    f.write(output)

print("Résultats sauvegardés dans test_results.txt")
