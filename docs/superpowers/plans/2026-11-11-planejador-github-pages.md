# Planejador no GitHub Pages: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recolocar no ar o site do Planejador Financeiro (hoje Flask no Render) como páginas estáticas no GitHub Pages, com cadastro e confirmação por e-mail, sessão de 7 dias e cálculos num Web App do Apps Script que grava os contatos numa planilha do Google.

**Architecture:**
- **Páginas:** HTML, CSS e JS estáticos, sem build. Chamam o Web App por POST `text/plain`, com o payload `{action, ...}`.
- **Lógica pura:** fica em `shared/*.js` (scripts clássicos com `module.exports` condicional). É testada no Node e concatenada em `apps-script/Shared.gs` por `scripts/sync-shared.js`, no mesmo padrão de `C:\Users\Public\pesquisa-planejamento-2027`.
- **Code.gs:** cuida da planilha, dos tokens, do e-mail (Brevo e, se falhar, MailApp) e das ações. É testado no Node com `vm` contra um simulador das APIs do Google.

**Tech Stack:** HTML/CSS/JS puro; Chart.js 4.4.1, hammerjs 2.0.8 e chartjs-plugin-zoom 2.0.1 (CDN jsDelivr, com SRI); Google Apps Script (V8); Node 24 (`node:test`).

**Spec:** `docs/superpowers/specs/2026-11-11-planejador-github-pages-design.md`

**Código de origem:** clone de `ZecaBeloto/heliobeloto` em `C:\Users\DELL\AppData\Local\Temp\claude\ae74859fe8e087eb\43b5bfc9-a730-4207-96c9-dc9f9a5ef202\scratchpad\heliobeloto`. Se não existir mais, recriar com `gh repo clone ZecaBeloto/heliobeloto <pasta>`.

**Repositório local:** `C:\Users\Public\planejador`, que vai virar `ZecaBeloto/planejador`.

## Global Constraints

- **Endereço do site:** `https://zecabeloto.github.io/planejador/`. O link de confirmação é `https://zecabeloto.github.io/planejador/confirmar.html?t=<token>`.
- **Validades:** o token de confirmação vale **24 horas** e só pode ser usado uma vez. A chave de acesso vale **7 dias**.
- **E-mail:**
  - Brevo em `https://api.brevo.com/v3/smtp/email`, com a chave em `BREVO_API_KEY` nas Propriedades do script.
  - Remetente "Helio Beloto Jr" <heliobelotojr@gmail.com>, assunto "Confirme seu e-mail — Helio Beloto Jr".
  - O HTML é o de `enviar_email` em `app.py`, copiado tal qual, trocando só o link.
  - Se não houver chave, ou se o Brevo responder com algo diferente de 2xx, envia por `MailApp.sendEmail` com o mesmo assunto, HTML e nome.
- **Segurança:** nenhum segredo no repositório. Tokens e chaves só são guardados como hash SHA-256 (base64 web-safe).
- **Aba "Contatos":** tem exatamente as colunas `Nome | WhatsApp | E-mail | Confirmado | Cadastrado em | Confirmado em | Último acesso`, com Confirmado em "Sim" ou "Não". "Cadastrado em" nunca muda depois da primeira gravação.
- **Contato já confirmado que pede link novo:** continua "Sim". O nome e o WhatsApp novos só são aplicados quando o link é clicado.
- **Cálculos:** só com chave válida. As fórmulas são as de `app.py` (ver Task 1). O arredondamento usa `Math.round(x*100)/100` e foi aceito que difira em até 1 centavo do Python.
- **Visual:** o `static/style.css` atual, sem mudanças de identidade.
- **Web App:** POST com `Content-Type: text/plain;charset=utf-8`. A resposta é sempre JSON `{ok:true, ...}` ou `{ok:false, erro:'<mensagem para o visitante>', codigo?:'sessao'}`.
- **Testes:** `node --test "test/*.test.js"`. No Node 24, o argumento é um glob entre aspas, não a pasta.

## Review Focus

