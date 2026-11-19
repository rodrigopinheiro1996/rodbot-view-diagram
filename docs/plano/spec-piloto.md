# Spec — novo Piloto do rod bot (fluxo montado pelo usuário)

Resultado do grill de 2026-11-19. Esta spec é a **única fonte** para o plano e a implementação.
Referência visual: `docs/plano/layouts/` (PNGs + `mockups.html`). Escolhido: **D + A, com a paleta da B**;
o modal de ordem inválida está em `layout-M.png`. Dados das imagens são fictícios.

## 1. Objetivo

Hoje o painel tem 5 abas (Piloto, Pastas, Envio, Fila, Auto) e o Piloto é **fixo** (Atender → Enviar → Pausar →
Mover, em loop com sentinela). O novo Piloto deixa o usuário (BM) **montar o próprio fluxo** escolhendo as funções
do rod bot e a ordem delas. Um **validador interno** recusa ordens impossíveis ou sem sentido e explica o motivo em
um modal. Meta de UX: clareza à primeira vista, sem poluição visual, sem dois jeitos de fazer a mesma coisa.

## 2. Estado atual (fatos lidos no código, `rodbot-final.html` decodificado)

- O código inteiro está dentro do `href="javascript:…"` codificado de `rodbot-final.html` (≈164 KB, ≈3.900 linhas).
  **Não existe fonte separada.**
- Abas: `getSavedTab()` aceita `piloto|pasta|mensagem|fila|auto` (chave `rf_rodbot_tab_v1`).
- Piloto: `executarPilotoLoop()` chama `pilotoEtapa1_PuxarFila` (com sentinela quando a fila = 0) →
  `pilotoEtapa2_EnviarMensagens` (pula **em silêncio** se a mensagem estiver vazia) → `pilotoEtapa3_PausarTodos` →
  `pilotoEtapa4_MandarPraPasta`; espera 1000 ms entre ciclos. Tem campos próprios de pasta e mensagem que
  **duplicam** os das abas Pastas/Envio (fallback `CONFIG → pilot… → aba`).
- Envio "Enviar + Finalizar" (`loop()`): mensagem → tag → finalizar → confirmar modal → abre o **primeiro da lista**
  (`passo5_proximoFila`) até a lista esvaziar ⇒ **depois dele não sobra ticket na tela**.
- Transferir (`TRANSF_*`): sempre o primeiro ticket da lista; só conta quando o ticket **sai da lista**.
- Auto (`auto*`): observador em segundo plano; age só em chats que chegam **depois** da ativação; um por vez; envia,
  **confirma o envio**, só então pausa; guarda ids por 24 h (`rf_rodbot_auto_tickets_v1`); `autoBloqueiaOutras()`
  impede outras ações enquanto processa um chat.
- Tempos atuais: `delayAcoes` 1200 ms, `delayTrocaTicket` 700 ms, Atender a cada 500 ms, 1000 ms entre ciclos,
  vários `sleep` curtos (120/150/550 ms); tempos máximos de espera em `waitFor`, `AUTO_T` e `TRANSF_T`.

## 3. Painel

- **Duas abas: 🧩 Montar | 📊 Acompanhar.** As abas Pastas, Envio, Fila e Auto **deixam de existir**; tudo vira
  passo do fluxo. Última aba salva antiga (`pasta|mensagem|fila|auto|piloto`) → abre em **Montar**.
- **Montar** (de cima para baixo): seletor de fluxo salvo + 💾 · "**Para quem?**" (⏳ Aguardando | 🆕 Que vão cair |
  👥 Ambos) · **paleta** com os 5 ícones (toque adiciona o passo no fim) · passos em lista vertical numerada com
  ▲ ▼ ✕ e os campos do passo · **⚙️ Ajustes** recolhível (velocidade, loop, pausa entre ciclos, "Também puxar a fila")
  · botão **Iniciar**. Painel vazio = paleta em destaque (o usuário entende que é só tocar).
- **Acompanhar**: nome do fluxo + ciclo · stepper com **os passos do usuário, na ordem dele**, status por passo
  (Aguardando / Rodando / Feito / Falha) · contadores do Auto (Novos chats, Contador Blip, Na fila do BM, lista,
  Retomar, Repetir pausas pendentes, Zerar contador) **só nos modos 🆕 e 👥** · Pausar / Parar · log.
  Ao clicar em Iniciar o painel **pula sozinho** para Acompanhar.
