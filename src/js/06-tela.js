  /* ========================================================
     TELA NOVA — MONTAR | ACOMPANHAR (Tarefas 15–21)
     Layout escolhido pelo BM: opção 2 · compacta (docs/plano/layouts/opcao-montar-2.png); Acompanhar como o layout D.
     PROVISÓRIO: só aparece com localStorage.rf_rodbot_ui_nova_v1 = '1'. Sem a chave, o painel antigo fica
     exatamente como era. Na Tarefa 22 o painel antigo e este interruptor são removidos.
     ======================================================== */

  const telaNova = (() => {
    try { return localStorage.getItem('rf_rodbot_ui_nova_v1') === '1'; } catch { return false; }
  })();

  styleEl.textContent += `
    #ba-win[data-ui="nova"] #ba-tabs, #ba-win[data-ui="nova"] .ba-pane { display: none !important; }
    #ba-win[data-ui="nova"][data-rb-aba="montar"] #ba-run-bar,
    #ba-win[data-ui="nova"][data-rb-aba="montar"] .ba-telemetry,
    #ba-win[data-ui="nova"][data-rb-aba="montar"] #ba-log { display: none !important; }
    .rb-abas { display: flex; gap: 4px; padding: 4px; border-radius: 12px; background: var(--rb-elevated); border: 1px solid var(--rb-border); }
    .rb-aba { flex: 1; padding: 8px 4px; border-radius: 9px; border: 1px solid transparent; background: transparent;
      color: var(--rb-muted); font: 600 13px/1.2 inherit; cursor: pointer; }
    .rb-aba:hover { color: var(--rb-text); }
    .rb-aba.ativa { background: var(--rb-accent-dim); color: var(--rb-accent); border-color: var(--rb-accent-border); }
    .rb-vista { display: none; flex-direction: column; gap: 10px; }
    .rb-vista.ativa { display: flex; }
    .rb-linha { display: flex; align-items: center; gap: 8px; }
    .rb-sub { color: var(--rb-muted); font-size: 12px; }
    .rb-sel { flex: 1; min-width: 0; padding: 7px 9px; border-radius: 9px; background: var(--rb-elevated);
      color: var(--rb-text); border: 1px solid var(--rb-border); font: 13px inherit; }
    .rb-ib { width: 32px; height: 32px; border-radius: 9px; background: var(--rb-elevated); color: var(--rb-text);
      border: 1px solid var(--rb-border); cursor: pointer; font-size: 14px; }
    .rb-pq { padding: 4px 9px; border-radius: 999px; border: 1px solid var(--rb-border); background: transparent;
      color: var(--rb-muted); font: 600 12px inherit; cursor: pointer; }
    .rb-pq.on { color: var(--rb-accent); border-color: var(--rb-accent-border); background: var(--rb-accent-dim); }
    @keyframes rb-pisca { 0%, 100% { box-shadow: none; } 50% { box-shadow: 0 0 0 3px var(--rb-accent-glow); } }
    .rb-pq-linha.rb-pisca .rb-pq { animation: rb-pisca 0.4s ease-in-out 3; border-color: var(--rb-accent-border); }
    .rb-pal { display: flex; gap: 6px; }
    .rb-pal button { flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px; padding: 7px 4px;
      border-radius: 10px; border: 1px solid var(--rb-border); background: var(--rb-card); color: var(--rb-muted);
      font: 12px inherit; cursor: pointer; }
    .rb-pal button:hover { color: var(--rb-text); border-color: var(--rb-border-strong); }
    .rb-pal.rb-destaque button { border-color: var(--rb-accent-border); color: var(--rb-text); box-shadow: 0 0 0 2px var(--rb-accent-dim); }
    .rb-pal.rb-off button { opacity: 0.4; }
    .rb-dica { color: var(--rb-muted); font-size: 11.5px; text-align: center; }
    .rb-dica:empty { display: none; }
    .rb-passos { display: flex; flex-direction: column; gap: 8px; }
    .rb-passo { border-radius: 11px; border: 1px solid var(--rb-border); background: var(--rb-card); padding: 9px 10px; }
    .rb-passo.aberto { border-color: var(--rb-accent-border); }
    .rb-passo.erro { border-color: #f26060; background: rgba(242, 96, 96, 0.10); }
    .rb-passo-topo { display: flex; gap: 10px; align-items: flex-start; cursor: pointer; }
    .rb-num { width: 24px; height: 24px; flex: none; border-radius: 50%; display: grid; place-items: center;
      background: var(--rb-elevated); border: 1px solid var(--rb-border); font-size: 12px; font-weight: 700; }
    .rb-passo-txt { flex: 1; min-width: 0; }
    .rb-passo-tit { font-weight: 700; font-size: 13.5px; }
    .rb-passo-res { color: var(--rb-muted); font-size: 12px; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .rb-passo-erro { color: #f6a3a3; font-size: 12px; margin-top: 3px; }
    .rb-passo-erro:empty { display: none; }
    .rb-ctl { display: flex; gap: 4px; }
    .rb-ctl button { width: 24px; height: 24px; border-radius: 6px; border: 1px solid var(--rb-border);
      background: var(--rb-elevated); color: var(--rb-muted); cursor: pointer; font-size: 11px; padding: 0; }
    .rb-ctl button:disabled { opacity: 0.35; cursor: default; }
    .rb-campos { display: none; flex-direction: column; gap: 7px; margin-top: 8px; padding-left: 34px; }
    .rb-passo.aberto .rb-campos { display: flex; }
    .rb-cta { padding: 12px; border-radius: 12px; border: 0; background: var(--rb-accent); color: var(--rb-on-accent);
      font: 800 15px inherit; cursor: pointer; }
    .rb-cta:disabled { opacity: 0.45; cursor: not-allowed; }
  `;

  const telaArmazenamento = { getItem: k => localStorage.getItem(k), setItem: (k, v) => localStorage.setItem(k, v) };
  const tela = { fluxos: null, item: null, fluxo: null, aberto: null };
  const rbAbas = {};
  const rbVistas = {};

  function telaAplicarAba(aba) {
    win.setAttribute('data-rb-aba', aba);
    Object.keys(rbAbas).forEach(k => {
      rbAbas[k].classList.toggle('ativa', k === aba);
      rbAbas[k].setAttribute('aria-selected', String(k === aba));
      rbVistas[k].classList.toggle('ativa', k === aba);
    });
  }

  function telaMontarCasca() {
    const corpo = win.querySelector('.ba-body');
    const antesDe = document.getElementById('ba-run-bar');
    const abas = document.createElement('div');
    abas.className = 'rb-abas';
    abas.id = 'rb-abas';
    abas.setAttribute('role', 'tablist');
    abas.innerHTML = `
      <button type="button" class="rb-aba" id="rb-aba-montar" role="tab" data-rb-aba="montar">🧩 Montar</button>
      <button type="button" class="rb-aba" id="rb-aba-acompanhar" role="tab" data-rb-aba="acompanhar">📊 Acompanhar</button>`;
    const montar = document.createElement('div');
    montar.className = 'rb-vista';
    montar.id = 'rb-montar';
    const acompanhar = document.createElement('div');
    acompanhar.className = 'rb-vista';
    acompanhar.id = 'rb-acompanhar';
    corpo.insertBefore(abas, antesDe);
    corpo.insertBefore(montar, antesDe);
    corpo.insertBefore(acompanhar, antesDe);
    rbAbas.montar = abas.querySelector('#rb-aba-montar');
    rbAbas.acompanhar = abas.querySelector('#rb-aba-acompanhar');
    rbVistas.montar = montar;
    rbVistas.acompanhar = acompanhar;
    abas.addEventListener('click', e => {
      const b = e.target.closest('[data-rb-aba]');
      if (b) telaAplicarAba(b.dataset.rbAba);
    });
    win.setAttribute('data-ui', 'nova');
    migrarPrimeiraAbertura(telaArmazenamento);
    tela.fluxos = criarFluxosSalvos(telaArmazenamento, { mensagemAuto: mensagemAutoMigrada(telaArmazenamento) });
    telaCarregar(tela.fluxos.atual());
    telaMontarMontar();
    telaAplicarAba(abaInicial());
  }

  function telaCarregar(item) {
    tela.item = item;
    tela.fluxo = JSON.parse(JSON.stringify(item.fluxo));
    tela.aberto = null;
  }

  // ───────── Montar (opção 2 · compacta)
  function telaMontarMontar() {
    rbVistas.montar.innerHTML = `
      <div class="rb-linha">
        <select id="rb-fluxo-sel" class="rb-sel" title="Fluxo salvo"></select>
        <button type="button" id="rb-novo" class="rb-ib" title="Novo fluxo vazio">＋</button>
      </div>
      <div class="rb-linha rb-pq-linha" id="rb-pq">
        <span class="rb-sub">Para quem?</span>
        <button type="button" class="rb-pq" data-pq="aguardando">⏳ Aguardando</button>
        <button type="button" class="rb-pq" data-pq="caindo">🆕 Que vão cair</button>
        <button type="button" class="rb-pq" data-pq="ambos">👥 Ambos</button>
      </div>
      <div class="rb-pal" id="rb-paleta">
        ${PASSO_ORDEM_PALETA.map(t => `<button type="button" data-tipo="${t}" title="Adicionar ${PASSO_INFO[t].titulo}"><span>${PASSO_INFO[t].icone}</span>${PASSO_INFO[t].nome}</button>`).join('')}
      </div>
      <div class="rb-dica" id="rb-pal-dica"></div>
      <div class="rb-passos" id="rb-passos"></div>
      <div id="rb-ajustes"></div>
      <button type="button" id="rb-iniciar" class="rb-cta">⚡ Iniciar fluxo</button>
      <div class="rb-dica" id="rb-iniciar-dica"></div>`;
    const v = rbVistas.montar;
    v.querySelector('#rb-fluxo-sel').addEventListener('change', e => {
      const item = tela.fluxos.listar().find(x => x.id === e.target.value);
      if (item) { telaCarregar(item); tela.fluxos.marcarAtual(item.id); telaRenderMontar(); }
    });
    v.querySelector('#rb-novo').addEventListener('click', () => {
      telaCarregar({ id: null, nome: 'Novo fluxo', modelo: false, fluxo: tela.fluxos.novoVazio() });
      telaRenderMontar();
    });
    v.querySelector('#rb-pq').addEventListener('click', e => {
      const b = e.target.closest('[data-pq]');
      if (!b) return;
      tela.fluxo.paraQuem = b.dataset.pq;
      telaRenderMontar();
    });
    v.querySelector('#rb-paleta').addEventListener('click', e => {
      const b = e.target.closest('[data-tipo]');
      if (b) telaAdicionarPasso(b.dataset.tipo);
    });
    v.querySelector('#rb-passos').addEventListener('click', e => {
      const card = e.target.closest('.rb-passo');
      if (!card) return;
      const i = Number(card.dataset.i);
      const acao = e.target.closest('[data-acao]')?.dataset.acao;
      if (acao === 'subir' || acao === 'descer') {
        tela.fluxo.passos = moverPasso(tela.fluxo.passos, i, acao === 'subir' ? -1 : 1);
        if (tela.aberto === i) tela.aberto = i + (acao === 'subir' ? -1 : 1);
        else if (tela.aberto === i + (acao === 'subir' ? -1 : 1)) tela.aberto = i;
      } else if (acao === 'remover') {
        tela.fluxo.passos = removerPasso(tela.fluxo.passos, i);
        if (tela.aberto === i) tela.aberto = null;
        else if (tela.aberto !== null && tela.aberto > i) tela.aberto--;
      } else if (e.target.closest('.rb-passo-topo')) {
        tela.aberto = tela.aberto === i ? null : i; // só um cartão aberto por vez
      } else {
        return;
      }
      telaRenderMontar();
    });
    v.querySelector('#rb-iniciar').addEventListener('click', () => {
      if (!podeIniciar(tela.fluxo)) return;
      log('▶ (tela nova em construção: o Iniciar será ligado ao motor na Tarefa 22)');
    });
    telaRenderMontar();
  }

  function telaPiscarParaQuem() {
    const linha = document.getElementById('rb-pq');
    linha.classList.remove('rb-pisca');
    void linha.offsetWidth; // reinicia a animação
    linha.classList.add('rb-pisca');
    setTimeout(() => linha.classList.remove('rb-pisca'), 1300);
  }

  function telaAdicionarPasso(tipo) {
    const f = tela.fluxo;
    if (!f.paraQuem) { telaPiscarParaQuem(); return; }
    if (f.passos.length >= FLUXO_MAX_PASSOS) return;
    if (tipo === 'atender' && !disponibilidade(f.paraQuem).atender) return;
    f.passos.push(novoPasso(tipo));
    tela.aberto = f.passos.length - 1;
    telaRenderMontar();
  }

  function telaRenderMontar() {
    const v = rbVistas.montar;
    const f = tela.fluxo;
    // seletor de fluxos
    const sel = v.querySelector('#rb-fluxo-sel');
    sel.innerHTML = '';
    const itens = tela.fluxos.listar();
    if (!tela.item.id) itens.unshift({ id: '', nome: tela.item.nome });
    for (const it of itens) {
      const o = document.createElement('option');
      o.value = it.id || '';
      o.textContent = it.nome;
      sel.appendChild(o);
    }
    sel.value = tela.item.id || '';
    // Para quem?
    v.querySelectorAll('.rb-pq').forEach(b => b.classList.toggle('on', b.dataset.pq === f.paraQuem));
    // paleta
    const pal = v.querySelector('#rb-paleta');
    const disp = disponibilidade(f.paraQuem);
    const cheio = f.passos.length >= FLUXO_MAX_PASSOS;
    pal.querySelector('[data-tipo="atender"]').hidden = !!f.paraQuem && !disp.atender;
    pal.classList.toggle('rb-off', !f.paraQuem || cheio);
    pal.classList.toggle('rb-destaque', !!f.paraQuem && f.passos.length === 0);
    v.querySelector('#rb-pal-dica').textContent = !f.paraQuem ? 'Escolha para quem primeiro'
      : cheio ? 'Máximo ' + FLUXO_MAX_PASSOS + ' passos'
        : f.passos.length === 0 ? 'Toque num ícone para adicionar um passo' : '';
    // passos
    const validacao = validarFluxo(f);
    const lista = v.querySelector('#rb-passos');
    lista.innerHTML = '';
    f.passos.forEach((passo, i) => {
      const errosDoPasso = (validacao.erros || []).filter(e => e.indice === i + 1);
      const principal = errosDoPasso.length ? erroDoModal(errosDoPasso) : null;
      const card = document.createElement('div');
      card.className = 'rb-passo' + (tela.aberto === i ? ' aberto' : '') + (principal ? ' erro' : '');
      card.dataset.i = String(i);
      card.innerHTML = `
        <div class="rb-passo-topo">
          <span class="rb-num"></span>
          <div class="rb-passo-txt"><div class="rb-passo-tit"></div><div class="rb-passo-res"></div><div class="rb-passo-erro"></div></div>
          <div class="rb-ctl">
            <button type="button" data-acao="subir" title="Subir">▲</button>
            <button type="button" data-acao="descer" title="Descer">▼</button>
            <button type="button" data-acao="remover" title="Remover">✕</button>
          </div>
        </div>
        <div class="rb-campos"></div>`;
      card.querySelector('.rb-num').textContent = String(i + 1);
      card.querySelector('.rb-passo-tit').textContent = tituloPasso(passo);
      card.querySelector('.rb-passo-res').textContent = resumoPasso(passo);
      card.querySelector('.rb-passo-erro').textContent = principal ? (principal.dica ? principal.mensagem + ' · ' + principal.dica : principal.mensagem) : '';
      card.querySelector('[data-acao="subir"]').disabled = i === 0;
      card.querySelector('[data-acao="descer"]').disabled = i === f.passos.length - 1;
      lista.appendChild(card);
    });
    // Iniciar
    const pode = podeIniciar(f);
    v.querySelector('#rb-iniciar').disabled = !pode;
    const primeiro = erroDoModal(validacao.erros || []);
    const vazio = f.passos.findIndex(p => validarCampos(p).length);
    v.querySelector('#rb-iniciar-dica').textContent = pode ? ''
      : !f.paraQuem ? 'Escolha para quem primeiro'
        : !f.passos.length ? 'Toque num ícone da paleta para começar'
          : primeiro && primeiro.indice ? 'Corrija o passo ' + primeiro.indice
            : primeiro ? primeiro.mensagem
              : vazio >= 0 ? 'Preencha o passo ' + (vazio + 1) : '';
  }

  if (telaNova) telaMontarCasca();

