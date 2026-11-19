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
  👥 Ambos) · **paleta** com os 5 ícones (toque adiciona o passo no fim; **não existe** o botão "+ Adicionar passo" do
  `layout-A.png`: dois jeitos de fazer a mesma coisa) · passos em lista vertical numerada com ▲ ▼ ✕; **só o cartão
  tocado fica aberto** (um por vez), os outros mostram um resumo de uma linha (ex.: "✉️ Enviar · Só enviar · “Realizamos…”")
  · **⚙️ Ajustes** recolhível (velocidade, loop, pausa entre ciclos, "Também puxar a fila")
  · botão **Iniciar**. Painel vazio = paleta em destaque (o usuário entende que é só tocar).
- **Acompanhar**: nome do fluxo + ciclo · stepper com **os passos do usuário, na ordem dele**, status por passo
  (Aguardando / Rodando / Feito / Falha) · contadores do Auto (Novos chats, Contador Blip, Na fila do BM, lista,
  Retomar, Repetir pausas pendentes, Zerar contador) **só nos modos 🆕 e 👥** · Pausar / Parar · log.
  Ao clicar em Iniciar o painel **pula sozinho** para Acompanhar.
- Cabeçalho (rod bot, status, Tema, fechar) e temas continuam como hoje.

## 4. Passos (blocos)

| Passo | Modos/campos | Disponível em |
|---|---|---|
| 📥 Atender fila | — (puxa a cada 500 ms até zerar; sentinela no loop) | só ⏳ (em 🆕/👥 vira a caixa "Também puxar a fila"; some da paleta) |
| ✉️ Enviar | **Só enviar** \| **Enviar + Finalizar** (+ campo **Tag**); campo **Mensagem** + "Usar padrão" | todos |
| ⏸️ Espera | **Pausar** \| **Despausar** | todos; **Despausar só existe em ⏳** (em 🆕 e 👥 some do seletor) |
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
- **Fluxo novo** (botão "+", ver §9) nasce **sem modo**: a paleta fica desabilitada com a dica "Escolha para quem
  primeiro" e o Iniciar bloqueado. Os modelos ⭐ sempre têm modo.
- **Trocar o "Para quem?" com passos já montados**: um passo que não existe no modo novo (Atender em 🆕/👥,
  Despausar em 🆕/👥) **fica no fluxo, em vermelho, com o motivo**, e o Iniciar bloqueia. **Nunca** é apagado sem o
  usuário mandar (✕).

## 6. Validação (função pura; **tudo que não faz sentido bloqueia**)

O validador simula o estado dos tickets passo a passo (em ⏳: a tela; em 🆕/👥: **por chat**). Estado simulado:
`tickets` ∈ {há, vazio} e `pausados` ∈ {**desconhecido**, nenhum, alguns, todos}.
**Estado inicial em ⏳: `tickets = há`, `pausados = desconhecido`** (a tela pode já ter pausados; o log mostra
"Pausados: N"). Em 🆕/👥 (por chat): `tickets = há` (o chat que caiu), `pausados = nenhum`.

| Passo | Precisa de | Deixa |
|---|---|---|
| Atender | nada | `tickets = há`; `pausados` **não muda** (os que já estavam pausados continuam) |
| Só enviar | tickets ativos (**regra 1**) | igual |
| Enviar + Finalizar | tickets ativos | `tickets = vazio` |
| Pausar | tickets | `pausados = todos` |
| Despausar | `pausados ≠ nenhum` (**regra 3**) | `pausados = nenhum` |
| Mover para pasta | tickets | `tickets = vazio` (suposição S1) |
| Transferir | tickets | `tickets = vazio` |

Regras (cada uma com mensagem própria no modal):
1. **Enviar depois de Pausar** sem Despausar no meio: ❌ — "Cliente em espera não recebe mensagem". Vale mesmo com
   Atender no meio (os pausados continuam na tela). Em ⏳, enviar com `pausados = desconhecido` é **permitido**: o
   motor só envia aos tickets ativos e pula os pausados.
2. **Qualquer passo depois de Enviar + Finalizar, Transferir ou Mover**, exceto Atender: ❌ — "Não sobra cliente na
   tela".
3. **Despausar** só é bloqueado quando já se sabe que **não há pausados** (`pausados = nenhum`): logo depois de outro
   Despausar, ou em 🆕/👥. Em ⏳, como o estado inicial é "desconhecido", **Despausar como 1º passo é permitido**
   (mantém o "Despausar todos" que existe hoje).
