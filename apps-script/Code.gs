// Web App do Planejador: cadastro com confirmação por e-mail, sessão de 7 dias e cálculos.
// A lógica pura (cálculos, validação, modelo do e-mail) vem de Shared.gs, gerado a partir de shared/.

var SITE_URL = 'https://zecabeloto.github.io/planejador/';
var CONFIRM_TTL_MS = 24 * 3600 * 1000;
var SESSION_TTL_MS = 7 * 24 * 3600 * 1000;
var RESEND_SECONDS = 60;
var SESSION_CACHE_SECONDS = 600;
var REMETENTE = { name: 'Helio Beloto Jr', email: 'heliobelotojr@gmail.com' };

var ABA_CONTATOS = 'Contatos';
var ABA_TOKENS = 'Tokens';
var CABECALHO_CONTATOS = ['Nome', 'WhatsApp', 'E-mail', 'Confirmado', 'Cadastrado em', 'Confirmado em', 'Último acesso', 'Gerar link', 'Link manual', 'Observação'];
var CABECALHO_TOKENS = ['Tipo', 'Hash', 'E-mail', 'Expira (ms)', 'Usado', 'Nome pendente', 'WhatsApp pendente', 'Origem'];
// Colunas (base 1) da aba Contatos.
var C_NOME = 1, C_WHATS = 2, C_EMAIL = 3, C_CONF = 4, C_CAD = 5, C_CONF_EM = 6, C_ACESSO = 7, C_GERAR = 8, C_LINK = 9, C_OBS = 10;
// Colunas (base 1) da aba Tokens.
var T_TIPO = 1, T_HASH = 2, T_EMAIL = 3, T_EXPIRA = 4, T_USADO = 5, T_NOME = 6, T_WHATS = 7, T_ORIGEM = 8;

var ERRO_SESSAO = { ok: false, codigo: 'sessao', erro: 'Sua sessão expirou. Entre novamente.' };
var ERRO_LINK = 'Link inválido, expirado ou já utilizado. Peça um novo link na página inicial.';

// Relógio isolado para os testes poderem avançar o tempo.
function agora() {
  return Date.now();
}

// Rodar uma vez no editor: cria a planilha e guarda o ID nas Propriedades do script.
function setup() {
  var ss = SpreadsheetApp.create('Planejador — Contatos');
  var contatos = ss.getSheets()[0];
  contatos.setName(ABA_CONTATOS);
  contatos.appendRow(CABECALHO_CONTATOS);
  contatos.setFrozenRows(1);
  contatos.getRange(1, 1, 1, CABECALHO_CONTATOS.length).setFontWeight('bold');
  var tokens = ss.insertSheet(ABA_TOKENS);
  tokens.appendRow(CABECALHO_TOKENS);
  tokens.hideSheet();
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  instalarLiberacaoManual();
  return ss.getId();
}

// Rodar uma vez no editor (já incluído no setup): cabeçalhos novos, caixinhas "Gerar link"
// na coluna H e o acionador que gera o link quando o dono marca uma caixinha.
function instalarLiberacaoManual() {
  var ss = planilha();
  var contatos = ss.getSheetByName(ABA_CONTATOS);
  contatos.getRange(1, 1, 1, CABECALHO_CONTATOS.length).setValues([CABECALHO_CONTATOS]);
  contatos.getRange(1, 1, 1, CABECALHO_CONTATOS.length).setFontWeight('bold');
  contatos.getRange('H2:H').setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
  ss.getSheetByName(ABA_TOKENS).getRange(1, 1, 1, CABECALHO_TOKENS.length).setValues([CABECALHO_TOKENS]);
  var existe = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'aoEditarPlanilha'; });
  if (!existe) ScriptApp.newTrigger('aoEditarPlanilha').forSpreadsheet(ss.getId()).onEdit().create();
}

// Acionador da planilha: caixinha "Gerar link" marcada → link de acesso novo (24 h) na coluna "Link manual",
// para o dono mandar por WhatsApp a quem não consegue usar o link do e-mail. Não envia e-mail.
function aoEditarPlanilha(e) {
  var r = e && e.range;
  if (!r || r.getSheet().getName() !== ABA_CONTATOS) return;
  if (r.getColumn() > C_GERAR || r.getColumn() + r.getNumColumns() - 1 < C_GERAR) return;
  var aba = r.getSheet();
  comLock(function () {
    for (var row = Math.max(2, r.getRow()); row < r.getRow() + r.getNumRows(); row++) {
      if (aba.getRange(row, C_GERAR).getValue() !== true) continue;
      aba.getRange(row, C_GERAR).setValue(false);
      var email = String(aba.getRange(row, C_EMAIL).getValue()).trim().toLowerCase();
      if (!email) continue;
      var token = novoSegredo();
      planilha().getSheetByName(ABA_TOKENS).appendRow(['confirmacao', resumo(token), email, agora() + CONFIRM_TTL_MS, '', '', '', 'manual']);
      aba.getRange(row, C_LINK).setValue(SITE_URL + 'confirmar.html?t=' + token);
    }
  });
}

