  /* ========================================================
     FLUXO MONTADO PELO USUÁRIO — ADAPTADORES DO MOTOR (Tarefa 11)
     Liga o motor puro (puro/motor.js) às funções reais do bot, uma ação POR TICKET.
     Reaproveita as funções antigas; o painel antigo continua funcionando igual.
     Por enquanto só é acionado pelo gancho de teste (window.__rodBotTeste === true).
     ======================================================== */

  // Chats novos entregues pelo observador do Auto (modo consumidor) para o motor 🆕/👥.
  const fluxoNovos = [];

  // Lê pelo menu do ticket se ele está em espera: 'pausado' | 'ativo' | null (não deu para ler).
  async function fluxoLerEspera(id) {
    const alvo = autoBotaoMenu(id);
    if (!alvo) return null;
    const wrap = alvo.closest('.ticket-menu') || alvo.parentElement;
    const card = autoCardDoTicket(alvo) || wrap;
    card?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    card?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    wrap?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await sleep(120);
    if (!menuEstaAberto(wrap)) clickUnico(alvo);
    const estado = await waitFor(() => {
      if (encontrarOpcaoMenu(wrap, AUTO_SEL.opcaoDespausar)) return 'pausado';
      if (encontrarOpcaoMenu(wrap, AUTO_SEL.opcaoPausar)) return 'ativo';
      return null;
    }, AUTO_T.menu, 100).catch(() => null);
    await fecharMenuTicket(wrap, alvo);
    return estado;
  }

  function fluxoListarTickets() {
    const leitura = autoColetarTickets();
    const lista = leitura.ids.map(id => ({ id, pausado: null }));
    for (let i = 0; i < leitura.semIdentidade; i++) lista.push({ id: null, pausado: null });
    return lista;
  }

  // Puxa a fila até zerar (mesma lógica do "Atender" antigo, sem mexer no estado global do painel).
  async function fluxoAtender() {
    let atendidos = 0;
    let desabilitadoDesde = 0;
    for (;;) {
      if (!(await aguardarPausaSeNecessario())) break;
      const antes = obterContagemFila();
      atualizarBadgeFila();
      if (antes !== null && antes <= 0) break;
      const btn = obterBotaoAtender();
      if (!btn || !btn.host) throw ErroGeral('botão "Atender" (#claim-ticket-button) não encontrado');
      if (btn.disabled) {
        desabilitadoDesde = desabilitadoDesde || Date.now();
        if (Date.now() - desabilitadoDesde > 10000) break; // contador ilegível e botão travado: segue o fluxo
        await sleep(250);
        continue;
      }
      desabilitadoDesde = 0;
      const alvoClique = btn.inner || btn.host;
      dispararCliqueReal(alvoClique);
      if (btn.host !== alvoClique) dispararCliqueReal(btn.host);
      atendidos++;
      const resta = obterContagemFila();
      log(`📥 [Atender #${atendidos}]${resta !== null ? ` Fila: ${resta}` : ''}`);
      if (resta !== null && resta <= 0) break;
      await pausaAcao(500);
    }
    atualizarBadgeFila();
    return { atendidos };
  }

  // Envia (e, em "Enviar + Finalizar", aplica a tag e finaliza) no chat do ticket `id`.
  // Só devolve ok depois de CONFIRMAR o envio na interface (campo vazio + texto novo na conversa).
  async function fluxoEnviar(id, op) {
    const msg = (op.mensagem || '').trim();
    if (!autoBotaoMenu(id)) return { ok: false, motivo: 'o ticket saiu da lista; nada enviado' };
    const espera = await fluxoLerEspera(id);
    if (espera === 'pausado') return { ok: true, pulado: true, nota: 'em espera: não recebe mensagem' };
    const card = autoCardDoTicket(autoBotaoMenu(id));
    if (!card) return { ok: false, motivo: 'card do ticket não encontrado; nada enviado' };
    if (autoTemRascunho(msg)) return { ok: false, motivo: 'há texto digitado no chat aberto; nada foi trocado' };

    if (autoIndicioChatAtivo(id) === null) clickUnico(card);
    const indicio = await waitFor(() => autoIndicioChatAtivo(id), AUTO_T.chatAtivo, 200).catch(() => null);
    if (!indicio) return { ok: false, motivo: 'não foi possível confirmar que o chat aberto é deste ticket; nada enviado' };
    const input = await waitFor(() => {
      const el = autoCampoTexto();
      return el && !el.disabled && isElementoVisivel(el) ? el : null;
    }, AUTO_T.campo, 200).catch(() => null);
    if (!input) return { ok: false, motivo: 'campo de mensagem indisponível; nada enviado' };
    if (autoTemRascunho(msg)) return { ok: false, motivo: 'o chat do cliente tem um rascunho; o texto não foi alterado' };

    if (input.value !== msg) await preencherCampoMensagem(input, msg);
    if (autoCampoTexto() !== input || autoIndicioChatAtivo(id) === null) {
      autoLimparSeNosso(input, msg);
      return { ok: false, motivo: 'o chat aberto mudou durante o preenchimento; nada enviado' };
    }
    if (input.value !== msg) return { ok: false, motivo: 'o texto do campo foi alterado manualmente; nada enviado' };

    const antes = autoContarOcorrencias(msg);
    dispararEnvioEnter(input);
    const resultado = await autoConfirmarEnvio(input, msg, antes);
    if (resultado !== 'confirmado') {
      autoLimparSeNosso(input, msg);
      return {
        ok: false,
        motivo: resultado === 'nao_enviado'
          ? 'o envio não ocorreu (texto permaneceu no campo)'
          : 'envio sem confirmação na interface; sem reenvio',
      };
    }
    log(`✉️ #${id}: mensagem enviada e confirmada.`);
    if (op.modo === 'finalizar') {
      await passo2_tag(op.tag);
      await passo3_finalizar();
      await passo4_confirmarModal();
      log(`🏁 #${id}: finalizado.`);
    }
    await pausaAcao(CONFIG.delayAcoes);
    return { ok: true };
  }

  // Despausar pelo menu do ticket (o caminho inverso de autoTentarPausa).
  async function fluxoDespausar(id) {
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
      const t = encontrarOpcaoMenu(wrap, AUTO_SEL.opcaoDespausar);
      if (t) return { tipo: 'alvo', el: t };
      const o = encontrarOpcaoMenu(wrap, AUTO_SEL.opcaoPausar);
      if (o) return { tipo: 'oposto', el: o };
      return null;
    }, AUTO_T.menu, 100).catch(() => null);
    if (!acao) {
      await fecharMenuTicket(wrap, alvo);
      return { ok: false, motivo: 'opção de espera não apareceu no menu' };
    }
    if (acao.tipo === 'oposto') {
      await fecharMenuTicket(wrap, alvo);
      return { ok: true, nota: 'já estava fora de espera' };
    }
    const innerBtn = acao.el.shadowRoot?.querySelector('button.menuaction__button, button') || acao.el;
    await sleep(150);
    clickUnico(innerBtn);
    await sleep(550);
    await fecharAvisosPendentes();
    const verif = await fluxoLerEspera(id);
    if (verif === 'ativo') {
      await pausaAcao(CONFIG.delayAcoes);
      return { ok: true };
    }
    return { ok: false, motivo: 'não foi possível confirmar que saiu da espera' };
  }

  async function fluxoPausar(id) {
    const r = await autoTentarPausa(id);
    if (r.ok) await pausaAcao(CONFIG.delayAcoes);
    return r;
  }

  async function fluxoMover(id, pasta) {
    const alvo = autoBotaoMenu(id);
    if (!alvo) return { ok: false, motivo: 'ticket não encontrado na lista' };
    const r = await processarMoverTicket(alvo, pasta, normalizarTexto(pasta), `#${id}`, 0);
    if (r === 'alterado') {
      await pausaAcao(CONFIG.delayAcoes);
      return { ok: true };
    }
    return { ok: false, motivo: r === 'parado' ? 'interrompido' : `não foi possível mover para "${pasta}"` };
  }

  async function fluxoTransferir(id, nome) {
    try {
      await tTransferirTicket(id, nome, tNorm(nome));
      return { ok: true };
    } catch (err) {
      if (err instanceof TransfInterrompido) return { ok: false, motivo: err.message };
      // TransfSuspenso no Transferir antigo suspende a transferência em massa: aqui é falha geral do passo
      throw ErroGeral(err.message);
    }
  }

  async function fluxoEntreChats() {
    await pausaAcao(AUTO_T.entreTickets);
  }

  const FLUXO_ACOES = {
    definirVelocidade: v => definirVelocidadeAtual(v),
    contar: () => {
      const leitura = autoColetarTickets();
      return { fila: obterContagemFila(), naTela: leitura.ids.length + leitura.semIdentidade, pausados: null };
    },
    filaAtual: () => obterContagemFila(),
    atender: fluxoAtender,
    listarTickets: fluxoListarTickets,
    enviar: fluxoEnviar,
    pausar: fluxoPausar,
    despausar: fluxoDespausar,
    mover: fluxoMover,
    transferir: fluxoTransferir,
    novosChats: () => fluxoNovos.splice(0, fluxoNovos.length),
    entreChats: fluxoEntreChats,
    memoria24h: {
      tem: id => { const r = autoLerTickets()[id]; return !!(r && (r.fluxo || r.envio)); },
      gravar: id => autoGravarTicket(id, { contado: true, fluxo: true }),
    },
  };

  const fluxoEventos = []; // [{ tipo:'passo'|'ciclo', ... }] para o Acompanhar (Tarefa 21) e os testes

  async function fluxoIniciar(fluxo) {
    if (rodando || auto.atual || auto.ativo) return { status: 'recusado', ciclos: 0, motivo: 'Já há um fluxo rodando' };
    const porChat = fluxo && fluxo.paraQuem !== 'aguardando';
    rodando = true;
    pausado = false;
    modoAtual = 'fluxo';
    fluxoEventos.length = 0;
    fluxoNovos.length = 0;
    ativarWakeLock();
    atualizarBotoesEstado(true, 'Fluxo em execução');
    cntEl.textContent = '0';
    if (porChat) autoAtivar(id => fluxoNovos.push(id));
    try {
      const r = await executarFluxo(fluxo, {
        acoes: FLUXO_ACOES,
        relogio: { esperar: ms => sleep(ms) },
        controle: { parado: () => !rodando || painelFechado, aguardar: aguardarPausaSeNecessario },
        eventos: {
          log,
          passo: (indice, status, detalhe) => fluxoEventos.push({ tipo: 'passo', indice, status, detalhe }),
          ciclo: n => fluxoEventos.push({ tipo: 'ciclo', n }),
        },
      });
      log(`🏁 Fluxo ${r.status}${r.motivo ? `: ${r.motivo}` : ''}.`);
      return r;
    } finally {
      if (porChat) autoDesativar();
      definirVelocidadeAtual(1);
      rodando = false;
      pausado = false;
      modoAtual = null;
      await liberarWakeLock();
      atualizarBotoesEstado(false);
    }
  }

  // Gancho de teste (§12.4): só existe quando o teste define window.__rodBotTeste = true ANTES de injetar.
  if (window.__rodBotTeste === true) {
    window.__rodBot = {
      executarFluxo: fluxo => fluxoIniciar(fluxo),
      eventos: () => fluxoEventos.slice(),
      parar: () => pararExecucao(),
    };
  }

