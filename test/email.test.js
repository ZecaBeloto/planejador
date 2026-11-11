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

test('texto do botão de confirmação é azul (#4a8fd4)', () => {
  const m = E.montarEmailConfirmacao('Ana', 'https://x/confirmar.html?t=abc');
  const botao = m.html.match(/<a href="https:\/\/x\/confirmar\.html\?t=abc"[^>]*>/)[0];
  assert.match(botao, /color:#4a8fd4/);
  assert.doesNotMatch(botao, /color:#0e0f11/);
});
