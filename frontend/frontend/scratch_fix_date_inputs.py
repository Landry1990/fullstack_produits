import os
import re

dir_path = r'c:\Projet Fullstack\fullstack_produits\frontend\frontend\src'

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    
    # 1. Add lang='fr-FR' to type='date' if not already there
    content = re.sub(
        r'(<input[^>]*?type=[\"\']date[\"\'][^>]*?)(/?>)', 
        lambda m: m.group(0) if 'lang=' in m.group(1) else m.group(1) + ' lang=\"fr-FR\" ' + m.group(2), 
        content
    )
    
    # 2. Add lang='fr-FR' to type='time' if not already there
    content = re.sub(
        r'(<input[^>]*?type=[\"\']time[\"\'][^>]*?)(/?>)', 
        lambda m: m.group(0) if 'lang=' in m.group(1) else m.group(1) + ' lang=\"fr-FR\" ' + m.group(2), 
        content
    )
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Updated {os.path.basename(filepath)}')

for root, dirs, files in os.walk(dir_path):
    for filename in files:
        if filename.endswith('.tsx') or filename.endswith('.ts'):
            process_file(os.path.join(root, filename))
