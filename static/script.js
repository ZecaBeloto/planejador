// Só executa no app (quando canvas #grafico existe)
if (!document.getElementById('grafico')) {
  // Página de landing — sem lógica de gráfico
  void 0;
} else {

// ── Paletas ───────────────────────────────────────────────────
const CORES_SIM = ['#4a8fd4','#3a9e7a','#d06040','#c8a030','#7C5CBF','#e05c8a'];
const CORES_OBJ = ['#f0c040','#80d8a0','#80c8f0','#f09060','#c0a0f0','#f0a8c0'];

// ── Helpers ───────────────────────────────────────────────────
const brl = v => v.toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
const parseNum = s => {
  if (!s) return 0;
  const clean = s.replace(/[R$\s]/g,'').replace(/\.(?=\d{3})/g,'').replace(',','.');
  return parseFloat(clean) || 0;
};
const parseP = s => parseFloat((s||'').replace(',','.')) || 0;

function applyMaskMoeda(el) {
  if (!el) return;
  el.addEventListener('blur', function() {
    let v = this.value.replace(/[R$\s]/g,'').replace(/\./g,'').replace(',','.');
    const n = parseFloat(v);
    if (!isNaN(n) && this.value !== '')
      this.value = n.toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
  });
  el.addEventListener('keypress', function(e) {
    if (!/[\d,\.]/.test(e.key) && !['Backspace','Delete','Tab','ArrowLeft','ArrowRight'].includes(e.key))
      e.preventDefault();
  });
}
function applyMaskPct(el) {
  if (!el) return;
  el.addEventListener('input', function() {
    let v = this.value.replace(/[^\d,\.]/g,'');
    const ci=v.indexOf(','), di=v.indexOf('.');
    if (ci!==-1 && di!==-1) {
      const k=Math.min(ci,di);
      v=v.slice(0,k+1)+v.slice(k+1).replace(/[,\.]/g,'');
    }
    this.value=v;
  });
}

applyMaskMoeda(document.getElementById('valor_obj'));
applyMaskPct(document.getElementById('selic_anual'));

// ── Estado ────────────────────────────────────────────────────
let sims       = [];
let objetivos  = [];
let editObjIdx = null;
let tempos     = {};
let chartInst  = null;
let calcTimer  = null;
let simCnt     = 0;

// ── Cenários ──────────────────────────────────────────────────
// O Web App calcula até 6 cenários por vez (uma cor para cada).
const MAX_SIMS = 6;

function adicionarSim() {
  if (sims.length >= MAX_SIMS) { alert('Você pode comparar até 6 cenários ao mesmo tempo.'); return; }
  const id  = ++simCnt;
  const cor = CORES_SIM[(sims.length) % CORES_SIM.length];
  sims.push({ id, nome:`Cenário ${id}`, cor,
              salario:'', pct:'', taxa:'', aporte:'', anos:'30',
              aberto:true, visivelLinha:true, visivelAux:true });
  renderSims();
  calcularAuto();
}

function toggleSim(id) {
  const s = sims.find(s=>s.id===id);
  if (s) { s.aberto=!s.aberto; renderSimHeader(id); renderSimBody(id); }
}

function removerSim(id) {
  if (sims.length<=1) return;
  sims = sims.filter(s=>s.id!==id);
  renderSims();
  calcularAuto();
}

function toggleLinha(id) {
  const s = sims.find(s=>s.id===id);
  if (!s) return;
  s.visivelLinha = !s.visivelLinha;
  renderSimHeader(id);
  atualizarVisibilidade();
}

function toggleAux(id) {
  const s = sims.find(s=>s.id===id);
  if (!s) return;
  s.visivelAux = !s.visivelAux;
  renderSimHeader(id);
  atualizarVisibilidade();
}

function atualizarVisibilidade() {
  if (!chartInst) return;
  chartInst.data.datasets.forEach((ds, i) => {
    const lbl = ds.label || '';
    const simPrinc = sims.find(s => s.nome === lbl);
    if (simPrinc) { chartInst.setDatasetVisibility(i, simPrinc.visivelLinha); return; }
    if (lbl.startsWith('_hobj_')) {
      chartInst.setDatasetVisibility(i, sims.some(s=>s.visivelAux)); return;
    }
    if (lbl.startsWith('_vobj_') || lbl.startsWith('_pt_')) {
      const parts = lbl.split('_').filter(Boolean);
      const simId = parseInt(parts[parts.length-1]);
      const s = sims.find(s=>s.id===simId);
      if (s) chartInst.setDatasetVisibility(i, s.visivelAux && s.visivelLinha);
    }
  });
  chartInst.update();
}

function lerSim(id) {
  const s = sims.find(s=>s.id===id);
  if (!s) return;
  s.salario = document.getElementById(`ss_${id}`)?.value || '';
  s.pct     = document.getElementById(`sp_${id}`)?.value || '';
  s.taxa    = document.getElementById(`st_${id}`)?.value || '';
  s.aporte  = document.getElementById(`sa_${id}`)?.value || '';
  s.anos    = document.getElementById(`so_${id}`)?.value || '30';
}

function atualizarNome(id) {
  const s = sims.find(s=>s.id===id);
  if (!s) return;
  s.nome = document.getElementById(`sn_${id}`)?.value || s.nome;
  const labelEl = document.getElementById(`sh_label_${id}`);
  if (labelEl) labelEl.textContent = s.nome;
  calcularAuto();
}

function renderSimHeader(id) {
  const s  = sims.find(s=>s.id===id);
  const el = document.getElementById(`sh_${id}`);
  if (!s || !el) return;
  el.innerHTML = `
    <span class="sim-dot" style="background:${s.cor}"></span>
    <span class="sim-header-label" id="sh_label_${s.id}">${s.nome}</span>
    <span class="sim-header-meta">${s.salario?'Sal: '+s.salario:''}</span>
    <div class="sim-actions" onclick="event.stopPropagation()">
      <button class="btn ${s.visivelLinha?'primary':''}"
              style="font-size:11px;padding:3px 10px"
              onclick="toggleLinha(${s.id})">
        ${s.visivelLinha?'👁 Linha':'🚫 Linha'}
      </button>
      <button class="btn ${s.visivelAux?'':'danger'}"
              style="font-size:11px;padding:3px 10px"
              onclick="toggleAux(${s.id})">
        ${s.visivelAux?'👁 Aux':'🚫 Aux'}
      </button>
      ${sims.length>1?`<button class="btn danger" style="font-size:11px;padding:3px 10px" onclick="removerSim(${s.id})">Remover</button>`:''}
      <button class="btn" style="padding:3px 10px;font-size:11px"
              onclick="toggleSim(${s.id})">${s.aberto?'▲':'▼'}</button>
    </div>`;
}

function renderSimBody(id) {
  const s  = sims.find(s=>s.id===id);
  const el = document.getElementById(`sb_${id}`);
  if (!s || !el) return;
  el.className = `sim-body ${s.aberto?'open':''}`;
}

function renderSims() {
  const el = document.getElementById('listaSims');
  if (!sims.length) { el.innerHTML=''; return; }
  el.innerHTML = sims.map(s => `
    <div class="sim-card">
      <div class="sim-header" id="sh_${s.id}" onclick="toggleSim(${s.id})"></div>
      <div class="sim-body ${s.aberto?'open':''}" id="sb_${s.id}">
        <div style="margin-bottom:10px">
          <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:5px">Nome do cenário</label>
          <input type="text" id="sn_${s.id}" value="${s.nome}" placeholder="Nome do cenário"
                 style="font-size:13px" oninput="atualizarNome(${s.id})">
        </div>
        <div class="grid5">
          <div class="field"><label>Salário mensal (R$)</label>
            <input type="text" id="ss_${s.id}" value="${s.salario}" placeholder="Ex: 5.000,00" inputmode="decimal"
                   oninput="lerSim(${s.id});calcularAuto()"></div>
          <div class="field"><label>% poupar</label>
            <input type="text" id="sp_${s.id}" value="${s.pct}" placeholder="Ex: 20" inputmode="decimal"
                   oninput="lerSim(${s.id});calcularAuto()"></div>
          <div class="field"><label>Rentab. mensal (%)</label>
            <input type="text" id="st_${s.id}" value="${s.taxa}" placeholder="Ex: 1,08" inputmode="decimal"
                   oninput="lerSim(${s.id});calcularAuto()"></div>
          <div class="field"><label>Aporte inicial (R$)</label>
            <input type="text" id="sa_${s.id}" value="${s.aporte}" placeholder="Ex: 10.000,00" inputmode="decimal"
                   oninput="lerSim(${s.id});calcularAuto()"></div>
          <div class="field"><label>Horizonte (anos)</label>
            <input type="number" id="so_${s.id}" value="${s.anos}" min="1" max="60"
                   oninput="lerSim(${s.id});calcularAuto()"></div>
        </div>
      </div>
    </div>`).join('');

  sims.forEach(s => {
    renderSimHeader(s.id);
    applyMaskMoeda(document.getElementById(`ss_${s.id}`));
    applyMaskMoeda(document.getElementById(`sa_${s.id}`));
    applyMaskPct(document.getElementById(`sp_${s.id}`));
    applyMaskPct(document.getElementById(`st_${s.id}`));
  });
}

// ── Objetivos ─────────────────────────────────────────────────
function salvarObj() {
  const nome  = document.getElementById('nome_obj').value.trim();
  const valor = parseNum(document.getElementById('valor_obj').value);
  if (!nome || !valor) return;
  if (editObjIdx !== null) {
    objetivos[editObjIdx] = {nome, valor};
    editObjIdx = null;
    document.getElementById('btnObj').textContent = 'Adicionar';
    document.getElementById('btnCancelar').style.display = 'none';
  } else {
    objetivos.push({nome, valor});
  }
  document.getElementById('nome_obj').value  = '';
  document.getElementById('valor_obj').value = '';
  renderObjs();
  calcularAuto();
}

function editarObj(i) {
  editObjIdx = i;
  document.getElementById('nome_obj').value  = objetivos[i].nome;
  document.getElementById('valor_obj').value = objetivos[i].valor.toFixed(2)
    .replace('.',',').replace(/(\d)(?=(\d{3})+(?!\d))/g,'$1.');
  document.getElementById('btnObj').textContent = 'Salvar';
  document.getElementById('btnCancelar').style.display = 'inline-block';
}

function excluirObj(i) {
  objetivos.splice(i,1);
  if (editObjIdx===i) cancelarObj();
  renderObjs();
  calcularAuto();
}

function cancelarObj() {
  editObjIdx = null;
  document.getElementById('nome_obj').value  = '';
  document.getElementById('valor_obj').value = '';
  document.getElementById('btnObj').textContent = 'Adicionar';
  document.getElementById('btnCancelar').style.display = 'none';
}

function renderObjs() {
  const el = document.getElementById('listaObjs');
  if (!objetivos.length) { el.innerHTML=''; return; }
  el.innerHTML = objetivos.map((o,i) => {
    const pills = sims.map(s => {
      const t = (tempos[s.id]||{})[i];
      if (!t) return '';
      if (t.atingido) {
        const aStr = t.anos  > 0 ? `${t.anos}a`  : '';
        const mStr = t.meses > 0 ? `${t.meses}m` : '';
        const prazo = [aStr,mStr].filter(Boolean).join(' ') || '<1m';
        return `<span class="pill" style="background:${s.cor}18;border:0.5px solid ${s.cor}55;color:${s.cor}">
          <span style="width:6px;height:6px;border-radius:50%;background:${s.cor};display:inline-block"></span>
          ${s.nome}: ${prazo}
        </span>`;
      }
      return `<span class="pill" style="background:var(--surface);border:0.5px solid var(--border2);color:var(--muted)">
        <span style="width:6px;height:6px;border-radius:50%;background:var(--muted2,#888);display:inline-block"></span>
        ${s.nome}: fora do horizonte
      </span>`;
    }).join('');
    return `
    <div class="objetivo-row">
      <div>
        <div>🎯 <strong>${o.nome}</strong> — ${brl(o.valor)}</div>
        ${pills?`<div class="pills-row">${pills}</div>`:''}
      </div>
      <div class="actions">
        <button class="btn" onclick="editarObj(${i})">Editar</button>
        <button class="btn danger" onclick="excluirObj(${i})">Excluir</button>
      </div>
    </div>`;
  }).join('');
}

// ── Cálculo ────────────────────────────────────────────────────
// Espera a pessoa parar de digitar: cada cálculo é uma chamada ao Web App.
function calcularAuto() {
  clearTimeout(calcTimer);
  calcTimer = setTimeout(executar, 600);
}

let calcSeq = 0;

function avisoCalculando(ativo, mensagem) {
  const card = document.getElementById('chartCard');
  let aviso = document.getElementById('avisoCalculo');
  if (!aviso) {
    aviso = document.createElement('div');
    aviso.id = 'avisoCalculo';
    aviso.className = 'aviso-calculo';
    aviso.setAttribute('role', 'status');
    document.querySelector('.chart-wrap').appendChild(aviso);
  }
  if (ativo || mensagem) card.style.display = 'block';
  card.classList.toggle('calculando', ativo);
  aviso.textContent = mensagem || (ativo ? 'Calculando…' : '');
  aviso.hidden = !ativo && !mensagem;
}

// Todas as simulações vão numa chamada só; o Web App devolve null nas vazias.
async function executar() {
  const params = sims.map(s => ({
    salario: parseNum(s.salario), pct: parseP(s.pct), taxa: parseP(s.taxa),
    aporte: parseNum(s.aporte), anos: parseInt(s.anos) || 30,
  }));
  if (!params.some(p => p.salario || p.aporte)) return;
  const seq = ++calcSeq;
  avisoCalculando(true);
  const r = await chamar('calcular', { chave: lerChave(), sims: params });
  if (seq !== calcSeq) return; // chegou uma resposta mais nova antes desta
  if (!r.ok) {
    if (r.codigo === 'sessao') { sairParaInicio(); return; }
    avisoCalculando(false, r.erro);
    return;
  }
  avisoCalculando(false);
  const resultados = [];
  r.resultados.forEach((d, i) => {
    if (!d) return;
    const p = params[i];
    resultados.push({sim:sims[i], labels:d.labels, valores:d.valores, sal:p.salario, pct:p.pct, apt:p.aporte});
  });
  if (!resultados.length) return;
  renderGrafico(resultados);
}

// ── Gráfico ────────────────────────────────────────────────────
function zoomChart(dir) { if(chartInst) dir==='in'?chartInst.zoom(1.25):chartInst.zoom(0.8); }
function resetZoom()    { if(chartInst) chartInst.resetZoom(); }

function renderGrafico(resultados) {
  tempos = {};
  document.getElementById('metricasArea').innerHTML = resultados.map(r => {
    const ult   = r.valores[r.valores.length-1];
    const amens = r.sal*(r.pct/100);
    const meses = r.labels.length - 1;
    const tapt  = amens * meses + r.apt;
    return `
    <div class="card" style="border-left:3px solid ${r.sim.cor}">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;
                  padding-bottom:8px;border-bottom:0.5px solid var(--border)">
        <span style="width:10px;height:10px;border-radius:50%;background:${r.sim.cor};display:inline-block"></span>
        <span style="font-size:13px;font-weight:500">${r.sim.nome}</span>
      </div>
      <div class="metric-grid">
        <div class="metric"><div class="mlabel">Patrimônio final</div>
          <div class="mvalue" style="color:${r.sim.cor}">${brl(ult)}</div></div>
        <div class="metric"><div class="mlabel">Total aportado</div>
          <div class="mvalue teal">${brl(tapt)}</div></div>
        <div class="metric"><div class="mlabel">Rendimento gerado</div>
          <div class="mvalue amber">${brl(Math.max(0,ult-tapt))}</div></div>
        <div class="metric"><div class="mlabel">Aporte mensal</div>
          <div class="mvalue blue">${brl(amens)}</div></div>
      </div>
    </div>`;
  }).join('');

  document.getElementById('chartCard').style.display = 'block';
  const datasets = [];

  resultados.forEach(r => {
    datasets.push({
      label: r.sim.nome,
      data:  r.labels.map((x,i)=>({x,y:r.valores[i]})),
      borderColor: r.sim.cor, backgroundColor: r.sim.cor+'12',
      borderWidth:2, tension:0.4, pointRadius:0,
      fill: resultados.length===1, parsing:false, cubicInterpolationMode:'monotone'
    });

    tempos[r.sim.id] = {};
    objetivos.forEach((obj,oi) => {
      const ii = r.valores.findIndex(v=>v>=obj.valor);
      if (ii===-1) { tempos[r.sim.id][oi]={atingido:false}; return; }
      const ta = r.labels[ii];
      tempos[r.sim.id][oi] = { atingido:true, anos:Math.floor(ta), meses:Math.round((ta-Math.floor(ta))*12) };
    });
  });

  objetivos.forEach((obj,oi) => {
    const cor = CORES_OBJ[oi%CORES_OBJ.length];
    let xMax  = null;
    resultados.forEach(r => {
      const ii = r.valores.findIndex(v=>v>=obj.valor);
      if (ii!==-1) { const x=r.labels[ii]; if(xMax===null||x>xMax) xMax=x; }
    });
    if (xMax===null) return;
    const xMin = Math.min(...resultados.map(r=>r.labels[0]));

    datasets.push({
      label:`_hobj_${oi}`, data:[{x:xMin,y:obj.valor},{x:xMax,y:obj.valor}],
      borderColor:cor, borderWidth:1, borderDash:[5,4],
      pointRadius:0, showLine:true, fill:false, parsing:false, tension:0
    });

    resultados.forEach(r => {
      const ii = r.valores.findIndex(v=>v>=obj.valor);
      if (ii===-1) return;
      const tempo = r.labels[ii];
      datasets.push({
        label:`_vobj_${oi}_${r.sim.id}`,
        data:[{x:tempo,y:0},{x:tempo,y:obj.valor}],
        borderColor:r.sim.cor, borderWidth:1, borderDash:[5,4],
        pointRadius:0, showLine:true, fill:false, parsing:false, tension:0
      });
      datasets.push({
        label:`_pt_${oi}_${r.sim.id}`,
        data:[{x:tempo,y:obj.valor}],
        pointBackgroundColor:r.sim.cor, pointBorderColor:'#fff', pointBorderWidth:1.5,
        pointRadius:5, showLine:false, parsing:false
      });
    });
  });

  const xMin = Math.min(...resultados.map(r=>r.labels[0]));
  const xMax = Math.max(...resultados.map(r=>r.labels[r.labels.length-1]));

  if (chartInst) chartInst.destroy();
  chartInst = new Chart(document.getElementById('grafico'),{
    type:'line', data:{ labels:resultados[0].labels, datasets },
    options:{
      responsive:true, maintainAspectRatio:false,
      interaction:{ mode:'index', intersect:false },
      plugins:{
        legend:{ display:false },
        tooltip:{
          filter: c => !c.dataset.label?.startsWith('_'),
          callbacks:{ label: c => c.parsed.y!=null ? '  '+c.dataset.label+': '+brl(c.parsed.y) : '' }
        },
        zoom:{
          pan:{ enabled:true, mode:'x' },
          zoom:{ wheel:{enabled:true}, pinch:{enabled:true}, mode:'x' },
          limits:{ x:{minRange:1} }
        }
      },
      scales:{
        x:{ type:'linear', position:'bottom', min:xMin, max:xMax,
            ticks:{color:'#6e6e6a',maxTicksLimit:10}, grid:{color:'rgba(255,255,255,0.04)'},
            title:{display:true,text:'Tempo (anos)',color:'#6e6e6a',font:{size:11}} },
        y:{ ticks:{color:'#6e6e6a',callback:v=>brl(v)}, grid:{color:'rgba(255,255,255,0.04)'},
            title:{display:true,text:'Patrimônio acumulado',color:'#6e6e6a',font:{size:11}} }
      }
    }
  });

  const lSims = resultados.map(r=>
    `<span style="opacity:${r.sim.visivelLinha?1:0.35}">
       <span style="width:14px;height:3px;background:${r.sim.cor};display:inline-block;border-radius:2px"></span>
       ${r.sim.nome}
     </span>`).join('');
  const lObjs = objetivos.map((o,oi)=>{
    const cor=CORES_OBJ[oi%CORES_OBJ.length];
    return `<span><span style="width:12px;height:0;display:inline-block;
      border-top:1.5px dashed ${cor};margin-bottom:2px"></span>${o.nome}</span>`;
  }).join('');
  document.getElementById('legendRow').innerHTML = lSims + lObjs;

  atualizarVisibilidade();
  renderObjs();
}

// Inicia com um cenário
adicionarSim();

} // fim do bloco if grafico

// ── Conversor (escopo global) ──────────────────────────────────
async function converterTaxa() {
  const v = document.getElementById('selic_anual').value.replace(',','.');
  if (!v) return;
  const saida = document.getElementById('resultado_taxa');
  saida.textContent = 'Convertendo…';
  const d = await chamar('converter', { chave: lerChave(), taxaAnual: parseFloat(v) });
  if (!d.ok) {
    if (d.codigo === 'sessao') { sairParaInicio(); return; }
    saida.textContent = d.erro;
    return;
  }
  saida.textContent = `Taxa mensal equivalente: ${String(d.taxaMensal).replace('.',',')}% a.m.`;
}
document.getElementById('selic_anual').addEventListener('keydown', e => {
  if (e.key === 'Enter') converterTaxa();
});