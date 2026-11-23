# Pausas do bookmarklet: o que a velocidade muda (Tarefa 7)

Critério do §8 da spec: **entra** na velocidade a pausa que é **ritmo fixo entre ações** (entre um clique e o seguinte,
entre um ticket e outro, intervalo do Atender). **Não entra** a que é **espera de UI/segurança** (esperar algo carregar ou
aparecer depois de um clique, polling, recuo depois de erro). **Na dúvida, não entra.**

- "entra" ⇒ no código a chamada é `pausaAcao(…)` (pausa ÷ velocidade, piso de 50%); "não entra" ⇒ continua `sleep(…)`.
- O teste `test/unidade/pausas-lista-fechada.test.mjs` confere esta tabela contra o código por **arquivo + função +
  valor**. A coluna de linha é a da classificação (pode andar quando o código mudar).
- Com velocidade 1.0 todos os valores são iguais aos de hoje.

Total: **43** pausas; **11** entram, **32** não entram (Tarefa 22: saíram as 36 do painel antigo removido).

| # | arquivo:linha | função | valor | decisão | motivo |
|---|---|---|---|---|---|
| 1 | `01-base.js:681` | `fecharAvisosPendentes` | `300` | não entra (espera de UI) | Espera o aviso (toast) fechar depois do clique em OK/Fechar. |
| 2 | `01-base.js:694` | `enviarTextoNoChat` | `CONFIG.delayAcoes` | entra (ritmo) | `delayAcoes` (§8: sempre entra). Ritmo depois de enviar a mensagem. |
| 3 | `01-base.js:699` | `preencherCampoMensagem` | `250` | não entra (espera de UI) | Espera o campo de texto receber o foco antes de preencher. |
| 4 | `01-base.js:705` | `preencherCampoMensagem` | `400` | não entra (espera de UI) | Espera a aplicação processar o texto (eventos input/change) antes do Enter. |
| 5 | `01-base.js:723` | `passo2_tag` | `CONFIG.delayAcoes` | entra (ritmo) | `delayAcoes` (§8: sempre entra). Ritmo depois de abrir "Adicionar tags". |
| 6 | `01-base.js:732` | `passo2_tag` | `200` | não entra (espera de UI) | Espera o campo da tag receber o foco. |
| 7 | `01-base.js:739` | `passo2_tag` | `1200` | não entra (espera de UI) | Espera a pesquisa de tags do Blip devolver resultados. |
| 8 | `01-base.js:763` | `passo2_tag` | `CONFIG.delayAcoes` | entra (ritmo) | `delayAcoes` (§8: sempre entra). Ritmo depois de selecionar a tag. |
| 9 | `01-base.js:776` | `passo3_finalizar` | `700` | não entra (espera de UI) | Espera o modal de finalização abrir depois do clique em Finalizar. |
| 10 | `01-base.js:795` | `passo4_confirmarModal` | `500` | não entra (espera de UI) | Estabilização do modal: o botão de confirmar acabou de aparecer (na dúvida, não entra). |
| 11 | `01-base.js:798` | `passo4_confirmarModal` | `1000` | não entra (espera de UI) | Espera o Blip fechar o ticket depois de confirmar. |
| 12 | `01-base.js:800` | `passo4_confirmarModal` | `CONFIG.delayTrocaTicket` | entra (ritmo) | `delayTrocaTicket` usado como ritmo entre o ticket finalizado e o próximo. |
| 13 | `01-base.js:816` | `aguardarPausaSeNecessario` | `400` | não entra (polling) | Leitura repetida enquanto o usuário mantém "Pausado". |
| 14 | `01-base.js:846` | `fecharMenuTicket` | `150` | não entra (espera de UI) | Espera o menu do ticket fechar (Escape). |
| 15 | `01-base.js:849` | `fecharMenuTicket` | `150` | não entra (espera de UI) | Espera o menu fechar depois do clique. |
| 16 | `01-base.js:1025` | `processarMoverTicket` | `150` | não entra (espera de UI) | Espera o hover revelar o botão do menu. |
| 17 | `01-base.js:1029` | `processarMoverTicket` | `250` | não entra (espera de UI) | Espera o menu dos 3 pontos abrir. |
| 18 | `01-base.js:1052` | `processarMoverTicket` | `350` | não entra (espera de UI) | Espera o submenu de pastas abrir depois do hover. |
| 19 | `01-base.js:1105` | `processarMoverTicket` | `750` | não entra (espera de UI) | "Aguarda o Blip processar a mudança de pasta" (comentário do código). |
| 20 | `03-auto.js:557` | `autoConfirmarEnvio` | `250` | não entra (polling) | Leitura repetida até confirmar o envio (prazo `AUTO_T.confirmarEnvio`). |
| 21 | `03-auto.js:653` | `autoTentarPausa` | `120` | não entra (espera de UI) | Espera o hover revelar o botão do menu. |
| 22 | `03-auto.js:671` | `autoTentarPausa` | `150` | não entra (espera de UI) | Estabilização: a opção do menu acabou de aparecer (na dúvida, não entra). |
| 23 | `03-auto.js:673` | `autoTentarPausa` | `550` | não entra (espera de UI) | Espera o Blip aplicar a espera antes de fechar avisos. |
| 24 | `03-auto.js:694` | `autoVerificarPausa` | `400` | não entra (recuo após erro) | Recuo antes de verificar a pausa de novo. |
| 25 | `03-auto.js:710` | `autoPausar` | `700` | não entra (recuo após erro) | Recuo antes da 2ª tentativa de pausar. |
| 26 | `03-auto.js:731` | `autoWorker` | `AUTO_T.espera` | não entra (§8: sempre de fora) | `AUTO_T.espera`: espera de segurança (outra automação rodando), §8. |
| 27 | `03-auto.js:737` | `autoWorker` | `AUTO_T.espera` | não entra (§8: sempre de fora) | `AUTO_T.espera`: espera de segurança (rascunho no chat), §8. |
| 28 | `03-auto.js:758` | `autoWorker` | `AUTO_T.entreTickets` | entra (ritmo) | `AUTO_T.entreTickets` (§8: sempre entra). Ritmo entre um chat e outro. |
| 29 | `04-transferir.js:50` | `tEsperar` | `150` | não entra (polling) | Leitura repetida de `tEsperar` (prazos de `TRANSF_T`). |
| 30 | `04-transferir.js:90` | `tPrimeiroTicket` | `TRANSF_T.leituraVazia` | não entra (§8: sempre de fora) | `TRANSF_T.leituraVazia` (polling), §8. |
| 31 | `04-transferir.js:180` | `tDigitar` | `atraso` | não entra (§8: sempre de fora) | Atraso de digitação do Transferir (§8). |
| 32 | `04-transferir.js:190` | `tDigitar` | `atraso` | não entra (§8: sempre de fora) | Atraso de digitação do Transferir (§8). |
| 33 | `05-fluxo.js:20` | `fluxoLerEspera` | `120` | não entra (espera de UI) | Espera o hover revelar o botão do menu (igual ao Auto). |
| 34 | `05-fluxo.js:52` | `fluxoAtender` | `250` | não entra (polling) | Leitura repetida enquanto o botão Atender está desabilitado. |
| 35 | `05-fluxo.js:63` | `fluxoAtender` | `500` | entra (ritmo) | Intervalo do Atender, 500 ms (§8: sempre entra). |
| 36 | `05-fluxo.js:116` | `fluxoEnviar` | `CONFIG.delayAcoes` | entra (ritmo) | `delayAcoes` (§8: sempre entra). Ritmo depois de enviar (e finalizar). |
| 37 | `05-fluxo.js:129` | `fluxoDespausar` | `120` | não entra (espera de UI) | Espera o hover revelar o botão do menu. |
| 38 | `05-fluxo.js:147` | `fluxoDespausar` | `150` | não entra (espera de UI) | Estabilização: a opção do menu acabou de aparecer (na dúvida, não entra). |
| 39 | `05-fluxo.js:149` | `fluxoDespausar` | `550` | não entra (espera de UI) | Espera o Blip aplicar a retomada antes de fechar avisos. |
| 40 | `05-fluxo.js:153` | `fluxoDespausar` | `CONFIG.delayAcoes` | entra (ritmo) | `delayAcoes` (§8: sempre entra). Ritmo entre tickets despausados. |
| 41 | `05-fluxo.js:162` | `fluxoPausar` | `CONFIG.delayAcoes` | entra (ritmo) | `delayAcoes` (§8: sempre entra). Ritmo entre tickets pausados. |
| 42 | `05-fluxo.js:171` | `fluxoMover` | `CONFIG.delayAcoes` | entra (ritmo) | `delayAcoes` (§8: sempre entra). Ritmo entre tickets movidos. |
| 43 | `05-fluxo.js:189` | `fluxoEntreChats` | `AUTO_T.entreTickets` | entra (ritmo) | `AUTO_T.entreTickets` (§8: sempre entra). Ritmo entre um chat e outro (🆕/👥). |
