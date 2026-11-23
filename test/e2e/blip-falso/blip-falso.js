/* Blip falso para testes do rod bot (dados fictícios).
 *
 * Imita só o que o código do bookmarklet procura. Origem de cada parte:
 *   VERIFICADO (comentários do código, Blip real em 18/11/2026): AUTO_SEL (fila, área da lista, contador do filtro,
 *     menu do ticket "menu-<id>", card, #text-input, cabeçalho "ticket-sequential-id", opções de espera) e TRANSF_SEL.
 *   CONFIRMADO pelo BM: o ticket puxado pelo Atender entra no TOPO da lista.
 *   INFERIDO do código (não conferido no site): estrutura do submenu de pastas, modal de finalizar, tags, como o
 *     Atender reage a cliques repetidos, onde entra um chat novo que cai (fim da lista), aparência do ticket pausado.
 *   OBSERVADO pelo BM em imagens do Blip real (23/11/2026), configurável: menuNaoFecha. Os menus ⋮ que o bot abre
 *     sem escolher opção continuam abertos (vários ao mesmo tempo); só escolher uma opção fecha. O porquê (estrutura
 *     do menu) ainda não foi conferido: aqui nada que o bot faz para fechar (open = false, Escape, novo clique no ⋮)
 *     tem efeito.
 *   SUPOSIÇÕES da spec (§11), configuráveis: S1 mover tira da lista; S2 pausado pode ser movido/transferido;
 *     S3 pausado não recebe mensagem (campo de texto desabilitado).
 *
 * API para os testes: window.blipFalso.{ reiniciar(config), estado(), chegarChat(nome), adicionarFila(n) }.
 */
