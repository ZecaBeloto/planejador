# Planejador Financeiro no GitHub Pages: desenho

Data: 2026-11-11
Origem: repositório privado `ZecaBeloto/heliobeloto` (Flask + PostgreSQL no Render).
Destino: repositório público novo `ZecaBeloto/planejador`, publicado em https://zecabeloto.github.io/planejador/

## Por que

O site de divulgação do Helio Beloto Jr (assessor de investimentos) está fora do ar porque atingiu o limite do plano gratuito do Render. O objetivo é hospedá-lo como os formulários de pesquisa já feitos (projeto `pesquisa-planejamento-2027`): páginas estáticas no GitHub Pages, com um Web App do Google Apps Script e uma planilha do Google no lugar do servidor e do banco.

O que mais importa para o dono: **só entra no planejador quem confirmou o e-mail**, e ele quer ter, na planilha, o registro desses e-mails verdadeiros (nome, WhatsApp, e-mail). Os contatos são leads da assessoria.

## Objetivos

- O site volta a ficar no ar, sem custo e sem "dormir".
- Mesmo visual e mesmas funções do site atual, para o visitante.
- Cadastro com confirmação por link no e-mail; acesso ao planejador só com e-mail confirmado.
- Os cálculos do planejador só funcionam com login válido (decisão do dono, mesmo sabendo da espera de 1 a 2 s por cálculo).
- A planilha do Google é a lista de contatos e substitui o painel admin.

## Não objetivos

- Não migrar contatos antigos: a planilha começa do zero (decisão do dono).
- Não criar painel admin com senha nem exportação: a planilha já faz isso.
- Não salvar as simulações e objetivos do visitante entre visitas (o site atual também não salva).
- Não usar senha para o visitante: o login continua sendo por link no e-mail.

## Anti-objetivos (seria fracasso mesmo funcionando)

- Contato marcado como confirmado sem ter clicado no link.
- Chave da API do Brevo, ou qualquer segredo, no repositório público ou no navegador.
- Planejador utilizável por quem não confirmou o e-mail.
- Gráfico travando a cada tecla (várias chamadas em fila).
- Visual diferente do atual a ponto de parecer outro site.

## O que existe hoje (para migrar)

- `templates/index.html`: página inicial com o herói "Helio Beloto Jr", o cartão de cadastro em 3 passos (Cadastro, Confirmar e-mail, Acessar), os campos nome, WhatsApp (com máscara) e e-mail, o painel "Verifique seu e-mail" com "Usar outro e-mail", três cartões "sobre" e o rodapé com WhatsApp (14) 99717-5510 e LinkedIn.
- `templates/app.html` + `static/script.js`: o planejador, com:
  - várias simulações (salário, % poupado, taxa mensal, aporte inicial e anos), que podem ser adicionadas, recolhidas e removidas;
  - objetivos financeiros (nome e valor; adicionar, editar e excluir), mostrados como linhas no gráfico com o tempo até atingir cada um;
  - gráfico Chart.js 4.4.1 com zoom (hammerjs 2.0.8 e chartjs-plugin-zoom 2.0.1);
  - conversor de taxa anual em mensal equivalente;
  - tema claro e escuro (em localStorage, com o escuro como padrão);
  - nome do usuário no topo e o botão Sair.
