import os

dir_path = r'c:\Projet Fullstack\fullstack_produits\frontend\frontend\src'

replacements = {
    ".toLocaleDateString()": ".toLocaleDateString('fr-FR')",
    ".toLocaleTimeString()": ".toLocaleTimeString('fr-FR')",
    ".toLocaleDateString(currentLocale)": ".toLocaleDateString('fr-FR')",
    ".toLocaleTimeString(currentLocale)": ".toLocaleTimeString('fr-FR')",
    ".toLocaleDateString(lng)": ".toLocaleDateString('fr-FR')",
    ".toLocaleTimeString(lng)": ".toLocaleTimeString('fr-FR')",
    ".toLocaleDateString(i18n.language)": ".toLocaleDateString('fr-FR')",
    ".toLocaleTimeString(i18n.language)": ".toLocaleTimeString('fr-FR')",
    ".toLocaleDateString(getLocale())": ".toLocaleDateString('fr-FR')",
    ".toLocaleTimeString(getLocale())": ".toLocaleTimeString('fr-FR')",
    ".toLocaleDateString(t('common:locale', 'fr-FR'))": ".toLocaleDateString('fr-FR')",
    ".toLocaleDateString(t('common:locale', { defaultValue: 'fr-FR' }))": ".toLocaleDateString('fr-FR')",
    ".toLocaleDateString(t('common:date_locale', 'fr-FR'))": ".toLocaleDateString('fr-FR')",
    ".toLocaleDateString(t('common:date_format_short') === 'dd/MM/yyyy' ? 'fr-FR' : 'en-GB')": ".toLocaleDateString('fr-FR')",
    
    ".toLocaleDateString(currentLocale, ": ".toLocaleDateString('fr-FR', ",
    ".toLocaleTimeString(currentLocale, ": ".toLocaleTimeString('fr-FR', ",
    ".toLocaleDateString(lng, ": ".toLocaleDateString('fr-FR', ",
    ".toLocaleTimeString(lng, ": ".toLocaleTimeString('fr-FR', ",
    ".toLocaleDateString(i18n.language, ": ".toLocaleDateString('fr-FR', ",
    ".toLocaleTimeString(i18n.language, ": ".toLocaleTimeString('fr-FR', ",
    ".toLocaleDateString(getLocale(), ": ".toLocaleDateString('fr-FR', ",
    ".toLocaleTimeString(getLocale(), ": ".toLocaleTimeString('fr-FR', ",
    ".toLocaleDateString(t('common:locale', 'fr-FR'), ": ".toLocaleDateString('fr-FR', ",
    ".toLocaleDateString(t('common:locale', { defaultValue: 'fr-FR' }), ": ".toLocaleDateString('fr-FR', ",
    ".toLocaleDateString(i18n.language === 'fr' ? 'fr-FR' : 'en-GB')": ".toLocaleDateString('fr-FR')"
}

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    
    for old_str, new_str in replacements.items():
        content = content.replace(old_str, new_str)
        
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated: {os.path.relpath(filepath, dir_path)}")

count = 0
for root, dirs, files in os.walk(dir_path):
    for filename in files:
        if filename.endswith('.tsx') or filename.endswith('.ts'):
            process_file(os.path.join(root, filename))
            count += 1
