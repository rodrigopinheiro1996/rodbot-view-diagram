# Entrega — novo Piloto do rod bot (fluxo montado pelo usuário)

Branch `claude/admiring-newton-97ebst`. Fonte única: `docs/plano/spec-piloto.md`. Plano e andamento: `docs/plano/plano-piloto.md`.

> **Resumo para o BM.** O `rodbot-final.html` desta branch já é o painel novo (🧩 Montar | 📊 Acompanhar). Tudo foi testado
> numa **página falsa do Blip**, nunca no Blip real. Antes de liberar para a equipe, faça o **checklist** abaixo com
> **tickets de teste**. Se algo der errado, volte ao HTML anterior (ver "Como voltar atrás").

## 1. O que mudou para quem usa

- O painel abre em **🧩 Montar**: escolha o fluxo (⭐ Piloto clássico, ⭐ Auto clássico ou um salvo), "Para quem?"
  (⏳ Aguardando · 🆕 Que vão cair · 👥 Ambos), toque nos ícones da paleta para adicionar passos (📥 Atender, ✉️ Enviar,
  ⏸️ Espera, 📁 Mover, 🔁 Transferir), preencha os campos e toque em **⚡ Iniciar fluxo**.
- O painel pula sozinho para **📊 Acompanhar**: passo a passo com o status de cada passo, ciclo, contadores do Auto
  (em 🆕/👥), Pausar/Parar e o log.
- Ordem impossível ou sem sentido fica **vermelha** e um **modal** explica e oferece a correção. Campo vazio bloqueia o
  Iniciar. Nada é pulado em silêncio.
- **Velocidade** (⚙️ Ajustes e por passo): 0.5 a 2.0; maior = mais rápido; só muda as pausas de ritmo; nenhuma pausa
  fica abaixo de 50% da original. A pausa entre ciclos não muda com a velocidade.
- As 5 abas antigas (Piloto fixo, Pastas, Envio, Fila, Auto) **não existem mais**; tudo virou passo do fluxo.
- Modelos ⭐ abrem com a **mensagem vazia** (toque em "Usar padrão"). A mensagem que o BM tinha no Auto antigo aparece no
  ⭐ Auto clássico. Nenhuma chave antiga do navegador foi apagada.

## 2. O que foi testado (e onde)

`npm run verificar` = **147 testes de unidade + 99 testes de tela**, todos verdes no último commit (≈ 4,5 min).

| Parte | Como foi testado |
|---|---|
| Build | O HTML é gerado de `src/`; um teste falha se alguém editar o HTML à mão. A divisão inicial foi provada idêntica ao HTML original byte a byte (commit `46f3091`). |
| Validador (§6) | Todas as regras 1–11, com os exemplos da spec, a precedência (regra 8) e a escolha do erro do modal (regra 10). |
| Velocidade (§8) | Funções puras + guarda que confere cada `sleep` do código contra `pausas.md` + medição de cada espera no navegador (2.0 × 1.0). |
| Motor (§5, §7, §10) | Função pura com Blip de mentira: loop, sentinela, memória por ticket (execução × 24 h), card sem número, falha de item × falha geral, um chat por vez, Pausar/Parar. |
| Funções reais do bot | Rodadas na **página falsa do Blip** (`test/e2e/blip-falso/`), que imita os seletores que o código usa. |
| Tela | Montar, campos, modal, Ajustes, fluxos salvos, Acompanhar e **10 cenários de ponta a ponta montados e iniciados pela tela** nos três modos. |

## 3. O que NÃO foi testado no Blip real

Nada abaixo foi verificado no site. É o que o checklist confere.

**Suposições da spec (§11)**
- **S1** — depois de **Mover para pasta**, o ticket **sai** da lista. O motor conta com isso (`Mover` esvazia a tela).
- **S2** — ticket **pausado** pode ser **movido** e **transferido**.
- **S3** — ticket **pausado** não recebe mensagem. Na página falsa isso foi imitado com o campo de texto desabilitado.

**Tamanho e permissões do navegador**
- O bookmarklet codificado passou de **286 KB para 356 KB** (a página tem 722 KB). Não foi testado se o navegador
  aceita arrastar um favorito desse tamanho, nem se o botão "Copiar Código" continua funcionando com ele.