- `static/style.css`: o visual (escuro, com dourado #c8a96e).
- `app.py`:
  - `calcular_patrimonio(salario, pct, taxa, aporte, anos)`: mês a mês, `patrimonio = patrimonio*(1+taxa/100) + salario*pct/100`, começando em `aporte`, por `anos*12+1` pontos; labels `round(mes/12, 2)` e valores `round(patrimonio, 2)`;
  - `taxa_mensal_eq(taxa_anual) = ((1+taxa/100)^(1/12) - 1)*100`, arredondada em 4 casas;
  - cadastro com upsert por e-mail e token aleatório; o e-mail é enviado pela API do Brevo (`https://api.brevo.com/v3/smtp/email`), com o remetente "Helio Beloto Jr" <heliobelotojr@gmail.com>, o assunto "Confirme seu e-mail — Helio Beloto Jr" e o HTML escuro e dourado com o botão "✓ Confirmar e-mail", dizendo que o link expira em 24 horas;
  - a confirmação marca o cadastro como confirmado e abre uma sessão de 7 dias;
  - o planner exige essa sessão.
- No front atual, o planner chama `/calcular` uma vez por simulação, em sequência, 300 ms depois de cada mudança; o conversor chama `/converter_taxa`.

## Como vai funcionar (decidido com o dono)

### Peças

1. **Páginas estáticas** no repositório `planejador`, no GitHub Pages: página inicial, página de confirmação e planejador, com o mesmo HTML, CSS e JS do atual, adaptados para chamar o Web App.
2. **Web App do Apps Script**:
   - preso a uma planilha nova do Google, na mesma conta Google do dono usada na pesquisa (heliobelotojr@gmail.com), já conectada no Chrome;
   - executa como o dono, com acesso "Qualquer pessoa";
   - o POST vai como `text/plain`, para evitar o preflight de CORS, como na pesquisa.
3. **Planilha do Google**: a aba de contatos funciona como a lista de leads.
4. **Brevo** continua enviando o e-mail de confirmação. A chave da API fica nas Propriedades do script (`BREVO_API_KEY`) e o dono a cola ele mesmo.
   - O dono não sabe se a conta do Brevo ainda funciona.
   - *Decisão do Claude:* se a chave não estiver configurada ou se o Brevo responder com erro, o Web App envia o mesmo e-mail pela conta Google do dono, com `MailApp`, o mesmo remetente e cerca de 100 envios por dia.
   - Assim, o cadastro funciona com o Brevo ou sem ele.
   - O teste final é um cadastro real com um e-mail do dono, conferindo se o e-mail chega, por qual caminho saiu e se cai no spam.

### Fluxo do visitante

1. **Cadastro**: na página inicial, o visitante preenche nome, WhatsApp e e-mail. O Web App:
   - valida os campos;
   - grava ou atualiza a linha do e-mail;
   - gera um token de confirmação aleatório, que vale **24 horas**;
   - envia o e-mail pelo Brevo, com o link `https://zecabeloto.github.io/planejador/confirmar.html?t=<token>`.

   A tela passa para "Verifique seu e-mail", como hoje.
2. **Confirmação**: a página de confirmação envia o token ao Web App. Se o token for válido, não tiver expirado e não tiver sido usado:
   - marca o contato como confirmado e grava a data;
   - cria uma chave de acesso que vale **7 dias**, como hoje;
   - devolve a chave e o nome.

   A página guarda a chave no navegador e abre o planejador. Se o token for inválido, mostra "Link inválido ou expirado" com o caminho para pedir um novo.
3. **Planejador**: ao abrir, confere a chave com o Web App. Se a chave for inválida ou tiver expirado, volta para a página inicial. Com a chave válida, mostra o nome no topo. Se o visitante já tiver uma chave válida, a página inicial leva direto ao planejador, como hoje.
4. **Cálculos**: a projeção e o conversor rodam no Web App e exigem a chave válida.
   - Todas as simulações vão numa **única chamada**.
   - O cálculo só dispara depois que o visitante para de digitar.
   - Enquanto calcula, aparece um aviso de "calculando…" no gráfico.
   - Uma resposta antiga não pode sobrescrever uma mais nova.
5. **Voltar depois de 7 dias**: o visitante usa o mesmo formulário de cadastro e recebe um novo link. Um contato que já confirmou **continua confirmado** na planilha ao pedir um link novo, ao contrário do site atual, que voltava a marcar como não confirmado.
   - *Decisão do Claude:* o nome e o WhatsApp digitados nesse novo pedido só substituem os da planilha **depois que o link for clicado**. Até lá ficam pendentes na área técnica. Assim, ninguém troca os dados de um e-mail verificado sem provar que é o dono dele.
   - *Decisão do Claude:* "Cadastrado em" guarda a data do primeiro cadastro e não muda depois.
6. **Sair**: apaga a chave do navegador e a invalida no Web App.

### Planilha

A aba "Contatos" tem uma linha por e-mail e é o que o dono lê. As colunas são:

- Nome, WhatsApp e E-mail;
- Confirmado (Sim/Não);
- Cadastrado em, Confirmado em e Último acesso.

Tokens de confirmação e chaves de acesso não ficam visíveis em texto puro: o Web App guarda só o resumo (hash) e a validade, numa aba ou área técnica separada.

## Restrições

- Segue o padrão já usado na pesquisa:
  - as páginas não precisam de build;
  - a URL do Web App fica em `config.js`;
  - LockService nas escritas;
  - testes com `node --test` para a lógica pura, incluindo cálculos, validação e tokens, e para o Code.gs com o simulador das APIs do Google.
- Os resultados dos cálculos devem bater com os do `app.py` atual. O arredondamento final em centavos pode diferir em 1 centavo nos casos de "meio centavo", porque o Python arredonda para o par; isso foi aceito.
- O Apps Script numa conta gratuita tem cotas diárias de execução e de URL Fetch. O Brevo gratuito tem limite diário de envios.
- Um repositório público não pode conter segredos.

## Deixado para quem construir

- A estrutura de arquivos e a forma exata das abas técnicas.
- O tempo de espera depois da digitação e o visual do aviso "calculando…", desde que pareçam parte do site atual.
- Como limitar abusos no envio de e-mail, por exemplo pedidos repetidos para o mesmo endereço em pouco tempo ou robôs no formulário.
- As mensagens de erro, no tom do site atual.
- O cache de validação das chaves no Apps Script, se precisar, para responder mais rápido.

## Passos manuais do dono

- Aprovar a criação do repositório público `ZecaBeloto/planejador` e a ativação do GitHub Pages.
- Colar a `BREVO_API_KEY` nas Propriedades do script, se a conta do Brevo ainda funcionar. Sem ela, o e-mail sai pela conta Google.
- O site antigo no Render já está fora do ar. Recomendação: suspender o serviço no painel do Render, para ele não voltar sozinho quando o limite gratuito zerar e criar uma segunda lista de contatos.
- Autorizar o Apps Script na primeira execução.

O Claude pode fazer o resto pelo Chrome, como na pesquisa.
