# Pausas do bookmarklet: o que a velocidade muda (Tarefa 7)

Critério do §8 da spec: **entra** na velocidade a pausa que é **ritmo fixo entre ações** (entre um clique e o seguinte,
entre um ticket e outro, intervalo do Atender). **Não entra** a que é **espera de UI/segurança** (esperar algo carregar ou
aparecer depois de um clique, polling, recuo depois de erro). **Na dúvida, não entra.**

- "entra" ⇒ no código a chamada é `pausaAcao(…)` (pausa ÷ velocidade, piso de 50%); "não entra" ⇒ continua `sleep(…)`.
- O teste `test/unidade/pausas-lista-fechada.test.mjs` confere esta tabela contra o código por **arquivo + função +
  valor**. A coluna de linha é a da classificação (pode andar quando o código mudar).
- Com velocidade 1.0 todos os valores são iguais aos de hoje.

Total: **68** pausas; **16** entram, **52** não entram.

| # | arquivo:linha | função | valor | decisão | motivo |
|---|---|---|---|---|---|
| 1 | `01-base.js:1025` | `fecharAvisosPendentes` | `300` | não entra (espera de UI) | Espera o aviso (toast) fechar depois do clique em OK/Fechar. |
| 2 | `01-base.js:1038` | `enviarTextoNoChat` | `CONFIG.delayAcoes` | entra (ritmo) | `delayAcoes` (§8: sempre entra). Ritmo depois de enviar a mensagem. |
| 3 | `01-base.js:1043` | `preencherCampoMensagem` | `250` | não entra (espera de UI) | Espera o campo de texto receber o foco antes de preencher. |
| 4 | `01-base.js:1049` | `preencherCampoMensagem` | `400` | não entra (espera de UI) | Espera a aplicação processar o texto (eventos input/change) antes do Enter. |
| 5 | `01-base.js:1074` | `passo2_tag` | `CONFIG.delayAcoes` | entra (ritmo) | `delayAcoes` (§8: sempre entra). Ritmo depois de abrir "Adicionar tags". |
| 6 | `01-base.js:1083` | `passo2_tag` | `200` | não entra (espera de UI) | Espera o campo da tag receber o foco. |
| 7 | `01-base.js:1090` | `passo2_tag` | `1200` | não entra (espera de UI) | Espera a pesquisa de tags do Blip devolver resultados. |
| 8 | `01-base.js:1114` | `passo2_tag` | `CONFIG.delayAcoes` | entra (ritmo) | `delayAcoes` (§8: sempre entra). Ritmo depois de selecionar a tag. |
| 9 | `01-base.js:1127` | `passo3_finalizar` | `700` | não entra (espera de UI) | Espera o modal de finalização abrir depois do clique em Finalizar. |
| 10 | `01-base.js:1146` | `passo4_confirmarModal` | `500` | não entra (espera de UI) | Estabilização do modal: o botão de confirmar acabou de aparecer (na dúvida, não entra). |
| 11 | `01-base.js:1149` | `passo4_confirmarModal` | `1000` | não entra (espera de UI) | Espera o Blip fechar o ticket depois de confirmar. |
| 12 | `01-base.js:1151` | `passo4_confirmarModal` | `CONFIG.delayTrocaTicket` | entra (ritmo) | `delayTrocaTicket` usado como ritmo entre o ticket finalizado e o próximo. |
| 13 | `01-base.js:1156` | `passo5_proximoFila` | `1500` | não entra (espera de UI) | Espera a lista atualizar depois de finalizar, antes de ler o primeiro da lista. |
| 14 | `01-base.js:1163` | `passo5_proximoFila` | `CONFIG.delayAcoes` | entra (ritmo) | `delayAcoes` (§8: sempre entra). Ritmo depois de o novo chat carregar (o `waitFor` já esperou). |
| 15 | `01-base.js:1223` | `aguardarPausaSeNecessario` | `400` | não entra (polling) | Leitura repetida enquanto o usuário mantém "Pausado". |
| 16 | `01-base.js:1253` | `fecharMenuTicket` | `150` | não entra (espera de UI) | Espera o menu do ticket fechar (Escape). |
| 17 | `01-base.js:1256` | `fecharMenuTicket` | `150` | não entra (espera de UI) | Espera o menu fechar depois do clique. |
| 18 | `01-base.js:1445` | `percorrerItensFila` | `350` | não entra (espera de UI) | Espera a lista rolar até o topo. |
| 19 | `01-base.js:1473` | `percorrerItensFila` | `1400` | não entra (espera de UI) | Espera a lista carregar mais itens depois de rolar. |
| 20 | `01-base.js:1493` | `percorrerItensFila` | `350` | entra (ritmo) | Ritmo entre um item da fila e o próximo (nada é esperado). |
| 21 | `01-base.js:1527` | `processarMoverTicket` | `150` | não entra (espera de UI) | Espera o hover revelar o botão do menu. |
| 22 | `01-base.js:1531` | `processarMoverTicket` | `250` | não entra (espera de UI) | Espera o menu dos 3 pontos abrir. |
| 23 | `01-base.js:1554` | `processarMoverTicket` | `350` | não entra (espera de UI) | Espera o submenu de pastas abrir depois do hover. |
| 24 | `01-base.js:1608` | `processarMoverTicket` | `750` | não entra (espera de UI) | "Aguarda o Blip processar a mudança de pasta" (comentário do código). |
| 25 | `01-base.js:1651` | `executarMoverParaPastaTodos` | `1200` | não entra (espera de UI) | Espera a fila carregar depois de rolar. |
| 26 | `01-base.js:1677` | `executarMoverParaPastaTodos` | `1400` | não entra (espera de UI) | Espera carregar tickets além dos pulados depois de rolar. |
| 27 | `01-base.js:1707` | `executarMoverParaPastaTodos` | `CONFIG.delayAcoes` | entra (ritmo) | `delayAcoes` (§8: sempre entra). Ritmo entre tickets movidos; o código comenta que espera a fila atualizar, o piso de 50% limita a 600 ms. |
| 28 | `01-base.js:1741` | `executarModoEsperaTodos` | `120` | não entra (espera de UI) | Espera o hover revelar o botão do menu. |
| 29 | `01-base.js:1756` | `executarModoEsperaTodos` | `150` | não entra (espera de UI) | Estabilização: a opção do menu acabou de aparecer (na dúvida, não entra). |
| 30 | `01-base.js:1759` | `executarModoEsperaTodos` | `550` | não entra (espera de UI) | Espera o Blip aplicar a espera/retomada antes de fechar avisos. |
| 31 | `01-base.js:1792` | `executarEscreverParaTodos` | `120` | não entra (espera de UI) | Espera a lista rolar até o card. |
| 32 | `01-base.js:1795` | `executarEscreverParaTodos` | `Math.max(800, CONFIG.delayTrocaTicket)` | não entra (§8: sempre de fora) | Piso `Math.max(800, delayTrocaTicket)`: espera de carregamento do chat (§8). |
| 33 | `01-base.js:1829` | `loop` | `5000` | não entra (§8: sempre de fora) | Recuo de 5000 ms depois de erro (§8). |
| 34 | `01-base.js:1989` | `executarAtendimentoAutomatico` | `250` | não entra (polling) | Leitura repetida enquanto o botão Atender está desabilitado. |
| 35 | `01-base.js:2010` | `executarAtendimentoAutomatico` | `500` | entra (ritmo) | Intervalo do Atender, 500 ms (§8: sempre entra). |
| 36 | `02-piloto.js:45` | `pilotoEtapa1_PuxarFila` | `1500` | não entra (polling) | Sentinela: leitura repetida da fila zerada. |
| 37 | `02-piloto.js:79` | `pilotoEtapa1_PuxarFila` | `250` | não entra (polling) | Leitura repetida enquanto o botão Atender está desabilitado. |
| 38 | `02-piloto.js:98` | `pilotoEtapa1_PuxarFila` | `500` | entra (ritmo) | Intervalo do Atender, 500 ms (§8: sempre entra). |
| 39 | `02-piloto.js:103` | `pilotoEtapa1_PuxarFila` | `1600` | não entra (espera de UI) | Espera os tickets renderizarem no painel. |
| 40 | `02-piloto.js:130` | `pilotoEtapa2_EnviarMensagens` | `800` | não entra (polling) | Nova leitura da lista vazia. |
| 41 | `02-piloto.js:157` | `pilotoEtapa2_EnviarMensagens` | `150` | não entra (espera de UI) | Espera a lista rolar até o card. |
| 42 | `02-piloto.js:160` | `pilotoEtapa2_EnviarMensagens` | `Math.max(800, CONFIG.delayTrocaTicket)` | não entra (§8: sempre de fora) | Piso `Math.max(800, delayTrocaTicket)`: espera de carregamento do chat (§8). |
| 43 | `02-piloto.js:173` | `pilotoEtapa2_EnviarMensagens` | `CONFIG.delayAcoes` | entra (ritmo) | `delayAcoes` (§8: sempre entra). Ritmo entre chats. |
| 44 | `02-piloto.js:178` | `pilotoEtapa2_EnviarMensagens` | `600` | entra (ritmo) | Ritmo de fim de etapa antes da próxima (nada é esperado). |
| 45 | `02-piloto.js:199` | `pilotoEtapa3_PausarTodos` | `800` | não entra (polling) | Nova leitura da lista vazia. |
| 46 | `02-piloto.js:232` | `pilotoEtapa3_PausarTodos` | `120` | não entra (espera de UI) | Espera o hover revelar o botão do menu. |
| 47 | `02-piloto.js:251` | `pilotoEtapa3_PausarTodos` | `150` | não entra (espera de UI) | Estabilização: a opção do menu acabou de aparecer (na dúvida, não entra). |
| 48 | `02-piloto.js:256` | `pilotoEtapa3_PausarTodos` | `550` | não entra (espera de UI) | Espera o Blip aplicar a espera antes de fechar avisos. |
| 49 | `02-piloto.js:264` | `pilotoEtapa3_PausarTodos` | `CONFIG.delayAcoes` | entra (ritmo) | `delayAcoes` (§8: sempre entra). Ritmo entre tickets pausados. |
| 50 | `02-piloto.js:269` | `pilotoEtapa3_PausarTodos` | `600` | entra (ritmo) | Ritmo de fim de etapa antes da próxima (nada é esperado). |
| 51 | `02-piloto.js:299` | `pilotoEtapa4_MandarPraPasta` | `1200` | não entra (espera de UI) | Espera a fila carregar depois de rolar. |
| 52 | `02-piloto.js:324` | `pilotoEtapa4_MandarPraPasta` | `1400` | não entra (espera de UI) | Espera carregar tickets além dos pulados depois de rolar. |
| 53 | `02-piloto.js:354` | `pilotoEtapa4_MandarPraPasta` | `CONFIG.delayAcoes` | entra (ritmo) | `delayAcoes` (§8: sempre entra). Ritmo entre tickets movidos. |
| 54 | `02-piloto.js:359` | `pilotoEtapa4_MandarPraPasta` | `600` | entra (ritmo) | Ritmo de fim de etapa antes da próxima (nada é esperado). |
| 55 | `02-piloto.js:429` | `executarPilotoLoop` | `1000` | não entra (§8: sempre de fora) | Pausa entre ciclos do Piloto antigo (§7: não muda com a velocidade). |
| 56 | `03-auto.js:553` | `autoConfirmarEnvio` | `250` | não entra (polling) | Leitura repetida até confirmar o envio (prazo `AUTO_T.confirmarEnvio`). |
| 57 | `03-auto.js:649` | `autoTentarPausa` | `120` | não entra (espera de UI) | Espera o hover revelar o botão do menu. |
| 58 | `03-auto.js:667` | `autoTentarPausa` | `150` | não entra (espera de UI) | Estabilização: a opção do menu acabou de aparecer (na dúvida, não entra). |
| 59 | `03-auto.js:669` | `autoTentarPausa` | `550` | não entra (espera de UI) | Espera o Blip aplicar a espera antes de fechar avisos. |
| 60 | `03-auto.js:690` | `autoVerificarPausa` | `400` | não entra (recuo após erro) | Recuo antes de verificar a pausa de novo. |
| 61 | `03-auto.js:706` | `autoPausar` | `700` | não entra (recuo após erro) | Recuo antes da 2ª tentativa de pausar. |
| 62 | `03-auto.js:727` | `autoWorker` | `AUTO_T.espera` | não entra (§8: sempre de fora) | `AUTO_T.espera`: espera de segurança (outra automação rodando), §8. |
| 63 | `03-auto.js:733` | `autoWorker` | `AUTO_T.espera` | não entra (§8: sempre de fora) | `AUTO_T.espera`: espera de segurança (rascunho no chat), §8. |
| 64 | `03-auto.js:754` | `autoWorker` | `AUTO_T.entreTickets` | entra (ritmo) | `AUTO_T.entreTickets` (§8: sempre entra). Ritmo entre um chat e outro. |
| 65 | `04-transferir-e-fechar.js:57` | `tEsperar` | `150` | não entra (polling) | Leitura repetida de `tEsperar` (prazos de `TRANSF_T`). |
| 66 | `04-transferir-e-fechar.js:97` | `tPrimeiroTicket` | `TRANSF_T.leituraVazia` | não entra (§8: sempre de fora) | `TRANSF_T.leituraVazia` (polling), §8. |
| 67 | `04-transferir-e-fechar.js:187` | `tDigitar` | `atraso` | não entra (§8: sempre de fora) | Atraso de digitação do Transferir (§8). |
| 68 | `04-transferir-e-fechar.js:197` | `tDigitar` | `atraso` | não entra (§8: sempre de fora) | Atraso de digitação do Transferir (§8). |
