  /* ========================================================
     TRANSFERÊNCIA EM MASSA PARA ATENDENTE
     Sempre o PRIMEIRO ticket da lista atual: abre, transfere pelo modal do Blip,
     confirma uma única vez e só conta quando o ticket sai da lista.
     ======================================================== */
  const TRANSF_T = Object.assign({
    abrir: 8000,       // chat do ticket carregar / botão de transferência aparecer
    modal: 8000,       // modal e campo de atendente aparecerem
    opcoes: 10000,     // resultados da pesquisa do Blip
    confirmar: 8000,   // botão "Transferir ticket" habilitar
    resultado: 20000,  // ticket sair da lista após a confirmação
    esperaModal: 3000, // espera mínima após o campo "Selecionar atendente" aparecer
    pronto: 6000,      // lista de atendentes carregar antes de digitar (não fatal)
    filtro: 5000,      // 1ª digitação: pesquisa ser aplicada pelo Blip
    leituraVazia: 800, // intervalo entre leituras da lista vazia
    carregando: 20000  // lista vazia com contador > 0 (carregamento)
  }, (window.__rodBotTransfTimeouts && typeof window.__rodBotTransfTimeouts === 'object') ? window.__rodBotTransfTimeouts : {});
  // Seletores fornecidos a partir do Blip real (18/11/2026).
  const TRANSF_SEL = {
    botaoTransferir: 'bds-button-icon[icon="transfer"][variant="secondary"]',
    radioAtendente: 'bds-radio[label="Atendente"]',
    autocomplete: 'bds-autocomplete#autocompleteAttendant',
    opcao: 'bds-select-option',
    confirmar: 'bds-button#confirm-transfer-btn'
  };
  let painelFechado = false;
  class TransfInterrompido extends Error {}
  class TransfSuspenso extends Error {}

  function tNorm(s) {
    return (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }
  function tDesabilitado(el) {
    return !el || el.disabled === true || el.hasAttribute?.('disabled') || el.getAttribute?.('aria-disabled') === 'true';
  }
  function tVisivel(el) {
    return !!el && el.isConnected && isElementoVisivel(el);
  }
  // Espera por condição; o tempo pausado não conta. Antes da confirmação, "Parar" interrompe a espera.
  async function tEsperar(fn, timeout, paravel = true) {
    let fim = Date.now() + timeout;
    for (;;) {
      if (painelFechado) throw new TransfInterrompido('painel fechado');
      if (paravel && !rodando) throw new TransfInterrompido('parado pelo usuário');
      let r = null;
      try { r = fn(); } catch {}
      if (r) return r;
      if (pausado && rodando) fim += 150;
      else if (Date.now() > fim) return null;
      await sleep(150);
    }
  }
  async function tAntesDeClicar() {
    if (!(await aguardarPausaSeNecessario()) || painelFechado) {
      throw new TransfInterrompido(painelFechado ? 'painel fechado' : 'parado pelo usuário');
    }
  }
  function tClicar(el) {
    if (el) el.click(); // um único clique (nada de cliques duplicados em ações do Blip)
  }

  // Lista atual: tickets fora das pastas, na ordem exibida; null = lista ainda não renderizada.
  function tListarTickets() {
    const cont = document.querySelector(AUTO_SEL.filaContainer) || document.querySelector(AUTO_SEL.areaLista);
    if (!cont) return null;
    return [...cont.querySelectorAll(AUTO_SEL.menuTicket)]
      .filter(b => !b.closest('.folder-list') && !p.contains(b))
      .map(b => (b.id || '').slice(5).trim())
      .filter(Boolean);
  }
  // Primeiro ticket da lista atual, distinguindo lista vazia de carregamento.
  async function tPrimeiroTicket() {
    let vaziasSeguidas = 0;
    const inicio = Date.now();
    for (;;) {
      if (painelFechado) throw new TransfInterrompido('painel fechado');
      if (!rodando) throw new TransfInterrompido('parado pelo usuário');
      const ids = tListarTickets();
      if (ids && ids.length) return ids[0];
      const nativo = autoResolverContador().numero;
      if (ids && nativo === 0) vaziasSeguidas++;
      else if (ids && nativo === null) vaziasSeguidas += 0.5; // contador ilegível: exige mais leituras
      else vaziasSeguidas = 0;
      if (vaziasSeguidas >= 3) return null;
      if (Date.now() - inicio > TRANSF_T.carregando) {
        throw new TransfSuspenso(ids === null
          ? 'a lista de atendimentos não foi encontrada'
          : `a lista está vazia, mas o contador do Blip indica ${nativo}; carregamento não concluiu (tickets dentro de pastas não são processados)`);
      }
      await sleep(TRANSF_T.leituraVazia);
    }
  }

  function tBotaoTransferir() {
    const noChat = [...document.querySelectorAll('#pane-chat-div ' + TRANSF_SEL.botaoTransferir)];
    const hosts = noChat.length ? noChat : [...document.querySelectorAll(TRANSF_SEL.botaoTransferir)];
    const host = hosts.find(tVisivel);
    const inner = host?.shadowRoot?.querySelector('button.icon__button');
    return inner ? { host, inner, habilitado: !tDesabilitado(host) && !tDesabilitado(inner) } : null;
  }
  function tRadioAtendente() {
    return [...document.querySelectorAll(TRANSF_SEL.radioAtendente)].find(tVisivel) || null;
  }
  function tRadioMarcado(host) {
    if (!host) return false;
    if (host.checked === true) return true;
    const i = host.shadowRoot?.querySelector('input[type="radio"]');
    return !!(i && i.checked);
  }
  // Número do ticket no título do modal ("Transferir atendimento do Ticket #3148290"), se legível.
  function tTicketDoModal(ancora) {
    for (let n = ancora, i = 0; n && i < 25; i++, n = n.parentNode || n.host) {
      if (n.nodeType !== 1) continue;
      const m = (n.textContent || '').match(/Transferir[^#]{0,60}Ticket\s*#\s*(\d+)/i);
      if (m) return m[1];
    }
    return null;
  }
  function tAutocomplete() {
    return [...document.querySelectorAll(TRANSF_SEL.autocomplete)].find(tVisivel) || null;
  }
  function tInputAuto(ac) {
    return ac?.shadowRoot?.querySelector('input[type="text"]') || null;
  }
  function tSetaAuto(ac) {
    const icone = ac?.shadowRoot?.querySelector('bds-icon[aria-label="arrow-down"]');
    return icone?.shadowRoot?.querySelector('div.icon-inner') || icone || null;
  }
  // Opções podem estar no light DOM (portal) ou dentro do Shadow Root do autocomplete.
  function tOpcoes(ac) {
    const todas = new Set([...document.querySelectorAll(TRANSF_SEL.opcao)]);
    if (ac?.shadowRoot) ac.shadowRoot.querySelectorAll(TRANSF_SEL.opcao).forEach(o => todas.add(o));
    return [...todas].filter(tOpcaoVisivel);
  }
  // O Blip mantém todas as opções no DOM e só esconde as que não batem com a pesquisa:
  // conta como visível apenas a opção com área real e com o div[role="button"] interno exibido.
  function tOpcaoVisivel(op) {
    if (!tVisivel(op)) return false;
    const r = op.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const inner = op.shadowRoot?.querySelector('div[role="button"]');
    if (inner) {
      const s = getComputedStyle(inner);
      if (s.display === 'none' || s.visibility === 'hidden') return false;
      const ri = inner.getBoundingClientRect();
      if (ri.width < 1 || ri.height < 1) return false;
    }
    return true;
  }
  function tConfirmar() {
    const host = [...document.querySelectorAll(TRANSF_SEL.confirmar)].find(tVisivel);
    const inner = host?.shadowRoot?.querySelector('button[type="button"]');
    return inner ? { host, inner, habilitado: !tDesabilitado(host) && !tDesabilitado(inner) } : null;
  }
  // Fecha o modal sem transferir (botão "Cancelar" do modal; se não houver, Escape).
  function tCancelarModal() {
    if (!tConfirmar() && !tRadioAtendente()) return;
    const cancelar = [...document.querySelectorAll('bds-button, button')]
      .find(b => tVisivel(b) && !p.contains(b) && (b.textContent || '').trim() === 'Cancelar');
    if (cancelar) tClicar(cancelar.shadowRoot?.querySelector('button') || cancelar);
    else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
  }

  function tSemAcento(s) {
    return tNorm(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function tRotulos() {
    return tOpcoes(tAutocomplete()).map(op => op.getAttribute('aria-label') || '');
  }
  // Digita como um usuário: um caractere por vez com keydown → InputEvent(insertText) → keyup.
  // Atribuir só .value (ou o texto inteiro de uma vez) pode não disparar a pesquisa do Blip.
  async function tDigitar(input, texto, atraso) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    const definir = v => (setter ? setter.call(input, v) : (input.value = v));
    const opc = { bubbles: true, composed: true };
    input.focus();
    if (input.value) {
      definir('');
      input.dispatchEvent(new InputEvent('input', { ...opc, inputType: 'deleteContentBackward' }));
      await sleep(atraso);
    }
    let atual = '';
    for (const ch of texto) {
      if (painelFechado || !rodando) throw new TransfInterrompido(painelFechado ? 'painel fechado' : 'parado pelo usuário');
      input.dispatchEvent(new KeyboardEvent('keydown', { ...opc, key: ch }));
      atual += ch;
      definir(atual);
      input.dispatchEvent(new InputEvent('input', { ...opc, data: ch, inputType: 'insertText' }));
      input.dispatchEvent(new KeyboardEvent('keyup', { ...opc, key: ch }));
      await sleep(atraso);
    }
    input.dispatchEvent(new Event('change', opc));
  }
  // Abre a lista e espera as opções carregarem e estabilizarem (não fatal: há Blips que só listam ao digitar).
  async function tEsperarAutocompletePronto() {
    let chave = '', desde = Date.now(), cliques = 0, ultimoClique = 0;
    return tEsperar(() => {
      const ac = tAutocomplete();
      const inp = tInputAuto(ac);
      if (!ac || !inp || tDesabilitado(inp)) return null;
      const rot = tRotulos();
      if (!rot.length) {
        // abre a lista; no máximo 2 cliques espaçados (a seta alterna abrir/fechar)
        if (cliques < 2 && Date.now() - ultimoClique > 2500) { cliques++; ultimoClique = Date.now(); tClicar(tSetaAuto(ac)); }
        return null;
      }
      const k = rot.join('|');
      if (k !== chave) { chave = k; desde = Date.now(); return null; }
      return Date.now() - desde >= 500 ? true : null;
    }, TRANSF_T.pronto);
  }
  // Espera o resultado da pesquisa. Sem filtro aplicado (lista igual à de antes) não decide "não encontrado".
  async function tEsperarOpcao(alvo, antes, timeout) {
    let chave = '', desde = Date.now(), ultimo = { iguais: 0, total: 0, filtrou: false };
    const r = await tEsperar(() => {
      const ops = tOpcoes(tAutocomplete());
      const rot = ops.map(op => op.getAttribute('aria-label') || '');
      const iguais = ops.filter(op => tNorm(op.getAttribute('aria-label')) === alvo);
      const k = rot.join('|');
      ultimo = { iguais: iguais.length, total: ops.length, filtrou: k !== antes, rotulos: rot };
      if (k !== chave) { chave = k; desde = Date.now(); return null; }
      const estavel = Date.now() - desde;
      if (iguais.length === 1 && estavel >= 400) return { op: iguais[0] };
      if (iguais.length > 1 && estavel >= 800) return { ambiguo: iguais.length };
      return null;
    }, timeout);
    return r || { ...ultimo, semFiltro: !ultimo.filtrou };
  }
  function tParecidos(rotulos, nome) {
    const palavras = tSemAcento(nome).split(' ').filter(w => w.length >= 3);
    const todas = rotulos.filter(r => palavras.length && palavras.every(w => tSemAcento(r).includes(w)));
    const alguma = rotulos.filter(r => palavras.some(w => tSemAcento(r).includes(w)));
    return [...new Set(todas.length ? todas : alguma)].slice(0, 5);
  }
  async function tPesquisarAtendente(nome, alvo) {
    const antes = tRotulos().join('|');
    let r = null;
    for (let tentativa = 1; tentativa <= 2; tentativa++) {
      await tAntesDeClicar();
      const campo = tInputAuto(tAutocomplete());
      if (!campo) throw new TransfSuspenso('o campo de pesquisa do atendente sumiu');
      await tDigitar(campo, nome, tentativa === 1 ? 40 : 110);
      r = await tEsperarOpcao(alvo, antes, tentativa === 1 ? TRANSF_T.filtro : TRANSF_T.opcoes);
      if (r.op) return r.op;
      if (r.ambiguo || r.iguais > 1) {
        throw new TransfSuspenso(`há ${r.ambiguo || r.iguais} atendentes chamados "${nome}" no Blip; não é possível escolher com segurança`);
      }
      if (!(r.semFiltro && tentativa === 1)) break;
      log('↻ O Blip não aplicou a pesquisa; digitando de novo, mais devagar...');
    }
    const parecidos = tParecidos(r.rotulos || [], nome);
    if (!r.total) {
      // Sem resultado visível: dica a partir de todas as opções que o Blip carregou (inclusive escondidas).
      const ac = tAutocomplete();
      const todas = [...document.querySelectorAll(TRANSF_SEL.opcao), ...(ac?.shadowRoot ? ac.shadowRoot.querySelectorAll(TRANSF_SEL.opcao) : [])]
        .map(op => op.getAttribute('aria-label') || '');
      const dica = tParecidos(todas, nome);
      throw new TransfSuspenso(`o Blip não retornou atendentes para "${nome}"` + (dica.length ? ` (nomes parecidos no Blip: ${dica.join(', ')})` : ''));
    }
    throw new TransfSuspenso(`nenhum atendente com o nome exato "${nome}" (${r.total} resultado(s)` +
      (r.semFiltro ? '; o Blip não aplicou a pesquisa' : '') +
      (parecidos.length ? `; parecidos: ${parecidos.join(', ')}` : '') + '; nome parcial não é aceito)');
  }

  async function tTransferirTicket(id, nome, alvo) {
    let confirmado = false;
    const garantirChat = etapa => {
      if (autoIndicioChatAtivo(id) === null) throw new TransfSuspenso(`o atendimento aberto deixou de ser o #${id} (${etapa})`);
    };
    try {
      const card = autoCardDoTicket(autoBotaoMenu(id));
      if (!card) throw new TransfSuspenso(`card do ticket #${id} não encontrado`);
      if (autoIndicioChatAtivo(id) === null) {
        await tAntesDeClicar();
        tClicar(card);
      }
      if (!(await tEsperar(() => autoIndicioChatAtivo(id), TRANSF_T.abrir))) {
        throw new TransfSuspenso(`não foi possível confirmar que o chat aberto é o do ticket #${id}`);
      }

      const botao = await tEsperar(() => { const b = tBotaoTransferir(); return b && b.habilitado ? b : null; }, TRANSF_T.abrir);
      if (!botao) throw new TransfSuspenso('botão de transferência não encontrado ou desabilitado');
      await tAntesDeClicar();
      garantirChat('antes de abrir a transferência');
      tClicar(botao.inner);

      const radio = await tEsperar(tRadioAtendente, TRANSF_T.modal);
      if (!radio) throw new TransfSuspenso('o modal de transferência não abriu');
      const ticketModal = tTicketDoModal(radio);
      if (ticketModal && ticketModal !== id) throw new TransfSuspenso(`o modal aberto é do ticket #${ticketModal}, esperado #${id}`);

      if (!tRadioMarcado(radio)) {
        await tAntesDeClicar();
        tClicar(radio.shadowRoot?.querySelector('label') || radio.shadowRoot?.querySelector('input[type="radio"]') || radio);
      }
      if (!(await tEsperar(() => tRadioMarcado(tRadioAtendente()), 4000))) throw new TransfSuspenso('não foi possível selecionar "Atendente"');

      const ac = await tEsperar(() => { const a = tAutocomplete(); return a && tInputAuto(a) ? a : null; }, TRANSF_T.modal);
      if (!ac) throw new TransfSuspenso('o campo "Selecionar atendente" não apareceu');
      // O modal do Blip termina de carregar depois de exibir o campo: espera mínima antes de mexer nele
      // (pausar estende; parar interrompe), depois espera a lista de atendentes estabilizar.
      await tEsperar(() => null, TRANSF_T.esperaModal);
      await tAntesDeClicar();
      await tEsperarAutocompletePronto();
      log(`🔎 Ticket #${id}: pesquisando "${nome}" no Blip...`);
      const opcao = await tPesquisarAtendente(nome, alvo); // pesquisa NO BLIP com o nome do painel

      // Clicar no nome do resultado é o que libera "Transferir ticket" no Blip.
      const alvoClique = () => opcao.isConnected ? (opcao.shadowRoot?.querySelector('div[role="button"]') || opcao) : null;
      await tAntesDeClicar();
      tClicar(alvoClique());
      const liberou = () => { const c = tConfirmar(); return c && c.habilitado; };
      if (!(await tEsperar(liberou, 2000)) && alvoClique()) {
        log('↻ O botão não liberou; clicando no nome do atendente novamente (seleção, não confirmação)...');
        await tAntesDeClicar();
        dispararCliqueReal(alvoClique());
      }
      if (!(await tEsperar(liberou, TRANSF_T.confirmar))) {
        throw new TransfSuspenso('o botão "Transferir ticket" não liberou após clicar no atendente');
      }
      if (tNorm(tInputAuto(tAutocomplete())?.value) !== alvo) {
        throw new TransfSuspenso('o atendente selecionado no Blip não corresponde ao nome informado');
      }

      // Validação final, imediatamente antes da ÚNICA confirmação.
      await tAntesDeClicar();
      garantirChat('antes de confirmar');
      const ticketModal2 = tTicketDoModal(tRadioAtendente() || tConfirmar()?.host);
      if (ticketModal2 && ticketModal2 !== id) throw new TransfSuspenso(`o modal passou a ser do ticket #${ticketModal2}`);
      if (tNorm(tInputAuto(tAutocomplete())?.value) !== alvo) throw new TransfSuspenso('a seleção de atendente mudou antes da confirmação');
      const conf = tConfirmar();
      if (!conf || !conf.habilitado) throw new TransfSuspenso('o botão "Transferir ticket" ficou desabilitado antes da confirmação');
      confirmado = true;
      tClicar(conf.inner);
      log(`📨 Ticket #${id}: transferência confirmada no Blip; aguardando a saída da lista...`);

      // Após confirmar: só observa (Parar não interrompe; não há nova tentativa).
      const saiu = await tEsperar(() => (autoBotaoMenu(id) ? null : true), TRANSF_T.resultado, false);
      if (!saiu) {
        throw new TransfSuspenso(tConfirmar()
          ? `resultado incerto para o ticket #${id}: o modal continua aberto após a confirmação (não será repetida)`
          : `o ticket #${id} continua na lista após a confirmação; verifique no Blip antes de continuar`);
      }
    } catch (err) {
      if (!confirmado) tCancelarModal();
      throw err;
    }
  }


