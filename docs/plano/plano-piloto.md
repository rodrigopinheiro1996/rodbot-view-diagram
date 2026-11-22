# Plano de implementação — novo Piloto do rod bot

Fonte única: `docs/plano/spec-piloto.md` (citada como §N; versão do commit `be2729f`). Em conflito, a spec manda.
Layout: **D + A com a paleta da B**; modal em `layouts/layout-M.png`. A ordem segue o §12 (1 extração · 2 validador ·
3 velocidade · 4 motor · 5 tela · 6 Playwright). Nada aqui está implementado ainda.

## Regras do plano

- **Testes primeiro** em toda tarefa: escrever, ver falhar, implementar, ver passar, commitar.
- **Nunca editar o `javascript:` codificado** de `rodbot-final.html`. Depois da Tarefa 1 o HTML é **gerado** por
  `npm run build`; o teste `html-sincronizado` falha se alguém editar o HTML à mão. Cada commit já inclui o HTML regerado.
- **Não reescrever o bot de uma vez.** O código é uma IIFE única com variáveis compartilhadas (`rodando`, `CONFIG`,
  elementos da tela). Os arquivos de `src/js/` são **trechos concatenados em ordem**, não módulos.
- **Duas espécies de commit, nunca misturadas:**
  - `refactor(mover): …` só move linhas para outro arquivo, sem mudar nenhuma. Prova: `npm run comparar-bundle`
    (concatenação atual == concatenação do commit anterior, byte a byte).
  - qualquer outro commit muda comportamento.
  A refatoração em arquivos menores só acontece **no que a tarefa seguinte vai tocar**.
- Código novo e puro vai em `src/js/puro/` (sem DOM), entra na concatenação e é testado no Node via `vm`.
- Sem dependências novas: `node:test` (Node 22) e o `playwright` já instalado.
- **Painel antigo até a troca (§12.4/§12.5):** até a Tarefa 22 o painel antigo continua funcional e é o padrão. A UI
  nova nasce atrás do interruptor **provisório** `localStorage.rf_rodbot_ui_nova_v1 = '1'`, só para testá-la
  (Tarefas 15–21). **Nenhum HTML com as duas UIs vai para o BM:** a troca (Tarefa 22) remove o painel antigo **e** o
  interruptor (sem chave inerte) e é o primeiro HTML com a UI nova. O gancho `window.__rodBot` (Tarefa 11) só existe com
  `window.__rodBotTeste === true` e pode ficar.
- Se um seletor do Blip falhar na página falsa ou for duvidoso: **parar e pedir o `outerHTML` do trecho ao BM**.
  Não inventar seletor.

## Comandos (criados na Tarefa 1)

| Comando | Faz |
|---|---|
| `npm run build` | `src/` → `rodbot-final.html` |
| `npm test` | testes de unidade (`node --test test/unidade`) |
| `npm run e2e` | testes de tela (`node --test test/e2e`, Playwright) |
| `npm run comparar-bundle` | prova que um `refactor(mover)` não mudou nenhuma linha |
| `npm run verificar` | `npm test` + `npm run e2e` + `html-sincronizado` |

## Fatos do arquivo atual que guiam a Tarefa 1 (conferidos)

- `rodbot-final.html`: 581.517 caracteres, 405 linhas, LF, termina em `\n`. O código aparece **duas vezes**, idêntico:
  `<a id="bm-button" href="javascript:…">` e `<input id="bm-code" … value="javascript:…">` (285.647 caracteres cada).
- Decodificado: 163.994 caracteres, 3.879 linhas; começa em `(function () {` e termina em `})();;void 0;`.
- Codificação: `encodeURIComponent` + `! ' ( ) *` em `%XX` maiúsculo. Conferido: `quote(código, safe="-_.")` reproduz o
  `href` byte a byte; as duas cópias são iguais.
- **Marcadores `====`:** a spec fala em "6 marcadores"; no código são **3 comentários em bloco**, cada um com uma
  linha `====` acima e outra abaixo (6 linhas), nas linhas 2025, 2481 e 3429. Eles dividem o código em **4 trechos**:
  1. linhas 1–2024 (base: config, estilos, painel, utilitários, envio, fila, pastas, espera, atender, stepper),
  2. 2025–2480 `PILOTO AUTOMÁTICO - PIPELINE VISUAL & LOOP CONTÍNUO`,
  3. 2481–3428 `RESPOSTA AUTOMÁTICA A NOVOS CHATS`,
  4. 3429–fim `TRANSFERÊNCIA EM MASSA PARA ATENDENTE` + fechamento do painel (`fecharPainel`, `})();;void 0;`).

---

# Etapa 1 — Extração e build (§12.1)

### Tarefa 1 — Dividir pelos blocos existentes, sem mudar nenhuma linha, e build idêntico

**Arquivos**
- `package.json` (scripts da tabela; sem dependências)
- `scripts/codec.mjs` — `codificar(js)` (`encodeURIComponent` + `! ' ( ) *`) e `decodificar(url)`
- `scripts/extrair.mjs` — uso único: decodifica o `href` atual e grava os 4 trechos cortando **só nas linhas dos
  marcadores**, sem alterar caractere algum (inclui as quebras de linha); recusa rodar se `src/js/` existir
- `src/js/01-base.js`, `02-piloto.js`, `03-auto.js`, `04-transferir-e-fechar.js` e `src/js/ordem.txt`
- `src/pagina/instalacao.html` — a página atual com o marcador `__RODBOT_BOOKMARKLET__` no lugar do código, **2×**
  (no `href` e no `value`); todo o resto do HTML fica igual