4. **Mesmo envio duas vezes nos mesmos tickets** (Enviar … Enviar sem Atender no meio): ❌ — não duplicar mensagem.
   Vale para **qualquer** Enviar (Só enviar ou Enviar + Finalizar, mesma mensagem ou outra).
5. **Pausar → Pausar** ou **Despausar → Despausar** seguidos: ❌ — sem efeito.
6. **Loop ligado sem Atender em 1º**: o loop fica efetivamente desligado, com o motivo (ver §7).
7. Fluxo sem Atender, ou com Atender no meio, é **permitido** (loop desligado) se passar nas regras acima.
8. **Precedência entre regras**: se mais de uma regra bloqueia o mesmo passo, a **regra 4 vence a regra 1** (ex.:
   Enviar → Pausar → Despausar → Enviar bloqueia pela regra 4). O modal só sugere "coloque Despausar antes" quando
   **não** houve envio antes; caso contrário sugere "remova o passo".
9. **A volta do loop não é simulada** pelo validador (ex.: [Atender, Enviar, Pausar] com loop é válido). Quem impede
   mensagem dupla e pausa dupla nos ciclos seguintes é o **motor**: envia só a tickets ativos que ainda não
   receberam envio (controle por número do ticket) e pula os já pausados (log "já estava em espera").

Exibição: o passo com problema fica **vermelho na hora** (com a frase curta do motivo); o **modal** abre ao adicionar
um passo que quebra a ordem e ao clicar em Iniciar; tem "Entendi" e, quando existir, uma correção ("Remover passo
3"); **Iniciar** fica bloqueado até a ordem ser válida. Ver `layout-M.png` (o texto "coloque Despausar antes"
daquela imagem vale só quando não houve envio antes — regra 8).

Interface sugerida: `validarFluxo({paraQuem, passos, loop}) → {ok:true} | {ok:false, erros:[{indice, regra, mensagem, correcao?}]}`.

## 7. Loop (só ⏳)

- Interruptor "**Repetir em loop (sentinela)**", **ligado por padrão**. Sentinela = fila 0 ⇒ vigia até surgir 1+
  cliente (como a etapa 1 atual).
- O interruptor guarda a **escolha do usuário** (padrão ligado). O loop **efetivo** = escolha **E** Atender em 1º.
  Sem Atender em 1º o interruptor aparece desabilitado com o motivo, **sem perder a escolha**: quando o Atender volta
  a ser o 1º, o loop volta ao que o usuário tinha escolhido (se ele tinha desligado, continua desligado).
- "**Pausa entre ciclos**": padrão **1 s**, de 0 a 60 s. É o valor que o usuário escolheu e **não é alterado pela
  velocidade**.
- Em 🆕/👥 não há loop nem pausa entre ciclos: o modo já vigia até Parar.

## 8. Velocidade

- Campo numérico no topo (em Ajustes): **0.5 a 2.0**, passo 0.1, **padrão 1.0** = tempos de hoje. **Maior = mais
  rápido**: pausa efetiva = pausa atual ÷ velocidade. Fora da faixa ⇒ corrige para o limite com aviso no campo.
- Por passo: mesmo campo, vazio = a do fluxo. Salva junto com o fluxo.
- **O que a velocidade muda** (lista fechada, as pausas fixas **entre ações**): `delayAcoes`, `delayTrocaTicket`, o
  intervalo do Atender (500 ms), os `sleep` literais curtos entre cliques (120/150/550 ms etc.) e
  **`AUTO_T.entreTickets`** (pausa entre um chat e outro no modo 🆕/👥).
- **O que a velocidade NÃO muda**: tempos máximos de espera (`waitFor`, e os campos de `AUTO_T` e `TRANSF_T` que são
  prazos); detecção do Auto (`debounce`, `reconciliar`, `janelaFiltro`, `janelaRolagem`, observers);
  **`AUTO_T.espera`** (espera de segurança quando outra automação está rodando ou há rascunho no chat: não é ritmo,
  é proteção); `TRANSF_T.esperaModal` e os atrasos de digitação do Transferir (40/110 ms; mexer pode quebrar o
  autocomplete); **a pausa entre ciclos** (§7).
- **Piso**: nenhuma pausa afetada fica abaixo de **50%** da atual (consequência: 2.0 é o máximo).

## 9. Fluxos salvos

- Modelos fixos (não apagáveis): ⭐ **Piloto clássico** (⏳, loop ligado: Atender → Enviar só → Pausar → Mover) e
  ⭐ **Auto clássico** (🆕: Enviar só → Pausar).
