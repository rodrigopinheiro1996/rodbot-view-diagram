  /* ========================================================
     RESPOSTA AUTOMÁTICA A NOVOS CHATS
     Detecta chats que chegam à lista depois da ativação, envia a mensagem
     configurada, confirma o envio pela interface e só então pausa (standby)
     o cliente. Um único worker processa a fila, um chat por vez.
     ======================================================== */
  const AUTO_MSG_KEY = 'rf_rodbot_auto_msg_v1';
  const AUTO_COUNT_KEY = 'rf_rodbot_auto_count_v1';
  const AUTO_TICKETS_KEY = 'rf_rodbot_auto_tickets_v1';
  const AUTO_TICKETS_TTL = 24 * 60 * 60 * 1000;
  const AUTO_TICKETS_MAX = 500;
  const AUTO_T = Object.assign({
    debounce: 250,        // agrupa mutações antes de reexaminar a fila
    reconciliar: 1500,    // revalida observers/elementos e reexamina a fila
    janelaFiltro: 3000,   // após interação com o filtro, ids novos são absorvidos sem contar
    janelaRolagem: 4000,  // após rolagem da lista (carregamento de itens antigos), idem
    chatAtivo: 6000,
    campo: 8000,
    confirmarEnvio: 8000,
    menu: 3500,
    verificarPausa: 3000,
    entreTickets: 600,
    espera: 1000
  }, (window.__rodBotAutoTimeouts && typeof window.__rodBotAutoTimeouts === 'object') ? window.__rodBotAutoTimeouts : {});

  // Seletores centralizados. Fila e contador: caminhos verificados na interface do Blip em 18/11/2026.
  // Menu do ticket, card, campo de texto e opções de espera: os mesmos já usados pelo restante do bookmarklet.
  const AUTO_SEL = {
    filaContainer: 'div#sidenav-div > div:nth-of-type(3) > div > div > div:nth-of-type(3) > div:nth-of-type(1) > div',
    // Área da lista inteira: busca, filtro "Todos", pastas (nv2, default...) e atendimentos (verificado 18/11/2026).
    // Obs.: no Blip, 'main > div > div' é a lista de pastas DENTRO da barra lateral, não o chat aberto.
    areaLista: 'div#sidenav-div > div:nth-of-type(3) > div > div',
    // Número do ticket no cabeçalho do chat aberto ("Ticket: #3148288"), verificado 18/11/2026.
    // O Blip repete esse id num drawer fora de #pane-chat-div, por isso o escopo.
    cabecalhoTicket: '#pane-chat-div [id="ticket-sequential-id"]',
    sidenav: '#sidenav-div',
    filtroDropdown: 'bds-dropdown#ticket-filter-dropdown',
    contadorChip: 'bds-dropdown#ticket-filter-dropdown > div > bds-chip-tag',
    menuTicket: 'button.ticket-info-options[id^="menu-"]',
    card: 'article.chat-list-item',
    campoTexto: '#text-input',
    opcaoPausar: 'option-setStandbyMode',
    opcaoDespausar: 'option-unsetStandbyMode'
  };
  const AUTO_ESTADOS = {
    pendente: '⏳ pendente', processando: '⚙️ processando', enviado: '✉️ enviado',
    pausado: '⏸️ pausado', falha: '❌ falha', falha_pausa: '⚠️ enviado, pausa pendente',
    suspenso: '✋ suspenso', descartado: '🗑️ descartado'
  };
  const AUTO_IGNORAR_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SVG', 'TEMPLATE', 'NOSCRIPT']);

  const autoMsgEl = document.getElementById('ba-auto-msg');
  const autoToggleBtn = document.getElementById('ba-auto-toggle');
  const autoStateEl = document.getElementById('ba-auto-state');
  const autoCountEl = document.getElementById('ba-auto-count');
  const autoNativeEl = document.getElementById('ba-auto-native');
  const autoQueueEl = document.getElementById('ba-auto-queue');
  const autoDetailEl = document.getElementById('ba-auto-detail');
  const autoListEl = document.getElementById('ba-auto-list');
  const autoResumeBtn = document.getElementById('ba-auto-resume');
  const autoRetryPauseBtn = document.getElementById('ba-auto-retry-pause');
  const autoResetBtn = document.getElementById('ba-auto-reset');
  const autoFillDefaultBtn = document.getElementById('ba-auto-fill-default');
  const autoPillEl = document.getElementById('ba-auto-pill');

  const auto = {
    ativo: false,
    destruido: false,
    gen: 0,                 // muda a cada ativação/desativação; invalida etapas pré-envio em curso
    baselinePronta: false,
    vistos: new Set(),      // identidades (id do ticket) já conhecidas: nunca voltam a ser "novas"
    registros: new Map(),   // id -> { id, estado, motivo, ts }
    fila: [],               // [{ id, soPausa }]
    atual: null,
    workerAtivo: false,
    suspensa: '',
    aguardando: '',
    supressaoAte: 0,
    motivoSupressao: '',
    assinaturaFiltro: null,
    ultimoNativo: null,
    mudancasNativo: 0,
    reconexoes: 0,
    avisoLeitura: '',
    ultimoErro: '',
    contador: 0,
    obs: { fila: null, chip: null, typo: null, filtro: null },
    alvos: { fila: null, chip: null, typo: null, filtro: null },
    timerScan: null,
    timerRecon: null,
    consumidor: null        // fluxo 🆕/👥: recebe os ids novos no lugar do worker do Auto
  };

  function autoLerContador() {
    try {
      const n = parseInt(localStorage.getItem(AUTO_COUNT_KEY) || '0', 10);
      return Number.isFinite(n) && n > 0 ? n : 0;
    } catch {
      return 0;
    }
  }
  function autoSalvarContador() {
    try { localStorage.setItem(AUTO_COUNT_KEY, String(auto.contador)); } catch {}
  }
  // Por ticket, só identidade e estado (nada do conteúdo das conversas).
  function autoLerTickets() {
    try {
      const o = JSON.parse(localStorage.getItem(AUTO_TICKETS_KEY) || '{}');
      return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
    } catch {
      return {};
    }
  }
  function autoGravarTicket(id, patch) {
    const agora = Date.now();
    const o = autoLerTickets();
    for (const k of Object.keys(o)) {
      if (!o[k] || agora - (o[k].ts || 0) > AUTO_TICKETS_TTL) delete o[k];
    }
    o[id] = { ...(o[id] || {}), ...patch, ts: agora };
    const chaves = Object.keys(o).sort((a, b) => (o[a].ts || 0) - (o[b].ts || 0));
    while (chaves.length > AUTO_TICKETS_MAX) delete o[chaves.shift()];
    try { localStorage.setItem(AUTO_TICKETS_KEY, JSON.stringify(o)); } catch {}
  }
  auto.contador = autoLerContador();

  function autoLerMensagem() {
    return (autoMsgEl?.value || '').trim();
  }
  function autoCampoTexto() {
    return document.querySelector(AUTO_SEL.campoTexto);
  }
  // Rascunho = texto no campo diferente da própria mensagem automática (que pode ter ficado
  // como rascunho do chat-alvo se o operador trocou de chat no meio do processamento).
  function autoTemRascunho(msg = autoLerMensagem()) {
    const c = autoCampoTexto();
    const v = c ? (c.value || '') : '';
    return !!v.trim() && v !== msg;
  }
  function autoBotaoMenu(id) {
    const b = document.getElementById('menu-' + id);
    return b && b.matches?.(AUTO_SEL.menuTicket) && !p.contains(b) ? b : null;
  }
  function autoCardDoTicket(btn) {
    return btn?.closest(AUTO_SEL.card) || btn?.closest('[class*="chat-list-item"]') || null;
  }
  function autoContemComposto(ancestral, no) {
    let n = no;
    while (n) {
      if (n === ancestral) return true;
      n = n.parentNode || n.host || null;
    }
    return false;
  }
  // Texto renderizado, atravessando Shadow Roots e slots (o <p> do bds-typo exibe o texto via <slot>).
  function autoTextoComposto(no, prof = 0) {
    if (!no || prof > 14) return '';
    if (no.nodeType === 3) return no.nodeValue || '';
    if (no.nodeType !== 1 && no.nodeType !== 11) return '';
    if (no.nodeType === 1 && no.tagName === 'SLOT') {
      const atribuidos = typeof no.assignedNodes === 'function' ? no.assignedNodes({ flatten: true }) : [];
      const fonte = atribuidos.length ? atribuidos : [...no.childNodes];
      return fonte.map(n => autoTextoComposto(n, prof + 1)).join('');
    }
    if (no.nodeType === 1 && no.shadowRoot) return autoTextoComposto(no.shadowRoot, prof + 1);
    return [...no.childNodes].map(n => autoTextoComposto(n, prof + 1)).join('');
  }

  // Resolução centralizada da fila e do contador nativo; qualquer peça ausente vira null.
  function autoResolverContador() {
    const chip = document.querySelector(AUTO_SEL.contadorChip);
    const chipRoot = chip?.shadowRoot || null;
    const typo = chipRoot?.querySelector('bds-typo') || null;
    const typoRoot = typo?.shadowRoot || null;
    const texto = typoRoot?.querySelector('p[part="bds-typo__text"]') || typoRoot?.querySelector('p') || null;
    const alternativo = chipRoot ? (chipRoot.querySelectorAll('div')[0] || null) : null;
    // No Blip o chip também tem um bds-typo no light DOM (slot); último recuo: texto renderizado do chip.
    const bruto = (autoTextoComposto(texto) || autoTextoComposto(typo) || autoTextoComposto(alternativo) ||
      autoTextoComposto(chip) || '').replace(/\s+/g, ' ').trim();
    const m = bruto.match(/\d+/);
    return { chip, chipRoot, typo, typoRoot, texto: bruto, numero: m ? parseInt(m[0], 10) : null };
  }
  function autoColetarTickets() {
    const container = document.querySelector(AUTO_SEL.filaContainer);
    let botoes = container ? [...container.querySelectorAll(AUTO_SEL.menuTicket)] : [];
    let origem = 'contêiner';
    if (!botoes.length) {
      const area = document.querySelector(AUTO_SEL.areaLista);
      const daArea = area ? [...area.querySelectorAll(AUTO_SEL.menuTicket)] : [];
      if (daArea.length) {
        botoes = daArea;
        origem = 'área da lista';
      }
    }
    if (!botoes.length) {
      const globais = [...document.querySelectorAll(AUTO_SEL.menuTicket)];
      if (globais.length) {
        botoes = globais;
        origem = container ? 'documento (contêiner sem tickets)' : 'documento (contêiner ausente)';
      }
    }
    const ids = [];
    const aqui = new Set();
    let duplicados = 0;
    for (const b of botoes) {
      if (p.contains(b)) continue;
      const id = (b.id || '').slice(5).trim();
      if (!id) continue;
      if (aqui.has(id)) { duplicados++; continue; }
      aqui.add(id);
      ids.push(id);
    }
    const cards = (container || document).querySelectorAll(AUTO_SEL.card).length;
    return { container, origem, ids, duplicados, semIdentidade: Math.max(0, cards - ids.length) };
  }
  function autoFiltroAberto() {
    const dd = document.querySelector(AUTO_SEL.filtroDropdown);
    return !!(dd && (dd.open === true || dd.hasAttribute('open') || dd.getAttribute('aria-expanded') === 'true'));
  }
  function autoAssinaturaFiltro(nat) {
    const dd = document.querySelector(AUTO_SEL.filtroDropdown);
    // Sem texto legível (Shadow Root ainda indisponível/substituído) a assinatura é desconhecida:
    // não compara, para o contador "aparecer" não ser confundido com troca de filtro.
    if (!dd || !nat.texto) return null;
    const attrs = el => el ? [...el.attributes]
      .filter(a => !/^(class|style|open|aria-expanded|data-open)$/i.test(a.name))
      .map(a => a.name + '=' + a.value).sort().join(',') : '';
    return [nat.texto, attrs(dd), attrs(nat.chip)].join('|').replace(/\d+/g, '#');
  }
  function autoSuprimir(ms, motivo) {
    const ate = Date.now() + ms;
    if (ate > auto.supressaoAte) {
      auto.supressaoAte = ate;
      auto.motivoSupressao = motivo;
    }
  }
  function autoMotivoAbsorcao() {
    if (autoFiltroAberto()) return 'filtro aberto';
    if (Date.now() < auto.supressaoAte) return auto.motivoSupressao;
    // o próprio fluxo 🆕/👥 que consome o observador não é "outra automação" (seus cliques não revelam chats antigos)
    if (rodando && modoAtual !== 'claim' && !(auto.consumidor && modoAtual === 'fluxo')) return 'outra automação do BM em execução';
    return '';
  }

  function autoReexaminar() {
    if (!auto.ativo || auto.destruido) return;
    try {
      const nat = autoResolverContador();
      if (nat.numero !== auto.ultimoNativo) {
        if (auto.ultimoNativo !== null && nat.numero !== null) auto.mudancasNativo++;
        auto.ultimoNativo = nat.numero;
      }
      const assinatura = autoAssinaturaFiltro(nat);
      if (assinatura !== null) {
        if (auto.assinaturaFiltro !== null && assinatura !== auto.assinaturaFiltro) autoSuprimir(AUTO_T.janelaFiltro, 'troca de filtro');
        auto.assinaturaFiltro = assinatura;
      }
      if (autoFiltroAberto()) autoSuprimir(AUTO_T.janelaFiltro, 'filtro aberto');

      const leitura = autoColetarTickets();
      auto.avisoLeitura = leitura.semIdentidade
        ? `${leitura.semIdentidade} chat(s) sem identidade estável (menu-<id>) não são monitorados.`
        : (leitura.origem !== 'contêiner' && leitura.ids.length ? `Lista lida pelo ${leitura.origem}.` : '');
      if (leitura.duplicados) {
        auto.ultimoErro = 'identidades duplicadas na lista; leitura ignorada';
        autoRender();
        return;
      }

      if (!auto.baselinePronta) {
        const vazioConfiavel = !!leitura.container && leitura.ids.length === 0 && leitura.semIdentidade === 0 && nat.numero === 0;
        if (leitura.ids.length || vazioConfiavel) {
          leitura.ids.forEach(id => auto.vistos.add(id));
          auto.baselinePronta = true;
          log(`📸 Estado inicial registrado: ${leitura.ids.length} chat(s) já presentes (não recebem mensagem).`);
          if (nat.numero !== null && nat.numero > leitura.ids.length) {
            log(`ℹ️ O Blip indica ${nat.numero} chat(s), ${leitura.ids.length} renderizado(s). Itens antigos carregados por rolagem são ignorados.`);
          }
        }
        autoRender();
        return;
      }

      const novos = leitura.ids.filter(id => !auto.vistos.has(id));
      if (!novos.length) {
        autoRender();
        return;
      }
      const motivo = autoMotivoAbsorcao();
      if (motivo) {
        novos.forEach(id => auto.vistos.add(id));
        log(`↪️ ${novos.length} chat(s) passaram a aparecer durante ${motivo}; registrados sem contar.`);
        autoRender();
        return;
      }
      const persistidos = autoLerTickets();
      for (const id of novos) {
        auto.vistos.add(id);
        const ant = persistidos[id];
        if (ant && ant.contado) {
          if (ant.envio === 'enviado' && !ant.pausado) {
            autoRegistrar(id, 'falha_pausa', 'mensagem enviada antes; pausa pendente');
          }
          continue;
        }
        auto.contador++;
        autoSalvarContador();
        autoGravarTicket(id, { contado: true });
        if (auto.consumidor) {
          log(`🆕 Novo chat #${id} (total do BM: ${auto.contador}).`);
          auto.consumidor(id);
          continue;
        }
        autoRegistrar(id, 'pendente', 'novo chat detectado');
        if (!auto.fila.some(it => it.id === id && !it.soPausa)) auto.fila.push({ id, soPausa: false });
        log(`🆕 Novo chat #${id} (total do BM: ${auto.contador}).`);
      }
      autoRender();
      autoAgendarWorker();
    } catch (err) {
      auto.ultimoErro = `leitura da fila: ${err.message}`;
      autoRender();
    }
  }
  function autoAgendarScan() {
    if (!auto.ativo || auto.destruido || auto.timerScan) return;
    auto.timerScan = setTimeout(() => {
      auto.timerScan = null;
      autoReexaminar();
    }, AUTO_T.debounce);
  }

  // Observers: fila (light DOM) + dois Shadow Roots do contador + atributos do filtro.
  // Um observer no document não atravessa Shadow DOM, por isso cada raiz é observada.
  function autoConectar(nome, alvo, opcoes) {
    const atual = auto.alvos[nome];
    if (atual === alvo && auto.obs[nome] && (!alvo || alvo.isConnected !== false)) return;
    if (auto.obs[nome]) {
      auto.obs[nome].disconnect();
      auto.obs[nome] = null;
    }
    if (atual && alvo && atual !== alvo) auto.reconexoes++;
    auto.alvos[nome] = alvo || null;
    if (!alvo) return;
    const mo = new MutationObserver(() => autoAgendarScan());
    mo.observe(alvo, opcoes);
    auto.obs[nome] = mo;
    autoAgendarScan();
  }
  function autoGarantirObservers() {
    if (!auto.ativo || auto.destruido) return;
    // Observa a área inteira da lista (inclui o conteúdo das pastas), com recuos se ela não existir.
    const alvoFila = document.querySelector(AUTO_SEL.areaLista) || document.querySelector(AUTO_SEL.filaContainer) ||
      document.querySelector(AUTO_SEL.sidenav) || document.body;
    autoConectar('fila', alvoFila, { childList: true, subtree: true, attributes: true, attributeFilter: ['id'] });
    const nat = autoResolverContador();
    autoConectar('chip', nat.chipRoot, { childList: true, subtree: true, characterData: true, attributes: true });
    autoConectar('typo', nat.typoRoot, { childList: true, subtree: true, characterData: true });
    autoConectar('filtro', document.querySelector(AUTO_SEL.filtroDropdown), { attributes: true });
  }
  function autoDesconectarObservers() {
    for (const k of Object.keys(auto.obs)) {
      auto.obs[k]?.disconnect();
      auto.obs[k] = null;
      auto.alvos[k] = null;
    }
  }

  function autoOnInteracao(e) {
    if (!auto.ativo) return;
    const caminho = typeof e.composedPath === 'function' ? e.composedPath() : [];
    const dd = document.querySelector(AUTO_SEL.filtroDropdown);
    if (dd && (caminho.includes(dd) || (e.target?.nodeType === 1 && dd.contains(e.target)))) {
      autoSuprimir(AUTO_T.janelaFiltro, 'troca de filtro');
      autoAgendarScan();
      return;
    }
    // Expandir/recolher pastas ou buscar na lista revela chats antigos: não são recebimentos.
    // Cliques em um card de chat (abrir, menu de 3 pontos) não entram aqui.
    const area = document.querySelector(AUTO_SEL.areaLista);
    if (area && caminho.includes(area) && !caminho.some(n => n.nodeType === 1 && n.matches?.(AUTO_SEL.card))) {
      autoSuprimir(AUTO_T.janelaRolagem, 'uso de pastas/busca da lista');
      autoAgendarScan();
    }
  }
  function autoOnRolagem(e) {
    if (!auto.ativo) return;
    const alvo = e.target;
    if (!alvo || alvo.nodeType !== 1) return;
    const lista = document.querySelector(AUTO_SEL.filaContainer);
    const sidenav = document.querySelector(AUTO_SEL.sidenav);
    if ((lista && (alvo === lista || alvo.contains(lista) || lista.contains(alvo))) || (sidenav && sidenav.contains(alvo))) {
      autoSuprimir(AUTO_T.janelaRolagem, 'rolagem da lista');
    }
  }
  const AUTO_EVENTOS = [
    ['pointerdown', autoOnInteracao, true],
    ['click', autoOnInteracao, true],
    ['keydown', autoOnInteracao, true],
    ['scroll', autoOnRolagem, true],
    ['wheel', autoOnRolagem, { capture: true, passive: true }]
  ];

  // Contagem de ocorrências de um texto no DOM visível, atravessando Shadow Roots.
  // Conta só o elemento mais profundo que contém o texto; tags de formulário/script são ignoradas.
  function autoSemEspaco(s) {
    return (s || '').replace(/\s+/g, '');
  }
  function autoRaizesTexto(base = document.body) {
    const raizes = base ? [base] : [];
    for (let i = 0; i < raizes.length && raizes.length < 4000; i++) {
      for (const el of raizes[i].querySelectorAll('*')) {
        if (el.shadowRoot) raizes.push(el.shadowRoot);
      }
    }
    return raizes;
  }
  function autoVarrer(no, teste, pular) {
    let n = 0, texto = '';
    for (const filho of no.childNodes) {
      if (filho.nodeType === 3) { texto += filho.nodeValue; continue; }
      if (filho.nodeType !== 1) continue;
      if (AUTO_IGNORAR_TAGS.has(filho.tagName.toUpperCase()) || (pular && pular(filho))) continue;
      const bruto = filho.textContent || '';
      if (!teste(bruto)) { texto += bruto; continue; }
      const r = autoVarrer(filho, teste, pular);
      n += r.n;
      texto += r.texto;
    }
    if (!n && teste(texto)) n = 1;
    return { n, texto };
  }
  function autoContarTexto(teste, pular, base) {
    let total = 0;
    for (const raiz of autoRaizesTexto(base)) {
      if (pular && raiz.host && pular(raiz.host)) continue;
      if (!teste(raiz.textContent || '')) continue;
      total += autoVarrer(raiz, teste, pular).n;
    }
    return total;
  }
  function autoContarOcorrencias(msg) {
    const chave = autoSemEspaco(msg).slice(0, 120);
    if (!chave) return 0;
    return autoContarTexto(t => autoSemEspaco(t).includes(chave));
  }

  // Evidência de que o chat aberto é o do ticket: URL, card marcado como selecionado
  // (único na lista) ou o número do ticket exibido fora da lista lateral.
  function autoCardMarcado(card) {
    if (card.getAttribute('aria-selected') === 'true') return true;
    const cur = card.getAttribute('aria-current');
    if (cur && cur !== 'false') return true;
    return [...card.classList].some(c => /(^|[-_])(active|selected|current)$/i.test(c));
  }
  // Painel do chat aberto = maior ancestral do #text-input que não contém a lista lateral.
  // Avisos/toasts globais ficam fora dele; o cabeçalho do chat aberto fica dentro.
  function autoRaizPainelChat() {
    // No Blip o campo fica em #pane-chat-div; a raiz sobe até antes de incluir a barra lateral.
    const campo = autoCampoTexto();
    const lateral = document.querySelector(AUTO_SEL.sidenav) || document.querySelector(AUTO_SEL.filaContainer);
    if (!campo || !lateral) return null;
    let raiz = null;
    for (let n = campo; n && n !== document.body && n !== document.documentElement; n = n.parentNode || n.host) {
      if (n.nodeType === 1) {
        if (autoContemComposto(n, lateral)) break;
        raiz = n;
      }
    }
    return raiz;
  }
  // Quantas vezes o número do ticket aparece no painel do chat aberto (inclui Shadow Roots).
  function autoContarIdPainel(id) {
    const raiz = autoRaizPainelChat();
    if (!raiz) return 0;
    const esc = escapeRegExp(id);
    const re = id.length >= 6
      ? new RegExp('(^|[^0-9A-Za-z])#?' + esc + '($|[^0-9A-Za-z])')
      : new RegExp('#' + esc + '($|[^0-9A-Za-z])');
    return autoContarTexto(t => re.test(t), null, raiz);
  }
  // Números de ticket exibidos no cabeçalho do chat aberto; null = cabeçalho ausente/ilegível.
  function autoTicketsNoCabecalho() {
    const nums = [];
    for (const el of document.querySelectorAll(AUTO_SEL.cabecalhoTicket)) {
      if (!isElementoVisivel(el)) continue;
      nums.push(...(autoTextoComposto(el).match(/\d+/g) || []));
    }
    return nums.length ? nums : null;
  }
  function autoIndicioChatAtivo(id) {
    // Indício principal e decisivo: se o cabeçalho mostra outro ticket, não é este chat,
    // mesmo que o número apareça em outro lugar (ex.: histórico do mesmo cliente).
    const cabecalho = autoTicketsNoCabecalho();
    if (cabecalho) return cabecalho.includes(id) ? 'cabeçalho' : null;
    try {
      if (new RegExp('[/=]' + escapeRegExp(id) + '($|[/?&#])').test(decodeURIComponent(location.href))) return 'url';
    } catch {}
    const btn = autoBotaoMenu(id);
    const card = autoCardDoTicket(btn);
    if (card && autoCardMarcado(card)) {
      const marcados = [...document.querySelectorAll(AUTO_SEL.card)].filter(autoCardMarcado);
      if (marcados.length === 1) return 'card';
    }
    return autoContarIdPainel(id) > 0 ? 'painel' : null;
  }

  function autoRegistrar(id, estado, motivo = '') {
    const r = auto.registros.get(id) || { id };
    r.estado = estado;
    r.motivo = motivo;
    r.ts = Date.now();
    auto.registros.delete(id);
    auto.registros.set(id, r);
    while (auto.registros.size > 200) {
      const antigo = auto.registros.keys().next().value;
      if (auto.atual && auto.atual.id === antigo) break;
      auto.registros.delete(antigo);
    }
    if (estado === 'falha' || estado === 'falha_pausa' || estado === 'suspenso') {
      auto.ultimoErro = `#${id}: ${motivo}`;
      log(`⚠️ Chat #${id}: ${motivo}`);
    } else if (estado === 'pausado' && auto.ultimoErro.startsWith(`#${id}:`)) {
      auto.ultimoErro = ''; // o mesmo ticket foi concluído depois da falha
    }
    autoRender();
  }
  function autoSuspender(motivo) {
    if (auto.suspensa) return;
    auto.suspensa = motivo;
    log(`✋ Resposta automática suspensa — ${motivo}.`);
    autoRender();
  }
  function autoInterromper(id, motivo) {
    autoRegistrar(id, 'suspenso', motivo);
    autoSuspender(`chat #${id}: ${motivo}`);
  }
  function autoSetAguardando(t) {
    if (auto.aguardando === t) return;
    auto.aguardando = t;
    autoRender();
  }
  function autoLimparSeNosso(input, msg) {
    try {
      if (!input || input.value !== msg) return;
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      if (setter && input instanceof HTMLTextAreaElement) setter.call(input, '');
      else input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch {}
  }

  // Envio confirmado = campo esvaziado E nova ocorrência do texto na conversa.
  // Texto ainda no campo sem nova ocorrência = não enviado. Qualquer outra combinação = ambíguo.
  async function autoConfirmarEnvio(input, msg, antes) {
    const fim = Date.now() + AUTO_T.confirmarEnvio;
    let apareceu = false;
    while (Date.now() < fim && !auto.destruido) {
      await sleep(250);
      const campo = autoCampoTexto();
      const limpo = !!campo && !(campo.value || '').trim();
      apareceu = autoContarOcorrencias(msg) > antes;
      if (limpo && apareceu) return 'confirmado';
    }
    if (auto.destruido) return 'interrompido'; // painel fechado: estado fica "enviando" (nunca reenvia)
    const campo = autoCampoTexto();
    if (!apareceu && campo === input && input.value === msg) return 'nao_enviado';
    return 'ambiguo';
  }

  async function autoProcessarTicket(id) {
    const gen = auto.gen;
    const vivo = () => auto.ativo && gen === auto.gen && !auto.destruido;
    const msg = autoLerMensagem(); // lida da configuração no início de cada atendimento
    const anterior = autoLerTickets()[id];
    if (anterior && anterior.envio) {
      if (anterior.envio === 'enviado' && !anterior.pausado) {
        autoRegistrar(id, 'enviado', 'mensagem já enviada antes; somente pausando');
        await autoPausar(id);
      } else {
        autoRegistrar(id, anterior.pausado ? 'pausado' : 'falha', 'já processado antes; nada reenviado');
      }
      return;
    }
    if (!msg) {
      autoRegistrar(id, 'suspenso', 'mensagem automática vazia');
      autoSuspender('a mensagem automática está vazia');
      return;
    }
    autoRegistrar(id, 'processando', 'abrindo o chat');
    const btn = await waitFor(() => autoBotaoMenu(id), 4000, 200).catch(() => null);
    if (!btn) return autoRegistrar(id, 'falha', 'o ticket saiu da lista; nada enviado');
    const card = autoCardDoTicket(btn);
    if (!card) return autoRegistrar(id, 'falha', 'card do ticket não encontrado; nada enviado');
    if (!vivo()) return autoRegistrar(id, 'descartado', 'automação desativada antes do envio');
    if (autoTemRascunho(msg)) return autoInterromper(id, 'há texto digitado no chat aberto; nada foi trocado');

    clickUnico(card);
    const indicio = await waitFor(() => autoIndicioChatAtivo(id), AUTO_T.chatAtivo, 200).catch(() => null);
    if (!indicio) return autoInterromper(id, 'não foi possível confirmar que o chat aberto é deste ticket; nada enviado');
    if (!vivo()) return autoRegistrar(id, 'descartado', 'automação desativada antes do envio');

    const input = await waitFor(() => {
      const el = autoCampoTexto();
      return el && !el.disabled && isElementoVisivel(el) ? el : null;
    }, AUTO_T.campo, 200).catch(() => null);
    if (!input) return autoRegistrar(id, 'falha', 'campo de mensagem indisponível; nada enviado');
    if (autoTemRascunho(msg)) return autoInterromper(id, 'o chat do cliente tem um rascunho; o texto não foi alterado');
    if (autoIndicioChatAtivo(id) === null) return autoInterromper(id, 'o chat aberto mudou antes do preenchimento');

    if (input.value !== msg) {
      autoRegistrar(id, 'processando', 'preenchendo a mensagem');
      await preencherCampoMensagem(input, msg);
    }

    // Reverificação imediatamente antes do envio.
    if (!vivo()) {
      autoLimparSeNosso(input, msg);
      return autoRegistrar(id, 'descartado', 'automação desativada antes do envio');
    }
    if (autoCampoTexto() !== input || autoIndicioChatAtivo(id) === null) {
      autoLimparSeNosso(input, msg);
      return autoInterromper(id, 'o chat aberto mudou durante o processamento; nada enviado');
    }
    if (input.value !== msg) return autoInterromper(id, 'o texto do campo foi alterado manualmente; nada enviado');

    const antes = autoContarOcorrencias(msg);
    autoGravarTicket(id, { envio: 'enviando' }); // a partir daqui o ticket nunca recebe reenvio automático
    autoRegistrar(id, 'processando', 'enviando');
    dispararEnvioEnter(input);
    const resultado = await autoConfirmarEnvio(input, msg, antes);
    if (resultado === 'interrompido') return;
    if (resultado !== 'confirmado') {
      autoLimparSeNosso(input, msg);
      autoGravarTicket(id, { envio: resultado });
      return autoRegistrar(id, 'falha', resultado === 'nao_enviado'
        ? 'o envio não ocorreu (texto permaneceu no campo); cliente não pausado'
        : 'envio sem confirmação na interface; cliente não pausado e sem reenvio automático');
    }
    autoGravarTicket(id, { envio: 'enviado' });
    autoRegistrar(id, 'enviado', 'envio confirmado; pausando');
    log(`✉️ Chat #${id}: mensagem enviada e confirmada.`);
    await autoPausar(id);
  }

  // Pausa pelo mesmo caminho já usado em "Pausar todos": menu do ticket → option-setStandbyMode.
  async function autoTentarPausa(id) {
    const alvo = autoBotaoMenu(id);
    if (!alvo) return { ok: false, motivo: 'ticket não encontrado na lista' };
    const wrap = alvo.closest('.ticket-menu') || alvo.parentElement;
    const card = autoCardDoTicket(alvo) || wrap;
    card?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    card?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    wrap?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await sleep(120);
    clickUnico(alvo);
    const acao = await waitFor(() => {
      const t = encontrarOpcaoMenu(wrap, AUTO_SEL.opcaoPausar);
      if (t) return { tipo: 'alvo', el: t };
      const o = encontrarOpcaoMenu(wrap, AUTO_SEL.opcaoDespausar);
      if (o) return { tipo: 'oposto', el: o };
      return null;
    }, AUTO_T.menu, 100).catch(() => null);
    if (!acao) {
      await fecharMenuTicket(wrap, alvo);
      return { ok: false, motivo: 'opção de espera não apareceu no menu' };
    }
    if (acao.tipo === 'oposto') {
      await fecharMenuTicket(wrap, alvo);
      return { ok: true, nota: 'já estava em espera' };
    }
    const innerBtn = acao.el.shadowRoot?.querySelector('button.menuaction__button, button') || acao.el;
    await sleep(150);
    clickUnico(innerBtn);
    await sleep(550);
    await fecharAvisosPendentes();
    const verif = await autoVerificarPausa(id);
    if (verif === 'confirmado') return { ok: true, nota: '' };
    if (verif === 'sumiu') return { ok: true, nota: 'saiu da lista após a pausa (não verificável)' };
    return { ok: false, motivo: 'a pausa não foi confirmada no menu do ticket' };
  }
  async function autoVerificarPausa(id) {
    const fim = Date.now() + AUTO_T.verificarPausa;
    while (Date.now() < fim && !auto.destruido) {
      const alvo = autoBotaoMenu(id);
      if (!alvo) return 'sumiu';
      const wrap = alvo.closest('.ticket-menu') || alvo.parentElement;
      if (!menuEstaAberto(wrap)) clickUnico(alvo);
      const acao = await waitFor(() => {
        if (encontrarOpcaoMenu(wrap, AUTO_SEL.opcaoDespausar)) return 'oposto';
        if (encontrarOpcaoMenu(wrap, AUTO_SEL.opcaoPausar)) return 'alvo';
        return null;
      }, 1500, 100).catch(() => null);
      await fecharMenuTicket(wrap, alvo);
      if (acao === 'oposto') return 'confirmado';
      await sleep(400);
    }
    return 'nao_confirmado';
  }
  async function autoPausar(id) {
    let motivo = '';
    for (let tentativa = 1; tentativa <= 2 && !auto.destruido; tentativa++) {
      autoRegistrar(id, 'enviado', tentativa === 1 ? 'pausando' : 'pausando (nova tentativa)');
      const r = await autoTentarPausa(id).catch(err => ({ ok: false, motivo: err.message }));
      if (r.ok) {
        autoGravarTicket(id, { pausado: true });
        autoRegistrar(id, 'pausado', r.nota);
        log(`⏸️ Chat #${id} pausado${r.nota ? ` (${r.nota})` : ''}.`);
        return true;
      }
      motivo = r.motivo;
      await sleep(700);
    }
    autoRegistrar(id, 'falha_pausa', `mensagem enviada; pausa falhou (${motivo}). Use "Repetir pausas pendentes"`);
    return false;
  }

  function autoAgendarWorker() {
    if (!auto.workerAtivo && !auto.destruido && auto.fila.length) autoWorker();
  }
  async function autoWorker() {
    if (auto.workerAtivo || auto.destruido) return;
    auto.workerAtivo = true;
    try {
      while (!auto.destruido && auto.fila.length) {
        const prox = auto.fila[0];
        if (!prox.soPausa) {
          if (!auto.ativo) { auto.fila.shift(); continue; }
          if (auto.suspensa) break;
        }
        if (rodando) {
          autoSetAguardando('outra automação do BM em execução');
          await sleep(AUTO_T.espera);
          continue;
        }
        if (!prox.soPausa) {
          if (autoTemRascunho()) {
            autoSetAguardando('há texto digitado no chat aberto (rascunho do operador)');
            await sleep(AUTO_T.espera);
            continue;
          }
          if (!autoLerMensagem()) {
            autoSuspender('a mensagem automática está vazia');
            break;
          }
        }
        auto.fila.shift();
        auto.atual = prox; // definido de forma síncrona: bloqueia o início de outras automações
        auto.aguardando = '';
        autoRender();
        try {
          if (prox.soPausa) await autoPausar(prox.id);
          else await autoProcessarTicket(prox.id);
        } catch (err) {
          autoRegistrar(prox.id, 'falha', `erro inesperado: ${err.message}`);
        } finally {
          auto.atual = null;
          autoRender();
        }
        await pausaAcao(AUTO_T.entreTickets);
      }
    } finally {
      auto.workerAtivo = false;
      auto.aguardando = '';
      autoRender();
    }
  }

  // consumidor: usado pelo fluxo 🆕/👥 (só o observador; quem processa é o motor, não o worker do Auto).
  function autoAtivar(consumidor = null) {
    if (auto.ativo || auto.destruido) return;
    if (!consumidor && !autoLerMensagem()) {
      log('⚠️ Digite a mensagem automática antes de ativar.');
      autoMsgEl?.focus();
      autoRender();
      return;
    }
    auto.ativo = true;
    auto.consumidor = consumidor;
    auto.gen++;
    auto.baselinePronta = false;
    auto.suspensa = '';
    auto.aguardando = '';
    auto.ultimoErro = '';
    auto.assinaturaFiltro = null;
    auto.supressaoAte = 0;
    for (const [tipo, fn, opt] of AUTO_EVENTOS) document.addEventListener(tipo, fn, opt);
    autoGarantirObservers();
    auto.timerRecon = setInterval(() => {
      autoGarantirObservers();
      autoReexaminar();
    }, AUTO_T.reconciliar);
    log(consumidor ? '👁️ Vigiando chats novos. Registrando os chats atuais...' : '▶ Resposta automática ativada. Registrando os chats atuais...');
    autoReexaminar();
    autoRender();
  }
  function autoDesativar() {
    if (!auto.ativo) return;
    const eraFluxo = !!auto.consumidor;
    auto.ativo = false;
    auto.consumidor = null;
    auto.gen++;
    for (const [tipo, fn, opt] of AUTO_EVENTOS) document.removeEventListener(tipo, fn, opt);
    clearInterval(auto.timerRecon);
    auto.timerRecon = null;
    clearTimeout(auto.timerScan);
    auto.timerScan = null;
    autoDesconectarObservers();
    const descartados = auto.fila.filter(it => !it.soPausa);
    auto.fila = auto.fila.filter(it => it.soPausa);
    descartados.forEach(it => autoRegistrar(it.id, 'descartado', 'automação desativada antes do envio'));
    for (const r of auto.registros.values()) {
      if (r.estado === 'suspenso') { r.estado = 'descartado'; r.motivo = 'automação desativada'; }
    }
    auto.suspensa = '';
    auto.aguardando = '';
    log(eraFluxo ? '⏹ Vigia de chats novos encerrada.' : `⏹ Resposta automática desativada. ${descartados.length} pendente(s) descartado(s).`);
    if (auto.atual && !auto.atual.soPausa) {
      log(`ℹ️ Chat #${auto.atual.id} em andamento: se a mensagem já saiu, a pausa será concluída; senão, nada será enviado.`);
    }
    autoRender();
  }
  function autoRetomar() {
    if (!auto.suspensa) return;
    auto.suspensa = '';
    const persistidos = autoLerTickets();
    const voltar = [...auto.registros.values()]
      .filter(r => r.estado === 'suspenso' && !(persistidos[r.id] && persistidos[r.id].envio))
      .map(r => r.id)
      .filter(id => !auto.fila.some(it => it.id === id && !it.soPausa));
    voltar.reverse().forEach(id => {
      auto.fila.unshift({ id, soPausa: false });
      autoRegistrar(id, 'pendente', 'retomado');
    });
    log(`▶ Resposta automática retomada${voltar.length ? ` (${voltar.length} chat(s) de volta à fila)` : ''}.`);
    autoRender();
    autoAgendarWorker();
  }
  function autoRepetirPausas() {
    const ids = [...auto.registros.values()].filter(r => r.estado === 'falha_pausa').map(r => r.id);
    let n = 0;
    for (const id of ids) {
      if (auto.fila.some(it => it.id === id && it.soPausa) || (auto.atual && auto.atual.id === id)) continue;
      auto.fila.unshift({ id, soPausa: true });
      n++;
    }
    log(`⏸️ Repetindo a pausa de ${n} chat(s); nenhuma mensagem será reenviada.`);
    autoRender();
    autoAgendarWorker();
  }
  function autoBloqueiaOutras() {
    if (!auto.atual) return false;
    log(`⚠️ Aguarde: a resposta automática está processando o chat #${auto.atual.id}.`);
    return true;
  }

  function autoRender() {
    if (auto.destruido || !autoStateEl) return;
    const pendentes = auto.fila.filter(it => !it.soPausa).length + (auto.atual && !auto.atual.soPausa ? 1 : 0);
    autoCountEl.textContent = String(auto.contador);
    autoQueueEl.textContent = String(pendentes);
    autoNativeEl.textContent = auto.ultimoNativo === null ? '--' : String(auto.ultimoNativo);
    let tom = 'off', rotulo = 'Desativada';
    let detalhe = 'Desativada. Ao ativar, os chats atuais são registrados e só os próximos recebem a mensagem.';
    if (auto.ativo) {
      tom = 'on';
      rotulo = 'Ativa';
      detalhe = auto.atual ? `Processando o chat #${auto.atual.id}…` : 'Vigiando a fila de chats…';
      if (!auto.baselinePronta) {
        tom = 'wait';
        rotulo = 'Iniciando';
        detalhe = 'Aguardando a lista de chats carregar para registrar o estado inicial…';
      }
      if (auto.aguardando) {
        tom = 'wait';
        rotulo = 'Aguardando';
        detalhe = `Aguardando: ${auto.aguardando}.`;
      }
      if (auto.suspensa) {
        tom = 'err';
        rotulo = 'Suspensa';
        detalhe = `Suspensa — ${auto.suspensa}. Resolva e clique em Retomar.`;
      }
      if (auto.avisoLeitura) detalhe += ` ${auto.avisoLeitura}`;
    } else if (auto.atual) {
      detalhe = `Concluindo o chat #${auto.atual.id}…`;
    }
    if (auto.ultimoErro && tom !== 'err') detalhe += ` Última falha: ${auto.ultimoErro}.`;
    autoStateEl.textContent = rotulo;
    autoStateEl.setAttribute('data-tone', tom);
    autoDetailEl.textContent = detalhe;
    autoDetailEl.setAttribute('data-tone', tom === 'err' || (auto.ultimoErro && auto.ativo) ? 'err' : tom === 'wait' ? 'wait' : '');

    autoToggleBtn.textContent = auto.ativo ? '⏹ Desativar resposta automática' : '▶ Ativar resposta automática';
    autoToggleBtn.style.background = auto.ativo ? '#ef4444' : '';
    autoToggleBtn.style.color = auto.ativo ? '#ffffff' : '';
    autoResumeBtn.style.display = auto.suspensa ? '' : 'none';
    const temPausaPendente = [...auto.registros.values()].some(r => r.estado === 'falha_pausa');
    autoRetryPauseBtn.style.display = temPausaPendente ? '' : 'none';

    autoPillEl.style.display = auto.ativo ? 'inline-block' : 'none';
    autoPillEl.textContent = `${auto.suspensa ? '✋' : '💬'} ${auto.contador}`;

    const recentes = [...auto.registros.values()].slice(-6).reverse();
    autoListEl.replaceChildren(...recentes.map(r => {
      const linha = document.createElement('div');
      linha.textContent = `#${r.id} · ${AUTO_ESTADOS[r.estado] || r.estado}${r.motivo ? ` · ${r.motivo}` : ''}`;
      return linha;
    }));
  }

  function autoDestruir() {
    autoDesativar();
    auto.destruido = true;
    auto.fila = [];
    if (window.__rodBotAuto && window.__rodBotAuto.instancia === auto) delete window.__rodBotAuto;
  }

  if (autoMsgEl) {
    let salva = '';
    try { salva = localStorage.getItem(AUTO_MSG_KEY) || ''; } catch {}
    bindPanelInput(autoMsgEl, salva, val => {
      try { localStorage.setItem(AUTO_MSG_KEY, val); } catch {}
      if (!val.trim() && auto.ativo) autoRender();
    });
  }
  autoFillDefaultBtn.onclick = () => {
    autoMsgEl.value = MENSAGEM_PADRAO;
    autoMsgEl.dispatchEvent(new Event('input', { bubbles: true }));
    log('📋 Mensagem padrão carregada na resposta automática.');
  };
  autoToggleBtn.onclick = () => {
    if (auto.consumidor) return log('⚠️ O fluxo está vigiando os chats novos; pare o fluxo antes.');
    return auto.ativo ? autoDesativar() : autoAtivar();
  };
  autoResumeBtn.onclick = () => autoRetomar();
  autoRetryPauseBtn.onclick = () => autoRepetirPausas();
  autoResetBtn.onclick = () => {
    auto.contador = 0;
    autoSalvarContador();
    log('🧹 Contador de novos chats zerado.');
    autoRender();
  };
  for (const [id, r] of Object.entries(autoLerTickets())) {
    if (r && r.envio === 'enviado' && !r.pausado) {
      auto.registros.set(id, { id, estado: 'falha_pausa', motivo: 'mensagem enviada em execução anterior; pausa pendente', ts: r.ts || 0 });
    }
  }
  window.__rodBotAuto = {
    instancia: auto,
    snapshot: () => ({
      ativo: auto.ativo, baselinePronta: auto.baselinePronta, contador: auto.contador,
      fila: auto.fila.map(it => (it.soPausa ? 'pausa:' : '') + it.id), atual: auto.atual ? auto.atual.id : null,
      suspensa: auto.suspensa, aguardando: auto.aguardando, ultimoNativo: auto.ultimoNativo,
      mudancasNativo: auto.mudancasNativo, reconexoes: auto.reconexoes, ultimoErro: auto.ultimoErro,
      observers: Object.keys(auto.obs).filter(k => auto.obs[k]), vistos: [...auto.vistos],
      registros: [...auto.registros.values()].map(r => ({ ...r }))
    })
  };
  autoRender();