function planilha() {
  return SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'));
}

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return respond({ ok: false, erro: 'Requisição inválida.' });
  }
  var acoes = { cadastrar: cadastrar, confirmar: confirmar, sessao: sessao, calcular: calcular, converter: converter, sair: sair };
  var acao = payload && acoes.hasOwnProperty(payload.action) ? acoes[payload.action] : null;
  if (!acao) return respond({ ok: false, erro: 'Requisição inválida.' });
  try {
    return respond(acao(payload));
  } catch (err) {
    console.error(err);
    return respond({ ok: false, erro: 'Não foi possível concluir agora. Tente novamente.' });
  }
}

// ── Segredos ───────────────────────────────────────────────────

function novoSegredo() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
}

function resumo(valor) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(valor), Utilities.Charset.UTF_8);
  // O prefixo impede que a planilha leia como fórmula um resumo que comece com "-".
  return 'h' + Utilities.base64EncodeWebSafe(bytes);
}

// Texto digitado pelo visitante não pode virar fórmula na planilha do dono.
// A planilha guarda o texto sem o apóstrofo: ao copiar um valor lido dela, proteja de novo.
function celula(s) {
  s = String(s == null ? '' : s);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

// ── Planilha ───────────────────────────────────────────────────

function linhaDoEmail(aba, email) {
  var rows = aba.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][C_EMAIL - 1]).trim().toLowerCase() === email) return { row: i + 1, values: rows[i] };
  }
  return null;
}

function tokenValido(aba, tipo, hash) {
  var rows = aba.getDataRange().getValues();
  for (var i = rows.length - 1; i >= 1; i--) {
    var r = rows[i];
    if (r[T_TIPO - 1] === tipo && r[T_HASH - 1] === hash && !r[T_USADO - 1] && Number(r[T_EXPIRA - 1]) > agora()) {
      return { row: i + 1, values: r };
    }
  }
  return null;
}

function comLock(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var out = fn();
    SpreadsheetApp.flush();
    return out;
  } finally {
    lock.releaseLock();
  }
}

// ── E-mail ─────────────────────────────────────────────────────

// Tenta o Brevo; sem chave ou com erro, envia pela conta Google do dono. Devolve o caminho usado.
function enviarConfirmacao(email, nome, link) {
  var m = montarEmailConfirmacao(nome, link);
  var chave = PropertiesService.getScriptProperties().getProperty('BREVO_API_KEY');
  if (chave) {
    try {
      var resp = UrlFetchApp.fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'post',
        contentType: 'application/json',
        headers: { accept: 'application/json', 'api-key': chave },
        payload: JSON.stringify({
          sender: REMETENTE,
          to: [{ email: email, name: nome }],
          subject: m.assunto,
          htmlContent: m.html,
        }),
        muteHttpExceptions: true,
      });
      var code = resp.getResponseCode();
      if (code >= 200 && code < 300) {
        console.log('confirmação enviada pelo Brevo');
        return 'brevo';
      }
      console.error('Brevo respondeu ' + code + ': ' + resp.getContentText());
    } catch (err) {
      console.error('Brevo falhou: ' + err);
    }
  }
  MailApp.sendEmail({ to: email, subject: m.assunto, htmlBody: m.html, name: REMETENTE.name });
  console.log('confirmação enviada pela conta Google');
  return 'gmail';
}

// ── Ações ──────────────────────────────────────────────────────

function cadastrar(p) {
  if (p.site) return { ok: true }; // campo escondido: robô
  var v = validarCadastro(p);
  if (!v.ok) return v;
  var d = v.dados;
  var cache = CacheService.getScriptCache();
  var chaveCache = 'env_' + resumo(d.email);
  var token = novoSegredo();
  // Confere e marca o reenvio dentro do lock e antes de enviar: pedidos simultâneos mandam um e-mail só.
  var recusado = comLock(function () {
    if (cache.get(chaveCache)) return true;
    cache.put(chaveCache, '1', RESEND_SECONDS);
    var ss = planilha();
    var contatos = ss.getSheetByName(ABA_CONTATOS);
    var achado = linhaDoEmail(contatos, d.email);
    var pendNome = '', pendWhats = '';
    if (!achado) {
      contatos.appendRow([celula(d.nome), celula(d.whatsapp), d.email, 'Não', new Date(agora()), '', '']);
    } else if (achado.values[C_CONF - 1] !== 'Sim') {
      contatos.getRange(achado.row, C_NOME, 1, 2).setValues([[celula(d.nome), celula(d.whatsapp)]]);
    } else {
      pendNome = celula(d.nome);
      pendWhats = celula(d.whatsapp);
    }
    ss.getSheetByName(ABA_TOKENS).appendRow(['confirmacao', resumo(token), d.email, agora() + CONFIRM_TTL_MS, '', pendNome, pendWhats]);
    return false;
  });
  if (recusado) {
    return { ok: false, erro: 'Já enviamos um link há pouco. Aguarde um minuto e confira também o spam.' };
  }
  try {
    enviarConfirmacao(d.email, d.nome, SITE_URL + 'confirmar.html?t=' + token);
  } catch (err) {
    console.error('envio falhou: ' + err);
    cache.remove(chaveCache); // deixa tentar de novo logo
    return { ok: false, erro: 'Não foi possível enviar o e-mail. Tente novamente.' };
  }
  return { ok: true };
}

