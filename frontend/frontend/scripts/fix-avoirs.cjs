const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'components', 'avoirs', 'AvoirsForm.tsx');
let c = fs.readFileSync(file, 'utf-8');

// Fix <block ... className="block ..."> → <label className="block ...">
c = c.replace(/<block text-sm font-medium text-gray-500 mb-1 className="block text-sm font-medium text-gray-500 mb-1">/g, '<label className="block text-sm font-medium text-gray-500 mb-1">');

// Fix <w-full text-sm border-separate border-spacing-0 className="..."> → <table className="...">
c = c.replace(/<w-full text-sm border-separate border-spacing-0 className="w-full text-sm border-separate border-spacing-0 w-full">/g, '<table className="w-full text-sm border-separate border-spacing-0">');

fs.writeFileSync(file, c, 'utf-8');
console.log('Fixed AvoirsForm.tsx');