1. **Link de confirmação clicado duas vezes,** ou aberto por um verificador de links do e-mail, como os do Outlook e do Gmail. A segunda abertura mostra "link inválido ou já usado", mas o contato continua confirmado. Teste na Task 2: `confirmar` com o mesmo token duas vezes.
2. **E-mail digitado com maiúsculas ou espaços** ("  Joao@Gmail.com ") gera a mesma linha que "joao@gmail.com". Teste na Task 1 (`normalizarEmail`) e na Task 2 (o segundo cadastro não cria linha nova).
3. **Simulação com campos vazios ou zerados,** ou com valores absurdos (anos = 500, texto no lugar de número). As vazias são ignoradas, como no `executar()` atual. Os anos ficam limitados a 1–100, no máximo 6 simulações, e o Web App não quebra. Teste na Task 1 (`validarSimulacoes`).
4. **Chave expirada ou apagada no meio do uso:** um cálculo com chave inválida devolve `codigo:'sessao'`, e a página volta para o início em vez de mostrar erro genérico. Teste na Task 2 (`calcular` com chave expirada).
5. **Vários cadastros seguidos para o mesmo e-mail** (botão clicado várias vezes, ou robô). Um segundo envio em menos de 60 s é recusado com mensagem clara e não gasta cota de e-mail. Um campo escondido (`site`) preenchido é tratado como robô: responde ok e não envia nada. Teste na Task 2.

---

## Estrutura de arquivos

```
planejador/
  index.html            página inicial + cadastro (de templates/index.html)
  confirmar.html        lê ?t=, confirma, guarda a chave, vai ao planner
  planner.html          o planejador (de templates/app.html)
  static/style.css      copiado sem mudanças, mais as regras do aviso "calculando…"
  static/script.js      lógica do planner (de static/script.js), chamando a API
  static/api.js         chamada ao Web App + chave no localStorage
  static/config.js      var WEB_APP_URL = '...';
  shared/calc.js        cálculos e validações puros (Node + Apps Script)
  shared/email.js       montagem do e-mail de confirmação (puro)
  apps-script/Code.gs   Web App: planilha, tokens, e-mail, ações
  apps-script/Shared.gs GERADO por scripts/sync-shared.js; nunca editar
  apps-script/appsscript.json
  scripts/sync-shared.js
  test/calc.test.js  test/email.test.js  test/sync.test.js  test/code-gs.test.js
  README.md  .gitignore
```

---

### Task 1: Lógica pura (cálculos, validação, e-mail) e esqueleto do repositório

**Files:**
- Create: `shared/calc.js`, `shared/email.js`, `scripts/sync-shared.js`, `apps-script/Shared.gs` (gerado), `.gitignore`
- Test: `test/calc.test.js`, `test/email.test.js`, `test/sync.test.js`

**Interfaces:**
- Produces (globais no Apps Script e `module.exports` no Node):
  - `calcularPatrimonio(salario:number, pct:number, taxa:number, aporte:number, anos:number) -> {labels:number[], valores:number[]}`
  - `taxaMensalEq(taxaAnual:number) -> number` (arredondada em 4 casas)
  - `validarSimulacoes(lista:any) -> {ok:true, sims:Array<{salario,pct,taxa,aporte,anos}>} | {ok:false, erro:string}`
  - `normalizarEmail(s:string) -> string` (trim + lowercase)
  - `validarCadastro({nome, whatsapp, email}) -> {ok:true, dados:{nome,whatsapp,email}} | {ok:false, erro:string}`
  - `montarEmailConfirmacao(nome:string, link:string) -> {assunto:string, html:string}`

- [ ] **Step 1: `git init` em `C:\Users\Public\planejador`**, `.gitignore` com `node_modules/` e `*.log`. O spec já está em `docs/`.

- [ ] **Step 2: Escrever `test/calc.test.js` falhando**