function confirmar(p) {
  if (typeof p.token !== 'string' || !p.token) return { ok: false, erro: ERRO_LINK };
  var hash = resumo(p.token);
  return comLock(function () {
    var ss = planilha();
    var tokens = ss.getSheetByName(ABA_TOKENS);
    var t = tokenValido(tokens, 'confirmacao', hash);
    if (!t) return { ok: false, erro: ERRO_LINK };
    var email = t.values[T_EMAIL - 1];
    var contatos = ss.getSheetByName(ABA_CONTATOS);
    var c = linhaDoEmail(contatos, email);
    if (!c) return { ok: false, erro: ERRO_LINK };
    tokens.getRange(t.row, T_USADO).setValue('Sim');
    var agoraData = new Date(agora());
    var nome = c.values[C_NOME - 1];
    if (t.values[T_NOME - 1]) {
      contatos.getRange(c.row, C_NOME, 1, 2).setValues([[celula(t.values[T_NOME - 1]), celula(t.values[T_WHATS - 1])]]);
      nome = t.values[T_NOME - 1];
    }
    contatos.getRange(c.row, C_CONF).setValue('Sim');
    if (t.values[T_ORIGEM - 1] === 'manual') {
      contatos.getRange(c.row, C_OBS).setValue('Liberado manualmente (link enviado pelo dono, e-mail não verificado)');
      contatos.getRange(c.row, C_LINK).setValue('');
    }
    if (!c.values[C_CONF_EM - 1]) contatos.getRange(c.row, C_CONF_EM).setValue(agoraData);
    contatos.getRange(c.row, C_ACESSO).setValue(agoraData);
    var chave = novoSegredo();
    var expira = agora() + SESSION_TTL_MS;
    tokens.appendRow(['sessao', resumo(chave), email, expira, '', '', '']);
    nome = String(nome);
    CacheService.getScriptCache().put('ses_' + resumo(chave), JSON.stringify({ email: email, nome: nome, expira: expira }), SESSION_CACHE_SECONDS);
    return { ok: true, chave: chave, nome: nome };
  });
}

// Confere a chave de acesso: primeiro no cache, depois na aba Tokens. Devolve {email, nome} ou null.
function validarChave(chave) {
  if (typeof chave !== 'string' || !chave) return null;
  var hash = resumo(chave);
  var cache = CacheService.getScriptCache();
  var guardado = cache.get('ses_' + hash);
  if (guardado) {
    var s = JSON.parse(guardado);
    if (s.expira > agora()) return s;
    cache.remove('ses_' + hash);
    return null;
  }
  var ss = planilha();
  var t = tokenValido(ss.getSheetByName(ABA_TOKENS), 'sessao', hash);
  if (!t) return null;
  var email = t.values[T_EMAIL - 1];
  var c = linhaDoEmail(ss.getSheetByName(ABA_CONTATOS), email);
  if (!c) return null;
  var sessaoAtual = { email: email, nome: String(c.values[C_NOME - 1]), expira: Number(t.values[T_EXPIRA - 1]) };
  var ttl = Math.min(SESSION_CACHE_SECONDS, Math.floor((sessaoAtual.expira - agora()) / 1000));
  if (ttl > 0) cache.put('ses_' + hash, JSON.stringify(sessaoAtual), ttl);
  return sessaoAtual;
}

function sessao(p) {
  var s = validarChave(p.chave);
  if (!s) return ERRO_SESSAO;
  var contatos = planilha().getSheetByName(ABA_CONTATOS);
  var c = linhaDoEmail(contatos, s.email);
  if (c) contatos.getRange(c.row, C_ACESSO).setValue(new Date(agora()));
  return { ok: true, nome: s.nome };
}

function calcular(p) {
  if (!validarChave(p.chave)) return ERRO_SESSAO;
  var v = validarSimulacoes(p.sims);
  if (!v.ok) return v;
  return {
    ok: true,
    resultados: v.sims.map(function (s) {
      return s ? calcularPatrimonio(s.salario, s.pct, s.taxa, s.aporte, s.anos) : null;
    }),
  };
}

function converter(p) {
  if (!validarChave(p.chave)) return ERRO_SESSAO;
  var taxa = Number(p.taxaAnual);
  if (p.taxaAnual === '' || p.taxaAnual === null || !isFinite(taxa)) return { ok: false, erro: 'Informe uma taxa válida.' };
  return { ok: true, taxaMensal: taxaMensalEq(taxa) };
}

function sair(p) {
  if (typeof p.chave !== 'string' || !p.chave) return { ok: true };
  var hash = resumo(p.chave);
  CacheService.getScriptCache().remove('ses_' + hash);
  comLock(function () {
    var tokens = planilha().getSheetByName(ABA_TOKENS);
    var t = tokenValido(tokens, 'sessao', hash);
    if (t) tokens.getRange(t.row, T_USADO).setValue('Sim');
  });
  return { ok: true };
}