(() => {
  // ───────────────────────── componentes bds-* (só o necessário, com Shadow DOM como no Blip)
  const def = (nome, html, extra = {}) => {
    if (customElements.get(nome)) return;
    customElements.define(nome, class extends HTMLElement {
      static get observedAttributes() { return ['disabled']; }
      constructor() {
        super();
        this.attachShadow({ mode: 'open' }).innerHTML = typeof html === 'function' ? html(this) : html;
        extra.init?.call(this);
      }
      attributeChangedCallback(nomeAttr, _a, valor) {
        if (nomeAttr !== 'disabled') return;
        const b = this.shadowRoot.querySelector('button');
        if (b) b.disabled = valor !== null;
      }
      get open() { return this.hasAttribute('open'); }
      set open(v) { if (!v && this.__travado) return; this.toggleAttribute('open', !!v); this.closest('.ticket-menu')?.classList.toggle('visible', !!v); }
      get checked() { return !!this.shadowRoot.querySelector('input[type="radio"]')?.checked; }
      set checked(v) { const i = this.shadowRoot.querySelector('input[type="radio"]'); if (i) i.checked = !!v; }
    });
  };
  def('bds-typo', '<p part="bds-typo__text"><slot></slot></p>');
  def('bds-button', '<button type="button"><slot></slot></button>');
  def('bds-button-icon', '<button class="icon__button" type="button">◻</button>');
  def('bds-menu', '<slot></slot>');
  def('bds-menu-action', (el) => `<button class="menuaction__button" type="button">${el.getAttribute('button-text') || ''}</button><slot></slot>`);
  def('bds-dropdown', '<slot></slot>');
  def('bds-chip-tag', '<div><bds-typo></bds-typo></div>');
  def('bds-icon', '<div class="icon-inner">▾</div>');
  def('bds-select-option', '<div role="button" style="padding:2px 6px;cursor:pointer"><slot></slot></div>');
  def('bds-select-chips', '<input type="text"><div class="select__options--open"></div>');
  def('bds-radio', '<label><input type="radio"> <slot></slot></label>');
  def('bds-autocomplete', '<input type="text"><bds-icon aria-label="arrow-down"></bds-icon><div class="lista" hidden></div>');

  // ───────────────────────── estado
  const PADRAO = {
    S1: true, S2: true, S3: true,
    naTela: ['Cliente Fictício 1', 'Cliente Fictício 2', 'Cliente Fictício 3'],
    pausadosIniciais: [], // índices (0-based) de naTela que já começam pausados
    fila: 3,
    pastas: ['nv2', 'default', 'Retorno'],
    tags: ['Resolvido', 'Atualização', 'Dúvida'],
    atendentes: ['Atendente Fictício', 'Atendente Fictício Dois', 'Outra Pessoa'],
    semBotaoAtender: false,
    cooldownAtenderMs: 150,
    menuNaoFecha: false,
  };
  let cfg, tickets, filaRestante, proxId, abertoId, ultimoAtender, eventos;

  const $ = (s, r = document) => r.querySelector(s);
  const lista = () => $('#lista-tickets');
  const naLista = () => tickets.filter((t) => t.status === 'aberto' && !(t.pasta && cfg.S1));
  const ticket = (id) => tickets.find((t) => t.id === id);
  const registrar = (tipo, dados) => eventos.push({ tipo, ...dados, em: Date.now() });

  function novoTicket(nome, pausado = false, noTopo = false) {
    const t = { id: String(proxId++), nome, pausado, pasta: null, mensagens: [], tags: [], status: 'aberto', atendente: null };
    if (noTopo) tickets.unshift(t);
    else tickets.push(t);
    return t;
  }

  // ───────────────────────── lista lateral (um card por ticket, atualizado no lugar)
  function criarCard(t) {
    const a = document.createElement('article');
    a.className = 'chat-list-item';
    a.dataset.id = t.id;
    a.setAttribute('aria-label', t.nome);
    a.setAttribute('aria-selected', 'false');
    a.innerHTML = `<span class="nome">${t.nome}</span> <span class="pausa-ind"></span>
      <div class="ticket-menu">
        <button class="ticket-info-options" id="menu-${t.id}" type="button">⋮</button>
        <bds-menu>
          <bds-menu-action data-testid="option-setStandbyMode" button-text="Colocar em espera"></bds-menu-action>
          <bds-menu-action data-testid="option-unsetStandbyMode" button-text="Retirar da espera"></bds-menu-action>
          <bds-menu-action data-testid="option-moveToFolder" button-text="Mover para" icon-left="folder"
            subtitle="Mover o ticket para uma pasta"><div class="folder-submenu-container"></div></bds-menu-action>
        </bds-menu>
      </div>`;
    a.addEventListener('click', () => abrirChat(t.id));
    const botao = a.querySelector('button.ticket-info-options');
    const menu = a.querySelector('bds-menu');
    botao.addEventListener('click', (e) => {
      e.stopPropagation();
      const abrir = !menu.open;
      if (cfg.menuNaoFecha) { if (abrir) abrirMenu(t, menu); return; } // não fecha nem os outros
      fecharMenus();
      if (abrir) abrirMenu(t, menu);
    });
    menu.addEventListener('click', (e) => e.stopPropagation());
    const [optPausar, optDespausar, optMover] = menu.querySelectorAll('bds-menu-action');
    optPausar.addEventListener('click', () => { if (menu.open) { definirPausa(t, true); fecharMenus(); } });
    optDespausar.addEventListener('click', () => { if (menu.open) { definirPausa(t, false); fecharMenus(); } });
    const sub = optMover.querySelector('.folder-submenu-container');
    const abrirSub = () => {
      if (!menu.open || sub.classList.contains('aberto')) return; // monta uma vez por abertura do menu
      montarSubmenu(t, sub, menu);
      sub.classList.add('aberto');
    };
    ['pointerenter', 'mouseenter', 'mouseover'].forEach((ev) => optMover.addEventListener(ev, abrirSub));
    return a;
  }

  function abrirMenu(t, menu) {
    const [optPausar, optDespausar, optMover] = menu.querySelectorAll('bds-menu-action');
    optPausar.hidden = t.pausado;
    optDespausar.hidden = !t.pausado;
    optMover.hidden = t.pausado && !cfg.S2;
    optMover.querySelector('.folder-submenu-container').classList.remove('aberto');
    menu.open = true;
    menu.__travado = !!cfg.menuNaoFecha;
  }

  function montarSubmenu(t, sub, menu) {
    sub.innerHTML = '';
    for (const nome of cfg.pastas) {
      const qtd = tickets.filter((x) => x.pasta === nome && x.status === 'aberto').length;
      const item = document.createElement('span');
      item.className = 'custom-submenu-item';
      item.innerHTML = `<span class="sub-menu">${nome} (${qtd})</span>`;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!menu.open) return; // cliques repetidos (dispararCliqueReal) contam uma vez só
        fecharMenus();
        t.pasta = nome;
        registrar('mover', { id: t.id, pasta: nome });
        renderizar();
      });
      sub.appendChild(item);
    }
  }

  function fecharMenus() {
    document.querySelectorAll('bds-menu[open]').forEach((m) => { m.__travado = false; m.open = false; });
  }

  function definirPausa(t, pausado) {
    t.pausado = pausado;
    registrar(pausado ? 'pausar' : 'despausar', { id: t.id });
    renderizar();
  }

  function renderizarLista() {
    const el = lista();
    const visiveis = naLista();
    const ids = new Set(visiveis.map((t) => t.id));
    for (const card of [...el.children]) if (!ids.has(card.dataset.id)) card.remove();
    visiveis.forEach((t, i) => {
      let card = el.querySelector(`article[data-id="${t.id}"]`) || criarCard(t);
      if (el.children[i] !== card) el.insertBefore(card, el.children[i] || null); // mantém a ordem sem recriar
      card.querySelector('.pausa-ind').textContent = t.pausado ? '⏸️ em espera' : '';
      card.setAttribute('aria-selected', String(t.id === abertoId));
    });
    $('#ticket-filter-dropdown bds-chip-tag').shadowRoot.querySelector('bds-typo').textContent = String(visiveis.length);
    $('#lista-pastas').textContent = cfg.pastas
      .map((p) => `${p} (${tickets.filter((x) => x.pasta === p && x.status === 'aberto').length})`).join(' · ');
  }

  // ───────────────────────── Atender + contador da fila
  function renderizarFila() {
    $('#waiting-tickets-count').textContent = String(filaRestante);
    const btn = $('#claim-ticket-button');
    if (btn) btn.toggleAttribute('disabled', filaRestante <= 0);
  }

  function atender() {
    if (filaRestante <= 0) return;
    const agora = Date.now();
    if (agora - ultimoAtender < cfg.cooldownAtenderMs) return; // INFERIDO: pedido em andamento ignora cliques repetidos
    ultimoAtender = agora;
    filaRestante--;
    const t = novoTicket(`Cliente da Fila ${proxId}`, false, true); // BM confirmou: o puxado entra no TOPO
    registrar('atender', { id: t.id });
    renderizar();
  }

  // ───────────────────────── chat aberto
  function abrirChat(id) {
    const t = ticket(id);
    if (!t || t.status !== 'aberto') return;
    abertoId = id;
    registrar('abrir', { id });
    renderizar();
  }

  function renderizarChat() {
    const pane = $('#pane-chat-div');
    const t = abertoId && ticket(abertoId);
    if (!t || t.status !== 'aberto' || (t.pasta && cfg.S1)) {
      abertoId = null;
      pane.innerHTML = '<p class="vazio">Nenhum atendimento aberto.</p>';
      pane.dataset.id = '';
      return;
    }
    if (pane.dataset.id !== t.id) {
      pane.dataset.id = t.id;
      pane.innerHTML = `
        <div class="cab"><b>${t.nome}</b> · <span id="ticket-sequential-id">Ticket: #${t.id}</span>
          <bds-button-icon icon="transfer" variant="secondary" title="Transferir"></bds-button-icon>
          <bds-button-icon id="close-ticket-button-icon" title="Finalizar"></bds-button-icon>
        </div>
        <div class="tags-container"><div class="pointer"><bds-typo>Adicionar tags</bds-typo></div><span class="tags"></span></div>
        <div class="msgs"></div>
        <textarea id="text-input" placeholder="Digite uma mensagem"></textarea>`;
      pane.querySelector('bds-button-icon[icon="transfer"]').addEventListener('click', () => abrirTransferencia(t));
      pane.querySelector('#close-ticket-button-icon').addEventListener('click', () => abrirModalFinalizar(t));
      pane.querySelector('.tags-container div.pointer').addEventListener('click', () => abrirTags(t));
      const campo = pane.querySelector('#text-input');
      campo.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || campo.disabled) return;
        e.preventDefault();
        const texto = campo.value;
        if (!texto.trim()) return;
        t.mensagens.push(texto);
        registrar('mensagem', { id: t.id, texto });
        campo.value = '';
        renderizarChat();
      });
    }
    pane.querySelector('#text-input').disabled = t.pausado && cfg.S3;
    pane.querySelector('.msgs').innerHTML = t.mensagens.map((m) => `<div class="msg"></div>`).join('');
    [...pane.querySelectorAll('.msg')].forEach((el, i) => { el.textContent = t.mensagens[i]; });
    pane.querySelector('.tags').textContent = t.tags.join(', ');
  }

  // ───────────────────────── tags (INFERIDO de passo2_tag)
  function abrirTags(t) {
    const pane = $('#pane-chat-div');
    if (pane.querySelector('bds-select-chips')) return;
    const chips = document.createElement('bds-select-chips');
    pane.querySelector('.tags-container').appendChild(chips);
    const raiz = chips.shadowRoot;
    const caixa = raiz.querySelector('.select__options--open');
    for (const nome of cfg.tags) {
      const op = document.createElement('bds-select-option');
      op.setAttribute('title-text', nome);
      op.textContent = nome;
      op.addEventListener('click', () => {
        if (!t.tags.includes(nome)) t.tags.push(nome);
        registrar('tag', { id: t.id, tag: nome });
        chips.remove();
        renderizarChat();
      });
      caixa.appendChild(op);
    }
    raiz.querySelector('input').addEventListener('input', (e) => {
      const termo = e.target.value.trim().toLowerCase();
      caixa.querySelectorAll('bds-select-option').forEach((op) => {
        op.style.display = op.textContent.toLowerCase().includes(termo) ? '' : 'none';
      });
    });
  }

  // ───────────────────────── finalizar (INFERIDO de passo3/passo4)
  function abrirModalFinalizar(t) {
    if ($('#modal-finalizar')) return;
    const m = document.createElement('div');
    m.className = 'modal';
    m.id = 'modal-finalizar';
    m.setAttribute('role', 'dialog');
    m.innerHTML = `<p>Finalizar o atendimento de ${t.nome}?</p>
      <bds-button class="confirmar">Finalizar ticket</bds-button> <bds-button class="cancelar">Cancelar</bds-button>`;
    m.querySelector('.confirmar').addEventListener('click', () => {
      if (!m.isConnected) return;
      m.remove();
      t.status = 'finalizado';
      registrar('finalizar', { id: t.id, tags: [...t.tags] });
      renderizar();
    });
    m.querySelector('.cancelar').addEventListener('click', () => m.remove());
    document.body.appendChild(m);
  }

  // ───────────────────────── transferência (estrutura de TRANSF_SEL)
  function abrirTransferencia(t) {
    if ($('#modal-transf')) return;
    if (t.pausado && !cfg.S2) return;
    const m = document.createElement('div');
    m.className = 'modal';
    m.id = 'modal-transf';
    m.setAttribute('role', 'dialog');
    m.innerHTML = `<h3>Transferir atendimento do Ticket #${t.id}</h3>
      <bds-radio label="Fila">Fila</bds-radio> <bds-radio label="Atendente">Atendente</bds-radio>
      <div class="campo" hidden><bds-autocomplete id="autocompleteAttendant"></bds-autocomplete></div>
      <bds-button id="confirm-transfer-btn" disabled>Transferir ticket</bds-button>
      <bds-button class="cancelar">Cancelar</bds-button>`;
    document.body.appendChild(m);
    const radio = m.querySelector('bds-radio[label="Atendente"]');
    const campo = m.querySelector('.campo');
    const ac = m.querySelector('bds-autocomplete');
    const acRaiz = ac.shadowRoot;
    const input = acRaiz.querySelector('input');
    const caixa = acRaiz.querySelector('.lista');
    const confirmar = m.querySelector('#confirm-transfer-btn');
    radio.shadowRoot.querySelector('input').addEventListener('change', () => { campo.hidden = false; });
    for (const nome of cfg.atendentes) {
      const op = document.createElement('bds-select-option');
      op.setAttribute('aria-label', nome);
      op.textContent = nome;
      op.addEventListener('click', () => {
        input.value = nome;
        caixa.hidden = true;
        confirmar.removeAttribute('disabled');
      });
      caixa.appendChild(op);
    }
    const filtrar = () => {
      const termo = input.value.trim().toLowerCase();
      caixa.hidden = false;
      caixa.querySelectorAll('bds-select-option').forEach((op) => {
        op.style.display = op.getAttribute('aria-label').toLowerCase().includes(termo) ? '' : 'none';
      });
      confirmar.setAttribute('disabled', '');
    };
    input.addEventListener('input', filtrar);
    acRaiz.querySelector('bds-icon').addEventListener('click', () => { caixa.hidden = !caixa.hidden; });
    confirmar.addEventListener('click', () => {
      if (confirmar.hasAttribute('disabled') || !m.isConnected) return;
      m.remove();
      t.status = 'transferido';
      t.atendente = input.value;
      registrar('transferir', { id: t.id, atendente: input.value });
      renderizar();
    });
    m.querySelector('.cancelar').addEventListener('click', () => m.remove());
  }

  // ───────────────────────── geral
  function renderizar() {
    renderizarLista();
    renderizarFila();
    renderizarChat();
  }

  function reiniciar(config = {}) {
    cfg = { ...PADRAO, ...config };
    tickets = [];
    proxId = 3148001;
    abertoId = null;
    ultimoAtender = 0;
    eventos = [];
    filaRestante = cfg.fila;
    lista().innerHTML = '';
    document.querySelectorAll('.modal').forEach((m) => m.remove());
    cfg.naTela.forEach((nome, i) => novoTicket(nome, cfg.pausadosIniciais.includes(i)));
    const btn = $('#claim-ticket-button');
    if (cfg.semBotaoAtender && btn) btn.remove();
    renderizar();
  }

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !cfg.menuNaoFecha) fecharMenus(); });
  document.addEventListener('click', (e) => {
    if (e.target.closest?.('#claim-ticket-button')) atender();
  });

  window.blipFalso = {
    reiniciar,
    estado: () => JSON.parse(JSON.stringify({
      tickets, filaRestante, abertoId, naLista: naLista().map((t) => t.id), eventos,
    })),
    adicionarFila: (n = 1) => { filaRestante += n; registrar('fila', { n }); renderizar(); return filaRestante; },
    chegarChat: (nome) => { const t = novoTicket(nome || `Cliente Novo ${proxId}`); registrar('chegou', { id: t.id }); renderizar(); return t.id; },
  };
  reiniciar();
})();
