#!/usr/bin/env node
/**
 * Audit Dark Mode - Détecte toutes les couleurs hardcodées
 * Usage: node audit_dark_mode.js
 */

const fs = require('fs');
const path = require('path');

const COMPONENTS_DIR = './components';
const PAGES_DIR = './pages';

// Patterns à détecter (couleurs hardcodées non DaisyUI)
const PATTERNS = [
  // Grays
  { name: 'bg-white', regex: /bg-white\b/g, severity: 'high' },
  { name: 'bg-gray-50', regex: /bg-gray-50\b/g, severity: 'high' },
  { name: 'bg-gray-100', regex: /bg-gray-100\b/g, severity: 'high' },
  { name: 'bg-gray-200', regex: /bg-gray-200\b/g, severity: 'high' },
  { name: 'bg-gray-300', regex: /bg-gray-300\b/g, severity: 'high' },
  { name: 'border-gray-200', regex: /border-gray-200\b/g, severity: 'high' },
  { name: 'border-gray-100', regex: /border-gray-100\b/g, severity: 'high' },
  { name: 'text-gray-900', regex: /text-gray-900\b/g, severity: 'high' },
  { name: 'text-gray-700', regex: /text-gray-700\b/g, severity: 'high' },
  { name: 'text-gray-600', regex: /text-gray-600\b/g, severity: 'high' },
  { name: 'text-gray-500', regex: /text-gray-500\b/g, severity: 'high' },
  { name: 'text-gray-400', regex: /text-gray-400\b/g, severity: 'high' },
  { name: 'text-gray-300', regex: /text-gray-300\b/g, severity: 'medium' },
  
  // Couleurs hardcodées spécifiques (hors DaisyUI)
  { name: 'bg-indigo-50', regex: /bg-indigo-50\b/g, severity: 'medium' },
  { name: 'bg-indigo-100', regex: /bg-indigo-100\b/g, severity: 'medium' },
  { name: 'bg-blue-50', regex: /bg-blue-50\b/g, severity: 'medium' },
  { name: 'bg-emerald-50', regex: /bg-emerald-50\b/g, severity: 'medium' },
  { name: 'bg-red-50', regex: /bg-red-50\b/g, severity: 'medium' },
  { name: 'bg-amber-50', regex: /bg-amber-50\b/g, severity: 'medium' },
  { name: 'bg-orange-50', regex: /bg-orange-50\b/g, severity: 'medium' },
  { name: 'bg-purple-50', regex: /bg-purple-50\b/g, severity: 'medium' },
  
  // Text colors spécifiques
  { name: 'text-indigo-600', regex: /text-indigo-600\b/g, severity: 'medium' },
  { name: 'text-blue-600', regex: /text-blue-600\b/g, severity: 'medium' },
  { name: 'text-emerald-600', regex: /text-emerald-600\b/g, severity: 'medium' },
  { name: 'text-red-600', regex: /text-red-600\b/g, severity: 'medium' },
  { name: 'text-amber-600', regex: /text-amber-600\b/g, severity: 'medium' },
  { name: 'text-orange-600', regex: /text-orange-600\b/g, severity: 'medium' },
  
  // Slate (alias de gray)
  { name: 'bg-slate-50', regex: /bg-slate-50\b/g, severity: 'high' },
  { name: 'bg-slate-100', regex: /bg-slate-100\b/g, severity: 'high' },
  { name: 'text-slate-900', regex: /text-slate-900\b/g, severity: 'high' },
  { name: 'text-slate-700', regex: /text-slate-700\b/g, severity: 'high' },
  { name: 'text-slate-600', regex: /text-slate-600\b/g, severity: 'high' },
  { name: 'text-slate-500', regex: /text-slate-500\b/g, severity: 'high' },
  { name: 'text-slate-400', regex: /text-slate-400\b/g, severity: 'high' },
  
  // Bordures colorées
  { name: 'border-indigo-500', regex: /border-indigo-500\b/g, severity: 'low' },
  { name: 'border-blue-500', regex: /border-blue-500\b/g, severity: 'low' },
  { name: 'focus:ring-indigo-50', regex: /focus:ring-indigo-50\b/g, severity: 'low' },
  
  // Inline styles avec couleurs hardcodées
  { name: 'style={{.*#[0-9a-fA-F]', regex: /style=\{\{[^}]*#[0-9a-fA-F]{3,6}/g, severity: 'high' },
  { name: 'style={{.*rgb(', regex: /style=\{\{[^}]*rgb\(/g, severity: 'high' },
];

const EXCLUDED_DIRS = ['node_modules', 'dist', '.git', 'coverage', '__tests__'];

function findFiles(dir, extensions) {
  const files = [];
  
  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item.name);
      
      if (item.isDirectory()) {
        if (!EXCLUDED_DIRS.includes(item.name)) {
          traverse(fullPath);
        }
      } else if (extensions.some(ext => item.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

function auditFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const issues = [];
  
  for (const pattern of PATTERNS) {
    const matches = content.match(pattern.regex);
    if (matches) {
      // Compter les lignes
      const lines = content.split('\n');
      const lineNumbers = [];
      
      for (let i = 0; i < lines.length; i++) {
        if (pattern.regex.test(lines[i])) {
          lineNumbers.push(i + 1);
        }
        // Reset regex lastIndex
        pattern.regex.lastIndex = 0;
      }
      
      issues.push({
        pattern: pattern.name,
        severity: pattern.severity,
        count: matches.length,
        lines: lineNumbers.slice(0, 5) // Limiter à 5 lignes
      });
    }
  }
  
  return issues;
}

function main() {
  console.log('🌙 AUDIT DARK MODE - Détection des couleurs hardcodées\n');
  
  const files = findFiles('.', ['.tsx', '.ts', '.jsx', '.js']);
  
  const results = [];
  let totalIssues = 0;
  let filesWithIssues = 0;
  
  for (const file of files) {
    const issues = auditFile(file);
    if (issues.length > 0) {
      const fileIssues = issues.reduce((sum, i) => sum + i.count, 0);
      totalIssues += fileIssues;
      filesWithIssues++;
      
      results.push({
        file: file.replace(/^\.\//, '').replace(/^components\//, '').replace(/^pages\//, ''),
        issues: fileIssues,
        details: issues
      });
    }
  }
  
  // Trier par nombre d'issues décroissant
  results.sort((a, b) => b.issues - a.issues);
  
  // Affichage
  console.log(`📊 RÉSULTATS: ${totalIssues} problèmes dans ${filesWithIssues} fichiers\n`);
  
  console.log('🔴 TOP 20 FICHIERS À CORRIGER EN PRIORITÉ:\n');
  
  results.slice(0, 20).forEach((result, index) => {
    console.log(`${index + 1}. ${result.file}`);
    console.log(`   ${result.issues} problèmes:`);
    result.details.slice(0, 5).forEach(d => {
      console.log(`   - ${d.pattern}: ${d.count}x (lignes: ${d.lines.join(', ')})`);
    });
    console.log('');
  });
  
  // Group by directory
  const byDir = {};
  for (const result of results) {
    const dir = result.file.split('/')[0];
    byDir[dir] = (byDir[dir] || 0) + result.issues;
  }
  
  console.log('\n📁 PROBLÈMES PAR DOSSIER:\n');
  Object.entries(byDir)
    .sort((a, b) => b[1] - a[1])
    .forEach(([dir, count]) => {
      console.log(`  ${dir}: ${count} problèmes`);
    });
  
  // Créer rapport JSON
  const report = {
    totalFiles: files.length,
    filesWithIssues,
    totalIssues,
    topFiles: results.slice(0, 30),
    byDirectory: byDir
  };
  
  fs.writeFileSync('./dark-mode-audit-report.json', JSON.stringify(report, null, 2));
  console.log('\n✅ Rapport complet sauvegardé: dark-mode-audit-report.json');
}

main();
