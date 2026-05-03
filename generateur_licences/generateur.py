import os
import datetime
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend
import jwt  # Nécessite 'PyJWT' et 'cryptography' (pip install PyJWT cryptography)

# Fichiers pour stocker vos clés (Ne les perdez jamais !)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PRIVATE_KEY_PATH = os.path.join(BASE_DIR, "cle_privee_secrete.pem")
PUBLIC_KEY_PATH = os.path.join(BASE_DIR, "cle_publique_a_distribuer.pem")

def generer_paires_de_cles():
    """Génère une paire de clés RSA 2048 bits si elles n'existent pas encore."""
    if os.path.exists(PRIVATE_KEY_PATH) and os.path.exists(PUBLIC_KEY_PATH):
        print("[!] Les clés existent déjà. On utilise les clés existantes.")
        return

    print("[+] Génération d'une nouvelle paire de clés RSA. Veuillez patienter...")
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend()
    )
    
    # Sauvegarde de la clé privée (À GARDER CHEZ VOUS STRICTEMENT)
    with open(PRIVATE_KEY_PATH, "wb") as f:
        f.write(private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        ))
        
    # Sauvegarde de la clé publique (À INTÉGRER DANS LE CODE DJANGO DU CLIENT)
    public_key = private_key.public_key()
    with open(PUBLIC_KEY_PATH, "wb") as f:
        f.write(public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        ))
    print("[+] Clés générées avec succès ! Ne partagez JAMAIS 'cle_privee_secrete.pem'.")

def charger_cle_privee():
    """Charge la clé privée depuis le fichier."""
    with open(PRIVATE_KEY_PATH, "rb") as key_file:
        return serialization.load_pem_private_key(
            key_file.read(),
            password=None,
            backend=default_backend()
        )

def generer_licence():
    """Demande les infos et génère le JWT crypté."""
    print("\n--- CRÉATION D'UNE NOUVELLE LICENCE ---")
    nom_pharmacie = input("Nom de la pharmacie : ").strip()
    nom_pharmacien = input("Nom du pharmacien (ex: Dr. Landry) : ").strip()
    
    # L'empreinte sera générée par le PC du client. 
    # Pour le moment, on met "ANY" si on ne l'a pas encore.
    empreinte_hw = input("Empreinte matérielle du PC client (laissez vide pour autoriser tous les PC au début) : ").strip()
    if not empreinte_hw:
        empreinte_hw = "ANY" 
        
    plan = input("Plan (ex: BASIC / PREMIUM / LIFETIME / DEMO) [Défaut: PREMIUM] : ").strip().upper() or "PREMIUM"

    if plan == "LIFETIME":
        jours_valide = None
        date_expiration = None
    else:
        jours_valide = int(input("Durée de validité en jours (ex: 365 pour 1 an, 0 pour à vie) : ") or "365")
        if jours_valide == 0:
            plan = "LIFETIME"
            date_expiration = None
        else:
            date_expiration = datetime.datetime.utcnow() + datetime.timedelta(days=jours_valide)

    # 1. Préparation des données (Payload)
    payload = {
        "pharmacie_nom": nom_pharmacie,
        "pharmacien_nom": nom_pharmacien,
        "hardware_id": empreinte_hw,
        "plan": plan,
        "iat": datetime.datetime.utcnow(),  # Date de création (Issued At)
    }
    if date_expiration:
        payload["exp"] = date_expiration  # Date d'expiration stricte (absente pour LIFETIME)
    
    # 2. Chargement de la clé
    cle_privee = charger_cle_privee()
    
    # 3. Signature
    token = jwt.encode(payload, cle_privee, algorithm="RS256")
    
    # Sauvegarde dans un fichier .lic
    nom_fichier = f"licence_{nom_pharmacie.replace(' ', '_').lower()}.lic"
    file_path = os.path.join(BASE_DIR, nom_fichier)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(token)
        
    print("\n" + "="*60)
    print("LICENCE GÉNÉRÉE AVEC SUCCÈS")
    print("="*60)
    print(f"Propriétaire : {nom_pharmacie} ({nom_pharmacien})")
    if date_expiration:
        print(f"Expire le    : {date_expiration.strftime('%Y-%m-%d %H:%M:%S UTC')}")
    else:
        print(f"Expire le    : JAMAIS (Licence à vie)")
    print(f"Matériel ID  : {empreinte_hw}")
    print(f"\n✅ FICHIER CRÉÉ : {nom_fichier}")
    print("Envoyez ce fichier au client (par WhatsApp ou Email) !")
    print("-" * 60)

    # Historisation locale pour vous en souvenir
    history_path = os.path.join(BASE_DIR, "historique_licences.txt")
    exp_str = date_expiration.date() if date_expiration else "JAMAIS"
    with open(history_path, "a", encoding="utf-8") as f:
        f.write(f"{datetime.datetime.now().date()} | {nom_pharmacie} | {plan} | Exp: {exp_str} | Clé: {token}\n")
    print("[i] Copie sauvegardée dans historique_licences.txt")

if __name__ == "__main__":
    try:
        generer_paires_de_cles()
        generer_licence()
    except KeyboardInterrupt:
        print("\nAnnulé.")
    except Exception as e:
        print(f"\nErreur : {e}")
