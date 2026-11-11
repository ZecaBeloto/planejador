const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('Shared.gs é a concatenação atual da lógica compartilhada', () => {
  assert.equal(read('apps-script/Shared.gs'), read('shared/calc.js') + '\n' + read('shared/email.js'),
    'rode: node scripts/sync-shared.js');
});
