import json
import sys

def append_login_section(file_path, title, username, password, submit, loading, subtitle):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        data['login'] = {
            "title": title,
            "username": username,
            "password": password,
            "submit": submit,
            "loading": loading,
            "subtitle": subtitle
        }
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        print(f"Successfully updated {file_path}")
    except Exception as e:
        print(f"Error updating {file_path}: {e}")
        sys.exit(1)

# Update French
append_login_section(
    "c:/Projet Fullstack/fullstack_produits/frontend/frontend/public/locales/fr/translation.json",
    "Connexion", "Utilisateur", "Mot de passe", "Se connecter", "Authentification...", "Ecosystème Sécurisé"
)

# Update English
append_login_section(
    "c:/Projet Fullstack/fullstack_produits/frontend/frontend/public/locales/en/translation.json",
    "Login", "Username", "Password", "Log In", "Authenticating...", "Secure Ecosystem"
)
