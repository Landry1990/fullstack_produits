# TODO — Session prochaine : WhatsApp Business API

## Objectif
Configurer les tokens WhatsApp Business et tester les envois depuis l'application.

## À faire

### 1. Configuration du token
- [ ] Récupérer le token permanent WhatsApp Business API (Meta Developer Portal)
- [ ] Identifier le `Phone Number ID` et le `WhatsApp Business Account ID`
- [ ] Stocker le token côté backend (variable d'environnement, PAS en dur dans le code)
- [ ] Vérifier que `PharmacySettings` a un champ pour le numéro WhatsApp de la pharmacienne

### 2. Backend — Endpoint d'envoi
- [ ] Vérifier/créer la vue d'envoi WhatsApp dans `api/views/communication.py`
- [ ] Tester l'appel à `https://graph.facebook.com/v19.0/{phone_number_id}/messages`
- [ ] Gérer les erreurs (token expiré, numéro invalide, limite de débit)

### 3. Cas d'usage à tester
- [ ] **Ticket de caisse** — envoi du récapitulatif de vente au client après paiement
- [ ] **Rapport Flash** — rapport journalier pour la pharmacienne (déjà partiellement fait via `generateDashboardFlashText`)
- [ ] **Alerte péremption** — notification automatique pour les stocks critiques
- [ ] **Rappel échéance fournisseur** — notification avant date de règlement

### 4. Frontend
- [ ] Page de test d'envoi dans les paramètres (`/app/pharmacy-settings`)
- [ ] Afficher le statut d'envoi (succès/échec) avec toast
- [ ] Historique des messages envoyés (`whatsapp-logs`)

## Notes techniques
- API : `https://graph.facebook.com/v19.0/`
- Token : stocker dans `backend/.env` → variable `WHATSAPP_TOKEN`
- Format numéro : international sans `+` (ex: `22670000000` pour Burkina)
- Les templates doivent être approuvés par Meta avant utilisation en prod
