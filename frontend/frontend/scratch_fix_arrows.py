import os

dir_path = r'c:\Projet Fullstack\fullstack_produits\frontend\frontend\src'

replacements = {
    'onChange={(e) = lang="fr-FR" > ': 'onChange={(e) => ',
    'onChange={e = lang="fr-FR" > ': 'onChange={e => ',
    'onChange={(e) = lang="fr-FR" >': 'onChange={(e) =>',
    'onChange={e = lang="fr-FR" >': 'onChange={e =>',
}

for root, dirs, files in os.walk(dir_path):
    for filename in files:
        if filename.endswith('.tsx') or filename.endswith('.ts'):
            filepath = os.path.join(root, filename)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            original = content
            for old_str, new_str in replacements.items():
                content = content.replace(old_str, new_str)
                
            if content != original:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f'Fixed {filename}')
