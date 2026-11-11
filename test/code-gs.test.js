// Roda apps-script/Code.gs contra um simulador mínimo das APIs do Google.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'apps-script/Shared.gs'), 'utf8') + '\n' +
  fs.readFileSync(path.join(root, 'apps-script/Code.gs'), 'utf8');

const HORA = 3600 * 1000;

// Como o Google Sheets guarda o que é escrito: "'" no início marca texto e some;
// "=", "+" ou "-" no início vira fórmula (aqui, um erro, que nunca casa com o texto original).
function armazenar(v) {
  if (typeof v !== 'string') return v;
  if (v.charAt(0) === "'") return v.slice(1);
  if (/^[=+\-]/.test(v)) return '#ERROR!';
  return v;
}

function makeSheet(name) {
  const sheet = {
    name, rows: [], hidden: false,
    getName: () => sheet.name,
    setName: (n) => { sheet.name = n; return sheet; },
    getLastRow: () => sheet.rows.length,
    appendRow: (row) => { sheet.rows.push(row.map(armazenar)); return sheet; },
    getDataRange: () => ({ getValues: () => sheet.rows.map((r) => r.slice()) }),
    hideSheet: () => { sheet.hidden = true; },
    setFrozenRows: () => {},
    setColumnWidth: () => {},
    getRange: (r, c, nr = 1, nc = 1) => {
      const ensure = () => {
        while (sheet.rows.length < r + nr - 1) sheet.rows.push([]);
      };
      return {
        getValues: () => { ensure(); return sheet.rows.slice(r - 1, r - 1 + nr).map((row) => { const out = []; for (let j = 0; j < nc; j++) out.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]); return out; }); },
        getValue: () => { ensure(); const v = sheet.rows[r - 1][c - 1]; return v === undefined ? '' : v; },
        setValues: (vals) => { ensure(); vals.forEach((row, i) => row.forEach((v, j) => { sheet.rows[r - 1 + i][c - 1 + j] = armazenar(v); })); },
        setValue: (v) => { ensure(); sheet.rows[r - 1][c - 1] = armazenar(v); },
        setFontWeight: () => {},
      };
    },
  };
  return sheet;
}

