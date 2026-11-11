const test = require('node:test');
const assert = require('node:assert');
const C = require('../shared/calc.js');

test('calcularPatrimonio reproduz app.py', () => {
  const r = C.calcularPatrimonio(1000, 10, 1, 0, 1);
  assert.equal(r.valores.length, 13);
  assert.deepEqual(r.labels.slice(0, 3), [0, 0.08, 0.17]);
  assert.equal(r.labels[12], 1);
  assert.deepEqual(r.valores.slice(0, 3), [0, 100, 201]);
  assert.equal(r.valores[12], 1268.25);
  const longo = C.calcularPatrimonio(5000, 20, 0.8, 10000, 30);
  assert.equal(longo.valores.length, 361);
  assert.ok(Math.abs(longo.valores[360] - 2252526.29) <= 0.01);
});

test('taxaMensalEq', () => {
  assert.equal(C.taxaMensalEq(12), 0.9489);
  assert.equal(C.taxaMensalEq(10.5), 0.8355);
});

test('validarSimulacoes ignora vazias, limita anos e quantidade', () => {
  const v = C.validarSimulacoes([
    { salario: 0, pct: 10, taxa: 1, aporte: 0, anos: 30 },
    { salario: 1000, pct: 10, taxa: 1, aporte: 0, anos: 500 },
  ]);
  assert.equal(v.ok, true);
  assert.equal(v.sims.length, 2);
  assert.equal(v.sims[0], null);
  assert.equal(v.sims[1].anos, 100);
  assert.equal(C.validarSimulacoes([{ salario: 1000, pct: 1, taxa: 1, aporte: 0, anos: 0 }]).sims[0].anos, 30);
  assert.equal(C.validarSimulacoes([{ salario: 'abc', pct: 1, taxa: 1, aporte: 0, anos: 1 }]).sims[0], null);
  assert.equal(C.validarSimulacoes(Array(7).fill({ salario: 1, pct: 1, taxa: 1, aporte: 0, anos: 1 })).ok, false);
  assert.equal(C.validarSimulacoes('x').ok, false);
  assert.equal(C.validarSimulacoes('x').erro, 'Simulações inválidas.');
});

test('normalizarEmail e validarCadastro', () => {
  assert.equal(C.normalizarEmail('  Joao@Gmail.com '), 'joao@gmail.com');
  assert.equal(C.validarCadastro({ nome: '', whatsapp: '1', email: 'a@b.c' }).erro, 'Preencha todos os campos.');
  assert.equal(C.validarCadastro({ nome: 'A', whatsapp: '1', email: 'semarroba' }).erro, 'Informe um e-mail válido.');
  assert.equal(C.validarCadastro(null).erro, 'Preencha todos os campos.');
  assert.deepEqual(C.validarCadastro({ nome: ' Ana ', whatsapp: '(14) 99999-0000', email: ' A@B.com ' }).dados,
    { nome: 'Ana', whatsapp: '(14) 99999-0000', email: 'a@b.com' });
  assert.equal(C.validarCadastro({ nome: 'x'.repeat(200), whatsapp: '1', email: 'a@b.com' }).dados.nome.length, 120);
});
