const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '..', 'src', 'components', 'Organisation.tsx'),
  path.join(__dirname, '..', 'src', 'components', 'common', 'CategoryManager.tsx'),
  path.join(__dirname, '..', 'src', 'components', 'common', 'ConfigOptionManager.tsx'),
];

const replacements = [
  // Base colors
  ['bg-base-50/50','bg-gray-50'],['bg-base-100/60','bg-white/60'],['bg-base-100','bg-white'],['bg-base-200/50','bg-gray-50'],['bg-base-200/30','bg-gray-50'],['bg-base-200','bg-gray-100'],['bg-base-300','bg-gray-200'],['border-base-300/50','border-gray-200'],['border-base-300','border-gray-200'],['border-base-200','border-gray-100'],['text-base-content/40','text-gray-400'],['text-base-content/30','text-gray-400'],['text-base-content/20','text-gray-300'],['text-base-content/50','text-gray-500'],['text-base-content/60','text-gray-500'],['text-base-content/70','text-gray-500'],['text-base-content/80','text-gray-500'],['text-base-content','text-gray-900'],['hover:bg-base-200','hover:bg-gray-100'],
  // Accents
  ['bg-primary/5','bg-indigo-50'],['bg-primary/10','bg-indigo-50'],['bg-primary/20','bg-indigo-100'],['text-primary','text-indigo-600'],['border-primary/20','border-indigo-200'],['border-primary','border-indigo-500'],
  ['bg-error/10','bg-red-50'],['text-error','text-red-600'],
  ['bg-warning/10','bg-amber-50'],['text-warning','text-amber-600'],
  ['bg-success/10','bg-emerald-50'],['text-success','text-emerald-600'],
  // Checkboxes
  ['checkbox checkbox-sm checkbox-primary','size-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer'],
  ['checkbox checkbox-xs checkbox-primary rounded-md','size-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer'],
  // Inputs
  ['input input-bordered input-sm w-full bg-base-100 border-base-200 focus:bg-white transition-colors','w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-900 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 transition-all h-8'],
  ['input input-bordered w-full','w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 transition-all'],
  ['input input-sm','w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 transition-all h-8'],
  // Select
  ['select select-sm','w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 transition-all h-8'],
  // Textarea
  ['textarea textarea-bordered w-full h-24','w-full rounded-lg border border-gray-200 bg-white p-3 text-sm font-medium text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 transition-all h-24'],
  // Buttons
  ['btn btn-sm btn-primary','inline-flex items-center justify-center h-8 px-3 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm'],
  ['btn btn-xs btn-primary','inline-flex items-center justify-center h-7 px-2.5 bg-indigo-600 text-white rounded-md text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm'],
  ['btn btn-xs btn-ghost','inline-flex items-center gap-1 px-2 py-1 text-gray-500 hover:bg-gray-50 rounded-md text-xs font-medium transition-colors'],
  ['btn btn-sm btn-ghost text-error hover:bg-error/10','inline-flex items-center gap-1.5 px-2.5 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors'],
  ['btn btn-sm btn-ghost','inline-flex items-center gap-1.5 px-2.5 py-1.5 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors'],
  ['btn btn-ghost','inline-flex items-center gap-1.5 px-3 py-1.5 text-gray-500 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors'],
  ['btn btn-square btn-ghost','inline-flex items-center justify-center size-8 rounded-full text-gray-500 hover:bg-gray-50 transition-colors'],
  ['btn btn-circle btn-ghost','inline-flex items-center justify-center size-8 rounded-full text-gray-500 hover:bg-gray-50 transition-colors'],
  // Loading
  ['loading loading-spinner loading-xs','inline-block size-3 border-2 border-gray-200 border-t-indigo-600 rounded-full animate-spin'],
  ['loading loading-spinner loading-sm','inline-block size-4 border-2 border-gray-200 border-t-indigo-600 rounded-full animate-spin'],
  // Modal
  ['modal-box max-w-xl w-full rounded-2xl','bg-white w-full max-w-xl rounded-2xl shadow-lg p-6'],
  ['modal modal-open z-[100] modal-bottom sm:modal-middle','fixed inset-0 z-[100] flex items-center justify-center bg-black/50'],
  // Alert
  ['alert alert-error mb-4','p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 flex items-start gap-2 mb-4'],
  // Table
  ['table table-sm w-full border-separate border-spacing-0','w-full text-sm border-separate border-spacing-0'],
  ['table w-full','w-full text-sm border-separate border-spacing-0'],
  // Cards
  ['card bg-base-100 border border-base-200','bg-white border border-gray-200 rounded-xl p-5'],
  ['card-body p-5','p-5'],
  ['card-body','p-5'],
  ['card-title','font-bold text-lg'],
  ['card ',''],
  // Dropdown
  ['dropdown dropdown-end','relative inline-block'],
  ['dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52 border border-base-200','absolute z-50 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[13rem] py-1'],
  ['dropdown-content','absolute z-50 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[13rem] py-1'],
  ['menu ','flex flex-col gap-0.5 '],
  // Labels
  ['label font-medium text-sm text-base-content/70','block text-sm font-medium text-gray-500 mb-1'],
  ['label ','block text-sm font-medium text-gray-500 mb-1 '],
  // Misc
  ['rounded-box','rounded-lg'],
  ['opacity-100',''],
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  for (const [from, to] of replacements) {
    content = content.split(from).join(to);
  }
  fs.writeFileSync(file, content, 'utf-8');
  console.log('Refactored', path.basename(file));
}
console.log('Done');
