// E-mail de confirmação: o mesmo modelo de enviar_email do app.py, trocando só o nome e o link.

var ASSUNTO_CONFIRMACAO = 'Confirme seu e-mail — Helio Beloto Jr';

function escaparHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function montarEmailConfirmacao(nome, link) {
  var html = '<!DOCTYPE html>\n' +
'<html lang="pt-BR"><head><meta charset="UTF-8"></head>\n' +
'<body style="margin:0;padding:0;background:#0e0f11;font-family:system-ui,sans-serif">\n' +
'<table width="100%" cellpadding="0" cellspacing="0" style="background:#0e0f11;padding:40px 0">\n' +
'<tr><td align="center">\n' +
'<table width="560" cellpadding="0" cellspacing="0"\n' +
'       style="background:#161719;border-radius:12px;border:1px solid rgba(255,255,255,0.08)">\n' +
'  <tr>\n' +
'    <td style="background:linear-gradient(135deg,#1a2a3a,#162030);padding:32px 40px;\n' +
'               border-bottom:1px solid rgba(255,255,255,0.06)">\n' +
'      <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.12em;\n' +
'                text-transform:uppercase;color:#c8a96e">ASSESSOR DE INVESTIMENTOS</p>\n' +
'      <h1 style="margin:6px 0 0;font-size:22px;font-weight:400;color:#e2e2e0">Helio Beloto Jr</h1>\n' +
'    </td>\n' +
'  </tr>\n' +
'  <tr>\n' +
'    <td style="padding:36px 40px">\n' +
'      <p style="margin:0 0 8px;font-size:15px;color:#9a9994">\n' +
'        Olá, <strong style="color:#e2e2e0">' + escaparHtml(nome) + '</strong>\n' +
'      </p>\n' +
'      <p style="margin:0 0 28px;font-size:14px;color:#6e6e6a;line-height:1.6">\n' +
'        Obrigado pelo interesse! Clique no botão abaixo para confirmar seu e-mail\n' +
'        e ter acesso ao Planejador Financeiro.\n' +
'      </p>\n' +
'      <a href="' + escaparHtml(link) + '"\n' +
'         style="display:inline-block;padding:13px 28px;\n' +
'                background:linear-gradient(135deg,#c8a96e,#a8893e);\n' +
'                color:#0e0f11;font-size:14px;font-weight:700;\n' +
'                text-decoration:none;border-radius:8px">\n' +
'        ✓ Confirmar e-mail\n' +
'      </a>\n' +
'      <p style="margin:28px 0 0;font-size:12px;color:#4a4a47;line-height:1.6">\n' +
'        Se você não se cadastrou, ignore este e-mail.<br>\n' +
'        O link expira em <strong style="color:#6e6e6a">24 horas</strong>.\n' +
'      </p>\n' +
'    </td>\n' +
'  </tr>\n' +
'  <tr>\n' +
'    <td style="padding:20px 40px;background:#0e0f11;\n' +
'               border-top:1px solid rgba(255,255,255,0.05)">\n' +
'      <p style="margin:0;font-size:11px;color:#4a4a47">\n' +
'        Helio Beloto Jr · Assessor de Investimentos ·\n' +
'        <a href="https://wa.me/5514997175510"\n' +
'           style="color:#6e6e6a;text-decoration:none">(14) 99717-5510</a>\n' +
'      </p>\n' +
'    </td>\n' +
'  </tr>\n' +
'</table>\n' +
'</td></tr></table>\n' +
'</body></html>';
  return { assunto: ASSUNTO_CONFIRMACAO, html: html };
}

if (typeof module !== 'undefined') {
  module.exports = { montarEmailConfirmacao: montarEmailConfirmacao, escaparHtml: escaparHtml };
}