- `scripts/build.mjs` (exporta `gerarHtml()`) e `scripts/comparar-bundle.mjs`
- `test/unidade/codec.test.mjs`, `ida-e-volta.test.mjs`, `html-sincronizado.test.mjs`
- `README.md`: "Como editar: mexa em `src/`, rode `npm run build`; nunca edite o HTML"

**Testes primeiro (entrada → esperado)**
- `codificar("a b(c)!*'é")` → `"a%20b%28c%29%21%2A%27%C3%A9"`; `codificar("A-z_0.9")` → inalterado
- `decodificar(codificar(x)) === x` para o código inteiro
- **Divisão sem perda:** concatenação de `ordem.txt` == `decodificar(href do 3ca5940)`, byte a byte
- **Ida e volta no HTML inteiro:** `gerarHtml() === rodbot-final.html do commit 3ca5940` (byte a byte + SHA-256);
  não só o `href`
- as duas cópias geradas são idênticas entre si; `instalacao.html` tem o marcador exatamente 2× e nenhum `.js` o contém
- cada trecho começa/termina em fronteira de linha; os trechos 2, 3 e 4 começam exatamente na linha `/* ====`
- todo arquivo de `ordem.txt` existe e todo `.js` de `src/js/` está listado
- `html-sincronizado`: `gerarHtml() === readFile('rodbot-final.html')`; falha com
  "rodbot-final.html difere de src/ — rode npm run build; não edite o HTML à mão"

**Comando:** `node scripts/extrair.mjs && npm run build && npm test && git diff --exit-code rodbot-final.html`

**Commit:** `build: divide o bookmarklet em 4 trechos de src/ e gera rodbot-final.html idêntico ao atual`

> O commit da Tarefa 1 **contém** `scripts/extrair.mjs` e o teste "idêntico ao 3ca5940" (a prova fica no histórico).
> Os dois são removidos **no primeiro commit que muda o bundle de propósito** (Tarefa 7), para ninguém rodá-los depois.

---

# Etapa 2 — Validador puro (§6, §12.2)

Arquivo `src/js/puro/validar-fluxo.js` + `test/unidade/validar-fluxo.test.mjs`; ajudante `test/util/carregar-puro.mjs`
(carrega um arquivo de `src/js/puro/` num `vm` e devolve as funções declaradas).

Formato: `validarFluxo({paraQuem, passos}) → {ok:true} | {ok:false, erros:[{indice, regra, mensagem, correcao?}]}` — o validador
**devolve todas as regras violadas** de cada índice (a regra 8 só decide 4 sobre 1); o modal mostra um só (regra 10 do §6, Tarefa 3);
`indice` base 1. Notação: `A`=Atender, `E`=Só enviar, `EF`=Enviar+Finalizar, `P`=Pausar, `D`=Despausar, `M`=Mover,
`T`=Transferir. Estado: `tickets` ∈ {há, vazio}; `pausados` ∈ {desconhecido, nenhum, alguns, todos}; `enviado`
(volta a falso no Atender). Início em ⏳: `há` + `desconhecido`; em 🆕/👥 (por chat): `há` + `nenhum`.

### Tarefa 2 — Simulação de estado + regras 2 e 3

**Testes primeiro**
- ⏳ `[A,E,P,M]` → ok (Piloto clássico); 🆕 `[E,P]` → ok (Auto clássico)
- ⏳ `[EF,P]` → erro `{indice:2, regra:2, mensagem:'Não sobra cliente na tela'}`; ⏳ `[M,E]`, `[T,P]` → regra 2 no índice 2
- ⏳ `[EF,A,E]` → ok (Atender é a exceção da regra 2)
- **regra 3, Despausar como 1º passo em ⏳:** `[D]` → **ok**; `[D,E]` → ok; `[D,M]` → ok
- regra 3: ⏳ `[P,D,D]` e `[D,D]` → o último passo tem erro **contendo** a regra 3 (`pausados = nenhum` depois de
  Despausar); o teste afirma "contém regra 3", pois a regra 5 também dispara (regra 10 do §6)
- **Despausar bloqueado em 🆕/👥:** 🆕 `[D]` → erros no índice 1: `regra:3` (estado inicial `nenhum`) **e** `indisponivel`;
  🆕/👥 `[E,P,D]` → erro `{indice:3, regra:'indisponivel'}` (depois de Pausar `pausados = todos`, então a regra 3
  **não** dispara; quem bloqueia é a indisponibilidade, Tarefa 4)
- erro traz `correcao:{acao:'remover', indice}` → texto "Remover passo N"

**Comando:** `npm test` · **Commit:** `feat(validador): simula o estado dos tickets e aplica as regras 2 e 3`

### Tarefa 3 — Regras 1, 4, 5 e precedência 8

**Testes primeiro**
- regra 1: ⏳ `[P,E]` → erro `{indice:2, regra:1, mensagem:'Cliente em espera não recebe mensagem'}`;
  ⏳ `[A,P,A,E]` → erro regra 1 índice 4 (vale com Atender no meio); ⏳ `[E,P,A,E]` → erro regra 1 índice 4 (o Atender libera a regra 4, não a 1)
- **regra 1 com `desconhecido`:** ⏳ `[E]`, `[A,E,P,M]`, `[A,E]` → ok (o motor pula os pausados)
- regra 4: ⏳ `[E,E]`, `[E,EF]`, `[EF,E]` (esta cai na regra 2) → erro; `[E,A,E]` → ok (Atender no meio libera);
  mensagens diferentes não escapam: `[E(“a”),E(“b”)]` → erro regra 4 índice 2