```js
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
  assert.equal(v.sims.length, 1);
  assert.equal(v.sims[0].anos, 100);
  assert.equal(C.validarSimulacoes([{ salario: 'abc', pct: 1, taxa: 1, aporte: 0, anos: 1 }]).sims.length, 0);
  assert.equal(C.validarSimulacoes(Array(7).fill({ salario: 1, pct: 1, taxa: 1, aporte: 0, anos: 1 })).ok, false);
  assert.equal(C.validarSimulacoes('x').ok, false);
});
test('normalizarEmail e validarCadastro', () => {
  assert.equal(C.normalizarEmail('  Joao@Gmail.com '), 'joao@gmail.com');
  assert.equal(C.validarCadastro({ nome: '', whatsapp: '1', email: 'a@b.c' }).erro, 'Preencha todos os campos.');
  assert.equal(C.validarCadastro({ nome: 'A', whatsapp: '1', email: 'semarroba' }).erro, 'Informe um e-mail válido.');
  assert.deepEqual(C.validarCadastro({ nome: ' Ana ', whatsapp: '(14) 99999-0000', email: ' A@B.com ' }).dados,
    { nome: 'Ana', whatsapp: '(14) 99999-0000', email: 'a@b.com' });
});
```

Regras para `validarSimulacoes`:
- cada campo vira `Number`; o que não é finito vira 0;
- uma simulação com `salario` e `aporte` iguais a 0 é ignorada (como `if (!sal && !apt) continue`);
- `anos` vira inteiro entre 1 e 100 (com 30 como padrão, como `parseInt(s.anos)||30`);
- uma lista que não é array, ou com mais de 6 itens, dá `{ok:false, erro:'Simulações inválidas.'}`.

Regras para `validarCadastro`:
- os textos são cortados com `.trim()`, com no máximo 120 caracteres cada;
- o e-mail precisa casar com `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`;
- as mensagens são exatamente as do teste.

- [ ] **Step 3: Rodar `node --test "test/*.test.js"`.** Esperado: FAIL, "Cannot find module".

- [ ] **Step 4: Implementar `shared/calc.js`.** O laço mensal segue `calcular_patrimonio` em `app.py`: `labels.push(Math.round(mes/12*100)/100)`, `valores.push(Math.round(p*100)/100)` e `p = p*(1+taxa/100) + salario*pct/100`.

- [ ] **Step 5: `test/email.test.js` e `shared/email.js`**

```js
test('montarEmailConfirmacao usa o modelo atual com o link', () => {
  const m = E.montarEmailConfirmacao('Ana <b>', 'https://zecabeloto.github.io/planejador/confirmar.html?t=abc');
  assert.equal(m.assunto, 'Confirme seu e-mail — Helio Beloto Jr');
  assert.ok(m.html.includes('href="https://zecabeloto.github.io/planejador/confirmar.html?t=abc"'));
  assert.ok(m.html.includes('Ana &lt;b&gt;'));       // nome escapado
  assert.ok(m.html.includes('24 horas'));
});
```

O HTML é o de `enviar_email` em `app.py`, copiado verbatim, com `{nome}` escapado (`& < > " '`) e `{link_confirmacao}` substituídos.

- [ ] **Step 6: `scripts/sync-shared.js`**, que grava `apps-script/Shared.gs` = `shared/calc.js` + `'\n'` + `shared/email.js`. Junto vem `test/sync.test.js`, que verifica se `Shared.gs` é idêntico a essa concatenação. Rodar `node scripts/sync-shared.js`.

- [ ] **Step 7: Rodar `node --test "test/*.test.js"`.** Esperado: todos PASS.

- [ ] **Step 8: Commit** `feat: cálculos, validação e e-mail de confirmação`, incluindo o spec e este plano.

---

### Task 2: Web App do Apps Script

**Files:**
- Create: `apps-script/Code.gs`, `apps-script/appsscript.json`
- Test: `test/code-gs.test.js` (com um simulador próprio, no molde de `pesquisa-planejamento-2027/test/code-gs.test.js`)

**Interfaces:**
- Consumes: todas as funções da Task 1 (globais via Shared.gs).
- Produces: as ações de `doPost(e)`, com o corpo JSON em `e.postData.contents`:

| action | entrada | saída ok |
|---|---|---|
| `cadastrar` | `{nome, whatsapp, email, site}` | `{ok:true}` |
| `confirmar` | `{token}` | `{ok:true, chave, nome}` |
| `sessao` | `{chave}` | `{ok:true, nome}` |
| `calcular` | `{chave, sims:[...]}` | `{ok:true, resultados:[{labels, valores}|null]}`, na mesma ordem e no mesmo tamanho de `sims` (`null` para as ignoradas) |
| `converter` | `{chave, taxaAnual}` | `{ok:true, taxaMensal}` |
| `sair` | `{chave}` | `{ok:true}` |

Uma chave inválida ou expirada em `sessao`, `calcular` ou `converter` devolve `{ok:false, codigo:'sessao', erro:'Sua sessão expirou. Entre novamente.'}`. Uma ação desconhecida ou um JSON inválido devolve `{ok:false, erro:'Requisição inválida.'}`.

- Constantes: `SITE_URL = 'https://zecabeloto.github.io/planejador/'`, `CONFIRM_TTL_MS = 24*3600*1000`, `SESSION_TTL_MS = 7*24*3600*1000` e `RESEND_SECONDS = 60`.
- `setup()`: cria uma planilha "Planejador — Contatos" e guarda `SPREADSHEET_ID` nas Propriedades. A planilha tem:
  - a aba "Contatos", com o cabeçalho das Global Constraints e a linha 1 congelada;
  - a aba "Tokens", oculta, com as colunas `Tipo | Hash | E-mail | Expira (ms) | Usado | Nome pendente | WhatsApp pendente`.

Decisões de implementação:
- **Token e chave:** `Utilities.getUuid()+Utilities.getUuid()` sem hífens. O hash é `Utilities.base64EncodeWebSafe(Utilities.computeDigest(SHA_256, valor, UTF_8))`.
- **`cadastrar`:**
  - Se `site` vier preenchido: `{ok:true}` sem gravar nem enviar.
  - Se `CacheService` tiver `env_<hash(email)>`: `{ok:false, erro:'Já enviamos um link há pouco. Aguarde um minuto e confira também o spam.'}`.
  - Caso contrário, com `LockService`:
    - Se não houver linha para o e-mail, cria uma com Confirmado "Não" e "Cadastrado em" igual a agora.
    - Se houver e ela for "Não", atualiza o nome e o WhatsApp.
    - Se for "Sim", não toca na linha: o nome e o WhatsApp vão para as colunas "pendente" do token.
    - Grava o token `confirmacao`, envia o e-mail e põe o cache por 60 s.
    - Se o envio falhar pelos dois caminhos: `{ok:false, erro:'Não foi possível enviar o e-mail. Tente novamente.'}`.
- **`enviarConfirmacao(email, nome, link) -> 'brevo'|'gmail'`:**
  - Usa `UrlFetchApp.fetch` com `muteHttpExceptions:true`, o header `api-key` e o corpo igual ao de `app.py`.
  - Se não houver chave ou o status não for 2xx, chama `MailApp.sendEmail({to, subject, htmlBody, name:'Helio Beloto Jr'})`.
  - Registra o caminho usado com `console.log`.
- **`confirmar`:**
  - Procura o hash do token com Tipo `confirmacao`, não usado e não expirado.
  - Se achar:
    - marca o token como Usado;
    - na linha do contato, marca Confirmado "Sim", grava "Confirmado em" (só se estiver vazio) e "Último acesso", e aplica o nome e o WhatsApp pendentes, se houver;
    - cria a chave `sessao` com validade de 7 dias e a devolve.
  - Se não achar: `{ok:false, erro:'Link inválido, expirado ou já utilizado. Peça um novo link na página inicial.'}`.
- **Validação da chave:** primeiro `CacheService` (`ses_<hash>`, com o e-mail e o nome, por 600 s); se não estiver lá, procura na aba Tokens. `sessao` atualiza o "Último acesso".
- **`sair`:** marca a chave como Usado e remove o cache.
- **`calcular`:** `validarSimulacoes`; para cada simulação válida, `calcularPatrimonio`; as ignoradas viram `null`, para a página casar cada resultado com sua simulação.