- Cabeçalho (rod bot, status, Tema, fechar) e temas continuam como hoje.

## 4. Passos (blocos)

| Passo | Modos/campos | Disponível em |
|---|---|---|
| 📥 Atender fila | — (puxa a cada 500 ms até zerar; sentinela no loop) | só ⏳ (em 🆕/👥 vira a caixa "Também puxar a fila") |
| ✉️ Enviar | **Só enviar** \| **Enviar + Finalizar** (+ campo **Tag**); campo **Mensagem** + "Usar padrão" | todos |
| ⏸️ Espera | **Pausar** \| **Despausar** | todos (Despausar some em 🆕) |
| 📁 Mover para pasta | campo **Pasta** + chips (nv2, default, recentes) | todos |
| 🔁 Transferir para atendente | campo **Nome do atendente** (exato) | todos |

- De **1 a 8 passos**; o mesmo passo pode repetir se a ordem for válida.
- **Campo obrigatório vazio** (mensagem, tag, pasta, atendente) ⇒ campo em vermelho e **Iniciar bloqueado**.
  Nada é pulado em silêncio (muda o comportamento atual do Piloto).
- Cada passo tem campo opcional **Velocidade** (vazio = a do fluxo); preenchido mostra o selo `×1.5` no cartão.
- A mensagem do Enviar tem o botão "Usar padrão" (`MENSAGEM_PADRAO`).

## 5. "Para quem?" (vale para o fluxo inteiro)

- ⏳ **Aguardando**: age em lote nos clientes que já estão na lista do BM (o Piloto de hoje).
- 🆕 **Que vão cair**: a cada chat que chegar **depois de ativar**, aplica os passos nele, **um chat por vez**, com as
  proteções do Auto atual (cada passo só começa depois de **confirmar** o anterior; ex.: só pausa após confirmar o
  envio). É o antigo Auto.
- 👥 **Ambos**: roda **uma vez** nos que aguardam e depois vigia os que caem.
- Em todos os modos, **cada ticket recebe o fluxo no máximo uma vez** (controle por número do ticket, como o Auto já
  faz). Impede mensagem dupla.
- "**Também puxar a fila (Atender)**" (só 🆕/👥, desligada por padrão): ligada, o bot clica em Atender; quem é puxado
  conta como "caiu" e recebe o fluxo uma vez.
- Ao adicionar Enviar sem "Para quem?" escolhido, o seletor pisca pedindo a resposta.

## 6. Validação (função pura; **tudo que não faz sentido bloqueia**)

O validador simula o estado dos tickets passo a passo (em ⏳: tela; em 🆕/👥: **por chat**).

| Passo | Precisa de | Deixa |
|---|---|---|
| Atender | nada | tickets **ativos** (somados aos que já estavam) |
| Só enviar | tickets **ativos** (não pausados) | igual |
| Enviar + Finalizar | tickets ativos | **vazio** |
| Pausar | tickets | **pausados** |
| Despausar | tickets **pausados** | **ativos** |
| Mover para pasta | tickets | **vazio** (suposição S1) |
| Transferir | tickets | **vazio** |

Regras (cada uma com mensagem própria no modal):
1. **Enviar depois de Pausar** sem Despausar no meio: ❌ — "Cliente em espera não recebe mensagem". Vale mesmo com
   Atender no meio (os pausados continuam na tela).
2. **Qualquer passo depois de Enviar + Finalizar, Transferir ou Mover**, exceto Atender: ❌ — "Não sobra cliente na
   tela".
3. **Despausar sem Pausar antes**: ❌.
4. **Mesmo envio duas vezes nos mesmos tickets** (Enviar … Enviar sem Atender no meio): ❌ — não duplicar mensagem.
5. **Pausar → Pausar** ou **Despausar → Despausar** seguidos: ❌ — sem efeito.
6. **Loop ligado sem Atender em 1º**: o interruptor fica desligado, com o motivo.
7. Fluxo sem Atender, ou com Atender no meio, é **permitido** (loop desligado) se passar nas regras acima.

