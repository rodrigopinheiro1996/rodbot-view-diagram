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
  `;

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
    telaAplicarAba(abaInicial());
  }

  if (telaNova) telaMontarCasca();

