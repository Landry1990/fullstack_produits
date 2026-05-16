const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'Perimes.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

const replacements = [
  ['bg-base-100','bg-white'],['bg-base-200/50','bg-gray-50'],['bg-base-200/30','bg-gray-50'],['bg-base-200','bg-gray-100'],['bg-base-50/50','bg-gray-50'],['bg-base-50','bg-gray-50'],['border-base-300/50','border-gray-200'],['border-base-300','border-gray-200'],['border-base-200','border-gray-100'],['text-base-content/40','text-gray-400'],['text-base-content/30','text-gray-400'],['text-base-content/20','text-gray-300'],['text-base-content/50','text-gray-500'],['text-base-content/60','text-gray-500'],['text-base-content/70','text-gray-500'],['text-base-content/80','text-gray-500'],['text-base-content','text-gray-900'],['hover:bg-base-50','hover:bg-gray-50'],['hover:bg-base-200/30','hover:bg-gray-50'],['hover:bg-base-300','hover:bg-gray-200'],['divide-base-100','divide-gray-100'],['divide-base-200','divide-gray-200'],
  ['bg-primary/5','bg-indigo-50'],['bg-primary/10','bg-indigo-50'],['bg-primary/20','bg-indigo-100'],['text-primary-content','text-white'],['text-primary','text-indigo-600'],['bg-primary','bg-indigo-600'],['border-primary/10','border-indigo-100'],['border-primary/20','border-indigo-200'],['border-primary/30','border-indigo-200'],['border-primary','border-indigo-500'],
  ['bg-error/5','bg-red-50'],['bg-error/10','bg-red-50'],['bg-error/20','bg-red-100'],['bg-error/30','bg-red-100'],['text-error','text-red-600'],['border-error/30','border-red-200'],['border-error','border-red-500'],
  ['bg-warning/10','bg-amber-50'],['bg-warning/20','bg-amber-100'],['text-warning','text-amber-600'],['border-warning/30','border-amber-200'],['border-warning','border-amber-500'],
  ['bg-info/10','bg-blue-50'],['bg-info/20','bg-blue-100'],['text-info','text-blue-600'],['border-info/30','border-blue-200'],['border-info','border-blue-500'],
  ['bg-success/10','bg-emerald-50'],['bg-success/20','bg-emerald-100'],['text-success','text-emerald-600'],['border-success/30','border-emerald-200'],['border-success','border-emerald-500'],
  ['card bg-gradient-to-br from-error/10 to-error/5 border border-error/30 shadow-sm','bg-gradient-to-br from-red-50 to-red-50/50 border border-red-200 shadow-sm rounded-xl p-5'],
  ['card bg-gradient-to-br from-warning/10 to-warning/5 border border-warning/30 shadow-sm','bg-gradient-to-br from-amber-50 to-amber-50/50 border border-amber-200 shadow-sm rounded-xl p-5'],
  ['card bg-gradient-to-br from-info/10 to-info/5 border border-info/30 shadow-sm','bg-gradient-to-br from-blue-50 to-blue-50/50 border border-blue-200 shadow-sm rounded-xl p-5'],
  ['card bg-base-100 border border-base-200 shadow-sm','bg-white border border-gray-100 shadow-sm rounded-xl p-5'],
  ['card bg-white border border-gray-100 shadow-sm','bg-white border border-gray-100 shadow-sm rounded-xl p-5'],
  ['card bg-white border border-gray-200 shadow-sm','bg-white border border-gray-200 shadow-sm rounded-xl p-5'],
  ['card-body p-5','p-5'],['card-body p-0','p-0'],['card-body','p-5'],['card-title','font-bold text-lg'],['card ',''],
  ['table table-xs table-pin-rows w-full border-separate border-spacing-0','w-full text-xs border-separate border-spacing-0'],
  ['table table-sm w-full','w-full text-sm border-separate border-spacing-0'],
  ['table w-full text-left','w-full text-left text-sm border-separate border-spacing-0'],
  ['table table-xs w-full','w-full text-xs border-separate border-spacing-0'],
  ['table-sm','text-sm'],['table-xs','text-xs'],['table-pin-rows',''],['table ','w-full text-sm border-separate border-spacing-0 '],
  ['badge badge-sm font-black px-2 py-2 gap-1.5 bg-red-50 text-red-600 border-none','inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200 gap-1.5'],
  ['badge badge-sm font-black px-2 py-2 gap-1.5 bg-amber-50 text-amber-600 border-none','inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 gap-1.5'],
  ['badge badge-error badge-sm','inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200'],
  ['badge badge-sm','inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200'],
  ['badge ','inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200 '],
  ['checkbox checkbox-xs checkbox-error rounded-md','size-3.5 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer'],
  ['checkbox checkbox-xs checkbox-primary rounded-md','size-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer'],
  ['checkbox checkbox-xs rounded-md','size-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer'],
  ['checkbox ','size-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer '],
  ['input input-bordered input-sm rounded-lg','w-full rounded-lg border border-gray-200 bg-white h-8 px-3 text-sm font-medium text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 transition-all'],
  ['input input-bordered w-full bg-gray-100 border-gray-200 rounded-lg py-2.5 px-3 font-medium text-gray-900 focus:ring-indigo-500','w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 px-3 text-sm font-medium text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 transition-all'],
  ['input input-bordered w-full bg-gray-100 border-gray-200 rounded-lg py-3 px-4 font-medium text-gray-900 focus:ring-indigo-500','w-full rounded-lg border border-gray-200 bg-gray-50 py-3 px-4 text-sm font-medium text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 transition-all'],
  ['input input-bordered w-full bg-gray-100 border-gray-200 rounded-lg py-4 px-4 text-2xl font-semibold text-indigo-600 focus:ring-indigo-500 pr-16 text-right','w-full rounded-lg border border-gray-200 bg-gray-50 py-4 px-4 text-2xl font-semibold text-indigo-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 transition-all pr-16 text-right'],
  ['select select-ghost select-xs font-bold text-[11px] h-7 focus:bg-transparent','w-full rounded-lg border border-gray-200 bg-transparent h-7 px-2 text-[11px] font-bold text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 transition-all'],
  ['select select-bordered w-full bg-gray-100 border-gray-200 rounded-lg py-2.5 font-medium text-gray-900 focus:ring-indigo-500','w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 px-3 text-sm font-medium text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 transition-all'],
  ['select select-bordered w-full bg-gray-100 border-gray-200 rounded-lg py-2 font-medium text-gray-900','w-full rounded-lg border border-gray-200 bg-gray-50 py-2 px-3 text-sm font-medium text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 transition-all'],
  ['btn btn-sm btn-primary gap-2 h-9','inline-flex items-center justify-center gap-2 h-9 px-3 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm'],
  ['btn btn-sm btn-ghost gap-2 text-gray-500 hover:text-gray-900 h-9','inline-flex items-center gap-2 h-9 px-3 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-lg text-xs font-medium transition-colors'],
  ['btn btn-sm btn-outline gap-2 rounded-lg','inline-flex items-center gap-2 px-3 py-1.5 border border-gray-200 bg-white text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors'],
  ['btn btn-sm btn-success text-white gap-2 rounded-lg','inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm'],
  ['btn btn-xs btn-error btn-outline h-7 px-3 rounded-lg','inline-flex items-center gap-1 h-7 px-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-bold hover:bg-red-100 transition-all'],
  ['btn btn-xs btn-ghost','inline-flex items-center gap-1 px-2 py-1 text-gray-500 hover:bg-gray-50 rounded-md text-xs font-medium transition-colors'],
  ['btn btn-sm btn-ghost','inline-flex items-center gap-1.5 px-2.5 py-1.5 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors'],
  ['btn btn-sm btn-outline','inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 bg-white text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors'],
  ['btn btn-sm','inline-flex items-center gap-1.5 px-3 py-1.5 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors'],
  ['btn ','inline-flex items-center gap-1.5 px-3 py-1.5 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors '],
  ['loading loading-spinner loading-lg text-indigo-600 opacity-20','inline-block size-8 border-2 border-gray-200 border-t-indigo-600 rounded-full animate-spin opacity-20'],
  ['loading loading-spinner loading-lg text-indigo-600','inline-block size-8 border-2 border-gray-200 border-t-indigo-600 rounded-full animate-spin'],
  ['loading loading-spinner loading-lg','inline-block size-8 border-2 border-gray-200 border-t-indigo-600 rounded-full animate-spin'],
  ['loading loading-spinner','inline-block size-4 border-2 border-gray-200 border-t-indigo-600 rounded-full animate-spin'],
  ['alert alert-error','p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 flex items-start gap-2'],
  ['alert ','p-3 rounded-lg flex items-start gap-2 '],
  ['dropdown dropdown-bottom','relative inline-block'],
  ['dropdown-content z-[100] menu p-2 shadow-lg bg-white rounded-box w-56 border border-gray-100 mt-2','absolute z-50 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[14rem] py-1'],
  ['dropdown-content','absolute z-50 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[14rem] py-1'],
  ['menu-title px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400','px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400'],
  ['menu p-2','flex flex-col gap-0.5 p-2'],
  ['menu ','flex flex-col gap-0.5 '],
  [/\btab\b tab-sm gap-2 h-8 rounded-lg transition-all duration-200/g,'inline-flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-medium transition-all duration-200'],
  [/\btab-active\b bg-indigo-600 text-white shadow-md/g,'bg-indigo-600 text-white shadow-sm'],
  [/\btab\b /g,'inline-flex items-center h-8 px-3 rounded-lg text-xs font-medium transition-all duration-200 '],
  ['tabs tabs-boxed bg-gray-50 p-1 border border-gray-200 rounded-xl','inline-flex items-center gap-1 bg-gray-50 p-1 border border-gray-200 rounded-xl'],
  ['stats shadow-sm border border-gray-100 w-full mb-4','grid grid-cols-1 divide-y divide-gray-100 shadow-sm border border-gray-100 w-full mb-4 rounded-xl'],
  ['stat-title text-xs font-bold uppercase text-gray-500','text-xs font-bold uppercase text-gray-500'],
  ['stat-value text-red-600 text-2xl','text-red-600 text-2xl font-bold'],
  ['stat-desc font-medium text-gray-400','text-sm font-medium text-gray-400'],
  ['stat ','p-4 '],
  ['rounded-box','rounded-lg'],
  ['shadow-inner',''],
  ['shadow-2xl','shadow-lg'],
  ['shadow-xl','shadow-md'],
  ['opacity-100',''],
  ['animate-fade-in',''],
  ['animate-in fade-in slide-in-from-left-2 duration-200',''],
  ['animate-in fade-in duration-300',''],
  ['no-scrollbar',''],
];

for (const [from, to] of replacements) {
  if (typeof from === 'string') {
    content = content.split(from).join(to);
  } else {
    content = content.replace(from, to);
  }
}

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Done');
