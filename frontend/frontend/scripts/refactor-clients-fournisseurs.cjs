const fs = require('fs');
const path = require('path');

const files = [
  'src/components/Clients.tsx',
  'src/components/clients/BulkDeleteWarningModal.tsx',
  'src/components/clients/ClientDeleteWarningModal.tsx',
  'src/components/clients/ClientDepositModal.tsx',
  'src/components/clients/ClientFormModal.tsx',
  'src/components/clients/PurchaseHistoryDrawer.tsx',
  'src/components/Fournisseurs.tsx',
  'src/components/fournisseurs/FournisseurDetails.tsx',
  'src/components/fournisseurs/FournisseurFormModals.tsx',
  'src/components/fournisseurs/FournisseursList.tsx',
  'src/components/fournisseurs/SupplierDashboard.tsx',
];

const replacements = [
  [/bg-base-100/g, 'bg-white'],
  [/bg-base-200/g, 'bg-gray-50'],
  [/bg-base-300/g, 'bg-gray-100'],
  [/border-base-200/g, 'border-gray-200'],
  [/border-base-300/g, 'border-gray-200'],
  [/text-base-content/g, 'text-gray-900'],
  [/text-base-content\/70/g, 'text-gray-500'],
  [/text-base-content\/60/g, 'text-gray-500'],
  [/text-base-content\/50/g, 'text-gray-400'],
  [/text-base-content\/40/g, 'text-gray-400'],
  [/btn btn-primary/g, 'btn-ref btn-primary'],
  [/btn btn-success/g, 'btn-ref btn-success'],
  [/btn btn-error/g, 'btn-ref btn-error'],
  [/btn btn-ghost/g, 'btn-ref btn-ghost'],
  [/btn btn-outline/g, 'btn-ref btn-outline'],
  [/btn btn-info/g, 'btn-ref btn-info'],
  [/btn btn-square/g, 'btn-ref btn-square'],
  [/btn btn-sm/g, 'btn-ref btn-sm'],
  [/badge badge-ghost/g, 'badge-ref badge-ghost'],
  [/badge badge-success/g, 'badge-ref badge-success'],
  [/badge badge-error/g, 'badge-ref badge-error'],
  [/badge badge-warning/g, 'badge-ref badge-warning'],
  [/badge badge-info/g, 'badge-ref badge-info'],
  [/badge badge-primary/g, 'badge-ref badge-primary'],
  [/badge badge-secondary/g, 'badge-ref badge-secondary'],
  [/input input-bordered/g, 'input-ref input-bordered'],
  [/select select-bordered/g, 'select-ref select-bordered'],
  [/textarea textarea-bordered/g, 'textarea-ref textarea-bordered'],
  [/checkbox checkbox-sm checkbox-primary/g, 'checkbox-ref checkbox-sm checkbox-primary'],
  [/loading loading-spinner/g, 'loading-ref loading-spinner'],
  [/alert alert-error/g, 'alert-ref alert-error'],
  [/alert alert-warning/g, 'alert-ref alert-warning'],
  [/alert alert-info/g, 'alert-ref alert-info'],
  [/tab-active/g, 'tab-active-ref'],
  [/form-control/g, 'form-control-ref'],
  [/label-text/g, 'label-text-ref'],
  [/rounded-box/g, 'rounded-box-ref'],
  [/card-body/g, 'card-body-ref'],
  [/card-title/g, 'card-title-ref'],
  [/table-zebra/g, 'table-zebra-ref'],
  [/table-sm/g, 'table-sm-ref'],
  [/table-xs/g, 'table-xs-ref'],
  [/table-pin-rows/g, 'table-pin-rows-ref'],
  [/stats shadow/g, 'stats-ref shadow'],
  [/stat-value/g, 'stat-value-ref'],
  [/stat-title/g, 'stat-title-ref'],
  [/stat-desc/g, 'stat-desc-ref'],
  [/dropdown-content/g, 'dropdown-content-ref'],
  [/dropdown-end/g, 'dropdown-end-ref'],
  [/dropdown-bottom/g, 'dropdown-bottom-ref'],
  [/dropdown-hover/g, 'dropdown-hover-ref'],
  [/dropdown/g, 'dropdown-ref'],
  [/menu /g, 'menu-ref '],
  [/bg-primary\/5/g, 'bg-indigo-50'],
  [/bg-primary\/10/g, 'bg-indigo-50'],
  [/hover:bg-primary\/5/g, 'hover:bg-indigo-50'],
  [/focus:border-primary/g, 'focus:border-indigo-500'],
  [/focus:ring-primary/g, 'focus:ring-indigo-500'],
  [/shadow-primary\/20/g, 'shadow-indigo-500/20'],
  [/shadow-primary\/30/g, 'shadow-indigo-500/30'],
  [/text-primary-content/g, 'text-white'],
  [/text-primary\/70/g, 'text-indigo-700'],
  [/ring-primary/g, 'ring-indigo-500'],
];

for (const rel of files) {
  const file = path.join(__dirname, '..', rel);
  if (!fs.existsSync(file)) { console.log('SKIP', rel); continue; }
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  for (const [re, repl] of replacements) {
    content = content.replace(re, repl);
  }
  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log('UPDATED', rel);
  } else {
    console.log('NO CHANGE', rel);
  }
}