- **CSP do Blip**: não foi verificado se o Blip bloqueia um `javascript:` maior. O antigo funcionava; o novo usa as
  mesmas técnicas.

**Tempos**
- Todos os tempos foram medidos na página falsa, que responde na hora. No Blip real a rede é mais lenta. As esperas de
  tela continuam as de hoje, mas a **velocidade 2.0** corta pela metade o ritmo entre tickets (ex.: 1200 → 600 ms),
  inclusive o `delayAcoes` que o código comenta como "aguarda a fila atualizar" ao mover.
- Antes de enviar, o bot abre o chat direto (como o Auto antigo). O menu ⋮ só é aberto para saber se o ticket está em
  espera quando o campo de mensagem não fica disponível; sem campo nem sinal de desabilitado, isso custa até 8 s
  (`AUTO_T.campo`) por ticket pausado. Corrigido em 23/11/2026: abrir o menu antes de enviar travava o envio no Blip
  real (o menu não fechava).

**Partes imitadas por dedução do código, sem conferir no site** (marcadas assim em `blip-falso.js`)
- Estrutura do submenu **Mover para** (`.folder-submenu-container > .custom-submenu-item > .sub-menu`).
- Modal de **Finalizar** (botão "Finalizar ticket") e a caixa de **tags**.
- **Atender** ignorando cliques repetidos enquanto o pedido está em andamento.
- Onde um **chat novo** aparece na lista (no fim, na página falsa). O BM confirmou que o ticket **puxado pelo Atender**
  entra no **topo**.
- Os seletores de `AUTO_SEL` e `TRANSF_SEL` vieram do Blip real (comentário do código de 18/11/2026). Mesmo assim, só
  foram exercitados na página falsa.

**Código novo que nunca rodou no Blip**
- **Despausar** por ticket (o "Despausar todos" antigo usava outro caminho).
- **Leitura de "em espera" pelo menu** antes de enviar.
- O Auto como **observador** do fluxo (🆕/👥), com o processamento antigo do Auto desligado.
- A **memória de 24 h** do 🆕 usa a mesma chave do Auto antigo (`rf_rodbot_auto_tickets_v1`). Um chat que o Auto antigo
  já contou nas últimas 24 h é ignorado pelo 🆕.

## 4. Checklist para o BM no Blip real (com tickets de teste)

Faça em ordem e anote o resultado. **Use tickets e um atendente de teste**, nunca clientes reais.

| # | O que fazer | O que deve acontecer | Se não acontecer |
|---|---|---|---|
| 1 | Guardar o favorito antigo. Instalar o novo **arrastando** o botão; repetir com **Copiar Código**. | Os dois jeitos instalam. Clicar no favorito abre o painel em 🧩 Montar. | Tamanho/CSP (seção 3): voltar ao antigo e avisar. |
| 2 | Abrir o console do navegador (F12) e clicar no favorito. | Nenhum erro vermelho do rod bot. | Mandar print do erro. |
| 3 | **S3**: pausar 1 ticket de teste à mão. Montar ⏳ `[Enviar "teste"]` e iniciar. | Esse ticket é **pulado** (log "em espera: não recebe mensagem"); os outros recebem 1 vez. | Se o pausado recebeu, S3 é falsa: ajustar a tabela do §6. |
| 4 | **S1**: ⏳ `[Mover → pasta de teste]` em 1 ticket. | O ticket vai para a pasta e **sai da lista**. | Se fica na lista, S1 é falsa: ajustar §6 (Mover não esvazia). |
| 5 | **S2**: com 1 ticket pausado, ⏳ `[Mover]` e depois `[Transferir → atendente de teste]`. | Ambos funcionam no pausado. | Se falhar, S2 é falsa: ajustar §6. |
| 6 | ⭐ Piloto clássico com 2 tickets de teste na fila, **loop desligado** (⚙️ Ajustes), mensagem "Usar padrão", pasta de teste. | Log: "Ciclo #1: 2 atendidos · 2 enviados · 2 pausados · 2 movidos · 0 falhas". | Mandar o log. |
| 7 | O mesmo com **loop ligado**: depois do ciclo 1, colocar 1 ticket novo na fila. | Log "Sentinela…", depois "Ciclo #2" só com o novo; ninguém recebe 2 vezes. Parar no fim. | Mandar o log. |
| 8 | ⏳ `[Despausar]` com 2 tickets de teste pausados. | Os 2 saem da espera; o resumo mostra "2 despausados". | Código novo: mandar o log. |
| 9 | ⏳ `[Enviar + Finalizar, tag de teste]` em 1 ticket. | Mensagem, tag aplicada e ticket finalizado. | Mandar o log. |
| 10 | ⏳ `[Transferir → nome exato do atendente de teste]`. | O ticket sai da lista para esse atendente. Um nome parcial é recusado. | Mandar o log. |
| 11 | 🆕 `[Enviar, Pausar]` (ou ⭐ Auto clássico). Iniciar e fazer cair 1 chat de teste. | Só o chat novo recebe 1 mensagem e é pausado; "Novos chats" vai a 1. | Mandar o log e o Acompanhar. |
| 12 | 👥 `[Enviar, Pausar]` com 1 ticket esperando; depois cair 1 chat de teste. | Os 2 recebem 1 mensagem cada (lote + vigia). | Mandar o log. |
| 13 | Repetir o passo 6 com **velocidade 2.0**. | Termina mais rápido e **sem falhas** (nenhum clique perdido). | Voltar para 1.0 e avisar quais passos falharam. |
| 14 | Olhar o log de qualquer ciclo em ⏳. | Não aparece "⚠️ card(s) sem número". | Se aparecer, mandar o `outerHTML` de um card (seção 6). |