- **precedência (regra 8):** ⏳ `[E,P,D,E]` → erro `{indice:4, regra:4}` (e **não** regra 1), `correcao` = "Remover passo 4"
  (não sugere Despausar, porque houve envio antes)
- **sugestão de Despausar só sem envio antes:** ⏳ `[P,E]` → `correcao` sugere "coloque Despausar antes" e traz
  `{acao:'inserir', indice:2, passo:'despausar'}` além de remover; ⏳ `[E,P,E]` → só "Remover passo 3"
- regra 5: ⏳ `[P,P]` → erro índice 2; `[D,D]` e `[P,D,D]` → erro **contendo** a regra 5 (além da 3); `[P,A,P]` → ok (adjacência literal; ver ambiguidade 4)
- ⏳ `[P,D,P]` → ok; ⏳ `[E,P,D]` → ok
- frases do modal: "O passo 3 · Enviar vem depois de 2 · Pausar." para ⏳ `[E,P,E]`→ (regra 4) e `[P,E]` (regra 1)
  com texto correspondente
- **regra 10 — `erroDoModal(erros)`:** devolve o erro do **primeiro passo com erro**, escolhendo a regra na ordem
  **indisponível → 2 → 3 → 4 → 1 → 5**:
  - ⏳ `[D,D]` → modal mostra regra 3 (não a 5); índice 2; `erros` continua com as duas (passo vermelho)
  - 🆕 `[D]` → modal mostra **indisponível** (não a regra 3)
  - ⏳ `[E,E,D,D]`… primeiro passo com erro é o 2 (regra 4), não o 4
  - ⏳ `[EF,P,P]` → índice 2 (regra 2) vence o índice 3 (regra 5)
  - ⏳ `[E,P,D,E]` → regra 4 (4 antes de 1); `ok:true` → `erroDoModal` devolve `null`
- 👥 usa o estado por chat (regra 11): 👥 `[E,P]` → ok; sem diferença prática, pois Despausar não existe em 👥

**Comando:** `npm test` · **Commit:** `feat(validador): regras 1, 4, 5, precedência da regra 4 e escolha do erro do modal (regra 10)`

### Tarefa 4 — Loop efetivo, modos, disponibilidade e tamanho

O loop **deixa de ser erro**: `loopEfetivo({paraQuem, passos, loopEscolha}) → {efetivo, motivo}` (§7, regras 6 e 7).

**Testes primeiro**
- ⏳ `loopEscolha:true`, `[A,E,P,M]` → `{efetivo:true}`; `[E,P,M]` → `{efetivo:false, motivo:'O loop precisa de Atender em 1º'}`
- **regra 9 (não simula a volta):** ⏳ `[A,E,P]` com loop → `validarFluxo` ok
- ⏳ `loopEscolha:false`, `[A,E,P]` → efetivo false, `motivo:null` (desligado pelo usuário, não por regra)
- 🆕/👥 → `{efetivo:false, motivo:'Este modo já vigia até Parar'}` e a `loopEscolha` é ignorada (sem erro)
- `disponibilidade(paraQuem)`: ⏳ → `{atender:true, despausar:true}`; 🆕 → `{atender:false, despausar:false}`;
  👥 → `{atender:false, despausar:false}` (§4: Despausar só em ⏳)
- passo indisponível **fica no fluxo**: 🆕 `[A,E]` → erro `{indice:1, regra:'indisponivel', mensagem:…, dica:"use 'Também puxar a fila'"}`;
  👥 `[E,P,D]` → erro índice 3 (indisponível, além da regra 3)
- trocar o modo não apaga: `validarFluxo` de ⏳ `[A,E,P,D]` ok → mesmo fluxo em 🆕 → erros nos índices 1 e 4
- `[]` → `fluxo-vazio`; 9 passos → `muitos-passos` (1 a 8); `paraQuem:null` → `sem-para-quem`

**Comando:** `npm test` · **Commit:** `feat(validador): loop efetivo, disponibilidade por modo e limite de 1 a 8 passos`

### Tarefa 5 — Campos obrigatórios (§4)

`src/js/puro/validar-campos.js` + teste.

**Testes primeiro**
- `validarCampos({tipo:'enviar', modo:'so', mensagem:'  '})` → `[{campo:'mensagem'}]`
- `{tipo:'enviar', modo:'finalizar', mensagem:'oi', tag:''}` → `[{campo:'tag'}]`
- `{tipo:'mover', pasta:''}` → `[{campo:'pasta'}]`; `{tipo:'transferir', atendente:''}` → `[{campo:'atendente'}]`
- `{tipo:'espera', modo:'pausar'}` e `{tipo:'atender'}` → `[]`
- `podeIniciar(fluxo)` → `false` com erro de ordem **ou** campo vazio **ou** sem "Para quem?"

**Comando:** `npm test` · **Commit:** `feat(validador): campo obrigatório vazio bloqueia o Iniciar`

---

# Etapa 3 — Velocidade (§8, §12.3)

### Tarefa 6 — Funções puras

`src/js/puro/velocidade.js` + `test/unidade/velocidade.test.mjs`.

**Testes primeiro**
- `pausa(1200, 1)` → 1200; `(1200, 2)` → 600; `(1200, 0.5)` → 2400; `(500, 2)` → 250; `(1000, 1.5)` → 667
- piso de 50%: `pausa(1200, 3)` → 600; `pausa(1200, 0.1)` → 2400
- `normalizarVelocidade('1.25')` → `{valor:1.3, aviso:null}`; `(2.5)` → `{valor:2, aviso:'Máximo 2.0'}`;
  `(0.2)` → `{valor:0.5, aviso:'Mínimo 0.5'}`; `('')` → `{valor:1, aviso:null}`; `('abc')` → `{valor:1, aviso:'Valor inválido'}`
