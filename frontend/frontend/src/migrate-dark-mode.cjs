#!/usr/bin/env node
/**
 * Migration automatique Dark Mode
 * Remplace en masse les couleurs hardcodées par les classes DaisyUI
 * 
 * Usage: node migrate-dark-mode.cjs
 * Mode test: node migrate-dark-mode.cjs --dry-run
 */

const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');

// Mapping des remplacements
const REPLACEMENTS = [
  // === FONDS (Backgrounds) ===
  { from: /\bbg-white\b/g, to: 'bg-base-100', description: 'Fond principal' },
  { from: /\bbg-gray-50\b/g, to: 'bg-base-200', description: 'Fond secondaire' },
  { from: /\bbg-gray-100\b/g, to: 'bg-base-200', description: 'Fond secondaire' },
  { from: /\bbg-gray-200\b/g, to: 'bg-base-300', description: 'Fond tertiaire' },
  { from: /\bbg-slate-50\b/g, to: 'bg-base-200', description: 'Fond secondaire' },
  { from: /\bbg-slate-100\b/g, to: 'bg-base-200', description: 'Fond secondaire' },
  
  // === BORDURES ===
  { from: /\bborder-gray-200\b/g, to: 'border-base-300', description: 'Bordure standard' },
  { from: /\bborder-gray-100\b/g, to: 'border-base-200', description: 'Bordure légère' },
  { from: /\bborder-gray-300\b/g, to: 'border-base-300', description: 'Bordure' },
  { from: /\bborder-slate-200\b/g, to: 'border-base-300', description: 'Bordure' },
  
  // === TEXTES ===
  { from: /\btext-gray-900\b/g, to: 'text-base-content', description: 'Texte principal' },
  { from: /\btext-gray-800\b/g, to: 'text-base-content', description: 'Texte principal' },
  { from: /\btext-gray-700\b/g, to: 'text-base-content', description: 'Texte principal' },
  { from: /\btext-gray-600\b/g, to: 'text-base-content/70', description: 'Texte secondaire' },
  { from: /\btext-gray-500\b/g, to: 'text-base-content/60', description: 'Texte secondaire' },
  { from: /\btext-gray-400\b/g, to: 'text-base-content/50', description: 'Texte tertiaire' },
  { from: /\btext-gray-300\b/g, to: 'text-base-content/40', description: 'Texte faible' },
  { from: /\btext-slate-900\b/g, to: 'text-base-content', description: 'Texte principal' },
  { from: /\btext-slate-800\b/g, to: 'text-base-content', description: 'Texte principal' },
  { from: /\btext-slate-700\b/g, to: 'text-base-content', description: 'Texte principal' },
  { from: /\btext-slate-600\b/g, to: 'text-base-content/70', description: 'Texte secondaire' },
  { from: /\btext-slate-500\b/g, to: 'text-base-content/60', description: 'Texte secondaire' },
  { from: /\btext-slate-400\b/g, to: 'text-base-content/50', description: 'Texte tertiaire' },
  
  // === FONDS SÉMANTIQUES (couleurs pastels à remplacer) ===
  { from: /\bbg-indigo-50\b/g, to: 'bg-primary/10', description: 'Fond primaire léger' },
  { from: /\bbg-indigo-100\b/g, to: 'bg-primary/20', description: 'Fond primaire' },
  { from: /\bbg-blue-50\b/g, to: 'bg-info/10', description: 'Fond info léger' },
  { from: /\bbg-blue-100\b/g, to: 'bg-info/20', description: 'Fond info' },
  { from: /\bbg-emerald-50\b/g, to: 'bg-success/10', description: 'Fond succès léger' },
  { from: /\bbg-emerald-100\b/g, to: 'bg-success/20', description: 'Fond succès' },
  { from: /\bbg-red-50\b/g, to: 'bg-error/10', description: 'Fond erreur léger' },
  { from: /\bbg-red-100\b/g, to: 'bg-error/20', description: 'Fond erreur' },
  { from: /\bbg-amber-50\b/g, to: 'bg-warning/10', description: 'Fond warning léger' },
  { from: /\bbg-amber-100\b/g, to: 'bg-warning/20', description: 'Fond warning' },
  { from: /\bbg-orange-50\b/g, to: 'bg-warning/10', description: 'Fond warning léger' },
  { from: /\bbg-orange-100\b/g, to: 'bg-warning/20', description: 'Fond warning' },
  { from: /\bbg-purple-50\b/g, to: 'bg-secondary/10', description: 'Fond secondaire léger' },
  { from: /\bbg-purple-100\b/g, to: 'bg-secondary/20', description: 'Fond secondaire' },
  
  // === TEXTES SÉMANTIQUES ===
  { from: /\btext-indigo-600\b/g, to: 'text-primary', description: 'Texte primaire' },
  { from: /\btext-indigo-700\b/g, to: 'text-primary', description: 'Texte primaire' },
  { from: /\btext-blue-600\b/g, to: 'text-info', description: 'Texte info' },
  { from: /\btext-blue-700\b/g, to: 'text-info', description: 'Texte info' },
  { from: /\btext-emerald-600\b/g, to: 'text-success', description: 'Texte succès' },
  { from: /\btext-emerald-700\b/g, to: 'text-success', description: 'Texte succès' },
  { from: /\btext-red-600\b/g, to: 'text-error', description: 'Texte erreur' },
  { from: /\btext-red-700\b/g, to: 'text-error', description: 'Texte erreur' },
  { from: /\btext-amber-600\b/g, to: 'text-warning', description: 'Texte warning' },
  { from: /\btext-amber-700\b/g, to: 'text-warning', description: 'Texte warning' },
  { from: /\btext-orange-600\b/g, to: 'text-warning', description: 'Texte warning' },
  { from: /\btext-orange-700\b/g, to: 'text-warning', description: 'Texte warning' },
  
  // === BOUTONS ET ÉTATS ===
  { from: /\bbg-indigo-600\b/g, to: 'bg-primary', description: 'Bouton primaire' },
  { from: /\bhover:bg-indigo-700\b/g, to: 'hover:bg-primary-focus', description: 'Hover bouton primaire' },
  { from: /\bbg-blue-600\b/g, to: 'bg-info', description: 'Bouton info' },
  { from: /\bhover:bg-blue-700\b/g, to: 'hover:bg-info-focus', description: 'Hover bouton info' },
  { from: /\bbg-emerald-600\b/g, to: 'bg-success', description: 'Bouton succès' },
  { from: /\bhover:bg-emerald-700\b/g, to: 'hover:bg-success-focus', description: 'Hover bouton succès' },
  { from: /\bbg-red-600\b/g, to: 'bg-error', description: 'Bouton erreur' },
  { from: /\bhover:bg-red-700\b/g, to: 'hover:bg-error-focus', description: 'Hover bouton erreur' },
  { from: /\bbg-amber-600\b/g, to: 'bg-warning', description: 'Bouton warning' },
  { from: /\bhover:bg-amber-700\b/g, to: 'hover:bg-warning-focus', description: 'Hover bouton warning' },
  
  // === DIVIDE ET SÉPARATIONS ===
  { from: /\bdivide-gray-200\b/g, to: 'divide-base-300', description: 'Séparation' },
  { from: /\bdivide-gray-100\b/g, to: 'divide-base-200', description: 'Séparation légère' },
  
  // === FOCUS ET RING ===
  { from: /\bfocus:ring-indigo-50\b/g, to: 'focus:ring-primary/20', description: 'Ring focus' },
  { from: /\bfocus:ring-indigo-500\b/g, to: 'focus:ring-primary', description: 'Ring focus' },
  { from: /\bfocus:border-indigo-500\b/g, to: 'focus:border-primary', description: 'Focus bordure' },
  
  // === OPACITÉ ET ÉTATS ===
  { from: /\bopacity-20\b/g, to: 'text-base-content/20', description: 'Opacité faible' },
  { from: /\bopacity-30\b/g, to: 'text-base-content/30', description: 'Opacité faible' },
  { from: /\bopacity-50\b/g, to: 'text-base-content/50', description: 'Opacité moyenne' },
  { from: /\bopacity-70\b/g, to: 'text-base-content/70', description: 'Opacité forte' },
];