Exibição: o passo com problema fica **vermelho na hora** (com a frase curta do motivo); o **modal** abre ao adicionar
um passo que quebra a ordem e ao clicar em Iniciar; tem "Entendi" e, quando existir, uma correção ("Remover passo
3"); **Iniciar** fica bloqueado até a ordem ser válida. Ver `layout-M.png`.

Interface sugerida: `validarFluxo({paraQuem, passos, loop}) → {ok:true} | {ok:false, erros:[{indice, regra, mensagem, correcao?}]}`.

## 7. Loop (só ⏳)

- Interruptor "**Repetir em loop (sentinela)**", **ligado por padrão**; só habilita com **Atender em 1º**.
  Sentinela = fila 0 ⇒ vigia até surgir 1+ cliente (como a etapa 1 atual).
- "**Pausa entre ciclos**": padrão **1 s**, de 0 a 60 s.
- Em 🆕/👥 não há loop nem pausa entre ciclos: o modo já vigia até Parar.

## 8. Velocidade

- Campo numérico no topo (em Ajustes): **0.5 a 2.0**, passo 0.1, **padrão 1.0** = tempos de hoje. **Maior = mais
  rápido**: pausa efetiva = pausa atual ÷ velocidade. Fora da faixa ⇒ corrige para o limite com aviso no campo.
- Por passo: mesmo campo, vazio = a do fluxo.
- Muda **só as pausas entre ações** (entre cliques, entre tickets, ritmo do Atender). **Nunca** muda tempos máximos
  de espera (`waitFor`, `AUTO_T`, `TRANSF_T`) nem a detecção do Auto (debounce, reconciliação, observers).
- **Piso**: nenhuma pausa abaixo de **50%** da atual (consequência: 2.0 é o máximo).
- Salva junto com o fluxo.

## 9. Fluxos salvos

- Modelos fixos (não apagáveis): ⭐ **Piloto clássico** (⏳, loop ligado: Atender → Enviar só → Pausar → Mover) e
  ⭐ **Auto clássico** (🆕: Enviar só → Pausar).
- Até **10** fluxos com nome, no `localStorage`, guardando passos, campos, "Para quem?", loop, pausa entre ciclos e
  velocidades. O último usado abre carregado.
- Migração na 1ª abertura: a mensagem salva da aba Auto vai para o Enviar do Auto clássico; pasta/mensagem do Piloto
  antigo vão para o Piloto clássico.

## 10. Execução e falhas

- Falha de um **item** (um chat que não aceitou texto) ⇒ pula e anota no log (como hoje).
- Falha **geral** do passo (botão não encontrado, modal não abriu) ⇒ **para o fluxo**, passo em vermelho, motivo no
  log/Acompanhar. Não segue adivinhando.
- Pausar/Parar globais como hoje.
- **Só no log**: contagem antes de iniciar ("Fila: 12 · Na tela: 8 · Pausados: 3") e resumo de cada ciclo
  ("Ciclo #3: 5 atendidos · 5 enviados · 5 pausados · 5 movidos · 0 falhas").
- Só um fluxo roda por vez (o antigo "Auto bloqueia as outras" vira natural: é um modo ou outro).

## 11. Suposições a conferir no Blip real (ninguém verificou no site)

- **S1** Depois de **Mover para pasta**, o ticket **sai** da lista da tela.
- **S2** Ticket **pausado** pode ser **transferido** e **movido**.
- **S3** Ticket **pausado** não recebe mensagem (regra do BM; o código não comprova).
Se alguma for falsa, ajustar a tabela do §6 (é uma linha cada) antes de liberar.

## 12. Implementação e testes (ordem)

1. **Extrair o código** do `javascript:` para arquivos pequenos em `src/` e criar um **build** que regera
   `rodbot-final.html`. Antes de qualquer mudança, provar que o HTML gerado é **idêntico** ao atual (teste de ida e
   volta). A partir daí, **nunca editar o `javascript:` codificado** à mão.
2. **Validador** como função pura com testes de todas as regras do §6 (inclui Enviar → Pausar → Enviar,
   Finalizar → Pausar, Despausar sozinho, loop sem Atender, modo 🆕 sem Atender/Despausar).
3. Velocidade como função pura (`pausa(msAtual, velocidade)` com piso 50%) com testes.
4. UI Montar/Acompanhar, paleta, modal, fluxos salvos e migração.
5. Motor que executa os passos reutilizando as funções atuais (atender, enviar, finalizar, pausar, mover,
   transferir, auto) com a velocidade aplicada só às pausas.
6. Testes da tela com **Playwright** numa **página falsa do Blip** (dados fictícios). Na entrega, dizer claramente o
   que **não** foi testado no site real (S1–S3, tempos reais, CSP do Blip).
