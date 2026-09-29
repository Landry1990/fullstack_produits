# ESC/POS — État des travaux (reprise 2026-09-28)

## ✅ Fait

- **Impression ESC/POS native via QZ Tray** implémentée et déployée :
  - `src/utils/escpos/encoder.ts` — commandes brutes (init, align, bold, double-size, WCP1252, barcode CODE128, cut, tiroir)
  - `src/utils/escpos/ticketEscpos.ts` — mapping TicketCaisse → ESC/POS (48 chars/80mm, 32/58mm)
  - `src/services/qzPrinter.ts` — connexion QZ (ports 8181/8182…), `qz_printer_name` + `qz_open_drawer` en localStorage
  - `src/utils/print/printTicketSmart.ts` — ESC/POS d'abord, fallback iframe HTML
  - Intégré dans `TicketPreviewModal` + `CaisseTicketPreviewModal`
  - `PrintingTab` : détection imprimantes, champ nom, checkbox tiroir, bouton test
- **CSP corrigée** : `index.html` meta tag + `nginx.conf` → `ws://localhost:*`, `127.0.0.1:*`, `localhost.qz.io:*`
  (⚠️ la CSP effective est dans la `<meta>` de index.html, PAS le header nginx — `location /` écrase les add_header)
- Marge haute ticket réduite (2mm → 1mm)
- Fallback HTML intact si QZ absent

## 🔜 À faire demain

1. **Brancher la POS-80** et tester :
   - Paramètres > Impression → "Détecter" → sélectionner POS-80 → "Tester l'impression"
   - Premier popup QZ Tray → cocher "Remember this decision" → Allow
   - Vérifier : netteté, accents FR (é/è/à via WCP1252), montants colonne droite, coupe auto, tiroir
   - Puis un vrai ticket de caisse

2. **Impression auto après vente** (demande utilisateur — ticket sans aperçu) :
   - Brancher `printTicketSmart` dans le onSuccess de la vente (`hooks/useInvoiceActions.tsx` ou équivalent)
   - Ajouter option dans réglages : "Imprimer automatiquement après chaque vente" (checkbox, localStorage `qz_auto_print`)
   - Comportement attendu : vente validée → ticket sort + tiroir s'ouvre, sans modal

3. **Étiquettes thermiques (TSPL)** — imprimante Xprinter/TSC :
   - Nouveau `src/utils/tspl/encoder.ts` (SIZE, GAP, TEXT, BARCODE, PRINT, DIRECTION, CLS)
   - Mapping `LabelData` (SimplePrintLabelsModal) → TSPL ; formats 40x20 / 30x15
   - `qz_label_printer_name` séparé dans PrintingTab (imprimante différente de la caisse)
   - Fallback : flux HTML actuel inchangé

4. **Certificat QZ Tray** (optionnel) : signer les requêtes pour éviter le popup "Allow" initial

## ⚠️ Pièges connus

- **Kaspersky** : son option "Inject script into web traffic" injecte une CSP qui bloque `ws://localhost:8182`.
  Fix : décocher l'option dans Kaspersky → Paramètres → Réseau. À documenter pour les clients.
- **Service worker PWA** : après déploiement, Ctrl+Maj+R obligatoire (l'ancien index.html garde l'ancienne CSP).
- qz-tray npm v2.3.0 : warning bénin "Unable to load LNA library" (require inexistant en browser) — ignorer.
