/**
 * Constructeur bas niveau de commandes ESC/POS pour imprimantes thermiques.
 * Les commandes sont renvoyées sous forme de chaîne contenant des séquences
 * d'octets brutes (\xNN). QZ Tray les envoie telles quelles en mode RAW.
 *
 * Page de code par défaut : Windows 1252 (\x1Bt\x10) pour conserver les accents FR.
 */

const LF = '\x0A';
const ESC = '\x1B';
const GS = '\x1D';

/** Commandes ESC/POS brutes */
export const COMMANDS = {
  init: `${ESC}@`,
  setCodepage: (n = 0x10) => `${ESC}t${String.fromCharCode(n)}`,
  alignLeft: `${ESC}a\x00`,
  alignCenter: `${ESC}a\x01`,
  alignRight: `${ESC}a\x02`,
  boldOn: `${ESC}E\x01`,
  boldOff: `${ESC}E\x00`,
  doubleWidthOn: `${GS}!\x10`,
  doubleWidthOff: `${GS}!\x00`,
  doubleSizeOn: `${GS}!\x11`, // double hauteur + double largeur
  normalSize: `${GS}!\x00`,
  feed: (n = 1) => `${ESC}d${String.fromCharCode(n)}`,
  cutFull: `${GS}V\x00`,
  cutPartial: `${GS}V\x42\x00`,
  drawerPulse: `${ESC}p\x00\x19\xFA`,
} as const;

/**
 * Table de correspondance partielle Unicode → Windows-1252.
 * Couvre les caractères usuels du français ; le reste est remplacé par '?'.
 */
const WCP1252_MAP: Record<string, string> = {
  '€': '\x80',
  '‚': '\x82',
  'ƒ': '\x83',
  '„': '\x84',
  '…': '\x85',
  '†': '\x86',
  '‡': '\x87',
  'ˆ': '\x88',
  '‰': '\x89',
  'Š': '\x8A',
  '‹': '\x8B',
  'Œ': '\x8C',
  'Ž': '\x8E',
  '‘': '\x91',
  '’': '\x92',
  '“': '\x93',
  '”': '\x94',
  '•': '\x95',
  '–': '\x96',
  '—': '\x97',
  '˜': '\x98',
  '™': '\x99',
  'š': '\x9A',
  '›': '\x9B',
  'œ': '\x9C',
  'ž': '\x9E',
  'Ÿ': '\x9F',
  'À': '\xC0',
  'Á': '\xC1',
  'Â': '\xC2',
  'Ã': '\xC3',
  'Ä': '\xC4',
  'Å': '\xC5',
  'Æ': '\xC6',
  'Ç': '\xC7',
  'È': '\xC8',
  'É': '\xC9',
  'Ê': '\xCA',
  'Ë': '\xCB',
  'Ì': '\xCC',
  'Í': '\xCD',
  'Î': '\xCE',
  'Ï': '\xCF',
  'Ð': '\xD0',
  'Ñ': '\xD1',
  'Ò': '\xD2',
  'Ó': '\xD3',
  'Ô': '\xD4',
  'Õ': '\xD5',
  'Ö': '\xD6',
  '×': '\xD7',
  'Ø': '\xD8',
  'Ù': '\xD9',
  'Ú': '\xDA',
  'Û': '\xDB',
  'Ü': '\xDC',
  'Ý': '\xDD',
  'Þ': '\xDE',
  'ß': '\xDF',
  'à': '\xE0',
  'á': '\xE1',
  'â': '\xE2',
  'ã': '\xE3',
  'ä': '\xE4',
  'å': '\xE5',
  'æ': '\xE6',
  'ç': '\xE7',
  'è': '\xE8',
  'é': '\xE9',
  'ê': '\xEA',
  'ë': '\xEB',
  'ì': '\xEC',
  'í': '\xED',
  'î': '\xEE',
  'ï': '\xEF',
  'ð': '\xF0',
  'ñ': '\xF1',
  'ò': '\xF2',
  'ó': '\xF3',
  'ô': '\xF4',
  'õ': '\xF5',
  'ö': '\xF6',
  '÷': '\xF7',
  'ø': '\xF8',
  'ù': '\xF9',
  'ú': '\xFA',
  'û': '\xFB',
  'ü': '\xFC',
  'ý': '\xFD',
  'þ': '\xFE',
  'ÿ': '\xFF',
};