function world(opts = {}) {
  const clock = { now: Date.UTC(2026, 10, 11, 12, 0, 0) };
  const sheets = [];
  const ss = {
    getId: () => 'ss1',
    getSheets: () => sheets.slice(),
    getSheetByName: (n) => sheets.find((s) => s.name === n) || null,
    insertSheet: (n) => { const s = makeSheet(n); sheets.push(s); return s; },
  };
  const props = { BREVO_API_KEY: 'chave-teste' };
  if (opts.semChave) delete props.BREVO_API_KEY;
  const cache = {};
  const fetches = [];
  const mails = [];
  const http = { status: opts.brevoStatus || 201 };
  let uuid = 0;
  const context = {
    console: { log: () => {}, error: () => {} },
    JSON, Math, Date, Object, Array, String, Number, isFinite,
    SpreadsheetApp: {
      create: () => { sheets.push(makeSheet('Página1')); return ss; },
      openById: () => ss,
      flush: () => {},
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; } }) },
    CacheService: { getScriptCache: () => ({ get: (k) => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: (k) => { delete cache[k]; } }) },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    Utilities: {
      getUuid: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}`,
      DigestAlgorithm: { SHA_256: 'sha256' },
      Charset: { UTF_8: 'utf8' },
      computeDigest: (alg, value) => Array.from(crypto.createHash('sha256').update(value, 'utf8').digest()).map((b) => (b > 127 ? b - 256 : b)),
      base64EncodeWebSafe: (bytes) => Buffer.from(bytes.map((b) => (b + 256) % 256)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
    },
    UrlFetchApp: { fetch: (url, o) => { fetches.push({ url, o }); return { getResponseCode: () => http.status, getContentText: () => '{}' }; } },
    MailApp: { sendEmail: (m) => { if (opts.gmailFalha) throw new Error('cota'); mails.push(m); } },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ setMimeType: () => JSON.parse(t) }) },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  context.agora = () => clock.now;
  context.setup();
  const call = (payload) => context.doPost({ postData: { contents: typeof payload === 'string' ? payload : JSON.stringify(payload) } });
  const contatos = () => ss.getSheetByName('Contatos').rows;
  const tokens = () => ss.getSheetByName('Tokens').rows;
  const clearCache = () => Object.keys(cache).forEach((k) => delete cache[k]);
  // Token do último e-mail enviado, lido do link como o visitante faria.
  const ultimoToken = () => {
    const html = mails.length ? mails[mails.length - 1].htmlBody : JSON.parse(fetches[fetches.length - 1].o.payload).htmlContent;
    return html.match(/confirmar\.html\?t=([A-Za-z0-9]+)/)[1];
  };
  return { context, ss, props, cache, fetches, mails, http, clock, call, contatos, tokens, clearCache, ultimoToken };
}

const ana = { action: 'cadastrar', nome: 'Ana', whatsapp: '(14) 99999-0000', email: 'ana@x.com' };

function entrar(w, dados = ana) {
  assert.equal(w.call(dados).ok, true);
  return w.call({ action: 'confirmar', token: w.ultimoToken() });
}

test('setup cria as abas Contatos e Tokens (oculta)', () => {
  const w = world();
  assert.deepEqual(w.contatos()[0], ['Nome', 'WhatsApp', 'E-mail', 'Confirmado', 'Cadastrado em', 'Confirmado em', 'Último acesso']);
  assert.equal(w.ss.getSheetByName('Tokens').hidden, true);
  assert.equal(w.props.SPREADSHEET_ID, 'ss1');
});

test('cadastro novo grava "Não", envia pelo Brevo e guarda só o hash do token', () => {
  const w = world();
  assert.deepEqual(w.call(ana), { ok: true });
  assert.equal(w.contatos().length, 2);
  assert.deepEqual(w.contatos()[1].slice(0, 4), ['Ana', '(14) 99999-0000', 'ana@x.com', 'Não']);
  assert.equal(w.fetches.length, 1);
  assert.equal(w.fetches[0].url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(w.fetches[0].o.headers['api-key'], 'chave-teste');
  const body = JSON.parse(w.fetches[0].o.payload);
  assert.deepEqual(body.sender, { name: 'Helio Beloto Jr', email: 'heliobelotojr@gmail.com' });
  assert.equal(body.subject, 'Confirme seu e-mail — Helio Beloto Jr');
  const token = w.ultimoToken();
  const celulas = JSON.stringify(w.tokens()) + JSON.stringify(w.contatos());
  assert.ok(!celulas.includes(token));
  assert.equal(w.mails.length, 0);
});

test('e-mail com maiúsculas e espaços cai na mesma linha', () => {
  const w = world();
  w.call(Object.assign({}, ana, { email: '  Ana@X.com ' }));
  w.clearCache();
  w.call(ana);
  assert.equal(w.contatos().length, 2);
});

test('segundo pedido em menos de 60 s é recusado sem enviar', () => {
  const w = world();
  w.call(ana);
  const r = w.call(ana);
  assert.equal(r.ok, false);
  assert.equal(r.erro, 'Já enviamos um link há pouco. Aguarde um minuto e confira também o spam.');
  assert.equal(w.fetches.length, 1);
});

test('campo escondido preenchido: responde ok e não grava nem envia', () => {
  const w = world();
  assert.deepEqual(w.call(Object.assign({}, ana, { site: 'http://spam' })), { ok: true });
  assert.equal(w.contatos().length, 1);
  assert.equal(w.fetches.length + w.mails.length, 0);
});

test('sem chave do Brevo, ou com erro do Brevo, envia pelo MailApp', () => {
  const a = world({ semChave: true });
  assert.equal(a.call(ana).ok, true);
  assert.equal(a.fetches.length, 0);
  assert.equal(a.mails.length, 1);
  assert.equal(a.mails[0].to, 'ana@x.com');
  assert.equal(a.mails[0].subject, 'Confirme seu e-mail — Helio Beloto Jr');
  assert.equal(a.mails[0].name, 'Helio Beloto Jr');
  const b = world({ brevoStatus: 400 });
  assert.equal(b.call(ana).ok, true);
  assert.equal(b.fetches.length, 1);
  assert.equal(b.mails.length, 1);
});

test('falha nos dois envios devolve erro claro', () => {
  const w = world({ semChave: true, gmailFalha: true });
  const r = w.call(ana);
  assert.equal(r.ok, false);
  assert.equal(r.erro, 'Não foi possível enviar o e-mail. Tente novamente.');
});

test('dados inválidos no cadastro', () => {
  const w = world();
  assert.equal(w.call({ action: 'cadastrar', nome: 'A', whatsapp: '1', email: 'x' }).erro, 'Informe um e-mail válido.');
});

test('texto que começa com = não vira fórmula na planilha', () => {
  const w = world();
  w.call(Object.assign({}, ana, { nome: '=HYPERLINK("http://x")', whatsapp: '+5514' }));
  assert.equal(w.contatos()[1][0], '=HYPERLINK("http://x")');
  assert.equal(w.contatos()[1][1], '+5514');
});

test('e-mail que começa com = ou - é recusado', () => {
  const w = world();
  const r = w.call(Object.assign({}, ana, { email: '=hyperlink("http://x/?"&a3,"x")&"@x.co"' }));
  assert.equal(r.erro, 'Informe um e-mail válido.');
  assert.equal(w.call(Object.assign({}, ana, { email: '-a@x.co' })).erro, 'Informe um e-mail válido.');
  assert.equal(w.contatos().length, 1);
});

test('nome pendente com = continua texto depois de confirmar', () => {
  const w = world();
  entrar(w);
  w.clearCache();
  w.call(Object.assign({}, ana, { nome: '=HYPERLINK("http://x")' }));
  const r = w.call({ action: 'confirmar', token: w.ultimoToken() });
  assert.equal(r.ok, true);
  assert.equal(w.contatos()[1][0], '=HYPERLINK("http://x")');
});

test('muitos cadastros: nenhum hash vira fórmula na planilha', () => {
  const w = world();
  for (let i = 0; i < 200; i++) {
    w.clearCache();
    const r = entrar(w, Object.assign({}, ana, { email: `p${i}@x.com` }));
    assert.equal(r.ok, true, `confirmação ${i}`);
    w.clearCache();
    assert.equal(w.call({ action: 'sessao', chave: r.chave }).ok, true, `sessão ${i}`);
  }
  assert.ok(!JSON.stringify(w.tokens()).includes('#ERROR!'));
});

test('pedidos simultâneos para o mesmo e-mail enviam um e-mail só', () => {
  const w = world();
  let aninhado = null;
  const fetchOriginal = w.context.UrlFetchApp.fetch;
  // Um segundo pedido chega enquanto o primeiro ainda está enviando.
  w.context.UrlFetchApp.fetch = (url, o) => {
    if (!aninhado) aninhado = w.call(ana);
    return fetchOriginal(url, o);
  };
  assert.equal(w.call(ana).ok, true);
  assert.equal(aninhado.ok, false);
  assert.equal(w.fetches.length, 1);
});

test('confirmar marca "Sim", grava as datas e devolve chave e nome', () => {
  const w = world();
  const r = entrar(w);
  assert.equal(r.ok, true);
  assert.equal(r.nome, 'Ana');
  assert.match(r.chave, /^[a-f0-9]{64}$/);
  const linha = w.contatos()[1];
  assert.equal(linha[3], 'Sim');
  assert.ok(linha[5] instanceof Date);
  assert.ok(linha[6] instanceof Date);
  assert.ok(!JSON.stringify(w.tokens()).includes(r.chave));
});

test('o mesmo link duas vezes: a segunda dá erro e o contato segue "Sim"', () => {
  const w = world();
  w.call(ana);
  const token = w.ultimoToken();
  assert.equal(w.call({ action: 'confirmar', token }).ok, true);
  const r = w.call({ action: 'confirmar', token });
  assert.equal(r.ok, false);
  assert.equal(r.erro, 'Link inválido, expirado ou já utilizado. Peça um novo link na página inicial.');
  assert.equal(w.contatos()[1][3], 'Sim');
});

test('link com mais de 24 horas expira', () => {
  const w = world();
  w.call(ana);
  const token = w.ultimoToken();
  w.clock.now += 24 * HORA + 1000;
  assert.equal(w.call({ action: 'confirmar', token }).ok, false);
  assert.equal(w.contatos()[1][3], 'Não');
});

test('contato confirmado que pede link novo mantém "Sim" e o nome antigo até confirmar', () => {
  const w = world();
  entrar(w);
  const cadastradoEm = w.contatos()[1][4];
  w.clearCache();
  w.clock.now += HORA;
  w.call(Object.assign({}, ana, { nome: 'Outro Nome', whatsapp: '(11) 1111-1111' }));
  assert.deepEqual(w.contatos()[1].slice(0, 4), ['Ana', '(14) 99999-0000', 'ana@x.com', 'Sim']);
  const r = w.call({ action: 'confirmar', token: w.ultimoToken() });
  assert.equal(r.nome, 'Outro Nome');
  assert.deepEqual(w.contatos()[1].slice(0, 4), ['Outro Nome', '(11) 1111-1111', 'ana@x.com', 'Sim']);
  assert.equal(w.contatos()[1][4], cadastradoEm);
});

test('sessao com chave válida devolve o nome e atualiza o último acesso', () => {
  const w = world();
  const { chave } = entrar(w);
  w.clock.now += HORA;
  w.clearCache();
  const r = w.call({ action: 'sessao', chave });
  assert.deepEqual(r, { ok: true, nome: 'Ana' });
  assert.equal(w.contatos()[1][6].getTime(), w.clock.now);
});

test('calcular devolve um resultado por simulação, null nas vazias', () => {
  const w = world();
  const { chave } = entrar(w);
  const r = w.call({ action: 'calcular', chave, sims: [
    { salario: 1000, pct: 10, taxa: 1, aporte: 0, anos: 1 },
    { salario: 0, pct: 10, taxa: 1, aporte: 0, anos: 1 },
  ] });
  assert.equal(r.ok, true);
  assert.equal(r.resultados.length, 2);
  assert.equal(r.resultados[0].valores[12], 1268.25);
  assert.equal(r.resultados[1], null);
});

test('chave expirada, inventada ou depois de sair dá codigo "sessao"', () => {
  const erroSessao = { ok: false, codigo: 'sessao', erro: 'Sua sessão expirou. Entre novamente.' };
  const w = world();
  const { chave } = entrar(w);
  assert.deepEqual(w.call({ action: 'calcular', chave: 'inventada', sims: [] }), erroSessao);
  assert.deepEqual(w.call({ action: 'calcular', sims: [] }), erroSessao);
  w.clock.now += 7 * 24 * HORA + 1000;
  assert.deepEqual(w.call({ action: 'calcular', chave, sims: [] }), erroSessao);

  const z = world();
  const s = entrar(z);
  assert.equal(z.call({ action: 'sessao', chave: s.chave }).ok, true);
  assert.deepEqual(z.call({ action: 'sair', chave: s.chave }), { ok: true });
  assert.deepEqual(z.call({ action: 'sessao', chave: s.chave }), erroSessao);
});

test('converter devolve a taxa mensal equivalente', () => {
  const w = world();
  const { chave } = entrar(w);
  assert.deepEqual(w.call({ action: 'converter', chave, taxaAnual: 12 }), { ok: true, taxaMensal: 0.9489 });
  assert.equal(w.call({ action: 'converter', chave, taxaAnual: 'x' }).ok, false);
});

test('ação desconhecida ou JSON inválido', () => {
  const w = world();
  assert.deepEqual(w.call({ action: 'apagarTudo' }), { ok: false, erro: 'Requisição inválida.' });
  assert.deepEqual(w.call('nao-e-json'), { ok: false, erro: 'Requisição inválida.' });
});
