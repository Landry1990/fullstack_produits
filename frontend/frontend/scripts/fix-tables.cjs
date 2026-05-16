const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'Perimes.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

content = content.replace(
  /<w-full text-sm border-separate border-spacing-0 className="w-full text-sm border-separate border-spacing-0"/g,
  '<table className="w-full text-sm border-separate border-spacing-0"'
);

content = content.replace(
  /<w-full text-sm border-separate border-spacing-0 className="w-full text-xs border-separate border-spacing-0"/g,
  '<table className="w-full text-xs border-separate border-spacing-0"'
);

content = content.replace(
  /<w-full text-sm border-separate border-spacing-0 style=/g,
  '<table style='
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed tables');
