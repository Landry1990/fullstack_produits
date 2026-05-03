import os
import datetime
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend
import jwt

# --- CONFIGURATION DU DESIGN ---
COLORS = {
    "bg": "#0F172A",          # Background profond
    "card": "#1E293B",        # Fond des sections
    "primary": "#38BDF8",      # Bleu ciel pour les accents
    "success": "#22C55E",      # Vert pour le bouton générer
    "text": "#F8FAFC",         # Texte blanc cassé
    "text_muted": "#94A3B8",   # Texte gris
    "border": "#334155"        # Bordures
}

# --- LOGIQUE DE GÉNÉRATION ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PRIVATE_KEY_PATH = os.path.join(BASE_DIR, "cle_privee_secrete.pem")
PUBLIC_KEY_PATH = os.path.join(BASE_DIR, "cle_publique_a_distribuer.pem")

class LicenceApp:
    def __init__(self, root):
        self.root = root
        self.root.title("LicenseGen Pro - Générateur de Licences")
        self.root.geometry("600x750")
        self.root.configure(bg=COLORS["bg"])
        
        self.setup_styles()
        self.create_widgets()
        self.log("Application démarrée. Prêt à générer.")
        
        # Vérification des clés au démarrage
        if not os.path.exists(PRIVATE_KEY_PATH):
            self.log("⚠️ Attention : Clé privée manquante. Utilisez le bouton 'Générer Clés RSA' d'abord.")

    def setup_styles(self):
        style = ttk.Style()
        style.theme_use('clam')
        
        # Personnalisation des éléments TTK
        style.configure("TFrame", background=COLORS["bg"])
        style.configure("Card.TFrame", background=COLORS["card"], relief="flat")
        
        style.configure("TLabel", background=COLORS["card"], foreground=COLORS["text"], font=("Segoe UI", 11))
        style.configure("Header.TLabel", background=COLORS["bg"], foreground=COLORS["text"], font=("Segoe UI", 20, "bold"))
        style.configure("Sub.TLabel", background=COLORS["card"], foreground=COLORS["text_muted"], font=("Segoe UI", 10))
        
        # Augmentation de la taille des champs (Entry)
        style.configure("TEntry", fieldbackground=COLORS["bg"], foreground="white", borderwidth=0, font=("Segoe UI", 12))
        style.configure("TCombobox", fieldbackground=COLORS["bg"], foreground="white", font=("Segoe UI", 12))

    def create_widgets(self):
        # --- HEADER ---
        header_frame = tk.Frame(self.root, bg=COLORS["bg"], pady=20)
        header_frame.pack(fill="x", padx=30)
        
        ttk.Label(header_frame, text="🔑 LicenseGen Pro", style="Header.TLabel").pack(side="left")
        
        # --- MAIN CARD ---
        main_card = ttk.Frame(self.root, style="Card.TFrame", padding=30)
        main_card.pack(fill="both", expand=True, padx=30, pady=10)
        
        # Formulaire
        self.create_field(main_card, "Nom de la Pharmacie", "pharmacie_var")
        self.create_field(main_card, "Nom du Pharmacien", "pharmacien_var")
        self.create_field(main_card, "ID Matériel (Hardware ID)", "hw_id_var", placeholder="Ex: A1B2-C3D4... (Laissez vide pour 'ANY')")
        
        # Plan & Durée
        row_plan = tk.Frame(main_card, bg=COLORS["card"])
        row_plan.pack(fill="x", pady=10)
        
        left_col = tk.Frame(row_plan, bg=COLORS["card"])
        left_col.pack(side="left", fill="x", expand=True)
        ttk.Label(left_col, text="Plan de licence").pack(anchor="w")
        self.plan_var = tk.StringVar(value="PREMIUM")
        plan_combo = ttk.Combobox(left_col, textvariable=self.plan_var, values=["TRIAL", "BASIC", "PREMIUM", "LIFETIME"])
        plan_combo.pack(fill="x", pady=8, padx=(0, 10), ipady=5)
        # Bind pour désactiver la durée si LIFETIME est sélectionné
        plan_combo.bind('<<ComboboxSelected>>', self.on_plan_changed)
        
        right_col = tk.Frame(row_plan, bg=COLORS["card"])
        right_col.pack(side="left", fill="x", expand=True)
        ttk.Label(right_col, text="Durée (jours, 0 = à vie)").pack(anchor="w")
        self.days_var = tk.StringVar(value="365")
        self.days_entry = ttk.Entry(right_col, textvariable=self.days_var)
        self.days_entry.pack(fill="x", pady=8, ipady=8)

        # --- ACTIONS ---
        tk.Frame(main_card, height=20, bg=COLORS["card"]).pack() # Spacer
        
        btn_gen = tk.Button(
            main_card, text="GÉNÉRER LE FICHIER .LIC", 
            command=self.handle_generate,
            bg=COLORS["success"], fg="white", font=("Segoe UI", 11, "bold"),
            activebackground="#16a34a", activeforeground="white",
            relief="flat", pady=12, cursor="hand2"
        )
        btn_gen.pack(fill="x")

        # --- CONSOLE / LOGS ---
        log_frame = tk.Frame(self.root, bg=COLORS["bg"], pady=10)
        log_frame.pack(fill="both", expand=True, padx=30)
        
        ttk.Label(log_frame, text="LOGS ACTIVITÉ", style="Sub.TLabel", background=COLORS["bg"]).pack(anchor="w")
        self.log_text = tk.Text(
            log_frame, height=8, bg="#020617", fg="#10B981", 
            font=("Consolas", 9), relief="flat", padx=10, pady=10
        )
        self.log_text.pack(fill="both", expand=True, pady=5)
        
        # --- FOOTER ACTIONS ---
        footer = tk.Frame(self.root, bg=COLORS["bg"], pady=10)
        footer.pack(fill="x", padx=30)
        
        tk.Button(
            footer, text="Générer nouvelles clés RSA", 
            command=self.handle_keys,
            bg=COLORS["card"], fg=COLORS["text_muted"], font=("Segoe UI", 8),
            relief="flat", padx=10, cursor="hand2"
        ).pack(side="right")

    def create_field(self, parent, label, var_name, placeholder=""):
        frame = tk.Frame(parent, bg=COLORS["card"], pady=10)
        frame.pack(fill="x")
        ttk.Label(frame, text=label).pack(anchor="w")
        var = tk.StringVar()
        setattr(self, var_name, var)
        entry = ttk.Entry(frame, textvariable=var)
        entry.pack(fill="x", pady=8, ipady=8) # Ajout de ipady pour plus de hauteur
        if placeholder:
            ttk.Label(frame, text=placeholder, style="Sub.TLabel").pack(anchor="w")

    def log(self, message):
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        self.log_text.insert(tk.END, f"[{timestamp}] {message}\n")
        self.log_text.see(tk.END)

    def on_plan_changed(self, event=None):
        """Désactive le champ durée si LIFETIME est sélectionné"""
        if self.plan_var.get() == "LIFETIME":
            self.days_var.set("0")
            self.days_entry.configure(state='disabled')
        else:
            self.days_entry.configure(state='normal')
            if self.days_var.get() == "0":
                self.days_var.set("365")

    def handle_keys(self):
        if os.path.exists(PRIVATE_KEY_PATH):
            if not messagebox.askyesno("Attention", "Des clés existent déjà. En générer de nouvelles rendra vos anciennes licences invalides. Continuer ?"):
                return
        
        try:
            self.log("Génération des clés RSA 2048 bits...")
            private_key = rsa.generate_private_key(
                public_exponent=65537, key_size=2048, backend=default_backend()
            )
            with open(PRIVATE_KEY_PATH, "wb") as f:
                f.write(private_key.private_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PrivateFormat.PKCS8,
                    encryption_algorithm=serialization.NoEncryption()
                ))
            public_key = private_key.public_key()
            with open(PUBLIC_KEY_PATH, "wb") as f:
                f.write(public_key.public_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PublicFormat.SubjectPublicKeyInfo
                ))
            self.log("✅ Clés RSA générées avec succès.")
            messagebox.showinfo("Succès", "Nouvelles clés générées.\nN'oubliez pas de mettre à jour la clé publique dans le Backend Django !")
        except Exception as e:
            self.log(f"❌ Erreur : {str(e)}")

    def handle_generate(self):
        pharma = self.pharmacie_var.get().strip()
        doc = self.pharmacien_var.get().strip()
        hw_id = self.hw_id_var.get().strip() or "ANY"

        if not pharma or not doc:
            messagebox.showwarning("Incomplet", "Veuillez remplir au moins le nom de la pharmacie et du pharmacien.")
            return

        if not os.path.exists(PRIVATE_KEY_PATH):
            messagebox.showerror("Erreur", "Clé privée introuvable. Générez les clés d'abord.")
            return

        try:
            self.log(f"Préparation de la licence pour : {pharma}")

            # Gestion plan LIFETIME
            plan = self.plan_var.get()
            days = int(self.days_var.get())
            is_lifetime = (plan == "LIFETIME" or days == 0)

            # Préparer le payload
            payload = {
                "pharmacie_nom": pharma,
                "pharmacien_nom": doc,
                "hardware_id": hw_id,
                "plan": "LIFETIME" if is_lifetime else plan,
                "iat": datetime.datetime.utcnow(),
            }

            # Ajouter expiration seulement si ce n'est pas une licence à vie
            if not is_lifetime:
                exp_date = datetime.datetime.utcnow() + datetime.timedelta(days=days)
                payload["exp"] = exp_date

            with open(PRIVATE_KEY_PATH, "rb") as key_file:
                priv_key = serialization.load_pem_private_key(
                    key_file.read(), password=None, backend=default_backend()
                )

            token = jwt.encode(payload, priv_key, algorithm="RS256")

            # Sauvegarde du fichier
            file_name = f"licence_{pharma.replace(' ', '_').lower()}.lic"
            file_path = os.path.join(BASE_DIR, file_name)
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(token)

            self.log(f"✅ Licence générée : {file_name}")
            if is_lifetime:
                self.log(f"♾️ Licence à vie (LIFETIME)")
            else:
                self.log(f"📅 Expire le : {exp_date.strftime('%d/%m/%Y')}")

            messagebox.showinfo("Succès", f"Fichier de licence créé :\n{file_name}\n\nVous pouvez maintenant l'envoyer au client.")

        except Exception as e:
            self.log(f"❌ Erreur de génération : {str(e)}")

if __name__ == "__main__":
    root = tk.Tk()
    app = LicenceApp(root)
    root.mainloop()