/** Encode une chaîne Unicode en séquences Windows-1252 exploitables par ESC/POS. */
export function encodeWcp1252(text: string): string {
  let out = '';
  for (const ch of String(text)) {
    const code = ch.charCodeAt(0);
    if (code < 128) {
      out += ch;
    } else if (code < 256) {
      // Plage haute Latin-1 (160-255) transmise en un octet directement.
      out += String.fromCharCode(code);
    } else {
      const mapped = WCP1252_MAP[ch];
      out += mapped ?? '?';
    }
  }
  return out;
}

/** Initialise l'imprimante et active le code page Windows-1252. */
export function init(): string {
  return COMMANDS.init + COMMANDS.setCodepage(0x10);
}

/** Active l'alignement : 0 = gauche, 1 = centre, 2 = droite. */
export function align(mode: 0 | 1 | 2): string {
  if (mode === 0) return COMMANDS.alignLeft;
  if (mode === 2) return COMMANDS.alignRight;
  return COMMANDS.alignCenter;
}

export const left = (): string => COMMANDS.alignLeft;
export const center = (): string => COMMANDS.alignCenter;
export const right = (): string => COMMANDS.alignRight;

/** Bascule le gras. */
export function bold(on: boolean): string {
  return on ? COMMANDS.boldOn : COMMANDS.boldOff;
}

export const boldOn = (): string => COMMANDS.boldOn;
export const boldOff = (): string => COMMANDS.boldOff;

/** Bascule la double largeur. */
export function doubleWidth(on: boolean): string {
  return on ? COMMANDS.doubleWidthOn : COMMANDS.normalSize;
}

export function doubleSize(on: boolean): string {
  return on ? COMMANDS.doubleSizeOn : COMMANDS.normalSize;
}

export const normalSize = (): string => COMMANDS.normalSize;

/** Retour chariot / saut de ligne. */
export function lf(): string {
  return LF;
}

/** Texte brut sans saut de ligne. */
export function text(value: string): string {
  return encodeWcp1252(value);
}

/** Ligne de texte avec saut de ligne. */
export function line(value: string): string {
  return text(value) + LF;
}

/** Alimentation papier (n demi-lignes). */
export function feed(n = 1): string {
  return COMMANDS.feed(n);
}

/** Coupe du papier (partielle par défaut). */
export function cut(partial = true): string {
  return partial ? COMMANDS.cutPartial : COMMANDS.cutFull;
}

/** Impulsion d'ouverture du tiroir-caisse. */
export function drawerPulse(): string {
  return COMMANDS.drawerPulse;
}

/** Ligne de séparation horizontale. */
export function hr(width = 48, char = '-'): string {
  const repeatChar = char.charAt(0);
  return line(repeatChar.repeat(Math.max(1, width)));
}

/**
 * Deux colonnes : label à gauche, valeur à droite.
 * La valeur est alignée à droite dans l'espace restant.
 */
export function columns(label: string, value: string, width = 48): string {
  const safeLabel = String(label ?? '');
  const safeValue = String(value ?? '');
  const valueLen = Math.min(safeValue.length, width);
  const labelMax = Math.max(0, width - valueLen - 1);
  const trimmedLabel = safeLabel.length > labelMax ? safeLabel.slice(0, labelMax) : safeLabel;
  const pad = Math.max(0, width - trimmedLabel.length - valueLen);
  return text(trimmedLabel) + ' '.repeat(pad) + text(safeValue) + LF;
}

/** Code-barres CODE128 en mode natif (format B). */
export function barcodeCODE128(data: string): string {
  // CODE128 B accepte l'ASCII imprimable (0x20-0x7E)
  const sanitized = String(data)
    .replace(/[^\x20-\x7E]/g, '')
    .slice(0, 40);
  const payload = `{B${sanitized}`;
  const len = payload.length;
  return `${GS}kI${String.fromCharCode(len)}${payload}`;
}