- `velocidadeDoPasso({velocidade:null}, 1.2)` → 1.2; `({velocidade:1.5}, 1.2)` → 1.5; `seloVelocidade` → `'×1.5'` / `null`
- **pausa entre ciclos ignora a velocidade (§7/§8):** `pausaEntreCiclos(1, 2)` → 1000 (s→ms, sem dividir);
  `normalizarPausaCiclos(75)` → `{valor:60, aviso}`; `(-1)` → 0; padrão 1

**Comando:** `npm test` · **Commit:** `feat(velocidade): pausa = pausa atual ÷ velocidade com piso de 50%; pausa entre ciclos fica fora`

### Tarefa 7 — Inventário das pausas e aplicação pelo critério da natureza

Os ~70 `sleep(` estão espalhados por muitas funções: **não há `refactor(mover)` aqui** (uma mudança que só move linhas
não consegue juntá-los). Os pontos de chamada mudam **no lugar**, no commit de comportamento, protegidos pela guarda
e pelo teste "velocidade 1.0 ⇒ mesmos valores de `sleep` que antes".

**Critério (§8): a natureza da pausa, não o número de ms.** **Entra** = ritmo fixo entre ações (entre cliques, entre
tickets, intervalo do Atender). **Não entra** = espera de UI/segurança (esperar algo carregar/aparecer depois de um
clique, polling, recuo após erro). **Na dúvida, não entra.**
- Sempre entram: `delayAcoes`, `delayTrocaTicket` (onde for ritmo), intervalo do Atender (500 ms), `AUTO_T.entreTickets`.
- Sempre ficam de fora: `waitFor` e prazos de `AUTO_T`/`TRANSF_T`; `debounce`, `reconciliar`, `janelaFiltro`,
  `janelaRolagem`, observers; `AUTO_T.espera`; `TRANSF_T.esperaModal`; `TRANSF_T.leituraVazia`; digitação do Transferir
  (40/110 ms, `atraso`); recuo de 5000 ms; pausa entre ciclos; o piso `Math.max(800, delayTrocaTicket)` (espera de
  carregamento: **não escala**, e `delayTrocaTicket` dentro dele também não).
- Os demais literais (120, 150, 250, 300, 350, 400, 550, 600, 750, 1400, 1500, 1600…): **um a um** pelo critério.
  **Sem esperar revisão do BM**; a tabela vai para o relatório final (Tarefa 24).

**Arquivos**
- `docs/plano/pausas.md`: tabela com **uma linha por `sleep(`**: arquivo/linha, valor, função, decisão
  (**ritmo → entra** / **espera de UI → não entra**) e motivo de uma frase
- `src/js/puro/pausas.js` (`velocidadeAtual`, `pausaAcao(ms)` = `sleep(pausa(ms, velocidadeAtual))`)
- `test/unidade/pausas-lista-fechada.test.mjs`
- este é o primeiro commit que muda o bundle de propósito: remove `scripts/extrair.mjs` e o teste "idêntico ao 3ca5940"

**Testes primeiro**
- **guarda de código:** lê `src/js/**`, acha todo `sleep(` e exige uma linha correspondente em `pausas.md`; decisão
  "entra" ⇒ a chamada é `pausaAcao(…)`; "não entra" ⇒ continua `sleep(…)`. Ocorrência sem linha → falha
  ("classifique esta pausa em docs/plano/pausas.md")
- cada linha de `pausas.md` tem motivo preenchido e decisão ∈ {entra, não entra}; "sempre de fora" nunca marcado "entra"
- `pausaAcao(1200)` com velocidade 2 → `sleep(600)` (relógio falso); com 1 → `sleep(1200)` (**idêntico a hoje**)
- `AUTO_T.entreTickets` 600 → 300 com 2.0; `AUTO_T.espera` → 1000 com 2.0; `esperaModal`, `leituraVazia`, 40/110 ms,
  5000 ms → inalterados; `Math.max(800, delayTrocaTicket)` com 2.0 → continua ≥ 800
- com velocidade 1.0 a sequência de valores passados a `sleep` num cenário falso é **igual** à do código antigo
  (garante que o painel antigo continua como hoje)

**Comando:** `npm test && npm run build` · **Commit:** `feat(velocidade): aplica a velocidade às pausas de ritmo, classificadas uma a uma em pausas.md`

---

# Etapa 4 — Motor (§5, §7, §10, §12.4)

O motor recebe o **fluxo como dados** (`{paraQuem, passos, loopEscolha, pausaCiclos, velocidade, puxarFila}`) e é
testado na página falsa **sem a tela nova**. As abas antigas seguem funcionando.

### Tarefa 8 — Página falsa do Blip (dados fictícios)

`test/e2e/blip-falso/index.html` + `blip-falso.js` + `test/e2e/util.mjs` (abre o Chromium, carrega a página, injeta o
bookmarklet gerado por `gerarHtml()`). A página imita os seletores que o código usa (`AUTO_SEL`, `TRANSF_SEL`, menu do
ticket, opções de espera, "Mover para", Atender + contador, campo de mensagem, tag, Finalizar + modal, modal de
transferência com autocomplete). Interruptores de comportamento: S1 (mover tira da lista), S2, S3, atrasos, falhas
forçadas, botão Atender ausente.

