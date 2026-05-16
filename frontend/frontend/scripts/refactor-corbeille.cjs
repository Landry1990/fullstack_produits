const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'components', 'Corbeille.tsx');
let c = fs.readFileSync(file, 'utf-8');

const replacements = [
  // Base colors
  ['bg-base-200/50','bg-gray-50'],['bg-base-200/30','bg-gray-50'],['bg-base-200/80','bg-gray-100'],['bg-base-200','bg-gray-100'],['bg-base-100/60','bg-white/60'],['bg-base-100','bg-white'],['border-base-300','border-gray-200'],['border-base-200/60','border-gray-100/60'],['border-base-200','border-gray-100'],['text-base-content/40','text-gray-400'],['text-base-content/30','text-gray-300'],['text-base-content/50','text-gray-500'],['text-base-content/60','text-gray-500'],['text-base-content/70','text-gray-500'],['text-base-content/80','text-gray-500'],['text-base-content','text-gray-900'],['hover:bg-base-200/30','hover:bg-gray-50'],['hover:bg-base-200','hover:bg-gray-100'],['hover:bg-base-100','hover:bg-gray-50'],
  // Primary accents
  ['bg-primary/10','bg-indigo-50'],['text-primary','text-indigo-600'],['border-primary/30','border-indigo-200'],['ring-primary/20','ring-indigo-200'],['shadow-primary/5','shadow-indigo-50/50'],
  // Checkboxes
  ['checkbox checkbox-sm checkbox-primary','size-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer'],
  // Inputs
  ['input input-bordered w-full pl-10 pr-8 rounded-xl h-10 text-sm bg-gray-50 border-gray-200 focus:border-indigo-500 focus:bg-white','w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-8 h-10 text-sm font-medium text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 transition-all'],
  // Buttons
  ['btn btn-xs btn-ghost text-emerald-600 hover:bg-emerald-50 gap-1 rounded-lg','inline-flex items-center gap-1 px-2 py-1 rounded-lg text-emerald-600 hover:bg-emerald-50 text-xs font-medium transition-colors'],
  ['btn btn-xs btn-ghost text-red-500 hover:bg-red-50 gap-1 rounded-lg','inline-flex items-center gap-1 px-2 py-1 rounded-lg text-red-500 hover:bg-red-50 text-xs font-medium transition-colors'],
  ['btn btn-sm btn-ghost text-gray-500 hover:text-indigo-600','inline-flex items-center gap-1.5 px-2.5 py-1.5 text-gray-500 hover:text-indigo-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors'],
  ['btn btn-sm btn-ghost text-gray-500 rounded-xl','inline-flex items-center gap-1.5 px-2.5 py-1.5 text-gray-500 hover:bg-gray-50 rounded-xl text-sm font-medium transition-colors'],
  ['btn btn-sm btn-success text-white gap-1 rounded-xl','inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm'],
  ['btn btn-sm btn-error text-white gap-1 rounded-xl','inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors shadow-sm'],
  ['btn btn-sm btn-error text-white gap-1.5 rounded-xl','inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors shadow-sm'],
  // Loading
  ['loading loading-spinner loading-xs','inline-block size-3 border-2 border-gray-200 border-t-indigo-600 rounded-full animate-spin'],
  ['loading loading-spinner loading-lg text-indigo-600','inline-block size-8 border-2 border-gray-200 border-t-indigo-600 rounded-full animate-spin'],
  // Table
  ['table w-full','w-full text-sm border-separate border-spacing-0'],
  // Misc
  ['animate-in fade-in',''],
  ['opacity-100',''],
];

for (const [from, to] of replacements) {
  c = c.split(from).join(to);
}

fs.writeFileSync(file, c, 'utf-8');
console.log('Done');
