  /* ========================================================
     PILOTO AUTOMÁTICO - PIPELINE VISUAL & LOOP CONTÍNUO
     ======================================================== */
  let pilotoCiclo = 0;

  function resetarStepper() {
    atualizarStepper(1, 'idle', 'Aguardando');
    atualizarStepper(2, 'idle', 'Pendente');
    atualizarStepper(3, 'idle', 'Pendente');
    atualizarStepper(4, 'idle', 'Pendente');
  }

  function atualizarStepper(stepNum, status, badgeText) {
    const stepEl = document.getElementById(`ba-step-${stepNum}`);
    const statusEl = document.getElementById(`ba-status-${stepNum}`);
    if (stepEl) stepEl.setAttribute('data-status', status);
    if (statusEl && badgeText) statusEl.textContent = badgeText;
  }

  async function pilotoEtapa1_PuxarFila() {
    atualizarStepper(1, 'active', 'Verificando fila...');
    log('📥 [Etapa 1/4] Verificando fila de atendimento...');

    let count = obterContagemFila();
    atualizarBadgeFila();

    // Se a fila já está zerada (0)
    if (count !== null && count <= 0) {
      const chatsAbertos = document.querySelectorAll('article.chat-list-item, button.ticket-info-options').length;
      if (chatsAbertos > 0) {
        log(`ℹ️ Fila zerada (0), porém há ${chatsAbertos} ticket(s) ativo(s) na tela. Prosseguindo...`);
        atualizarStepper(1, 'done', 'Fila zerada (0)');
        return true;
      }

      // Modo Sentinela se não há clientes
      atualizarStepper(1, 'waiting', '👁️ Sentinela: fila vazia');
      setSt('👁️ Sentinela', '#f59e0b');
      const loopDesc = document.getElementById('ba-loop-desc');
      if (loopDesc) loopDesc.textContent = '👁️ Fila zerada (0). Sentinela vigiando até surgir novo cliente (1+)...';
      log('👁️ [Sentinela] Fila zerada (0). Aguardando novo cliente na fila...');

      while (rodando) {
        if (!(await aguardarPausaSeNecessario())) return false;
        await sleep(1500);
        count = obterContagemFila();
        atualizarBadgeFila();
        if (count !== null && count > 0) {
          log(`🔔 [Sentinela] Detectado(s) ${count} cliente(s) na fila! Iniciando atendimento...`);
          setSt('Rodando', '#16a34a');
          if (loopDesc) loopDesc.textContent = `Ciclo #${pilotoCiclo} em andamento. Puxando ${count} cliente(s)...`;
          break;
        }
      }
      if (!rodando) return false;
    }

    atualizarStepper(1, 'active', `Puxando (${count ?? '...'})`);
    let solicitados = 0;

    while (rodando) {
      if (!(await aguardarPausaSeNecessario())) return false;

      const cAtual = obterContagemFila();
      atualizarBadgeFila();
      if (cAtual !== null && cAtual <= 0) {
        log('🎉 A contagem da fila chegou a 0!');
        break;
      }

      const btnInfo = obterBotaoAtender();
      if (!btnInfo || !btnInfo.host) {
        log('⚠️ Botão "Atender" (#claim-ticket-button) não localizado.');
        break;
      }

      if (btnInfo.disabled) {
        if (cAtual !== null && cAtual <= 0) break;
        await sleep(250);
        continue;
      }

      const target = btnInfo.inner || btnInfo.host;
      dispararCliqueReal(target);
      if (btnInfo.host !== target) dispararCliqueReal(btnInfo.host);

      solicitados++;
      cntEl.textContent = solicitados;
      atualizarStepper(1, 'active', `Puxando (Restam: ${cAtual !== null ? cAtual : '?'})`);
      log(`📥 [Atender #${solicitados}]${cAtual !== null ? ` Fila atual: ${cAtual}` : ''}`);

      const rest = obterContagemFila();
      if (rest !== null && rest <= 0) {
        log('🎉 A contagem da fila chegou a 0!');
        break;
      }

      await pausaAcao(500);
    }

    atualizarStepper(1, 'done', 'Fila zerada (0)');
    log('⏳ Aguardando tickets renderizarem no painel...');
    await sleep(1600);
    return true;
  }

  async function pilotoEtapa2_EnviarMensagens() {
    const mensagem = (CONFIG.mensagem || pilotMsgEl?.value || msgEl?.value || '').trim();
    if (!mensagem) {
      log('ℹ️ Nenhuma mensagem definida no piloto. Avançando...');
      atualizarStepper(2, 'done', 'Sem mensagem');
      return true;
    }

    atualizarStepper(2, 'active', 'Carregando chats...');
    log('✉️ [Etapa 2/4] Enviando mensagem em todos os chats ativos...');

    const processados = new Set();
    let enviados = 0;
    let scrollContainer = obterScrollContainerGeral();
    let tentativasVazio = 0;

    while (rodando) {
      if (!(await aguardarPausaSeNecessario())) return false;

      const cards = [...document.querySelectorAll('article.chat-list-item')];
      if (cards.length === 0) {
        tentativasVazio++;
        if (tentativasVazio <= 3) {
          await sleep(800);
          continue;
        }
        log('ℹ️ Nenhum chat ativo encontrado para envio de mensagem.');
        break;
      }

      let alvo = null;
      let chave = '';
      for (let i = 0; i < cards.length; i++) {
        const c = cards[i];
        const k = obterChaveElemento(c, i);
        if (!processados.has(k)) {
          alvo = c;
          chave = k;
          break;
        }
      }

      if (!alvo) break;

      processados.add(chave);
      tentativasVazio = 0;
      const nome = alvo.getAttribute('aria-label') || chave;
      atualizarStepper(2, 'active', `Enviando (${enviados + 1})`);

      rolarCardNoContainer(alvo, scrollContainer);
      await sleep(150);
      clickUnico(alvo);
      log(`👤 [${enviados + 1}] Chat selecionado: ${nome}`);
      await sleep(Math.max(800, CONFIG.delayTrocaTicket));

      if (!(await aguardarPausaSeNecessario())) return false;

      try {
        await enviarTextoNoChat(mensagem);
        enviados++;
        cntEl.textContent = enviados;
      } catch (err) {
        log(`⚠️ Não foi possível enviar texto para ${nome}: ${err.message}`);
        await fecharAvisosPendentes();
      }

      await pausaAcao(CONFIG.delayAcoes);
    }

    atualizarStepper(2, 'done', `Enviados (${enviados})`);
    log(`✅ [Etapa 2/4 Concluída] Mensagens enviadas: ${enviados}.`);
    await pausaAcao(600);
    return true;
  }

  async function pilotoEtapa3_PausarTodos() {
    atualizarStepper(3, 'active', 'Localizando tickets...');
    log('⏸️ [Etapa 3/4] Colocando todos os clientes em espera (standby)...');

    const processados = new Set();
    let pausados = 0;
    let jaPausados = 0;
    let scrollContainer = obterScrollContainerGeral();
    let tentativasVazio = 0;

    while (rodando) {
      if (!(await aguardarPausaSeNecessario())) return false;

      const botoes = [...document.querySelectorAll('button.ticket-info-options')];
      if (botoes.length === 0) {
        tentativasVazio++;
        if (tentativasVazio <= 3) {
          await sleep(800);
          continue;
        }
        log('ℹ️ Nenhum ticket encontrado para pausar.');
        break;
      }

      let alvo = null;
      let chave = '';
      for (let i = 0; i < botoes.length; i++) {
        const b = botoes[i];
        const k = obterChaveElemento(b, i);
        if (!processados.has(k)) {
          alvo = b;
          chave = k;
          break;
        }
      }

      if (!alvo) break;

      processados.add(chave);
      tentativasVazio = 0;

      const wrap = alvo.closest('.ticket-menu') || alvo.parentElement;
      const card = alvo.closest('article.chat-list-item, [class*="chat-list-item"], [class*="ticket"]') || wrap;
      const labelId = alvo.id ? `#${alvo.id.replace('menu-', '')}` : chave;

      atualizarStepper(3, 'active', `Pausando (${pausados + 1})`);
      rolarCardNoContainer(card, scrollContainer);
      card?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      card?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      wrap?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      await sleep(120);

      clickUnico(alvo);

      const acaoEncontrada = await waitFor(() => {
        const t = encontrarOpcaoMenu(wrap, 'option-setStandbyMode');
        if (t) return { tipo: 'alvo', el: t };
        const o = encontrarOpcaoMenu(wrap, 'option-unsetStandbyMode');
        if (o) return { tipo: 'oposto', el: o };
        return null;
      }, 3500, 100);

      if (!(await aguardarPausaSeNecessario())) {
        await fecharMenuTicket(wrap, alvo);
        return false;
      }

      if (acaoEncontrada && acaoEncontrada.tipo === 'alvo') {
        const innerBtn = acaoEncontrada.el.shadowRoot?.querySelector('button.menuaction__button, button') || acaoEncontrada.el;
        await sleep(150);
        clickUnico(innerBtn);
        pausados++;
        cntEl.textContent = pausados;
        log(`⏸️ Ticket ${labelId} colocado em espera! (${pausados})`);
        await sleep(550);
        await fecharAvisosPendentes();
      } else {
        jaPausados++;
        log(`⏭️ Ticket ${labelId} já estava em espera.`);
        await fecharMenuTicket(wrap, alvo);
      }

      await pausaAcao(CONFIG.delayAcoes);
    }

    atualizarStepper(3, 'done', `Pausados (${pausados})`);
    log(`✅ [Etapa 3/4 Concluída] ${pausados} ticket(s) pausado(s)${jaPausados ? `, ${jaPausados} já estavam pausados` : ''}.`);
    await pausaAcao(600);
    return true;
  }

  async function pilotoEtapa4_MandarPraPasta() {
    const pasta = (CONFIG.pastaDestino || pilotFolderEl?.value || folderEl?.value || '').trim();
    if (!pasta) {
      log('⚠️ Nenhuma pasta configurada. Pulando movimentação...');
      atualizarStepper(4, 'done', 'Sem pasta');
      return true;
    }

    const alvoNorm = normalizarTexto(pasta);
    atualizarStepper(4, 'active', `Movendo → ${pasta}`);
    log(`📁 [Etapa 4/4] Movendo todos os tickets para a pasta "${pasta}"...`);

    let alterados = 0;
    let pulados = 0;
    const falhasSeguidas = new Map();
    let tentativasSemTickets = 0;

    while (rodando) {
      if (!(await aguardarPausaSeNecessario())) return false;

      const lista = [...document.querySelectorAll('button.ticket-info-options')];
      if (lista.length === 0) {
        tentativasSemTickets++;
        if (tentativasSemTickets <= 4) {
          log(`⏳ Carregando fila (${tentativasSemTickets}/4)...`);
          await rolarFila();
          await sleep(1200);
          continue;
        }
        log('🏁 Todos os tickets foram movidos para a pasta!');
        break;
      }

      let alvo = null;
      let chave = '';
      for (let i = 0; i < lista.length; i++) {
        const item = lista[i];
        const k = obterChaveElemento(item, i);
        const falhas = falhasSeguidas.get(k) || 0;
        if (falhas < 2) {
          alvo = item;
          chave = k;
          break;
        }
      }

      if (!alvo) {
        tentativasSemTickets++;
        if (tentativasSemTickets <= 3) {
          log(`⏳ Carregando tickets (${tentativasSemTickets}/3)...`);
          await rolarFila();
          await sleep(1400);
          continue;
        }
        log('🏁 Todos os tickets restantes foram movidos ou pulados.');
        break;
      }

      tentativasSemTickets = 0;
      const labelId = alvo.id ? `#${alvo.id.replace('menu-', '')}` : chave;

      try {
        const res = await processarMoverTicket(alvo, pasta, alvoNorm, labelId, alterados);
        if (res === 'alterado') {
          alterados++;
          cntEl.textContent = alterados;
          atualizarStepper(4, 'active', `Movidos: ${alterados}`);
          falhasSeguidas.delete(chave);
        } else {
          pulados++;
          const f = falhasSeguidas.get(chave) || 0;
          falhasSeguidas.set(chave, f + 1);
        }
      } catch (err) {
        log(`❌ Erro no ticket ${labelId}: ${err.message}`);
        pulados++;
        const f = falhasSeguidas.get(chave) || 0;
        falhasSeguidas.set(chave, f + 1);
        await fecharAvisosPendentes();
      }

      await pausaAcao(CONFIG.delayAcoes);
    }

    atualizarStepper(4, 'done', `Movidos (${alterados})`);
    log(`✅ [Etapa 4/4 Concluída] ${alterados} ticket(s) movido(s) para "${pasta}"${pulados ? `, ${pulados} pulado(s)` : ''}.`);
    await pausaAcao(600);
    return true;
  }

  async function executarPilotoLoop() {
    if (rodando) {
      rodando = false;
      pausado = false;
      log('⏹ Interrompendo piloto automático...');
      return;
    }

    const pasta = (CONFIG.pastaDestino || pilotFolderEl?.value || folderEl?.value || '').trim();
    if (!pasta) {
      log('⚠️ Digite o nome da pasta de destino antes de iniciar o Piloto.');
      if (pilotFolderEl) pilotFolderEl.focus();
      return;
    }
    CONFIG.pastaDestino = pasta;
    saveRecentFolder(pasta);

    const msg = (CONFIG.mensagem || pilotMsgEl?.value || msgEl?.value || '').trim();
    CONFIG.mensagem = msg;

    rodando = true;
    pausado = false;
    modoAtual = 'piloto';
    pilotoCiclo = 0;
    ativarWakeLock();
    atualizarBotoesEstado(true, '⚡ Piloto Contínuo');

    const loopCard = document.getElementById('ba-loop-card');
    if (loopCard) loopCard.classList.add('active');

    const loopDesc = document.getElementById('ba-loop-desc');

    log('🚀 PILOTO AUTOMÁTICO INICIADO EM LOOP CONTÍNUO!');
    log(`📂 Pasta Destino: "${pasta}" | ✉️ Mensagem: ${msg ? 'Ativa' : 'Desativada (apenas mover)'}`);

    try {
      while (rodando) {
        pilotoCiclo++;
        const cycleBadge = document.getElementById('ba-pilot-cycle-badge');
        if (cycleBadge) cycleBadge.textContent = `Ciclo: #${pilotoCiclo}`;
        if (loopDesc) loopDesc.textContent = `Ciclo #${pilotoCiclo} em andamento. Executando as 4 etapas...`;

        log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        log(`🔄 INICIANDO CICLO #${pilotoCiclo} DO PILOTO`);
        log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        resetarStepper();

        // 1. Puxar fila até zerar (sentinela se tiver 0)
        const ok1 = await pilotoEtapa1_PuxarFila();
        if (!ok1 || !rodando) break;

        // 2. Só enviar mensagem sem finalizar
        const ok2 = await pilotoEtapa2_EnviarMensagens();
        if (!ok2 || !rodando) break;

        // 3. Pausar todos os clientes
        const ok3 = await pilotoEtapa3_PausarTodos();
        if (!ok3 || !rodando) break;

        // 4. Mover todos para a pasta configurada
        const ok4 = await pilotoEtapa4_MandarPraPasta();
        if (!ok4 || !rodando) break;

        log(`🎉 Ciclo #${pilotoCiclo} concluído com sucesso!`);
        if (loopDesc) loopDesc.textContent = `Ciclo #${pilotoCiclo} concluído! Verificando fila para o próximo ciclo...`;
        await sleep(1000);
      }
    } catch (err) {
      log(`❌ Erro no loop do piloto: ${err.message}`);
    } finally {
      rodando = false;
      pausado = false;
      modoAtual = null;
      await liberarWakeLock();
      atualizarBotoesEstado(false);
      resetarStepper();

      if (loopCard) loopCard.classList.remove('active');
      if (loopDesc) loopDesc.textContent = 'Repete o fluxo. Se fila = 0, vigia até surgir 1 ou + clientes.';
      log(`🏁 Piloto automático parado. Total de ciclos: ${pilotoCiclo}.`);
    }
  }

  btnPilotStart.onclick = () => {
    if (!rodando && autoBloqueiaOutras()) return;
    executarPilotoLoop();
  };

  btnClaimAuto.onclick = () => {
    if (rodando || autoBloqueiaOutras()) return;
    executarAtendimentoAutomatico();
  };