**Testes primeiro**
- Atender com fila 3 → lista +1, contador 2; pausar pelo menu → ticket pausado; mover → ticket sai (S1 ligada) ou fica (S1 desligada)
- cada seletor de `AUTO_SEL`/`TRANSF_SEL` encontra ≥1 elemento na página falsa; **o que não encontrar vira lista de
  "seletor a confirmar" e eu peço o `outerHTML` ao BM** (não invento)
- o bookmarklet gerado injeta sem erro no console e abre as 5 abas antigas

**Comando:** `npm run build && npm run e2e` · **Commit:** `test(e2e): página falsa do Blip e utilitário de injeção do bookmarklet`

### Tarefa 9 — Motor puro ⏳ Aguardando

`src/js/puro/motor.js` → `executarFluxo(fluxo, acoes, relogio, eventos)`; `acoes` reais no bookmarklet, falsas no teste.

**Testes primeiro**
- `[A,E,P,M]` loop off → chama atender, enviar, pausar, mover uma vez, nessa ordem, com os campos do passo
- loop efetivo, fila falsa `[3,0,0,2]` → 1º ciclo roda; fila 0 ⇒ sentinela vigia até 2 e roda o 2º ciclo
- loop escolhido mas sem Atender em 1º → **não repete** (loop efetivo false)
- **pausa entre ciclos** 1 s → relógio falso registra 1000 ms, **igual com velocidade 0.5 e 2.0**
- **regra 9 no motor:** `[A,E,P]` em loop, 2º ciclo com tickets 11,12 já enviados/pausados e 13 novo → enviar só 13;
  log "já estava em espera" para os pausados puxados de novo; ninguém recebe duas mensagens
- Enviar com `pausados` desconhecido: tickets 1 (ativo) e 2 (pausado) → envia só ao 1; 2 é pulado e anotado
- Despausar como 1º passo em ⏳ → `despausar` chamado antes de tudo, sem Atender
- **memória só da execução (§5):** ticket 7 enviado no ciclo 1 não recebe no ciclo 2 do mesmo Iniciar; ticket 7 que
  **volta à fila** num **novo Iniciar** recebe o fluxo (memória zerada); a chave `rf_rodbot_auto_tickets_v1` **não é lida
  nem gravada** em ⏳
- **card sem id extraído:** pulado e anotado no log ("card sem número, pulado"); enviar nunca é chamado para ele
- **nenhum** card da tela com id → falha **geral** do passo (para o fluxo, passo `Falha`)
- falha de **item** (`enviar` devolve `{falhas:1}`) → segue; log "… 1 falha"
- falha **geral** (`ErroGeral('botão Atender não encontrado')`) → para, passo `Falha`, motivo no log, passos seguintes não chamados
- log inicial `"Fila: 12 · Na tela: 8 · Pausados: 3"`; fim de ciclo `"Ciclo #3: 5 atendidos · 5 enviados · 5 pausados · 5 movidos · 0 falhas"`
- Pausar/Parar globais: `parar()` no meio do passo 2 → passo 3 não roda; `pausar()` segura o próximo passo
- **EF em ⏳** continua abrindo o próximo até esvaziar (passa `abrirProximo:true`)

**Comando:** `npm test` · **Commit:** `feat(motor): executa o fluxo em lote com loop, sentinela, falhas e controle por ticket`

### Tarefa 10 — Motor puro 🆕 Que vão cair e 👥 Ambos

Reaproveita a lógica do Auto (`03-auto.js`) por baixo; fica com observador falso nos testes.

**Testes primeiro**
- 🆕 `[E,P]`, chegam 101 e 102 → 101 faz enviar→**confirmar**→pausar, depois 102; nunca intercalados
- envio não confirmado → não pausa, falha de item anotada, segue para o 102
- 🆕 usa as **24 h do Auto**: id 101 reaparece (inclusive depois de reabrir o painel) → ignorado (`rf_rodbot_auto_tickets_v1`);
  chats presentes **antes** de ativar → ignorados em 🆕
- 👥 → roda o fluxo **uma vez** nos que aguardam (sem loop) usando a **memória da execução**; os tratados entram nela
  **e** na de 24 h; a fase de vigia usa as 24 h; ticket do lote que "cai" de novo não recebe outra vez; ticket de uma
  execução anterior (≤ 24 h) que está na fila de espera **ainda é tratado** no lote (a 24 h só vale na vigia)
- "Também puxar a fila" ligada → motor chama `atender`; os puxados contam como "caiu" e recebem o fluxo uma vez; desligada → nunca chama `atender`
- 🆕/👥 `[EF]` → `abrirProximo:false`; finaliza só o chat atual
- velocidade: `AUTO_T.entreTickets` entre chats usa `pausaAcao`; `AUTO_T.espera` não
- um fluxo por vez: iniciar outro enquanto roda → recusado com "Já há um fluxo rodando"

**Comando:** `npm test` · **Commit:** `feat(motor): modos Que vão cair e Ambos com um chat por vez e sem envio duplo`

### Tarefa 11 — Ligar o motor às funções atuais (parâmetros em vez de campos da tela)

Primeiro `refactor(mover)` isolando as funções que serão tocadas (`passo1…5`, `executarModoEsperaTodos`,
`executarMoverParaPastaTodos`, `executarEscreverParaTodos`, `executarAtendimentoAutomatico`, `tTransferirTicket`,
`autoProcessarTicket`). Depois cada uma passa a aceitar mensagem/tag/pasta/atendente/`abrirProximo` por **parâmetro**,
mantendo o comportamento antigo quando chamada sem parâmetro (as abas antigas continuam). O motor é exposto em
`window.__rodBot.executarFluxo` **só quando** `window.__rodBotTeste === true` (§12.4).