- Até **10 fluxos do usuário** (os 2 modelos **não** contam), no `localStorage`, guardando passos, campos,
  "Para quem?", loop, pausa entre ciclos e velocidades. O último usado abre carregado.
- **Editar um modelo** vale só enquanto o painel está aberto e ele está selecionado; ao reabrir, o modelo volta ao
  original. **💾 sempre salva como fluxo novo, pedindo um nome** (não existe "salvar por cima" de modelo). Trocar de
  fluxo com alterações não salvas pergunta **Salvar como novo / Descartar**.
- O botão **"+"** cria um fluxo **vazio e sem "Para quem?"** (ver §5).
- **Migração (1ª abertura).** Fato lido no código: só **tema, aba, pastas recentes (chips), mensagem do Auto
  (`rf_rodbot_auto_msg_v1`), contador e tickets do Auto** são gravados hoje; a mensagem e a pasta do Piloto e das
  abas Envio/Pastas **não são persistidas**. Portanto:
  - a mensagem do Auto, se existir, vai para o Enviar do ⭐ Auto clássico;
  - as pastas recentes continuam como chips do Mover;
  - **não há mais nada a migrar** do Piloto/Envio/Pastas;
  - se **não** houver mensagem do Auto salva, o Enviar do Auto clássico abre **vazio**; o Enviar do Piloto clássico
    também abre **vazio**. Em vermelho, com o Iniciar bloqueado: o usuário toca em "Usar padrão" **de propósito**.
    **Nunca preencher sozinho com `MENSAGEM_PADRAO`**: o Piloto antigo, com mensagem vazia, só movia (não enviava), e
    um envio a clientes não pode aparecer sem o usuário pedir;
  - as chaves antigas do `localStorage` **não são apagadas** (permite voltar ao HTML anterior).
- Última aba antiga salva (`pasta|mensagem|fila|auto|piloto`) → abre em **Montar**.

## 10. Execução e falhas

- **Enviar + Finalizar em 🆕/👥**: finaliza **só o chat atual** e **não abre o primeiro da lista**
  (`passo5_proximoFila` abriria outro cliente). Em ⏳ continua como hoje: finaliza e abre o próximo da lista até esvaziar.
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
   - **Como extrair sem quebrar:** o código é um único bloco (≈3.900 linhas) com variáveis compartilhadas (`rodando`,
     `CONFIG`, elementos da tela). **Não reescrever nem separar em módulos de uma vez.** Primeiro dividir o código
     **pelos blocos de comentário que já existem** (6 marcadores `====`), **sem mudar nenhuma linha**, e provar que
     a concatenação dos arquivos, na mesma ordem, é idêntica ao código original. A refatoração em módulos menores
     vem depois, com testes, e só do que for tocado pelas etapas seguintes.
   - **Codificação (verificada):** `encodeURIComponent(codigo)` com `! ' ( ) *` também escapados (`%21 %27 %28 %29
     %2A`) reproduz o `href` atual **byte a byte**. A segunda cópia do mesmo código (campo `bm-code`) é igual à
     primeira. O build deve usar exatamente essa codificação e gerar as duas cópias.
2. **Validador** como função pura com testes de todas as regras do §6 (inclui Enviar → Pausar → Enviar,
   Enviar → Pausar → Despausar → Enviar (regra 4 vence), Finalizar → Pausar, Despausar como 1º passo em ⏳, Despausar
   em 🆕, loop sem Atender, e a precedência da regra 8).
3. **Velocidade** como função pura (`pausa(msAtual, velocidade)` com piso 50%) com testes, e a aplicação só à lista
   fechada do §8.
4. **Motor** que executa os passos reutilizando as funções atuais (atender, enviar, finalizar, pausar, mover,
   transferir, auto), com controle por número do ticket e a velocidade só nas pausas. Recebe o fluxo como dados e é
   testado com a página falsa **sem a tela nova**. **O HTML gerado continua com as abas antigas funcionando** até a
   etapa 5: nenhuma versão intermediária fica com o Iniciar quebrado.
5. **UI** Montar/Acompanhar, paleta, modal, fluxos salvos e migração, ligada ao motor. As abas antigas só saem nesta
   etapa.
6. Testes da tela com **Playwright** numa **página falsa do Blip** (dados fictícios). Na entrega, dizer claramente o
   que **não** foi testado no site real (S1–S3, tempos reais, CSP do Blip).

