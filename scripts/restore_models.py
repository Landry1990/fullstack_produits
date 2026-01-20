import os
import time
import subprocess
import shutil

repo_root = r"c:\Projet Fullstack\fullstack_produits"
lock_file = os.path.join(repo_root, ".git", "index.lock")
target_file = os.path.join(repo_root, "backend", "api", "models.py")

print(f"Attempting to restore {target_file}...")

# 1. Try to remove lock file
if os.path.exists(lock_file):
    print(f"Lock file found at {lock_file}. Removing...")
    for i in range(5):
        try:
            os.remove(lock_file)
            print("Lock file removed.")
            break
        except OSError as e:
            print(f"Attempt {i+1}: Failed to remove lock file: {e}")
            time.sleep(1)
else:
    print("No lock file found.")

# 2. Run git checkout
try:
    print("Running git checkout...")
    result = subprocess.run(
        ["git", "checkout", "HEAD", "--", "backend/api/models.py"],
        cwd=repo_root,
        capture_output=True,
        text=True,
        check=True
    )
    print("Git checkout successful.")
    # Check file size
    if os.path.exists(target_file):
        size = os.path.getsize(target_file)
        print(f"Restored file size: {size} bytes")
    else:
        print("Error: File does not exist after checkout.")

except subprocess.CalledProcessError as e:
    print(f"Git checkout failed: {e.stderr}")

# 3. Verify content (head)
if os.path.exists(target_file):
    with open(target_file, 'r', encoding='utf-8') as f:
        print(f"First 5 lines:\n{f.read(200)}")