**Testes primeiro**
- unidade: cada função chamada com parâmetros não lê `CONFIG`/campo da tela; chamada sem parâmetro → idêntica a hoje
- unidade: nenhuma função do motor referencia `pilot…`/`obterCamposPainel`
- e2e leve: `executarFluxo` com `[E]` e mensagem `"Olá"` na página falsa → mensagem digitada e enviada 1×
- **gancho:** sem `__rodBotTeste` → `window.__rodBot` é `undefined`; com a flag definida antes de injetar → `executarFluxo` existe
- **ids em ⏳:** a extração reaproveita `autoColetarTickets`/id do card do Auto; se o seletor falhar na página falsa →
  **parar e pedir o `outerHTML` do card ao BM** (não inventar)

**Comando:** `npm run verificar` · **Commits:** `refactor(mover): isola as funções de ação` · `feat(motor): ações recebem parâmetros e o motor roda o fluxo por dados`

### Tarefa 12 — Motor na página falsa, sem a tela nova

**Testes primeiro** (e2e; chama `__rodBot.executarFluxo` direto)
- ⏳ Piloto clássico, fila 3, S1 ligada → 3 atendidos · 3 enviados · 3 pausados · 3 movidos; log do ciclo certo
- ⏳ `[D]` com 2 pausados → ficam ativos; ⏳ `[A,E,P]` loop com ticket novo no 2º ciclo → 1 mensagem por ticket
- 🆕 Auto clássico → chat que cai depois recebe 1 mensagem e é pausado; chat antigo não
- 👥 `[E,P]` → antigos e novos recebem 1 mensagem cada; Transferir `"Atendente Fictício"` → tickets saem
- botão Atender ausente → fluxo para, passo Falha, motivo no log
- velocidade 2.0 vs 1.0 → tempo total menor e **nenhuma pausa medida abaixo de 50%**; pausa entre ciclos igual nas duas
- as 5 abas antigas continuam executando como antes (regressão)

**Comando:** `npm run verificar` · **Commit:** `test(e2e): motor nos três modos, falhas e velocidade na página falsa`

---

# Etapa 5 — Tela (§3, §4, §5, §9, §12.5)

Tudo atrás de `rf_rodbot_ui_nova_v1`; as abas antigas só saem na Tarefa 22.

### Tarefa 13 — Fluxos salvos (puro, `localStorage` injetado)

`src/js/puro/fluxos-salvos.js` + teste. Chaves novas: `rf_rodbot_fluxos_v1`, `rf_rodbot_fluxo_atual_v1`.

**Testes primeiro**
- vazio → `listar()` = `[⭐ Piloto clássico, ⭐ Auto clássico]`; `atual()` = Piloto clássico
- Piloto clássico = `{paraQuem:'aguardando', loopEscolha:true, pausaCiclos:1, velocidade:1, passos:[A, E(so, mensagem:''), P, M]}`;
  Auto clássico = `{paraQuem:'caindo', passos:[E(so, mensagem:''), P]}` — **mensagens vazias** (§9)
- `validarFluxo`/`validarCampos` do Piloto clássico: ordem ok, campo `mensagem` vazio ⇒ `podeIniciar` false
- **nunca preenche `MENSAGEM_PADRAO` sozinho:** nenhum caminho de `listar/atual/salvar` grava essa mensagem
- salvar → aparece; recarregar → igual (passos, campos, paraQuem, **loopEscolha**, pausaCiclos, velocidades)
- **loop guarda a escolha:** salvar com `loopEscolha:false` e sem Atender em 1º; recarregar → continua false; colocar
  Atender em 1º → `loopEfetivo` false (usuário desligou); salvar com `true`, tirar Atender → efetivo false mas
  `loopEscolha` segue true; recolocar → efetivo true
- 11º fluxo **do usuário** → `{ok:false, motivo:'Limite de 10 fluxos'}`; com 10 do usuário + 2 modelos, `listar()` tem 12
- modelo não apagável nem sobrescrevível; `salvar` com nome de modelo → `{ok:false}`
- editar modelo em memória e reabrir → volta ao original; 💾 sempre cria novo com nome
- `novoVazio()` → `{paraQuem:null, passos:[]}`
- JSON corrompido → volta aos modelos sem lançar erro

**Comando:** `npm test` · **Commit:** `feat(fluxos): modelos fixos, até 10 fluxos do usuário e escolha do loop persistida`

### Tarefa 14 — Migração na 1ª abertura (só o que existe)

`src/js/puro/migracao.js` + teste. Marca `rf_rodbot_migracao_v1`. Fato lido no código (§9): só tema, aba, pastas
recentes, mensagem do Auto, contador e tickets são gravados.

**Testes primeiro**
- `rf_rodbot_auto_msg_v1='Olá'` → Enviar do ⭐ Auto clássico com `mensagem:'Olá'`
- **sem** mensagem do Auto → Enviar do Auto clássico **vazio**; Enviar do Piloto clássico **sempre vazio**
- **nada** é lido de mensagem/pasta do Piloto, Envio ou Pastas (não são persistidos): teste confirma que a migração só
  acessa `rf_rodbot_auto_msg_v1`, `rf_rodbot_recent_folders_v1` e `rf_rodbot_tab_v1`
- `rf_rodbot_recent_folders_v1` continua alimentando os chips do Mover
- aba `pasta|mensagem|fila|auto|piloto` → abre em **Montar**; `acompanhar` ou desconhecido → `montar`
- 2ª execução não sobrescreve; **nenhuma chave antiga é apagada** (`getItem` ainda devolve os valores)

