  /* ========================================================
     TELA NOVA — MONTAR | ACOMPANHAR (Tarefas 15–21)
     Layout escolhido pelo BM: opção 2 · compacta (docs/plano/layouts/opcao-montar-2.png); Acompanhar como o layout D.
     É a única tela do painel (o painel antigo de 5 abas foi removido na Tarefa 22).
     ======================================================== */

  styleEl.textContent += `
    #ba-win[data-ui="nova"][data-rb-aba="montar"] #ba-run-bar,
    #ba-win[data-ui="nova"][data-rb-aba="montar"] .ba-telemetry,
    #ba-win[data-ui="nova"][data-rb-aba="montar"] #ba-log { display: none !important; }
    .rb-abas { display: flex; gap: 4px; padding: 4px; border-radius: 12px; background: var(--rb-elevated); border: 1px solid var(--rb-border); }
    .rb-aba { flex: 1; padding: 8px 4px; border-radius: 9px; border: 1px solid transparent; background: transparent;
      color: var(--rb-muted); font-weight: 600; font-size: 13px; line-height: 1.2; font-family: inherit; cursor: pointer; }
    .rb-aba:hover { color: var(--rb-text); }
    .rb-aba.ativa { background: var(--rb-accent-dim); color: var(--rb-accent); border-color: var(--rb-accent-border); }
    .rb-vista { display: none; flex-direction: column; gap: 10px; }
    .rb-vista.ativa { display: flex; }
    .rb-linha { display: flex; align-items: center; gap: 8px; }
    .rb-sub { color: var(--rb-muted); font-size: 12px; }
    .rb-sel { flex: 1; min-width: 0; padding: 7px 9px; border-radius: 9px; background: var(--rb-elevated);
      color: var(--rb-text); border: 1px solid var(--rb-border); font-size: 13px; font-family: inherit; }
    .rb-ib { width: 32px; height: 32px; border-radius: 9px; background: var(--rb-elevated); color: var(--rb-text);
      border: 1px solid var(--rb-border); cursor: pointer; font-size: 14px; }
    .rb-pq { padding: 4px 9px; border-radius: 999px; border: 1px solid var(--rb-border); background: transparent;
      color: var(--rb-muted); font-weight: 600; font-size: 12px; font-family: inherit; cursor: pointer; }
    .rb-pq.on { color: var(--rb-accent); border-color: var(--rb-accent-border); background: var(--rb-accent-dim); }
    @keyframes rb-pisca { 0%, 100% { box-shadow: none; } 50% { box-shadow: 0 0 0 3px var(--rb-accent-glow); } }
    .rb-pq-linha.rb-pisca .rb-pq { animation: rb-pisca 0.4s ease-in-out 3; border-color: var(--rb-accent-border); }
    .rb-pal { display: flex; gap: 6px; }
    .rb-pal button { flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px; padding: 7px 4px;
      border-radius: 10px; border: 1px solid var(--rb-border); background: var(--rb-card); color: var(--rb-muted);
      font-size: 12px; font-family: inherit; cursor: pointer; }
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
    .rb-seg { display: flex; gap: 3px; padding: 3px; border-radius: 10px; background: var(--rb-elevated); border: 1px solid var(--rb-border); }
    .rb-seg button { flex: 1; padding: 7px 4px; border-radius: 8px; border: 1px solid transparent; background: transparent;
      color: var(--rb-muted); font-weight: 600; font-size: 12.5px; font-family: inherit; cursor: pointer; }
    .rb-seg button.on { background: var(--rb-accent-dim); color: var(--rb-accent); border-color: var(--rb-accent-border); }
    .rb-in { width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 9px; background: var(--rb-elevated);
      color: var(--rb-text); border: 1px solid var(--rb-border); font-size: 13px; font-family: inherit; resize: vertical; }
    .rb-in.rb-vazio { border-color: #f26060; background: rgba(242, 96, 96, 0.10); }
    .rb-in-vel { width: 82px; flex: none; }
    .rb-sp { flex: 1; }
    .rb-aviso { color: #fbbf24; font-size: 11.5px; }
    .rb-aviso:empty { display: none; }
    .rb-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .rb-chip { padding: 4px 10px; border-radius: 999px; border: 1px solid var(--rb-border); background: var(--rb-elevated);
      color: var(--rb-text); font-size: 12.5px; font-family: inherit; cursor: pointer; }
    .rb-selo { font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 999px; background: #2b2210;
      color: #f5b041; border: 1px solid #5d4517; }
    .rb-selo:empty { display: none; }
    .rb-modal-ancora { position: sticky; top: 0; height: 0; z-index: 60; overflow: visible; }
    .rb-modal-fundo { position: absolute; top: 0; left: 0; right: 0; display: grid; place-items: center; padding: 18px;
      background: rgba(0, 0, 0, 0.62); border-radius: inherit; }
    .rb-modal { width: 100%; box-sizing: border-box; padding: 16px; border-radius: 14px; background: #151b20;
      border: 1px solid #6b2b2b; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8); color: var(--rb-text); }
    .rb-modal h3 { margin: 0 0 8px; color: #ff8a8a; font-size: 16px; font-weight: 700; }
    .rb-modal-linha { font-size: 14px; margin: 0 0 8px; }
    .rb-modal-detalhe { color: var(--rb-muted); font-size: 13px; margin: 0 0 14px; line-height: 1.45; }
    .rb-modal-btns { display: flex; gap: 10px; flex-wrap: wrap; }
    .rb-modal-btns button { flex: 1; min-width: 120px; padding: 11px 8px; border-radius: 11px; font-weight: 700; font-size: 14px; cursor: pointer;
      border: 1px solid var(--rb-border-strong); background: var(--rb-elevated); color: var(--rb-text); font-family: inherit; }
    .rb-modal-btns button.rb-primario { background: var(--rb-accent); color: var(--rb-on-accent); border-color: transparent; }
    .rb-ajustes { border-radius: 12px; border: 1px solid var(--rb-border); background: var(--rb-card); }
    .rb-ajustes-topo { width: 100%; display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: transparent;
      border: 0; color: var(--rb-text); cursor: pointer; text-align: left; font-family: inherit; }
    .rb-ajustes-tit { font-weight: 700; font-size: 13px; }
    #rb-ajustes-res { flex: 1; min-width: 0; text-align: right; }
    .rb-ajustes-corpo { display: flex; flex-direction: column; gap: 10px; padding: 0 12px 12px; }
    .rb-ajustes-corpo[hidden], .rb-bloco[hidden] { display: none; }
    .rb-bloco { display: flex; flex-direction: column; gap: 4px; }
    .rb-toggle { display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; }
    .rb-toggle input:disabled + * , .rb-toggle:has(input:disabled) { opacity: 0.6; cursor: not-allowed; }
    .rb-modal-neutro { border-color: var(--rb-border-strong); }
    .rb-modal-neutro h3 { color: var(--rb-text); }
    .rb-modal-campo { margin: 0 0 8px; }
    .rb-modal-campo[hidden] { display: none; }
    .rb-modal-erro { color: #f6a3a3; font-size: 12.5px; margin: 0 0 10px; min-height: 0; }
    .rb-modal-erro:empty { display: none; }
    #rb-alterado[hidden], #rb-apagar[hidden] { display: none; }
    .rb-acomp-topo { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 12px;
      border: 1px solid var(--rb-border); background: var(--rb-card); }
    .rb-acomp-nome { flex: 1; font-weight: 700; font-size: 14px; }
    .rb-pill { font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 999px; background: var(--rb-accent-dim);
      color: var(--rb-accent); border: 1px solid var(--rb-accent-border); }
    .rb-pill[data-estado="parado"], .rb-pill[data-estado="concluido"] { background: var(--rb-elevated); color: var(--rb-muted); border-color: var(--rb-border); }
    .rb-pill[data-estado="falha"] { background: rgba(242, 96, 96, 0.12); color: #f6a3a3; border-color: rgba(242, 96, 96, 0.5); }
    .rb-stepper { display: flex; flex-direction: column; gap: 8px; }
    .rb-etapa { display: flex; gap: 10px; align-items: center; padding: 10px 12px; border-radius: 12px;
      border: 1px solid var(--rb-border); background: var(--rb-card); }
    .rb-etapa-marca { width: 26px; height: 26px; flex: none; border-radius: 50%; display: grid; place-items: center;
      background: var(--rb-elevated); border: 1px solid var(--rb-border); font-size: 12px; font-weight: 800; }
    .rb-etapa-txt { flex: 1; min-width: 0; }
    .rb-etapa-tit { font-weight: 700; font-size: 13.5px; }
    .rb-etapa-sub { font-size: 12px; color: var(--rb-muted); margin-top: 2px; }
    .rb-etapa[data-status="aguardando"] { opacity: 0.7; }
    .rb-etapa[data-status="rodando"] { border-color: var(--rb-accent); box-shadow: 0 0 0 2px var(--rb-accent-dim); }
    .rb-etapa[data-status="rodando"] .rb-etapa-sub { color: var(--rb-accent); }
    .rb-etapa[data-status="feito"] .rb-etapa-marca { background: var(--rb-accent); color: var(--rb-on-accent); border-color: transparent; }
    .rb-etapa[data-status="falha"] { border-color: #f26060; background: rgba(242, 96, 96, 0.10); }
    .rb-etapa[data-status="falha"] .rb-etapa-marca { background: #f26060; color: #fff; border-color: transparent; }
    .rb-etapa[data-status="falha"] .rb-etapa-sub { color: #f6a3a3; }
    #rb-acomp-auto[hidden] { display: none; }
    .rb-cta.rb-bloqueado { opacity: 0.45; }
    .rb-cta { padding: 12px; border-radius: 12px; border: 0; background: var(--rb-accent); color: var(--rb-on-accent);
      font-weight: 800; font-size: 15px; font-family: inherit; cursor: pointer; }
    .rb-cta:disabled { opacity: 0.45; cursor: not-allowed; }
  `;

  const telaArmazenamento = { getItem: k => localStorage.getItem(k), setItem: (k, v) => localStorage.setItem(k, v) };
  const tela = { fluxos: null, item: null, fluxo: null, aberto: null, exec: null };
  const rbAbas = {};
  const rbVistas = {};

  function telaAplicarAba(aba) {
    win.setAttribute('data-rb-aba', aba);
    if (aba === 'acompanhar') telaRenderAcompanhar();
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
    telaMontarAcompanhar();
    telaAplicarAba(abaInicial());
  }

  // ───────── Iniciar: roda uma CÓPIA do fluxo (editar o Montar durante a execução não muda o que está rodando)
  async function telaIniciar() {
    if (rodando || !podeIniciar(tela.fluxo)) return;
    const copia = JSON.parse(JSON.stringify(tela.fluxo));
    telaAplicarAba('acompanhar'); // §3: ao clicar em Iniciar o painel pula sozinho para Acompanhar
    const r = await fluxoIniciar(copia, { nome: tela.item.nome });
    if (r.status === 'recusado' || r.status === 'invalido') log(`⚠️ Não iniciou: ${r.motivo}.`);
  }

  // ───────── Acompanhar (layout D): nome + ciclo, passo a passo do usuário, contadores do Auto (🆕/👥), Pausar/Parar e log
  function telaMontarAcompanhar() {
    rbVistas.acompanhar.innerHTML = `
      <div class="rb-acomp-topo"><span id="rb-acomp-nome" class="rb-acomp-nome"></span><span id="rb-acomp-ciclo" class="rb-pill"></span></div>
      <div id="rb-stepper" class="rb-stepper"></div>
      <div id="rb-acomp-auto" hidden></div>`;
    // os contadores do Auto são os mesmos elementos de antes (autoRender continua atualizando por id)
    const cartaoAuto = document.getElementById('ba-auto-count')?.closest('.ba-card');
    if (cartaoAuto) rbVistas.acompanhar.querySelector('#rb-acomp-auto').appendChild(cartaoAuto);
    fluxoOuvintes.push(telaAoEventoFluxo);
    telaRenderAcompanhar();
  }

  function telaAoEventoFluxo(ev) {
    if (ev.tipo === 'inicio') {
      tela.exec = novaExecucao({ nome: ev.nome, paraQuem: ev.fluxo.paraQuem, passos: ev.fluxo.passos });
    } else if (tela.exec) {
      tela.exec = aplicarEventoStepper(tela.exec, ev);
    }
    telaRenderAcompanhar();
    if (ev.tipo === 'inicio' || ev.tipo === 'fim') telaAtualizarMontar(); // Iniciar bloqueia enquanto roda
  }

  function telaRenderAcompanhar() {
    const v = rbVistas.acompanhar;
    if (!v || !tela.fluxo || !v.querySelector('#rb-acomp-nome')) return; // ainda não montado
    const base = tela.exec || { nome: tela.item.nome, paraQuem: tela.fluxo.paraQuem, passos: tela.fluxo.passos };
    v.querySelector('#rb-acomp-nome').textContent = base.nome;
    const pill = v.querySelector('#rb-acomp-ciclo');
    pill.textContent = rotuloExecucao(tela.exec);
    pill.dataset.estado = tela.exec ? (tela.exec.fim || 'rodando') : 'parado';
    const lista = v.querySelector('#rb-stepper');
    lista.innerHTML = '';
    for (const item of montarStepper(base.passos, tela.exec)) {
      const el = document.createElement('div');
      el.className = 'rb-etapa';
      el.dataset.status = item.status;
      el.innerHTML = '<span class="rb-etapa-marca"></span><div class="rb-etapa-txt"><div class="rb-etapa-tit"></div><div class="rb-etapa-sub"></div></div>';
      el.querySelector('.rb-etapa-marca').textContent = item.status === 'feito' ? '✓' : item.status === 'falha' ? '✕' : String(item.indice);
      el.querySelector('.rb-etapa-tit').textContent = item.rotulo;
      el.querySelector('.rb-etapa-sub').textContent = item.texto;
      lista.appendChild(el);
    }
    v.querySelector('#rb-acomp-auto').hidden = !(base.paraQuem === 'caindo' || base.paraQuem === 'ambos');
  }

  function telaCarregar(item) {
    tela.item = item;
    tela.fluxo = JSON.parse(JSON.stringify(item.fluxo));
    tela.original = JSON.parse(JSON.stringify(item.fluxo)); // base para "alterações não salvas"
    tela.aberto = null;
  }

  function telaSujo() {
    return !!tela.original && temAlteracoes(tela.fluxo, tela.original);
  }

  // ───────── Montar (opção 2 · compacta)
  function telaMontarMontar() {
    rbVistas.montar.innerHTML = `
      <div class="rb-linha">
        <select id="rb-fluxo-sel" class="rb-sel" title="Fluxo salvo"></select>
        <button type="button" id="rb-salvar" class="rb-ib" title="Salvar como novo fluxo">💾</button>
        <button type="button" id="rb-apagar" class="rb-ib" title="Apagar este fluxo" hidden>🗑</button>
        <button type="button" id="rb-novo" class="rb-ib" title="Novo fluxo vazio">＋</button>
      </div>
      <div id="rb-alterado" class="rb-aviso" hidden>● Alterações não salvas (💾 salva como um fluxo novo)</div>
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
      <div class="rb-ajustes" id="rb-ajustes">
        <button type="button" id="rb-ajustes-topo" class="rb-ajustes-topo" aria-expanded="false">
          <span class="rb-ajustes-tit">⚙️ Ajustes</span><span id="rb-ajustes-res" class="rb-sub"></span><span class="rb-sub rb-seta">▾</span>
        </button>
        <div class="rb-ajustes-corpo" id="rb-ajustes-corpo" hidden>
          <div class="rb-linha"><label class="rb-sub" for="rb-vel">Velocidade</label><span class="rb-sp"></span>
            <input id="rb-vel" class="rb-in rb-in-vel" inputmode="decimal"><span id="rb-vel-aviso" class="rb-aviso"></span></div>
          <div class="rb-sub">De 0.5 a 2.0 · maior = mais rápido · vale para as pausas entre ações</div>
          <div id="rb-loop-bloco" class="rb-bloco">
            <label class="rb-toggle"><input type="checkbox" id="rb-loop"> Repetir em loop (sentinela)</label>
            <div id="rb-loop-motivo" class="rb-sub"></div>
          </div>
          <div id="rb-ciclo-bloco" class="rb-bloco">
            <div class="rb-linha"><label class="rb-sub" for="rb-ciclo">Pausa entre ciclos (s)</label><span class="rb-sp"></span>
              <input id="rb-ciclo" class="rb-in rb-in-vel" inputmode="decimal"><span id="rb-ciclo-aviso" class="rb-aviso"></span></div>
            <div class="rb-sub">De 0 a 60 s · não muda com a velocidade</div>
          </div>
          <div id="rb-puxar-bloco" class="rb-bloco" hidden>
            <label class="rb-toggle"><input type="checkbox" id="rb-puxar"> Também puxar a fila (Atender)</label>
            <div class="rb-sub">O bot clica em Atender e quem for puxado recebe o fluxo uma vez</div>
          </div>
        </div>
      </div>
      <button type="button" id="rb-iniciar" class="rb-cta">⚡ Iniciar fluxo</button>
      <div class="rb-dica" id="rb-iniciar-dica"></div>`;
    const v = rbVistas.montar;
    v.querySelector('#rb-fluxo-sel').addEventListener('change', e => {
      const item = tela.fluxos.listar().find(x => x.id === e.target.value);
      if (!item) return;
      if (telaSujo()) e.target.value = tela.item.id || ''; // enquanto a pergunta está aberta, o seletor mostra o fluxo atual
      telaAntesDeTrocar(() => { telaCarregar(item); tela.fluxos.marcarAtual(item.id); telaRenderMontar(); });
    });
    v.querySelector('#rb-novo').addEventListener('click', () => {
      telaAntesDeTrocar(() => {
        telaCarregar({ id: null, nome: 'Novo fluxo', modelo: false, fluxo: tela.fluxos.novoVazio() });
        telaRenderMontar();
      });
    });
    v.querySelector('#rb-salvar').addEventListener('click', () => telaPedirNome(null));
    v.querySelector('#rb-apagar').addEventListener('click', telaConfirmarApagar);
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
    telaLigarCampos(v.querySelector('#rb-passos'));
    telaLigarAjustes(v);
    v.querySelector('#rb-iniciar').addEventListener('click', () => {
      if (!podeIniciar(tela.fluxo)) {
        // ordem inválida: o botão continua clicável para o modal explicar o motivo (§6)
        const erro = erroDoModal((validarFluxo(tela.fluxo).erros || []));
        if (erro && erro.indice) telaAbrirModal(erro);
        return;
      }
      telaIniciar();
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
    const doNovo = (validarFluxo(f).erros || []).filter(e => e.indice === f.passos.length);
    if (doNovo.length) telaAbrirModal(erroDoModal(doNovo));
  }

  // ───────── Diálogos dos fluxos salvos (mesmo visual do modal de ordem; textos só por textContent)
  function telaDialogo({ titulo, linha, detalhe, campo, botoes }) {
    telaFecharModal();
    const ancora = document.createElement('div');
    ancora.className = 'rb-modal-ancora';
    ancora.innerHTML = `
      <div class="rb-modal-fundo">
        <div class="rb-modal rb-modal-neutro" role="dialog" aria-modal="true" aria-labelledby="rb-modal-tit">
          <h3 id="rb-modal-tit"></h3>
          <p class="rb-modal-linha"></p>
          <p class="rb-modal-detalhe"></p>
          <input class="rb-in rb-modal-campo" hidden maxlength="40">
          <p class="rb-modal-erro" role="alert"></p>
          <div class="rb-modal-btns"></div>
        </div>
      </div>`;
    ancora.querySelector('h3').textContent = titulo;
    ancora.querySelector('.rb-modal-linha').textContent = linha || '';
    ancora.querySelector('.rb-modal-detalhe').textContent = detalhe || '';
    const input = ancora.querySelector('.rb-modal-campo');
    const erro = ancora.querySelector('.rb-modal-erro');
    if (campo) { input.hidden = false; input.placeholder = campo.placeholder || ''; input.value = campo.valor || ''; }
    const btns = ancora.querySelector('.rb-modal-btns');
    let primeiro = null;
    for (const b of botoes) {
      const el = document.createElement('button');
      el.type = 'button';
      el.textContent = b.texto;
      if (b.primario) el.className = 'rb-primario';
      // a ação pode devolver um texto de erro: o diálogo continua aberto e mostra o erro
      el.addEventListener('click', () => {
        const msg = b.acao ? b.acao(input.value) : null;
        if (typeof msg === 'string' && msg) { erro.textContent = msg; return; }
        telaFecharModal();
        if (b.depois) b.depois();
      });
      btns.appendChild(el);
      if (!primeiro) primeiro = el;
    }
    win.insertBefore(ancora, win.firstChild);
    ancora.querySelector('.rb-modal-fundo').style.height = win.clientHeight + 'px';
    (campo ? input : primeiro).focus();
    ancora.addEventListener('keydown', e => {
      if (e.key === 'Escape') { telaFecharModal(); telaRenderMontar(); }
      if (e.key === 'Enter' && campo) { e.preventDefault(); btns.querySelector('.rb-primario')?.click(); }
    });
    return ancora;
  }

  // 💾: sempre cria um fluxo NOVO com nome. `depois` roda se salvar (usado na troca de fluxo).
  function telaPedirNome(depois) {
    telaDialogo({
      titulo: '💾 Salvar como novo fluxo',
      linha: 'Dê um nome ao fluxo.',
      detalhe: 'Até 10 fluxos seus (os modelos ⭐ não contam). Modelos nunca são alterados.',
      campo: { placeholder: 'Ex.: Mensagem de atualização', valor: '' },
      botoes: [
        { texto: 'Cancelar', acao: () => null, depois: () => telaRenderMontar() },
        {
          texto: 'Salvar', primario: true,
          acao: nome => {
            const r = tela.fluxos.salvar(nome, tela.fluxo);
            if (!r.ok) return r.motivo;
            const salvo = tela.fluxos.listar().find(x => x.id === r.id);
            telaCarregar(salvo);
            tela.fluxos.marcarAtual(r.id);
            return null;
          },
          depois: () => { telaRenderMontar(); if (depois) depois(); },
        },
      ],
    });
  }

  // Trocar de fluxo (ou criar um vazio) com alterações pendentes pergunta o que fazer (§9).
  function telaAntesDeTrocar(seguir) {
    if (!telaSujo()) { seguir(); return; }
    telaDialogo({
      titulo: 'Alterações não salvas',
      linha: 'Você mexeu em "' + tela.item.nome + '".',
      detalhe: 'Salvar como novo guarda uma cópia com as alterações. Descartar volta o fluxo ao que estava salvo.',
      botoes: [
        { texto: 'Voltar', acao: () => null, depois: () => telaRenderMontar() },
        { texto: 'Descartar', acao: () => null, depois: seguir },
        { texto: 'Salvar como novo', primario: true, acao: () => null, depois: () => telaPedirNome(seguir) },
      ],
    });
  }

  function telaConfirmarApagar() {
    const id = tela.item.id;
    if (!id || tela.item.modelo) return;
    telaDialogo({
      titulo: 'Apagar fluxo',
      linha: 'Apagar "' + tela.item.nome + '"?',
      detalhe: 'Isso não pode ser desfeito.',
      botoes: [
        { texto: 'Cancelar', acao: () => null },
        {
          texto: 'Apagar', primario: true,
          acao: () => { const r = tela.fluxos.apagar(id); return r.ok ? null : r.motivo; },
          depois: () => { const atual = tela.fluxos.listar()[0]; telaCarregar(atual); tela.fluxos.marcarAtual(atual.id); telaRenderMontar(); },
        },
      ],
    });
  }

  // ───────── Modal de ordem inválida (layout-M)
  function telaFecharModal() {
    const m = win.querySelector('.rb-modal-ancora');
    if (m) m.remove();
  }

  function telaAbrirModal(erro) {
    telaFecharModal();
    const t = textoModal(erro, tela.fluxo.passos);
    const ancora = document.createElement('div');
    ancora.className = 'rb-modal-ancora';
    ancora.innerHTML = `
      <div class="rb-modal-fundo">
        <div class="rb-modal" role="dialog" aria-modal="true" aria-labelledby="rb-modal-tit">
          <h3 id="rb-modal-tit"></h3>
          <p class="rb-modal-linha"></p>
          <p class="rb-modal-detalhe"></p>
          <div class="rb-modal-btns"></div>
        </div>
      </div>`;
    ancora.querySelector('h3').textContent = '⛔ ' + t.titulo;
    ancora.querySelector('.rb-modal-linha').textContent = t.linha;
    ancora.querySelector('.rb-modal-detalhe').textContent = t.detalhe;
    const btns = ancora.querySelector('.rb-modal-btns');
    const botao = (texto, classe, acao) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = texto;
      if (classe) b.className = classe;
      b.addEventListener('click', () => { telaFecharModal(); if (acao) acao(); });
      btns.appendChild(b);
      return b;
    };
    const entendi = botao('Entendi', '', null);
    if (erro.sugestao) {
      botao(erro.sugestao.texto, '', () => {
        tela.fluxo.passos.splice(erro.sugestao.indice - 1, 0, novoPasso('espera'));
        tela.fluxo.passos[erro.sugestao.indice - 1].modo = 'despausar';
        tela.aberto = null;
        telaRenderMontar();
      });
    }
    if (erro.correcao && erro.correcao.acao === 'remover') {
      botao(erro.correcao.texto, 'rb-primario', () => {
        tela.fluxo.passos = removerPasso(tela.fluxo.passos, erro.correcao.indice - 1);
        tela.aberto = null;
        telaRenderMontar();
      });
    }
    win.insertBefore(ancora, win.firstChild);
    ancora.querySelector('.rb-modal-fundo').style.height = win.clientHeight + 'px';
    entendi.focus();
    ancora.addEventListener('keydown', e => { if (e.key === 'Escape') telaFecharModal(); });
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
    v.querySelector('#rb-apagar').hidden = !tela.item.id || !!tela.item.modelo;
    telaAtualizarAlterado();
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
    // passos (estrutura); o que muda ao digitar é atualizado por telaAtualizarMontar, sem perder o foco
    const lista = v.querySelector('#rb-passos');
    lista.innerHTML = '';
    f.passos.forEach((passo, i) => {
      const card = document.createElement('div');
      card.className = 'rb-passo' + (tela.aberto === i ? ' aberto' : '');
      card.dataset.i = String(i);
      card.innerHTML = `
        <div class="rb-passo-topo">
          <span class="rb-num"></span>
          <div class="rb-passo-txt"><div class="rb-passo-tit"><span class="rb-tit-txt"></span> <span class="rb-selo"></span></div>
            <div class="rb-passo-res"></div><div class="rb-passo-erro"></div></div>
          <div class="rb-ctl">
            <button type="button" data-acao="subir" title="Subir">▲</button>
            <button type="button" data-acao="descer" title="Descer">▼</button>
            <button type="button" data-acao="remover" title="Remover">✕</button>
          </div>
        </div>
        <div class="rb-campos"></div>`;
      card.querySelector('.rb-num').textContent = String(i + 1);
      card.querySelector('[data-acao="subir"]').disabled = i === 0;
      card.querySelector('[data-acao="descer"]').disabled = i === f.passos.length - 1;
      telaMontarCampos(card.querySelector('.rb-campos'), passo, f);
      lista.appendChild(card);
    });
    telaAtualizarMontar();
    telaAtualizarAjustes();
    if (!tela.exec) telaRenderAcompanhar();
  }

  // ───────── ⚙️ Ajustes (velocidade, loop, pausa entre ciclos, puxar a fila)
  function telaTextoSegundos(n) {
    return String(n).replace('.', ',');
  }

  function telaAtualizarAlterado() {
    rbVistas.montar.querySelector('#rb-alterado').hidden = !telaSujo();
  }

  function telaAtualizarAjustes() {
    telaAtualizarAlterado();
    const v = rbVistas.montar;
    const f = tela.fluxo;
    const porChat = f.paraQuem === 'caindo' || f.paraQuem === 'ambos';
    const loop = loopEfetivo(f);
    const partes = ['Velocidade ' + Number(f.velocidade).toFixed(1)];
    if (porChat) partes.push(f.puxarFila ? 'Puxa a fila' : 'Sem puxar a fila');
    else if (loop.efetivo) partes.push('🔁 Loop ligado', telaTextoSegundos(f.pausaCiclos) + ' s entre ciclos');
    else partes.push('🔁 Loop desligado');
    v.querySelector('#rb-ajustes-res').textContent = partes.join(' · ');
    v.querySelector('#rb-loop-bloco').hidden = porChat;
    v.querySelector('#rb-ciclo-bloco').hidden = porChat;
    v.querySelector('#rb-puxar-bloco').hidden = !porChat;
    const campo = (id, valor) => { const el = v.querySelector(id); if (document.activeElement !== el) el.value = valor; };
    campo('#rb-vel', Number(f.velocidade).toFixed(1));
    campo('#rb-ciclo', String(f.pausaCiclos));
    const caixaLoop = v.querySelector('#rb-loop');
    caixaLoop.checked = !!f.loopEscolha; // a escolha do usuário nunca se perde (§7)
    caixaLoop.disabled = !loop.habilitado;
    v.querySelector('#rb-loop-motivo').textContent = loop.habilitado ? '' : (loop.motivo || '');
    v.querySelector('#rb-puxar').checked = !!f.puxarFila;
  }

  function telaLigarAjustes(v) {
    const topo = v.querySelector('#rb-ajustes-topo');
    const corpo = v.querySelector('#rb-ajustes-corpo');
    topo.addEventListener('click', () => {
      corpo.hidden = !corpo.hidden;
      topo.setAttribute('aria-expanded', String(!corpo.hidden));
      v.querySelector('.rb-seta').textContent = corpo.hidden ? '▾' : '▴';
    });
    v.querySelector('#rb-vel').addEventListener('change', e => {
      const n = normalizarVelocidade(e.target.value);
      tela.fluxo.velocidade = n.valor;
      e.target.value = n.valor.toFixed(1);
      v.querySelector('#rb-vel-aviso').textContent = n.aviso || '';
      telaAtualizarAjustes();
    });
    v.querySelector('#rb-ciclo').addEventListener('change', e => {
      const n = normalizarPausaCiclos(e.target.value);
      tela.fluxo.pausaCiclos = n.valor;
      e.target.value = String(n.valor);
      v.querySelector('#rb-ciclo-aviso').textContent = n.aviso || '';
      telaAtualizarAjustes();
    });
    v.querySelector('#rb-loop').addEventListener('change', e => {
      tela.fluxo.loopEscolha = e.target.checked;
      telaAtualizarAjustes();
    });
    v.querySelector('#rb-puxar').addEventListener('change', e => {
      tela.fluxo.puxarFila = e.target.checked;
      telaAtualizarAjustes();
    });
  }

  function telaSeg(campo, opcoes, atual) {
    return `<div class="rb-seg" data-campo="${campo}">${opcoes.map(([v, rot, oculto]) =>
      `<button type="button" data-v="${v}" class="${v === atual ? 'on' : ''}"${oculto ? ' hidden' : ''}>${rot}</button>`).join('')}</div>`;
  }

  function telaChipsPastas() {
    const lista = [];
    for (const nome of [...DEFAULT_FOLDERS, ...getRecentFolders()]) {
      if (!lista.some(x => x.toLowerCase() === nome.toLowerCase())) lista.push(nome);
    }
    return lista.slice(0, 6);
  }

  // Campos de cada bloco (§4). Textos do usuário entram por .value / textContent, nunca por HTML.
  function telaMontarCampos(caixa, passo, f) {
    let html = '';
    if (passo.tipo === 'enviar') {
      html += telaSeg('modo', [['so', '🛡️ Só enviar'], ['finalizar', '⚡ Enviar + Finalizar']], passo.modo);
      html += '<textarea class="rb-in" data-campo="mensagem" rows="3" placeholder="Mensagem para o cliente"></textarea>';
      html += '<div class="rb-linha"><button type="button" class="rb-chip" data-acao-campo="padrao">📋 Usar padrão</button></div>';
      if (passo.modo === 'finalizar') html += '<input class="rb-in" data-campo="tag" placeholder="Tag (ex.: Resolvido)">';
    } else if (passo.tipo === 'espera') {
      const semDespausar = !disponibilidade(f.paraQuem).despausar && passo.modo !== 'despausar';
      html += telaSeg('modo', [['pausar', '⏸️ Pausar'], ['despausar', '▶️ Despausar', semDespausar]], passo.modo);
    } else if (passo.tipo === 'mover') {
      html += '<input class="rb-in" data-campo="pasta" placeholder="Nome da pasta">';
      html += `<div class="rb-chips">${telaChipsPastas().map(() => '<button type="button" class="rb-chip" data-pasta=""></button>').join('')}</div>`;
    } else if (passo.tipo === 'transferir') {
      html += '<input class="rb-in" data-campo="atendente" placeholder="Nome do atendente (exato, como no Blip)">';
    }
    html += `<div class="rb-linha rb-vel"><span class="rb-sub">Velocidade deste passo</span><span class="rb-sp"></span>
      <input class="rb-in rb-in-vel" data-campo="velocidade" placeholder="do fluxo" inputmode="decimal"><span class="rb-aviso"></span></div>`;
    caixa.innerHTML = html;
    for (const el of caixa.querySelectorAll('[data-campo="mensagem"], [data-campo="tag"], [data-campo="pasta"], [data-campo="atendente"]')) {
      el.value = passo[el.dataset.campo] || '';
    }
    if (passo.tipo === 'mover') {
      const chips = caixa.querySelectorAll('[data-pasta]');
      telaChipsPastas().forEach((nome, k) => { chips[k].dataset.pasta = nome; chips[k].textContent = nome; });
    }
    const vel = caixa.querySelector('[data-campo="velocidade"]');
    vel.value = passo.velocidade === null || passo.velocidade === undefined ? '' : Number(passo.velocidade).toFixed(1);
  }

  // Atualiza o que depende dos valores (títulos, selo, resumos, erros, campos vazios, Iniciar) sem recriar os campos.
  function telaAtualizarMontar() {
    telaAtualizarAlterado();
    const v = rbVistas.montar;
    const f = tela.fluxo;
    const validacao = validarFluxo(f);
    v.querySelectorAll('#rb-passos .rb-passo').forEach(card => {
      const i = Number(card.dataset.i);
      const passo = f.passos[i];
      const errosDoPasso = (validacao.erros || []).filter(e => e.indice === i + 1);
      const principal = errosDoPasso.length ? erroDoModal(errosDoPasso) : null;
      card.classList.toggle('erro', !!principal);
      card.querySelector('.rb-tit-txt').textContent = tituloPasso(passo);
      card.querySelector('.rb-selo').textContent = seloVelocidade(passo) || '';
      card.querySelector('.rb-passo-res').textContent = resumoPasso(passo);
      card.querySelector('.rb-passo-erro').textContent = principal
        ? (principal.dica ? principal.mensagem + ' · ' + principal.dica : principal.mensagem) : '';
      const faltando = validarCampos(passo).map(x => x.campo);
      card.querySelectorAll('[data-campo]').forEach(el => el.classList.toggle('rb-vazio', faltando.includes(el.dataset.campo)));
    });
    const pode = podeIniciar(f) && !rodando;
    const btnIniciar = v.querySelector('#rb-iniciar');
    btnIniciar.textContent = rodando ? '⏳ Fluxo rodando…' : '⚡ Iniciar fluxo';
    const temErroDePasso = (validacao.erros || []).some(e => e.indice);
    // bloqueado em qualquer caso; só fica "clicável" (aria-disabled) quando há erro de ordem, para abrir o modal
    btnIniciar.disabled = !pode && !temErroDePasso;
    btnIniciar.classList.toggle('rb-bloqueado', !pode);
    if (pode) btnIniciar.removeAttribute('aria-disabled');
    else btnIniciar.setAttribute('aria-disabled', 'true');
    const primeiro = erroDoModal(validacao.erros || []);
    const vazio = f.passos.findIndex(p => validarCampos(p).length);
    v.querySelector('#rb-iniciar-dica').textContent = pode ? ''
      : rodando ? 'Só um fluxo por vez: acompanhe ou pare em Acompanhar'
      : !f.paraQuem ? 'Escolha para quem primeiro'
        : !f.passos.length ? 'Toque num ícone da paleta para começar'
          : primeiro && primeiro.indice ? 'Corrija o passo ' + primeiro.indice
            : primeiro ? primeiro.mensagem
              : vazio >= 0 ? 'Preencha o passo ' + (vazio + 1) : '';
  }

  function telaLigarCampos(lista) {
    const passoDe = el => tela.fluxo.passos[Number(el.closest('.rb-passo').dataset.i)];
    lista.addEventListener('input', e => {
      const campo = e.target.dataset && e.target.dataset.campo;
      if (!campo || campo === 'velocidade') return;
      passoDe(e.target)[campo] = e.target.value;
      telaAtualizarMontar();
    });
    lista.addEventListener('change', e => {
      if (!e.target.dataset || e.target.dataset.campo !== 'velocidade') return;
      const passo = passoDe(e.target);
      const aviso = e.target.parentElement.querySelector('.rb-aviso');
      if (!e.target.value.trim()) {
        passo.velocidade = null;
        aviso.textContent = '';
      } else {
        const n = normalizarVelocidade(e.target.value);
        passo.velocidade = n.valor;
        e.target.value = n.valor.toFixed(1);
        aviso.textContent = n.aviso || '';
      }
      telaAtualizarMontar();
    });
    lista.addEventListener('click', e => {
      const seg = e.target.closest('.rb-seg [data-v]');
      const chip = e.target.closest('[data-pasta]');
      const padrao = e.target.closest('[data-acao-campo="padrao"]');
      if (!seg && !chip && !padrao) return;
      const passo = passoDe(e.target);
      if (seg) passo[seg.parentElement.dataset.campo] = seg.dataset.v;
      if (chip) passo.pasta = chip.dataset.pasta;
      if (padrao) passo.mensagem = MENSAGEM_PADRAO; // só quando o usuário toca (§9)
      telaRenderMontar();
    });
  }

  telaMontarCasca();

