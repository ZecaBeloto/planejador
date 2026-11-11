// Ponte entre as páginas e o Web App do Apps Script, e a chave de acesso guardada no navegador.

var CHAVE_STORAGE = 'planejadorChave';

function lerChave() {
  try { return localStorage.getItem(CHAVE_STORAGE) || ''; } catch (e) { return ''; }
}

function salvarChave(chave) {
  try { localStorage.setItem(CHAVE_STORAGE, chave); } catch (e) { /* sem armazenamento: vale só nesta aba */ }
}

function apagarChave() {
  try { localStorage.removeItem(CHAVE_STORAGE); } catch (e) { /* nada a apagar */ }
}

// POST text/plain: evita o preflight de CORS, que o Apps Script não responde.
function chamar(action, dados) {
  var corpo = JSON.stringify(Object.assign({ action: action }, dados || {}));
  var controle = typeof AbortController === 'function' ? new AbortController() : null;
  var timer = controle ? setTimeout(function () { controle.abort(); }, 30000) : null;
  return fetch(WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: corpo,
    signal: controle ? controle.signal : undefined,
  })
    .then(function (res) { return res.json(); })
    .catch(function () { return { ok: false, erro: 'Erro de conexão. Tente novamente.' }; })
    .finally(function () { if (timer) clearTimeout(timer); });
}

function sairParaInicio() {
  apagarChave();
  location.replace('index.html');
}

// Confere a chave com o Web App. Sem chave ou com sessão vencida, volta para a página inicial.
function exigirSessao() {
  var chave = lerChave();
  if (!chave) { sairParaInicio(); return new Promise(function () {}); }
  return chamar('sessao', { chave: chave }).then(function (r) {
    if (r.ok) return { nome: r.nome };
    if (r.codigo === 'sessao') { sairParaInicio(); return new Promise(function () {}); }
    throw new Error(r.erro || 'Erro de conexão. Tente novamente.');
  });
}

function sair() {
  var chave = lerChave();
  apagarChave();
  var fim = function () { location.replace('index.html'); };
  if (!chave) return fim();
  chamar('sair', { chave: chave }).then(fim, fim);
}