const EXCLUDED_DIRS = ['node_modules', 'dist', '.git', 'coverage', '__tests__', 'i18n', 'hooks', 'context', 'services', 'utils', 'types'];
const INCLUDED_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];

function findFiles(dir) {
  const files = [];
  
  function traverse(currentDir) {
    let items;
    try {
      items = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (e) {
      return;
    }
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item.name);
      
      if (item.isDirectory()) {
        if (!EXCLUDED_DIRS.includes(item.name)) {
          traverse(fullPath);
        }
      } else if (INCLUDED_EXTENSIONS.some(ext => item.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

function migrateFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  let newContent = content;
  const changes = [];
  
  for (const rule of REPLACEMENTS) {
    const matches = newContent.match(rule.from);
    if (matches) {
      const count = matches.length;
      newContent = newContent.replace(rule.from, rule.to);
      changes.push({
        description: rule.description,
        original: rule.from.source,
        replacement: rule.to,
        count
      });
    }
  }
  
  return { newContent, changes, hasChanges: changes.length > 0 };
}

function main() {
  console.log('🌙 MIGRATION AUTOMATIQUE DARK MODE\n');
  console.log(`Mode: ${DRY_RUN ? 'TEST (dry-run)' : 'PRODUCTION'}\n`);
  
  const files = findFiles('./components');
  let totalFiles = 0;
  let filesModified = 0;
  let totalChanges = 0;
  
  const report = [];
  
  for (const file of files) {
    totalFiles++;
    const { newContent, changes, hasChanges } = migrateFile(file);
    
    if (hasChanges) {
      filesModified++;
      const fileChanges = changes.reduce((sum, c) => sum + c.count, 0);
      totalChanges += fileChanges;
      
      report.push({
        file: file.replace('./components/', ''),
        changes: fileChanges,
        details: changes
      });
      
      if (!DRY_RUN) {
        fs.writeFileSync(file, newContent, 'utf-8');
      }
    }
  }
  
  // Trier par nombre de changements
  report.sort((a, b) => b.changes - a.changes);
  
  console.log(`📊 RÉSULTATS:\n`);
  console.log(`  Fichiers analysés: ${totalFiles}`);
  console.log(`  Fichiers modifiés: ${filesModified}`);
  console.log(`  Total changements: ${totalChanges}\n`);
  
  console.log(`🔴 TOP 15 FICHIERS MODIFIÉS:\n`);
  report.slice(0, 15).forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.file}`);
    console.log(`     ${r.changes} changements`);
    const topChanges = r.details.slice(0, 3);
    topChanges.forEach(c => {
      console.log(`     - ${c.original} → ${c.replacement}: ${c.count}x`);
    });
    console.log('');
  });
  
  if (DRY_RUN) {
    console.log('\n⚠️  MODE TEST - Aucun fichier n\'a été modifié');
    console.log('   Relancez sans --dry-run pour appliquer les changements');
  } else {
    console.log('\n✅ MIGRATION TERMINÉE');
    console.log('   N\'oubliez pas de builder et tester !');
  }
  
  // Sauvegarder rapport
  fs.writeFileSync('./migration-report.json', JSON.stringify({
    mode: DRY_RUN ? 'dry-run' : 'production',
    totalFiles,
    filesModified,
    totalChanges,
    topFiles: report.slice(0, 30)
  }, null, 2));
  
  console.log('\n📄 Rapport sauvegardé: migration-report.json');
}

main();
