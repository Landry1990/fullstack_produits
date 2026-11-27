export type LabelTsplItem = {
  name: string;
  barcode: string;
  barcodeType: 'CODE128' | 'DATAMATRIX';
  price?: string;
  /** Nom de la pharmacie, centré en haut (comme l'aperçu navigateur). */
  header?: string;
  /** Lignes de méta déjà formatées, empilées en bas à gauche
   *  (ex. "L:CMD64-1643", "15/07/26", "EXP:01/29", "UBIPHARM"). */
  meta?: string[];
  count: number;
};

// TSPL quoted strings: backslash-escape quotes; remove command/control injection.
// eslint-disable-next-line no-control-regex -- filtrage volontaire des caractères de contrôle
const quote = (value: string): string => value.replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\\/g, '\\\\').replace(/"/g, '\\"');

// Fonte « 1 » TSPL = 8×12 dots ; « 2 » = 12×20. 203 dpi ≈ 8 dots/mm.
const FONT1_W = 8;
const FONT1_H = 12;
const FONT2_W = 12;
const FONT2_H = 20;

export function buildLabelsTspl(items: LabelTsplItem[], format: '40x20' | '30x15'): string {
  const compact = format === '30x15';
  // 40×20 mm → 320×160 dots ; 30×15 mm → 240×120 dots. Marge 8 dots.
  const width = compact ? 30 : 40;
  const height = compact ? 15 : 20;
  const dotsW = width * 8;
  const margin = 8;
  const printableW = dotsW - margin * 2;
  // Palier intermédiaire du nom produit (fonte 2, 12×20) — 40×20 seulement.
  const maxNameChars = Math.floor(printableW / FONT2_W);
  const barcodeHeight = compact ? 30 : 46;
  const metaLineH = compact ? 11 : FONT1_H;
  const maxMetaLines = compact ? 3 : 5;
  // La colonne méta laisse ~55% de la largeur au prix affiché à droite.
  const maxMetaChars = Math.floor((printableW * 0.45) / FONT1_W);

  const centerX = (text: string, mul = 1) =>
    Math.max(margin, Math.round((dotsW - text.length * FONT1_W * mul) / 2));

  const fit = (s: string, max: number) =>
    s.length > max ? s.slice(0, Math.max(1, max - 2)) + '..' : s;

  return items.filter(item => Number.isFinite(item.count) && item.count > 0).map(item => {
    const commands = [
      `SIZE ${width} mm, ${height} mm`,
      'GAP 2 mm, 0 mm',
      'DIRECTION 1',
      'CLS',
    ];

    let y = compact ? 2 : 4;

    // En-tête : nom de la pharmacie centré
    if (item.header) {
      const header = fit(item.header.toUpperCase(), maxNameChars);
      commands.push(`TEXT ${centerX(header)},${y},"1",0,1,1,"${quote(header)}"`);
      y += FONT1_H;
    }

    // Nom produit : 3 paliers de taille selon la longueur (fonte 1 ×2 →
    // fonte 2 → fonte 1). Au-delà, le nom passe sur DEUX lignes plutôt que
    // d'être tronqué — le code-barres est raccourci d'autant pour que la
    // zone méta (ancrée en bas) ne soit jamais débordée.
    let wrappedName = false;
    if (item.name) {
      const upper = item.name.toUpperCase();
      let font = '1';
      let mul = 1;
      let charW = FONT1_W;
      let charH = FONT1_H;
      if (upper.length <= Math.floor(printableW / (FONT1_W * 2))) {
        font = '1'; mul = 2; charW = FONT1_W * 2; charH = FONT1_H * 2;   // 16×24
      } else if (!compact && upper.length <= maxNameChars) {
        font = '2'; charW = FONT2_W; charH = FONT2_H;                  // 12×20
      }
      const cap = Math.floor(printableW / charW);
      if (!compact && upper.length > cap) {
        // Coupure sur espace si possible, sinon coupe franche à `cap`.
        const cut = upper.lastIndexOf(' ', cap);
        const first = upper.slice(0, cut > cap / 2 ? cut : cap);
        const second = fit(upper.slice(first.length).trim(), cap);
        commands.push(`TEXT ${margin},${y},"${font}",0,${mul},${mul},"${quote(first)}"`);
        commands.push(`TEXT ${margin},${y + charH},"${font}",0,${mul},${mul},"${quote(second)}"`);
        y += charH * 2;
        wrappedName = true;
      } else {
        const name = fit(upper, cap);
        commands.push(`TEXT ${margin},${y},"${font}",0,${mul},${mul},"${quote(name)}"`);
        y += charH;
      }
    }

    // Code-barres / DataMatrix centré — raccourci si le nom a pris 2 lignes.
    const effectiveBarHeight = wrappedName ? barcodeHeight - FONT1_H : barcodeHeight;
    if (item.barcode) {
      const barY = y + 2;
      if (item.barcodeType === 'DATAMATRIX') {
        // TSPL DMATRIX: x,y,width,height,x-module,y-module,content (ECC200).
        const size = compact ? 56 : 80;
        const dmX = Math.max(margin, Math.round((dotsW - size) / 2));
        commands.push(`DMATRIX ${dmX},${barY},${size},${size},2,2,"${quote(item.barcode)}"`);
        y = barY + size + 4;
      } else {
        // human_readable=1 : le CIP s'imprime sous les barres (comme l'aperçu).
        // Centrage estimé : CODE128 ≈ 11 modules/car (jeu C pour les chiffres
        // → 2 chiffres/car) + start/check/stop ≈ 35 modules, × 2 dots/module.
        const numericPairs = /^\d+$/.test(item.barcode);
        const symbolChars = numericPairs ? Math.ceil(item.barcode.length / 2) : item.barcode.length;
        const barWidth = (symbolChars * 11 + 35) * 2;
        const barX = Math.max(margin, Math.round((dotsW - barWidth) / 2));
        // human_readable=0 : le texte natif sous les barres se décalait/s'effaçait
        // sur la Hoin — le CIP est imprimé nous-même, centré, juste en dessous.
        commands.push(`BARCODE ${barX},${barY},"128",${effectiveBarHeight},0,0,2,2,"${quote(item.barcode)}"`);
        const cipText = fit(item.barcode, maxNameChars);
        commands.push(`TEXT ${centerX(cipText)},${barY + effectiveBarHeight + 2},"1",0,1,1,"${quote(cipText)}"`);
        y = barY + effectiveBarHeight + 2 + FONT1_H;
      }
    }

    // Zone basse : méta à gauche, prix en grand à droite
    const meta = (item.meta ?? []).filter(Boolean).slice(0, maxMetaLines);
    const bottomY = (compact ? 120 : 160) - margin;
    if (item.price) {
      // Prix court en ×2 (16×24, bien visible), prix long en ×1 — suffixe « F »
      // court, jamais tronqué (~55% de la largeur réservée au prix).
      const mul = item.price.length <= 10 ? 2 : 1;
      const price = fit(item.price, Math.floor((printableW * 0.55) / (FONT1_W * mul)));
      const x = Math.max(margin, dotsW - margin - price.length * FONT1_W * mul);
      commands.push(`TEXT ${x},${bottomY - FONT1_H * mul},"1",0,${mul},${mul},"${quote(price)}"`);
    }
    let metaY = Math.max(y + 2, bottomY - meta.length * metaLineH);
    for (const line of meta) {
      const txt = quote(fit(line, maxMetaChars));
      // Faux-gras : double impression décalée d'1 dot — même taille, plus
      // lisible que la fonte 1 seule (la fonte 2 dépasserait la colonne).
      commands.push(`TEXT ${margin},${metaY},"1",0,1,1,"${txt}"`);
      commands.push(`TEXT ${margin + 1},${metaY},"1",0,1,1,"${txt}"`);
      metaY += metaLineH;
    }

    commands.push(`PRINT 1,${Math.floor(item.count)}`);
    return commands.join('\r\n') + '\r\n';
  }).join('');
}