## 5. Decisões tomadas durante a implementação (fora do texto da spec)

- ⭐ Piloto clássico abre também com a **pasta vazia** (vermelha até tocar num chip), como a mensagem.
- Ao trocar de fluxo com alterações: botão extra **Voltar** (além de Salvar como novo / Descartar); Esc também volta.
- **🗑 Apagar** só em fluxos do usuário, com confirmação (a spec só diz que modelos não se apagam).
- Em 🆕/👥, se o envio é **pulado** (ticket já em espera), aquele chat **não segue** para os passos seguintes (não move nem
  transfere sem a mensagem). "Já estava em espera" num Pausar **não** encerra o chat.
- "Já estava em espera" aparece **uma vez** por ticket pausado por outra pessoa (não a cada ciclo do loop).
- A vigia de 🆕/👥 olha os chats novos a cada **0,5 s** (é espera; não muda com a velocidade).
- As pausas curtas de **estabilização** (antes de clicar numa opção do menu ou do modal que acabou de aparecer; 3 no
  código atual) ficaram **fora** da velocidade ("na dúvida, não entra"). Mudar uma delas é trocar uma linha em `pausas.md`.

## 6. Pendências

- **Pergunta ao BM:** o card de um ticket **pausado** mostra algum sinal na lista (ícone, cor, texto "Em espera")? Se
  sim, mandar o `outerHTML` do `<article class="chat-list-item">` (botão direito → Inspecionar → Copy → Copy outerHTML).
  Com isso o bot deixa de abrir o menu de cada ticket antes de enviar e o log mostra "Pausados: N" em vez de "?".
- Ficou **CSS morto** do Piloto antigo (`.ba-pipeline`, `.ba-step`…). Não afeta nada; dá para limpar depois.

## 7. Como voltar atrás

O HTML anterior está no commit `3ca5940`. Para gerar o arquivo:

```bash
git show 3ca5940:rodbot-final.html > rodbot-anterior.html
```

As chaves antigas do navegador (tema, pastas recentes, mensagem/contador/tickets do Auto) **não foram apagadas**, então
o painel antigo volta como estava. As chaves novas (`rf_rodbot_fluxos_v1`, `rf_rodbot_fluxo_atual_v1`,
`rf_rodbot_migracao_v1`) são ignoradas por ele.

## 8. Tabela de pausas (o que a velocidade muda)

Fonte de verdade: `docs/plano/pausas.md` (um teste a confere contra o código). Critério do §8: **entra** = ritmo fixo
entre ações; **não entra** = espera de tela, polling, recuo após erro ou segurança. Na dúvida, não entra.

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