**Comando:** `npm test` · **Commit:** `feat(fluxos): migra só a mensagem do Auto e leva a aba antiga para Montar`

### Tarefa 15 — Casca: duas abas novas (atrás do interruptor)

Primeiro `refactor(mover)` extraindo `getSavedTab/saveTab/aplicarAba` e o HTML das abas para arquivos próprios. Depois a
casca nova: com `rf_rodbot_ui_nova_v1='1'` aparecem **🧩 Montar | 📊 Acompanhar**; sem ele, as 5 abas antigas como hoje.

**Testes primeiro** (e2e)
- interruptor ligado → exatamente 2 abas visíveis; desligado → 5 abas antigas (regressão)
- aba antiga salva (`fila`) com interruptor ligado → abre em Montar
- cabeçalho (rod bot, status, Tema, fechar) igual; trocar tema funciona; abrir duas vezes não duplica o painel

**Comando:** `npm run verificar` · **Commit:** `feat(painel): abas Montar e Acompanhar atrás do interruptor`

### Tarefa 16 — Para quem? + paleta + lista de passos

**Testes primeiro** (e2e)
- fluxo vazio → paleta com destaque; **fluxo novo ("+") sem modo** → paleta desabilitada com a dica "Escolha para quem
  primeiro" e Iniciar bloqueado
- tocar ✉️ → "1 · ✉️ Enviar" no fim; tocar 📁 → "2 · 📁 Mover"; ▲ ▼ ✕ reordenam/removem e renumeram; 8 passos → paleta desabilitada "Máximo 8 passos"
- **sem botão "+ Adicionar passo"** no DOM (só a paleta)
- só o cartão tocado fica aberto; os outros mostram resumo de uma linha (ex.: `✉️ Enviar · Só enviar · “Realizamos…”`)
- 🆕/👥 → 📥 Atender some/desabilita na paleta; Espera mostra só **Pausar** (Despausar some em 🆕 **e** 👥); ⏳ mostra os dois
- sem modo escolhido, tocar ✉️ → seletor pisca
- **trocar o modo** com `[A,E,P,D]` de ⏳ para 🆕 → Atender e Despausar **continuam no fluxo, em vermelho com o motivo**; Iniciar bloqueado; nenhum passo apagado

**Comando:** `npm run verificar` · **Commit:** `feat(montar): Para quem?, paleta e lista de passos com ▲ ▼ ✕`

### Tarefa 17 — Campos dos passos

**Testes primeiro**
- Enviar: Só enviar | Enviar + Finalizar; Tag só no Finalizar; "Usar padrão" preenche `MENSAGEM_PADRAO` **só ao tocar**
- Piloto clássico recém-aberto: campo Mensagem **vazio e vermelho**, Iniciar bloqueado; tocar "Usar padrão" → libera
- Espera: Pausar | Despausar; Mover: chips `nv2`, `default` e recentes; Transferir: nome do atendente
- campo vazio → borda vermelha + Iniciar bloqueado; velocidade do passo `1.5` → selo `×1.5`; `9` → `2.0` com aviso no campo

**Comando:** `npm run verificar` · **Commit:** `feat(montar): campos de cada passo com velocidade própria e bloqueio de vazio`

### Tarefa 18 — Validação na tela + modal (layout-M)

**Testes primeiro**
- ⏳ `[E,P]` + tocar ✉️ → passo 3 vermelho com frase curta **e** modal "⛔ Esta ordem não é aceita" com
  "O passo 3 · Enviar vem depois de 2 · Pausar." e botões "Entendi" / "Remover passo 3"
- **regra 8 no modal:** `[P,E]` → texto sugere "coloque Despausar antes"; `[E,P,D,E]` → **não** sugere Despausar, só "Remover passo 4"
- "Remover passo N" remove e libera o Iniciar; "Entendi" fecha e mantém vermelho + Iniciar bloqueado
- Iniciar com ordem inválida → abre o modal do 1º erro; erro sem correção → só "Entendi"

**Comando:** `npm run verificar` · **Commit:** `feat(montar): passo inválido em vermelho e modal com correção`

### Tarefa 19 — ⚙️ Ajustes

**Testes primeiro**
- recolhido com resumo "Velocidade 1.0 · Loop ligado · 1 s entre ciclos"; velocidade `3` → `2.0` com aviso
- ⏳ **sem Atender em 1º:** interruptor desabilitado com o motivo, **mantendo a escolha**; recolocar Atender em 1º →
  volta ao que o usuário tinha (desligou antes → continua desligado; padrão ligado)
- pausa entre ciclos 0–60 (`90` → 60 com aviso); texto "não muda com a velocidade"
- "Também puxar a fila" só em 🆕/👥, desligada por padrão; loop e pausa entre ciclos somem em 🆕/👥

**Comando:** `npm run verificar` · **Commit:** `feat(montar): ajustes de velocidade, loop, pausa entre ciclos e puxar fila`

### Tarefa 20 — Fluxos salvos na tela

**Testes primeiro**
- 1ª abertura → "⭐ Piloto clássico" carregado, Enviar vazio/vermelho; trocar para Auto clássico → 🆕 `[E,P]` com a mensagem do Auto migrada
- 💾 pede nome e cria **novo**; reabrir → último usado carregado; modelos sem opção de apagar
- editar modelo e trocar de fluxo → pergunta **"Salvar como novo / Descartar"**; Descartar → modelo volta ao original
- "+" → fluxo vazio sem "Para quem?"; 11º fluxo do usuário → aviso de limite (modelos não contam)

**Comando:** `npm run verificar` · **Commit:** `feat(montar): seletor de fluxos salvos, salvar como novo e fluxo vazio`

