import subprocess
import os

target_file = r"backend/api/models.py"

print(f"Reading content from HEAD:{target_file}...")
try:
    # Read from HEAD using git show (bypasses index lock usually)
    content = subprocess.check_output(["git", "show", "HEAD:backend/api/models.py"], cwd=r"c:\Projet Fullstack\fullstack_produits")
    
    # Write to file
    print(f"Writing {len(content)} bytes to {target_file}...")
    with open(os.path.join(r"c:\Projet Fullstack\fullstack_produits", target_file), "wb") as f:
        f.write(content)
        
    print("Success: models.py restored.")
    
except subprocess.CalledProcessError as e:
    print(f"Git Error: {e}")
except Exception as e:
    print(f"Error: {e}")
