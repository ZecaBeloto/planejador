// Copia a lógica compartilhada para o Apps Script, que não tem módulos.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

fs.mkdirSync(path.join(root, 'apps-script'), { recursive: true });
fs.writeFileSync(path.join(root, 'apps-script/Shared.gs'), read('shared/calc.js') + '\n' + read('shared/email.js'));