- [ ] **Step 1: Escrever `test/code-gs.test.js` falhando.** O simulador oferece SpreadsheetApp (abas com `getDataRange().getValues()`, `getRange().setValue(s)`, `appendRow`, `hideSheet`), PropertiesService, CacheService (com `remove`), LockService, `Utilities` (`getUuid` com contador, `computeDigest` via `crypto.createHash('sha256')` e devolvendo um array de bytes, `base64EncodeWebSafe`, `DigestAlgorithm`, `Charset`), UrlFetchApp (status configurável e registro das chamadas), MailApp (registro) e ContentService. Os testes:
  - cadastro novo cria uma linha "Não", envia pelo Brevo e grava o token com hash (o token puro não aparece em nenhuma célula);
  - "  Ana@X.com " e depois "ana@x.com", com o cache limpo entre os dois, deixam uma linha só;
  - um segundo cadastro em menos de 60 s é recusado e não chama UrlFetch nem MailApp;
  - com `site` preenchido: ok, sem linha e sem envio;
  - sem `BREVO_API_KEY`, ou com o Brevo respondendo 400, o envio vai pelo MailApp;
  - `confirmar` com o token do link marca "Sim", grava "Confirmado em" e devolve a chave e o nome;
  - `confirmar` com o mesmo token pela segunda vez dá erro, e o contato continua "Sim";
  - um token de mais de 24 h (adiantar o relógio do simulador) dá erro;
  - um contato "Sim" que pede link novo com outro nome continua "Sim", com o nome antigo até confirmar, e depois da confirmação fica com o nome novo; "Cadastrado em" não muda;
  - `calcular` com chave válida devolve resultados no tamanho de `sims`, com `null` nas vazias;
  - `calcular` com chave expirada (mais de 7 dias) ou depois de `sair` dá `codigo:'sessao'`;
  - `converter` devolve `taxaMensal` 0.9489 para 12;
  - uma ação desconhecida dá `Requisição inválida.`.

  O relógio é injetável: `Code.gs` usa `agora()`, que retorna `Date.now()`, e o teste a substitui no contexto.

- [ ] **Step 2: Rodar os testes.** Esperado: FAIL.
- [ ] **Step 3: Implementar `apps-script/Code.gs` e `appsscript.json`.** O `appsscript.json` tem o `timeZone` `America/Sao_Paulo`, `runtimeVersion` `V8` e `webapp` com `executeAs: USER_DEPLOYING` e `access: ANYONE_ANONYMOUS`.
- [ ] **Step 4: Rodar `node --test "test/*.test.js"`.** Esperado: todos PASS.
- [ ] **Step 5: Commit** `feat: Web App com cadastro, confirmação, sessão e cálculos`.

---

### Task 3: Páginas estáticas

**Files:**
- Create: `index.html`, `confirmar.html`, `planner.html`, `static/api.js`, `static/config.js`, `static/script.js`, `static/style.css` (copiados da origem e adaptados)

**Interfaces:**
- Consumes: as ações da Task 2.
- Produces, em `static/api.js`:
  - `chamar(action:string, dados:object) -> Promise<object>`: POST `text/plain` para `WEB_APP_URL`, com timeout de 30 s. Em erro de rede, resolve `{ok:false, erro:'Erro de conexão. Tente novamente.'}`.
  - `lerChave() / salvarChave(c) / apagarChave()`: `localStorage['planejadorChave']`, com try/catch.
  - `exigirSessao() -> Promise<{nome}>`: sem chave ou com `codigo:'sessao'`, apaga a chave e faz `location.replace('index.html')`.

Mudanças nas páginas:
- **Referências:** `{{ url_for('static', filename=X) }}` vira `static/X` e `{{ nome }}` passa a ser preenchido por JS. Os links `/planner` viram `planner.html`, e `/sair` vira `sair()`, que chama `chamar('sair')`, apaga a chave e vai para `index.html`. Os scripts de CDN ganham `integrity` (SRI) e `crossorigin`.
- **`index.html`:**
  - o `cadastrar()` atual passa a usar `chamar('cadastrar', {nome, whatsapp, email, site})`;
  - acrescentar o campo escondido `site` (fora da tela, `tabindex=-1`, `autocomplete=off`);
  - ao carregar, se houver chave, chamar `sessao` e, com ok, ir para `planner.html`.
