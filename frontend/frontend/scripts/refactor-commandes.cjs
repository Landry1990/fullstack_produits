const fs = require('fs');
const path = require('path');

const files = [
  'src/components/Commandes.tsx',
  'src/components/commandes/CommandeDetails.tsx',
  'src/components/commandes/CommandeForm.tsx',
  'src/components/commandes/CommandeList.tsx',
  'src/components/commandes/CommandeProductTable.tsx',
  'src/components/commandes/MergeCommandesModal.tsx',
  'src/components/commandes/OrderSchedulingModal.tsx',
  'src/components/commandes/ScheduledOrdersListModal.tsx',
  'src/components/commandes/SuggestionCommandeModal.tsx',
  'src/components/commandes/TransferCommandeModal.tsx',
];

const replacements = [
  [/bg-base-100/g, 'bg-white'],
  [/bg-base-200/g, 'bg-gray-50'],
  [/bg-base-300/g, 'bg-gray-100'],
  [/border-base-100/g, 'border-gray-100'],
  [/border-base-200/g, 'border-gray-200'],
  [/border-base-300/g, 'border-gray-300'],
  [/text-base-content\/70/g, 'text-gray-500'],
  [/text-base-content\/50/g, 'text-gray-400'],
  [/text-base-content\/60/g, 'text-gray-500'],
  [/text-base-content\/40/g, 'text-gray-400'],
  [/text-base-content/g, 'text-gray-900'],
  [/bg-primary\/5/g, 'bg-indigo-50'],
  [/border-primary\/10/g, 'border-indigo-500/10'],
  [/text-primary\/40/g, 'text-indigo-500/40'],
  [/text-primary\/50/g, 'text-indigo-500/50'],
  [/text-primary/g, 'text-indigo-600'],
  [/bg-primary/g, 'bg-indigo-600'],
  [/shadow-primary\/20/g, 'shadow-indigo-500/20'],
  [/focus:border-primary/g, 'focus:border-indigo-500'],
  [/focus:ring-primary/g, 'focus:ring-indigo-500'],
  [/ring-primary/g, 'ring-indigo-500'],
  [/btn btn-primary/g, 'btn-ref btn-primary'],
  [/btn btn-ghost/g, 'btn-ref btn-ghost'],
  [/btn btn-info/g, 'btn-ref btn-info'],
  [/btn btn-success/g, 'btn-ref btn-success'],
  [/btn btn-error/g, 'btn-ref btn-error'],
  [/btn btn-warning/g, 'btn-ref btn-warning'],
  [/btn btn-sm/g, 'btn-ref btn-sm'],
  [/btn btn-lg/g, 'btn-ref btn-lg'],
  [/btn btn-xs/g, 'btn-ref btn-xs'],
  [/btn btn-circle/g, 'btn-ref btn-circle'],
  [/btn btn-block/g, 'btn-ref btn-block'],
  [/loading loading-spinner/g, 'loading-ref loading-spinner'],
  [/input input-bordered/g, 'input-ref input-bordered'],
  [/input input-sm/g, 'input-ref input-sm'],
  [/select select-bordered/g, 'select-ref select-bordered'],
  [/textarea textarea-bordered/g, 'textarea-ref textarea-bordered'],
  [/checkbox checkbox-sm checkbox-primary/g, 'checkbox-ref checkbox-sm checkbox-primary'],
  [/checkbox checkbox-primary/g, 'checkbox-ref checkbox-primary'],
  [/checkbox checkbox-sm/g, 'checkbox-ref checkbox-sm'],
  [/badge badge-sm/g, 'badge-ref badge-sm'],
  [/badge badge-xs/g, 'badge-ref badge-xs'],
  [/badge badge-ghost/g, 'badge-ref badge-ghost'],
  [/badge badge-success/g, 'badge-ref badge-success'],
  [/badge badge-error/g, 'badge-ref badge-error'],
  [/badge badge-warning/g, 'badge-ref badge-warning'],
  [/badge badge-info/g, 'badge-ref badge-info'],
  [/table table-zebra/g, 'table table-zebra-ref'],
  [/table table-xs/g, 'table table-xs-ref'],
  [/table table-sm/g, 'table table-sm-ref'],
  [/table table-lg/g, 'table table-lg-ref'],
  [/table table-pin-rows/g, 'table table-pin-rows-ref'],
  [/table table/g, 'table'],
  [/text-success/g, 'text-emerald-600'],
  [/text-error/g, 'text-red-600'],
  [/text-warning/g, 'text-amber-600'],
  [/text-info/g, 'text-blue-600'],
  [/bg-success/g, 'bg-emerald-600'],
  [/bg-error/g, 'bg-red-600'],
  [/bg-warning/g, 'bg-amber-500'],
  [/bg-info/g, 'bg-blue-600'],
  [/bg-success\/10/g, 'bg-emerald-50'],
  [/bg-error\/10/g, 'bg-red-50'],
  [/bg-warning\/10/g, 'bg-amber-50'],
  [/bg-info\/10/g, 'bg-blue-50'],
  [/border-success\/20/g, 'border-emerald-200'],
  [/border-error\/20/g, 'border-red-200'],
  [/border-warning\/20/g, 'border-amber-200'],
  [/border-info\/20/g, 'border-blue-200'],
  [/hover:bg-base-200/g, 'hover:bg-gray-50'],
  [/hover:bg-base-100/g, 'hover:bg-gray-50'],
  [/bg-base-50/g, 'bg-gray-50'],
  [/form-control/g, ''],
  [/label-text/g, 'text-sm font-medium text-gray-700'],
  [/modal-action/g, 'flex justify-end gap-3 pt-4'],
  [/card-body/g, 'p-6'],
  [/card-title/g, 'text-lg font-bold'],
  [/stats shadow/g, ''],
  [/stat/g, ''],
  [/menu menu-sm/g, ''],
  [/menu /g, ''],
  [/dropdown-bottom/g, ''],
  [/rounded-box/g, 'rounded-xl'],
];

files.forEach(relPath => {
  const fullPath = path.join(__dirname, '..', relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`SKIP (not found): ${relPath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  let original = content;

  replacements.forEach(([regex, replacement]) => {
    content = content.replace(regex, replacement);
  });

  if (content !== original) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`UPDATED: ${relPath}`);
  } else {
    console.log(`NO CHANGE: ${relPath}`);
  }
});

console.log('\nDone!');
