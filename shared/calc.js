// Cálculos e validações do planejador. Roda no Node (testes) e no Apps Script (via Shared.gs).

var MAX_SIMULACOES = 6;
var MAX_TEXTO = 120;

function arredondar(valor, casas) {
  var f = Math.pow(10, casas);
  return Math.round(valor * f) / f;
}

// Mesma conta de calcular_patrimonio no app.py: mês a mês, juros sobre o saldo e depois o aporte mensal.
function calcularPatrimonio(salario, pct, taxa, aporte, anos) {
  var aporteMensal = salario * (pct / 100);
  var patrimonio = aporte;
  var labels = [];
  var valores = [];
  for (var mes = 0; mes <= anos * 12; mes++) {
    labels.push(arredondar(mes / 12, 2));
    valores.push(arredondar(patrimonio, 2));
    patrimonio = patrimonio * (1 + taxa / 100) + aporteMensal;
  }
  return { labels: labels, valores: valores };
}

function taxaMensalEq(taxaAnual) {
  return arredondar((Math.pow(1 + taxaAnual / 100, 1 / 12) - 1) * 100, 4);
}

function numero(v) {
  var n = Number(v);
  return isFinite(n) ? n : 0;
}

// Devolve uma posição por simulação recebida: null para as vazias, como o "continue" do script atual.
function validarSimulacoes(lista) {
  if (!Array.isArray(lista) || lista.length > MAX_SIMULACOES) return { ok: false, erro: 'Simulações inválidas.' };
  var sims = lista.map(function (s) {
    s = s || {};
    var salario = numero(s.salario);
    var aporte = numero(s.aporte);
    if (!salario && !aporte) return null;
    var anos = Math.floor(numero(s.anos)) || 30;
    anos = Math.min(100, Math.max(1, anos));
    return { salario: salario, pct: numero(s.pct), taxa: numero(s.taxa), aporte: aporte, anos: anos };
  });
  return { ok: true, sims: sims };
}

function normalizarEmail(s) {
  return String(s == null ? '' : s).trim().toLowerCase();
}

function texto(s) {
  return String(s == null ? '' : s).trim().slice(0, MAX_TEXTO);
}

function validarCadastro(dados) {
  dados = dados || {};
  var nome = texto(dados.nome);
  var whatsapp = texto(dados.whatsapp);
  var email = normalizarEmail(dados.email).slice(0, MAX_TEXTO);
  if (!nome || !whatsapp || !email) return { ok: false, erro: 'Preencha todos os campos.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, erro: 'Informe um e-mail válido.' };
  return { ok: true, dados: { nome: nome, whatsapp: whatsapp, email: email } };
}

if (typeof module !== 'undefined') {
  module.exports = {
    calcularPatrimonio: calcularPatrimonio,
    taxaMensalEq: taxaMensalEq,
    validarSimulacoes: validarSimulacoes,
    normalizarEmail: normalizarEmail,
    validarCadastro: validarCadastro,
  };
}
