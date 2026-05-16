const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '..', 'src', 'components', 'avoirs', 'AvoirsTable.tsx'),
  path.join(__dirname, '..', 'src', 'components', 'avoirs', 'AvoirsDetails.tsx'),
  path.join(__dirname, '..', 'src', 'components', 'avoirs', 'modals', 'AvoirsLotModal.tsx'),
];

for (const file of files) {
  let c = fs.readFileSync(file, 'utf-8');
  // Fix <w-full text-sm border-separate border-spacing-0 className="..."> → <table className="...">
  c = c.replace(/<w-full text-sm border-separate border-spacing-0 className="w-full text-sm border-separate border-spacing-0\s+w-full text-sm">/g, '<table className="w-full text-sm border-separate border-spacing-0">');
  c = c.replace(/<w-full text-sm border-separate border-spacing-0 className="w-full text-sm border-separate border-spacing-0">/g, '<table className="w-full text-sm border-separate border-spacing-0">');
  fs.writeFileSync(file, c, 'utf-8');
  console.log('Fixed', path.basename(file));
}
console.log('Done');
