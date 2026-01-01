import os
import sys

# Add the project root to sys.path
sys.path.append(os.getcwd())

try:
    print("Attempting to import api.zpl_generator...")
    import api.zpl_generator
    print(f"api.zpl_generator imported: {api.zpl_generator}")
    
    print("Attempting to import generate_labels_zpl...")
    from api.zpl_generator import generate_labels_zpl
    print(f"generate_labels_zpl imported: {generate_labels_zpl}")
except Exception as e:
    print(f"CRITICAL ERROR: {e}")
    import traceback
    traceback.print_exc()
