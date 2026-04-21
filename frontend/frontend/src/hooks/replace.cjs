const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'useFacturationState.ts');
let content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

// 1. Add imports at line 22
const importIdx = lines.findIndex(l => l.includes("import type { OrdonnanceData }"));
lines.splice(importIdx + 1, 0,
  "import { useFacturationSession } from './useFacturationSession'",
  "import { useFacturationActions } from './useFacturationActions'"
);

// 2. Replace Auto-Save logic
const autoSaveStart = lines.findIndex(l => l.includes("const contextStorageKey = useMemo(() => user?.id ? `activeSaleContext_${user.id}` : null, [user?.id]);"));
const autoSaveEnd = lines.findIndex(l => l.includes("// --- END AUTO-SAVE LOGIC ---"));

if (autoSaveStart !== -1 && autoSaveEnd !== -1) {
  lines.splice(autoSaveStart, autoSaveEnd - autoSaveStart + 1,
    "  useFacturationSession({",
    "    clientsHook,",
    "    ui,",
    "    isRetrocession,",
    "    setIsRetrocession,",
    "    isFactureA4,",
    "    setIsFactureA4,",
    "    cartLength: cart.lignesFacture.length",
    "  });"
  );
} else {
  console.log("Could not find auto save block");
}

// 3. Replace Actions logic
const proformaStart = lines.findIndex(l => l.includes("const handleProforma = async () => {"));
const attenteEnd = lines.findIndex(l => l.includes("supprimerVenteEnAttente = (id: number) => {"));
// Find the end of supprimerVenteEnAttente
let actionEnd = attenteEnd;
while (!lines[actionEnd].includes("     });") && !lines[actionEnd].includes("  }")) {
  actionEnd++;
}
actionEnd++; // Include the closing brace of supprimerVenteEnAttente

if (proformaStart !== -1 && attenteEnd !== -1) {
  lines.splice(proformaStart, actionEnd - proformaStart + 1,
    "  const {",
    "      handleProforma,",
    "      handleBonDeLivraison,",
    "      handleImprimerFacture,",
    "      handleConfirmPrintClientName,",
    "      ouvrirModalPaiement,",
    "      handleSendWhatsApp,",
    "      _resetSale,",
    "      mettreEnAttente,",
    "      annulerVente,",
    "      restaurerVente,",
    "      supprimerVenteEnAttente",
    "  } = useFacturationActions({",
    "      apiBaseUrl,",
    "      cart,",
    "      clientsHook,",
    "      ui,",
    "      totals,",
    "      pendingSales,",
    "      setLoading,",
    "      setError,",
    "      t,",
    "      productSearch,",
    "      searchInputRef,",
    "      paymentInputRef,",
    "      pendingPrintFacture,",
    "      setPendingPrintFacture,",
    "      setShowClientNameModal",
    "  });"
  );
} else {
  console.log("Could not find actions block");
}

fs.writeFileSync(filePath, lines.join('\n'));
console.log("Replacements done successfully");
