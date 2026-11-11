const test = require('node:test');
const assert = require('node:assert');
const E = require('../shared/email.js');

test('montarEmailConfirmacao usa o modelo atual com o link', () => {
  const m = E.montarEmailConfirmacao('Ana <b>', 'https://zecabeloto.github.io/planejador/confirmar.html?t=abc');
  assert.equal(m.assunto, 'Confirme seu e-mail — Helio Beloto Jr');
  assert.ok(m.html.includes('href="https://zecabeloto.github.io/planejador/confirmar.html?t=abc"'));
  assert.ok(m.html.includes('Ana &lt;b&gt;'));
  assert.ok(!m.html.includes('Ana <b>'));
  assert.ok(m.html.includes('24 horas'));
  assert.ok(m.html.includes('Confirmar e-mail'));
});