### Tarefa 21 — Acompanhar

Puro `src/js/puro/stepper.js` (`montarStepper(passos, execucao)`) + teste.

**Testes primeiro**
- unidade: `montarStepper([A,E,P,M], {passoAtual:1, feitos:[0]})` → `['Feito','Rodando','Aguardando','Aguardando']`;
  rótulo `'📁 Mover → nv2'`; falha no passo 2 → `'Falha'`
- e2e: nome do fluxo + "Ciclo #N", stepper na ordem do usuário, Pausar/Parar, log
- contadores do Auto (Novos chats, Contador Blip, Na fila do BM, lista, Retomar, Repetir pausas pendentes, Zerar contador) **só em 🆕/👥**

**Comando:** `npm run verificar` · **Commit:** `feat(acompanhar): stepper com os passos do usuário, contadores do Auto e log`

### Tarefa 22 — Ligar ao motor, pular para Acompanhar e remover as abas antigas

Aqui (e só aqui) a UI nova vira padrão: o **painel antigo e o interruptor `rf_rodbot_ui_nova_v1` são removidos** (sem chave
inerte no `localStorage`). Este é o **primeiro HTML com a UI nova** e o primeiro que pode ir para o BM. Antes:
`refactor(mover)` isolando os trechos do Piloto, Envio, Pastas e Fila/Auto que serão removidos.

**Testes primeiro** (e2e na página falsa)
- Iniciar válido → painel pula para Acompanhar, status "Rodando", stepper do fluxo
- Parar → "Parado"; Pausar alterna para "Retomar"; só um fluxo por vez (Iniciar desabilitado enquanto roda)
- falha geral → passo vermelho no stepper e motivo no log
- DOM sem ids das abas Pastas/Envio/Fila/Auto/Piloto antigo; **nenhuma referência a `rf_rodbot_ui_nova_v1`** em `src/`
  e, numa abertura limpa, a chave não é lida nem criada no `localStorage`
- o HTML gerado só contém a UI nova (o painel antigo não está no bundle)
- unidade: nenhuma referência a `executarPilotoLoop`, `pilotoEtapa*`, `autoBloqueiaOutras`, `obterCamposPainel`

**Comando:** `npm run verificar` · **Commit:** `feat: Iniciar roda o fluxo montado e remove as abas antigas`

---

# Etapa 6 — Playwright e entrega (§12.6)

### Tarefa 23 — Cenários de ponta a ponta pela tela

**Testes primeiro** (página falsa, pela UI real)
- montar `[A,E,P,M]` ⏳ e iniciar; montar `[E,P]` 🆕; montar 👥 `[E,P]`; transferir `"Atendente Fictício"`
- ordem inválida → modal e Iniciar bloqueado; campo vazio → nada executa
- velocidade 2.0 na tela → mais rápido, sem pausa abaixo de 50%; mensagem do Auto migrada aparece no Auto clássico
- tema continua trocando; recarregar mantém o último fluxo

**Comando:** `npm run verificar` · **Commit:** `test(e2e): fluxos montados pela tela nos três modos`

### Tarefa 24 — Entrega

`docs/plano/entrega-piloto.md` e `README.md`. Diz claramente o que **não** foi testado no site real: S1–S3 (§11), tempos
reais do Blip, **CSP do Blip** (bookmarklet maior), seletores só verificados na página falsa, contagem de
"Na tela/Pausados" no log. Checklist para o BM conferir no Blip real antes de liberar. **Inclui a tabela completa de `docs/plano/pausas.md`**
(ritmo × espera de UI, uma linha por `sleep`) para o BM revisar depois.

**Teste:** `npm run verificar` verde · **Commit:** `docs: notas de entrega do novo Piloto e o que falta testar no Blip real`

---

## Pontos ainda ambíguos

Nenhum. Os 3 últimos foram decididos e estão na spec (`be2729f`): log "⚠️ N card(s) sem número, pulado(s)" por ciclo em ⏳;
em 👥 o ticket de execução anterior ainda na tela é tratado de novo com o log "tratado de novo (execução anterior)"
(só informativo); a memória de ⏳ é só da execução porque o BM pode querer outro fluxo ou mensagem nos mesmos tickets no
mesmo dia (parar e iniciar de novo trata os mesmos tickets de novo); a tabela `pausas.md` é aplicada pelo critério do §8
sem revisão prévia e listada no relatório final.

## Andamento

- Tarefa 1: feita (commit `build: divide o bookmarklet em 4 trechos…`). Parar aqui para conferência do BM.
- Tarefa 2: feita. `src/js/puro/validar-fluxo.js` ainda **não** entra em `ordem.txt` (o bundle não muda até a
  Tarefa 7, então a prova de ida e volta da Tarefa 1 continua valendo); entra quando o motor/UI o usarem.
  A Tarefa 2 já traz a regra `indisponivel` (Atender/Despausar em 🆕/👥), porque os testes dela dependem disso; a
  Tarefa 4 acrescenta o resto (loop efetivo, limites, `sem-para-quem`).
- Tarefa 3: feita (regras 1, 4, 5, precedência 4 › 1, `erroDoModal` na ordem da regra 10 e `textoModal` com as frases do layout-M).
  Fora do bundle, como a Tarefa 2.
- Tarefa 4: feita (`loopEfetivo` com `habilitado`, `disponibilidade`, erros globais `sem-para-quem`/`fluxo-vazio`/`muitos-passos`). Fora do bundle.
- Tarefa 5: feita (`validarCampos`, `podeIniciar`). Fora do bundle. Etapa 2 (validador) concluída.
