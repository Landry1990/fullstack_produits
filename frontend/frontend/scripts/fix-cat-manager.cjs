const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'components', 'common', 'CategoryManager.tsx');
let c = fs.readFileSync(file, 'utf-8');

const replacements = [
  // Base
  ['border-base-100','border-gray-100'],['from-base-50','from-gray-50'],['to-base-50','to-gray-50'],
  // Dynamic bg-primary -> bg-indigo-600 but careful with conditional classes
  ["'bg-primary ","'bg-indigo-600 "],["'bg-primary'","'bg-indigo-600'"],
  // text-primary-content -> text-white
  ['text-indigo-600-content','text-white'],
  // shadow-primary
  ['shadow-primary/30','shadow-indigo-500/30'],['shadow-primary/20','shadow-indigo-500/20'],
  // ring-primary
  ['focus:ring-primary/20','focus:ring-indigo-500/20'],
  // Loading
  ['loading loading-dots text-indigo-600','inline-block size-6 border-2 border-gray-200 border-t-indigo-600 rounded-full animate-spin'],
  ['loading loading-spinner loading-lg text-indigo-600','inline-block size-8 border-2 border-gray-200 border-t-indigo-600 rounded-full animate-spin'],
  ['loading loading-spinner loading-lg','inline-block size-8 border-2 border-gray-200 border-t-indigo-600 rounded-full animate-spin'],
  // Badges
  ['badge badge-outline opacity-50','inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border border-gray-200 text-gray-500 opacity-50'],
  // Buttons - specific patterns from the file
  ['btn btn-primary btn-sm btn-circle shadow-lg shadow-indigo-500/20','inline-flex items-center justify-center size-8 bg-indigo-600 text-white rounded-full text-sm font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20'],
  ['btn btn-primary rounded-2xl px-6 gap-2 shadow-lg shadow-indigo-500/20','inline-flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20'],
  ['btn btn-primary rounded-xl px-10 shadow-lg shadow-indigo-500/20','inline-flex items-center justify-center px-10 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20'],
  ['btn btn-outline btn-success rounded-2xl px-4 gap-2','inline-flex items-center gap-2 px-4 py-2 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-bold hover:bg-emerald-100 transition-all'],
  ['btn btn-sm btn-circle btn-ghost','inline-flex items-center justify-center size-8 rounded-full text-gray-500 hover:bg-gray-50 transition-colors'],
  // btn-xs btn-square variants
  ['btn btn-xs btn-square','inline-flex items-center justify-center size-7 rounded-md text-gray-500 hover:bg-gray-50 transition-colors'],
  ['btn-xs btn-square text-info','size-7 rounded-md text-blue-600 hover:bg-blue-50 transition-colors inline-flex items-center justify-center'],
  ['btn-square text-info','text-blue-600 hover:bg-blue-50 inline-flex items-center justify-center'],
  ['btn-square','inline-flex items-center justify-center'],
  // btn-ghost in conditionals
  ["? 'btn-ghost' : 'btn-info btn-outline border-none'","? 'text-gray-500 hover:bg-gray-50' : 'text-blue-600 hover:bg-blue-50 bg-blue-50 rounded-md border-0'"],
  ["? 'btn-ghost' : 'btn-primary btn-outline border-none'","? 'text-gray-500 hover:bg-gray-50' : 'text-indigo-600 hover:bg-indigo-50 bg-indigo-50 rounded-md border-0'"],
  // Select
  ['select select-bordered w-full h-12 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all','w-full rounded-xl border border-gray-200 bg-white h-12 px-3 text-sm font-medium text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 transition-all'],
  // Input duplicate fix
  ['w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 transition-all h-8 w-full pl-10 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500/20','w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 h-8 text-sm font-medium text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 transition-all'],
  // btn-ghost standalone
  ['btn btn-ghost','inline-flex items-center gap-1.5 px-3 py-1.5 text-gray-500 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors'],
  // Modal
  ['modal modal-open z-[100] modal-bottom sm:modal-middle','fixed inset-0 z-[100] flex items-center justify-center bg-black/50'],
  ['modal-backdrop','absolute inset-0 bg-black/50'],
  // Misc
  ['animate-in fade-in duration-500',''],
];

for (const [from, to] of replacements) {
  c = c.split(from).join(to);
}

fs.writeFileSync(file, c, 'utf-8');
console.log('Done');