- **`confirmar.html`:**
  - usa o mesmo visual (o cabeçalho e o cartão da página inicial);
  - mostra "Confirmando seu e-mail…";
  - lê `t` da URL, chama `confirmar` e, com ok, salva a chave e faz `location.replace('planner.html')`;
  - se der erro, mostra a mensagem e um botão "Voltar à página inicial".
- **`planner.html` e `static/script.js`:**
  - ao carregar, `exigirSessao()` preenche o nome. A página fica oculta até a sessão ser confirmada, para não piscar o conteúdo;
  - `calcularAuto` espera 600 ms;
  - `executar()` monta `sims` a partir de todas as simulações (com os mesmos `parseNum`/`parseP`) e faz uma única chamada `chamar('calcular', {chave, sims})`;
  - um contador `seq` descarta respostas antigas;
  - durante a chamada, `#grafico` ganha a classe `calculando` e aparece um aviso "Calculando…" sobre o gráfico (o CSS vai no fim de `style.css`, com as cores do tema);
  - um resultado `null` pula a simulação; `codigo:'sessao'` leva a `exigirSessao()`;
  - `converterTaxa` passa a usar `chamar('converter', {chave, taxaAnual})`.

- [ ] **Step 1: Copiar** `style.css`, `script.js`, `index.html` e `app.html` (como `planner.html`) da origem e fazer as adaptações acima.
- [ ] **Step 2: Criar `static/config.js`** com `var WEB_APP_URL = '';`, que será preenchido na Task 4.
- [ ] **Step 3: Verificar no navegador** com `python -m http.server` e um Web App falso. Num script de rascunho, fora do repositório, sobrescrever `window.fetch` para responder às ações. Conferir:
  - o cadastro passa para "Verifique seu e-mail";
  - `confirmar.html?t=x` leva ao planner;
  - o planner mostra o nome, a página inicial redireciona quando há chave e o Sair volta para o início;
  - digitar numa simulação faz uma única chamada, depois de parar de digitar;
  - o gráfico aparece igual ao do site antigo, nos temas claro e escuro;
  - largura de 375 px sem rolagem horizontal.
- [ ] **Step 4: Commit** `feat: páginas estáticas do planejador`.

---

### Task 4: Publicação e teste de ponta a ponta

Exige a confirmação do dono antes de cada passo público ou com credenciais.

- [ ] **Step 1: Criar o repositório público** `ZecaBeloto/planejador` (`gh repo create ZecaBeloto/planejador --public --source C:\Users\Public\planejador --push`), **depois da confirmação do dono**. Ativar o GitHub Pages pela branch `main`, raiz (`gh api -X POST repos/ZecaBeloto/planejador/pages -f "source[branch]=main" -f "source[path]=/"`).
- [ ] **Step 2: Apps Script** (no Chrome, na conta do dono):
  - criar o projeto "Planejador — Web App" e colar `Shared.gs` + `Code.gs` (como na pesquisa: `Set-Clipboard` e colar no editor);
  - ajustar o manifesto;
  - rodar `setup()`; o dono autoriza.
- [ ] **Step 3: O dono cola a `BREVO_API_KEY`** em Configurações do projeto > Propriedades do script, se a conta do Brevo funcionar. O Claude não digita a chave.
- [ ] **Step 4: Implantar como app da Web** (executar como eu, acesso "Qualquer pessoa"). Gravar a URL em `static/config.js`, fazer o commit e o push, e esperar o Pages publicar: `curl` na página com grep da URL nova.
- [ ] **Step 5: Teste real com um e-mail do dono.**
  - Cadastro, e-mail recebido (anotar se veio pelo Brevo ou pelo Gmail, pelo log de execução, e se caiu no spam), clique no link, planner com nome, cálculo com 2 simulações, conversor e Sair.
  - Conferir na planilha a linha com "Sim" e as datas.
- [ ] **Step 6: README.md** com os endereços, a planilha, como trocar a chave do Brevo, como reimplantar (Gerenciar implantações > Editar > Nova versão) e o aviso de suspender o serviço no Render. Fazer o commit e o push.
