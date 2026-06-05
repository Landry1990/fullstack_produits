/**
 * Script d'extraction des textes en dur à traduire
 * Analyse les fichiers .tsx et .ts du dossier src/
 * Ignore les className, key, id, name (attributs techniques), les nombres, etc.
 */
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');
const REPORT_PATH = path.join(__dirname, '..', 'i18n_audit_report.md');

const IGNORED_PROPS = new Set([
  'className','class','style','key','id','name','type','placeholder',
  'htmlFor','href','src','alt','title','aria-label','aria-labelledby',
  'data-testid','data-tip','role','target','rel','method','action',
  'encType','autoComplete','autoFocus','readOnly','maxLength','pattern',
  'min','max','step','accept','multiple','dir','lang','download','ref',
  'viewBox','fill','stroke','strokeWidth','strokeLinecap','strokeLinejoin',
  'd','cx','cy','r','x','y','width','height','xmlns','version','d',
  'clipRule','fillRule','fr','to','from','xmlnsXlink','xlinkHref',
  'strokeDasharray','strokeDashoffset','transform','gradientUnits',
  'offset','stopColor','stopOpacity','fx','fy','spreadMethod','gradientTransform'
]);

const TECHNICAL_WORDS = /^[a-z][a-zA-Z0-9]*$|^\d+$|^[A-Z_]+$|^[a-z-]+$|^[a-z_]+$|^[0-9:\/\-.,]+$|^\*.*\*$/;

function walkDir(dir, extensions, callback) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
      walkDir(fullPath, extensions, callback);
    } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
      callback(fullPath);
    }
  }
}

function extractStrings(content, filePath) {
  const results = [];
  const lines = content.split('\n');

  // Regex pour attraper les strings entre guillemets doubles dans JSX et JS
  // C'est une approximation ; on va chercher les patterns les plus évidents
  const stringRegex = /"([^"\n]{2,100})"|'([^'\n]{2,100})'/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Ignorer les imports et les commentaires
    if (line.trim().startsWith('import ') || line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

    let match;
    const regex = new RegExp(stringRegex.source, 'g');
    while ((match = regex.exec(line)) !== null) {
      const str = match[1] || match[2];
      const fullMatch = match[0];
      const startIdx = match.index;

      // Ignorer si c'est une clé d'objet technique
      const before = line.substring(0, startIdx).trim();
      const after = line.substring(startIdx + fullMatch.length).trim();

      // Ignorer les strings qui sont des valeurs de props techniques
      const prevChar = line.charAt(startIdx - 1);
      const nextChar = line.charAt(startIdx + fullMatch.length);

      // Détecter si c'est une prop JSX : prop="string"
      const propMatch = before.match(/(\w+)\s*=\s*$/);
      if (propMatch) {
        const propName = propMatch[1];
        if (IGNORED_PROPS.has(propName)) continue;
      }

      // Ignorer les strings dans des objets de style inline (sauf si c'est du texte visible)
      if (before.endsWith('style={{') || before.endsWith(':') && before.includes('style')) continue;

      // Ignorer les URLs / chemins
      if (str.startsWith('/') || str.startsWith('http') || str.startsWith('data:') || str.startsWith('#')) continue;

      // Ignorer les noms de variables / classes Tailwind complexes qui sont juste des strings
      if (str.includes('size-') || str.includes('btn-') || str.includes('bg-') || str.includes('text-') || str.includes('border-') || str.includes('rounded-') || str.includes('shadow-') || str.includes('p-') || str.includes('m-') || str.includes('w-') || str.includes('h-') || str.includes('flex') || str.includes('grid') || str.includes('gap-') || str.includes('max-w-') || str.includes('min-h-') || str.includes('overflow-') || str.includes('hidden') || str.includes('block') || str.includes('inline')) {
        // Vérifier si c'est probablement une classe Tailwind entière (pas de texte français)
        if (/^[a-z0-9\-\/\:\[\]\(\)\%\_\.\#\s]+$/.test(str) && !/[àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ]/.test(str)) {
          continue;
        }
      }

      // Ignorer si c'est purement technique
      if (TECHNICAL_WORDS.test(str)) continue;

      // Ignorer si c'est déjà un appel t()
      if (before.includes('t(') || before.includes('i18n')) continue;

      // Ignorer les strings très courtes qui sont probablement des keys
      if (str.length <= 1) continue;

      // Ignorer les strings qui sont juste des émojis ou symboles
      if (/^[\s\p{Emoji}\p{P}\d]+$/.test(str)) continue;

      results.push({
        line: lineNum,
        text: str,
        context: line.trim().substring(0, 120)
      });
    }
  }
  return results;
}

const fileResults = [];

walkDir(SRC_DIR, ['.tsx', '.ts'], (filePath) => {
  const relPath = path.relative(path.join(__dirname, '..'), filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  const strings = extractStrings(content, filePath);
  if (strings.length > 0) {
    fileResults.push({ file: relPath, count: strings.length, strings });
  }
});

// Trier par nombre de strings décroissant
fileResults.sort((a, b) => b.count - a.count);

// Générer le rapport
let report = `# Rapport d'audit i18n — Textes en dur\n\n`;
report += `**Total fichiers concernés :** ${fileResults.length}\n\n`;
report += `## Fichiers prioritaires (top 50)\n\n`;
report += `| Fichier | Nb textes |\n|---------|-----------|\n`;

for (const f of fileResults.slice(0, 50)) {
  report += `| ${f.file} | ${f.count} |\n`;
}

report += `\n\n## Détails par fichier\n\n`;

for (const f of fileResults.slice(0, 30)) {
  report += `### ${f.file}\n\n`;
  for (const s of f.strings.slice(0, 20)) {
    report += `- L${s.line}: \`${s.text.replace(/`/g, '\\`')}\`\n`;
  }
  if (f.strings.length > 20) {
    report += `- ... et ${f.strings.length - 20} autres\n`;
  }
  report += `\n`;
}

fs.writeFileSync(REPORT_PATH, report, 'utf-8');
console.log(`Rapport généré : ${REPORT_PATH}`);
console.log(`Fichiers concernés : ${fileResults.length}`);
