# Plano de implementação — novo Piloto do rod bot

Fonte única: `docs/plano/spec-piloto.md` (citada como §N). Layout: **D + A com a paleta da B**; modal em
`layouts/layout-M.png`. A ordem segue o §12. Nada aqui está implementado ainda.

## Regras do plano

- **Testes primeiro** em toda tarefa: escrever o teste, ver falhar, implementar, ver passar, commitar.
- **Nunca editar o `javascript:` codificado** de `rodbot-final.html` à mão. A partir da Tarefa 1 o HTML é
  **gerado** por `npm run build` a partir de `src/`; o teste `html-sincronizado` falha se alguém editar o HTML.
- Sem dependências novas: `node:test` (Node 22) para unidade e a biblioteca `playwright` já instalada para a tela.
- Cada commit deixa `npm test` verde e `rodbot-final.html` regenerado no mesmo commit.
- Funções puras (validador, velocidade, fluxos salvos, motor) ficam em `src/puro/`, sem tocar no DOM, e são
  testadas no Node. Elas entram no bookmarklet pela concatenação normal do build.

## Comandos (criados na Tarefa 1)

| Comando | Faz |
|---|---|
| `npm run build` | `src/` → `rodbot-final.html` |
| `npm test` | testes de unidade (`node --test test/unidade`) |
| `npm run e2e` | testes de tela com Playwright (`node --test test/e2e`) |
| `npm run verificar` | `npm test` + `npm run e2e` |

## Fatos do arquivo atual que guiam a Tarefa 1

- `rodbot-final.html`: 581.517 caracteres, 405 linhas, LF. O código aparece **duas vezes**, idêntico:
  `<a id="bm-button" href="javascript:…">` e `<input id="bm-code" … value="javascript:…">` (285.647 caracteres cada).
- Decodificado: 163.994 caracteres, 3.879 linhas; começa em `(function () {` e termina em `})();;void 0;`.
- Codificação = `encodeURIComponent` **mais** `! ' ( ) *` em `%XX` maiúsculo (crus: `A–Z a–z 0–9 - _ . ~`).
  Conferido: `quote(decodificado, safe="-_.")` em Python reproduz o original exatamente. O código atual não tem `~`;
  segue a regra do `encodeURIComponent` (fica cru).
- O código é uma IIFE única com estado compartilhado por closure ⇒ os arquivos de `src/` são **trechos
  concatenados em ordem** (não módulos ES). A ordem fica em `src/ordem.txt`.

---

## Bloco 1 — Extração e build (§12.1)

### Tarefa 1 — Extrair o `javascript:` para `src/` e build com ida e volta idêntica

**Arquivos**
- `package.json` (scripts acima, `"type": "module"`, sem dependências)
- `scripts/codec.mjs` — `codificar(js)` / `decodificar(url)` (regra de codificação acima)
- `scripts/extrair.mjs` — uso único: lê `rodbot-final.html`, decodifica, corta em trechos e grava `src/`;
  recusa rodar se `src/` já existir
- `scripts/build.mjs` — concatena `src/ordem.txt`, codifica, injeta nos **dois** marcadores do modelo e grava
  `rodbot-final.html`; exporta `gerarHtml()` para os testes
- `src/pagina/instalacao.html` — a página de instalação com o marcador `__RODBOT_BOOKMARKLET__` (2×)
- `src/ordem.txt` + trechos (cortes em linhas em branco entre seções; ≤ ~400 linhas cada), proposta:
  `00-inicio.js` (limpeza de instância anterior) · `01-config-storage.js` (MENSAGEM_PADRAO, CONFIG, chaves, tema/aba/pastas)
  · `02-estilos.js` (CSS do painel) · `03-wakelock.js` · `04-painel-html.js` · `05-painel-ui.js` (tema, arrastar,
  abas, chips) · `06-utilitarios.js` (log, sleep, waitFor, enviarTextoNoChat) · `07-envio-finalizar.js` (passo1–5)
  · `08-estado-botoes.js` · `09-menu-ticket.js` · `10-percorrer-fila.js` · `11-mover-pasta.js` · `12-espera.js`
  · `13-loop-controles.js` · `14-atender.js` · `15-piloto.js` · `16a-auto-estado.js` · `16b-auto-deteccao.js`
  · `16c-auto-processo.js` · `16d-auto-ui.js` · `17a-transferir-dom.js` · `17b-transferir-exec.js` · `18-fechar.js`
- `test/unidade/codec.test.mjs`, `test/unidade/ida-e-volta.test.mjs`, `test/unidade/html-sincronizado.test.mjs`
- `README.md` — seção "Como editar": editar `src/`, rodar `npm run build`, nunca o HTML

**Testes primeiro (entrada → esperado)**
- `codificar("a b(c)!*'~é")` → `"a%20b%28c%29%21%2A%27~%C3%A9"`
- `codificar("A-z_0.9")` → `"A-z_0.9"` (inalterado)
- `decodificar(codificar(x)) === x` para o JS decodificado inteiro
- **Ida e volta (antes de qualquer mudança):** `concat(src/ordem.txt) === decodificar(href atual)` e
  `gerarHtml() === conteúdo de rodbot-final.html do commit 3ca5940` (byte a byte; também compara SHA-256)
- `instalacao.html` contém `__RODBOT_BOOKMARKLET__` exatamente 2× e nenhum trecho de `src/` contém o marcador
- `html-sincronizado`: `gerarHtml() === readFile('rodbot-final.html')`; mensagem de falha:
  "rodbot-final.html difere de src/ — rode npm run build; não edite o HTML à mão"
- Todo arquivo listado em `ordem.txt` existe e todo `.js` de `src/` (fora de `pagina/`) está listado

**Comando:** `node scripts/extrair.mjs && npm run build && npm test && git diff --exit-code rodbot-final.html`

**Commit:** `build: extrai o código do bookmarklet para src/ e gera rodbot-final.html idêntico ao atual`

> Depois desta tarefa o teste de ida e volta "idêntico ao 3ca5940" é **removido** (cumpriu o papel no commit
> acima); o `html-sincronizado` fica para sempre. `scripts/extrair.mjs` é apagado no mesmo commit, para ninguém
> rodá-lo de novo — fica no histórico.

---

## Bloco 2 — Validador puro (§6, §12.2)

Arquivo único `src/puro/validar-fluxo.js` (entra em `ordem.txt` logo após `01-config-storage.js`) e
`test/unidade/validar-fluxo.test.mjs`. Ajudante `test/util/carregar-puro.mjs` carrega um arquivo de `src/puro/`
num `vm` e devolve as funções declaradas (criado na Tarefa 2, usado pelas seguintes).

Formato: `validarFluxo({paraQuem, passos, loop}) → {ok:true} | {ok:false, erros:[{indice, regra, mensagem, correcao?}]}`;
passo = `{tipo:'atender'|'enviar'|'espera'|'mover'|'transferir', modo?, ...campos}`. Notação nos testes:
`A`=Atender, `E`=Só enviar, `EF`=Enviar+Finalizar, `P`=Pausar, `D`=Despausar, `M`=Mover, `T`=Transferir;
`indice` é base 1 (como o usuário vê). Estado simulado: `{ativos, pausados, enviados, vazio}` — em ⏳ é a tela,
em 🆕/👥 é **um chat** que acabou de cair (começa `ativos`).

### Tarefa 2 — Simulação de estado + regras 2 e 3

**Testes primeiro**
- ⏳ `[A,E,P,M]` → `ok:true` (Piloto clássico)
- 🆕 `[E,P]` → `ok:true` (Auto clássico)
- ⏳ `[EF,P]` → erro `{indice:2, regra:'depois-de-esvaziar', mensagem:'Não sobra cliente na tela'}` (Finalizar → Pausar)
- ⏳ `[M,E]`, `[T,P]` → erro regra 2 no índice 2
- ⏳ `[EF,A,E]` → `ok:true` (Atender é a exceção da regra 2)
- ⏳ `[D]` → erro `{indice:1, regra:'despausar-sem-pausar'}` (Despausar sozinho)
- ⏳ `[E,D]` → erro regra 3 no índice 2
- erro traz `correcao:{acao:'remover', indice}` → texto "Remover passo N"

**Comando:** `npm test` · **Commit:** `feat(validador): simula o estado dos tickets e aplica as regras 2 e 3`

### Tarefa 3 — Regras 1, 4 e 5

**Testes primeiro**
- ⏳ `[E,P,E]` → erro `{indice:3, regra:'enviar-apos-pausar', mensagem:'Cliente em espera não recebe mensagem'}`
- ⏳ `[A,E,P,A,E]` → erro regra 1 no índice 5 (vale com Atender no meio)
- ⏳ `[E,E]` → erro `{indice:2, regra:'envio-duplicado'}`; `[E,EF]` → idem
- ⏳ `[E,A,E]` → `ok:true` (Atender no meio libera a regra 4)
- ⏳ `[E,P,D,E]` → erro regra 4 no índice 4 (ver ambiguidade 1)
- ⏳ `[P,P]` → erro `{indice:2, regra:'sem-efeito'}`; `[P,D,D]` → erro regra 5 no índice 3
- ⏳ `[P,D,P]` → `ok:true`
- mensagens: texto do modal `layout-M.png` — linha 1 "O passo 3 · Enviar vem depois de 2 · Pausar."

**Comando:** `npm test` · **Commit:** `feat(validador): bloqueia envio após pausa, envio duplicado e espera repetida`

### Tarefa 4 — Loop, modos, disponibilidade e tamanho do fluxo

**Testes primeiro**
- ⏳ `loop:true`, `[E,P,M]` → erro `{indice:null, regra:'loop-sem-atender', mensagem:'O loop precisa de Atender em 1º'}`
- ⏳ `loop:false`, `[E,P,M]` → `ok:true`; `[E,A,E]` loop false → `ok:true` (regra 7)
- ⏳ `loop:true`, `[A,E,P,M]` → `ok:true`
- 🆕 `[A,E]` → erro `{indice:1, regra:'passo-indisponivel'}` com dica "use 'Também puxar a fila'"
- 🆕 `[E,P,D]` → erro `passo-indisponivel` no índice 3 (Despausar some em 🆕)
- 👥 `[E,P,D]` → `ok:true` (Despausar existe em 👥; P→D é válido)
- 🆕/👥 `loop:true` → `loop` é ignorado (sem erro)
- 🆕 `[EF,P]` → erro regra 2 (simulação por chat)
- `[]` → erro `fluxo-vazio`; 9 passos → erro `muitos-passos` (1 a 8)
- `paraQuem:null` → erro `sem-para-quem`
- `podeLigarLoop({paraQuem, passos})` → `{pode:false, motivo}` / `{pode:true}` (usado pelo interruptor)

**Comando:** `npm test` · **Commit:** `feat(validador): regras de loop, disponibilidade por modo e limite de 1 a 8 passos`

### Tarefa 5 — Campos obrigatórios (§4)

Arquivo: `src/puro/validar-campos.js` + teste.

**Testes primeiro**
- `validarCampos({tipo:'enviar', modo:'so', mensagem:'  '})` → `[{campo:'mensagem'}]`
- `{tipo:'enviar', modo:'finalizar', mensagem:'oi', tag:''}` → `[{campo:'tag'}]`
- `{tipo:'mover', pasta:''}` → `[{campo:'pasta'}]`; `{tipo:'transferir', atendente:''}` → `[{campo:'atendente'}]`
- `{tipo:'espera', modo:'pausar'}` → `[]`; `{tipo:'atender'}` → `[]`
- `fluxoPodeIniciar(fluxo)` → `false` se houver qualquer erro de ordem **ou** campo vazio

**Comando:** `npm test` · **Commit:** `feat(validador): campo obrigatório vazio bloqueia o Iniciar`

---

## Bloco 3 — Velocidade pura (§8, §12.3)

### Tarefa 6 — `pausa(msAtual, velocidade)` com piso de 50%

Arquivo: `src/puro/velocidade.js` + `test/unidade/velocidade.test.mjs`.

**Testes primeiro**
- `pausa(1200, 1)` → `1200`; `pausa(1200, 2)` → `600`; `pausa(1200, 0.5)` → `2400`
- `pausa(500, 2)` → `250` (ritmo do Atender); `pausa(1000, 1.5)` → `667` (arredonda)
- `pausa(1200, 3)` → `600` (piso de 50%); `pausa(1200, 0.1)` → `2400` (teto da faixa)
- `normalizarVelocidade('1.25')` → `{valor:1.3, aviso:null}` (passo 0.1)
- `normalizarVelocidade(2.5)` → `{valor:2, aviso:'Máximo 2.0'}`; `(0.2)` → `{valor:0.5, aviso:'Mínimo 0.5'}`
- `normalizarVelocidade('')` → `{valor:1, aviso:null}`; `('abc')` → `{valor:1, aviso:'Valor inválido'}`
- `velocidadeDoPasso({velocidade:null}, 1.2)` → `1.2`; `({velocidade:1.5}, 1.2)` → `1.5`
- `seloVelocidade({velocidade:1.5})` → `'×1.5'`; sem velocidade → `null`
- `normalizarPausaCiclos(75)` → `{valor:60, aviso}`; padrão `1` (s)

**Comando:** `npm test` · **Commit:** `feat(velocidade): pausa efetiva = pausa ÷ velocidade com piso de 50%`

---

## Bloco 4 — Dados e UI (§3, §4, §5, §9, §12.4)

### Tarefa 7 — Fluxos salvos (puro, `localStorage` injetado)

Arquivo: `src/puro/fluxos-salvos.js` (recebe um objeto `armazenamento` com `getItem/setItem`) + teste.
Chaves novas: `rf_rodbot_fluxos_v1` (lista) e `rf_rodbot_fluxo_atual_v1` (último usado).

**Testes primeiro**
- armazenamento vazio → `listar()` = `[⭐ Piloto clássico, ⭐ Auto clássico]`; `atual()` = Piloto clássico
- Piloto clássico = `{paraQuem:'aguardando', loop:true, pausaCiclos:1, velocidade:1, passos:[A, E(so), P, M]}`;
  Auto clássico = `{paraQuem:'caindo', passos:[E(so), P]}`
- `salvar({nome:'Meu', …})` → aparece em `listar()`; recarregar do mesmo armazenamento → igual (passos, campos,
  paraQuem, loop, pausa entre ciclos, velocidades)
- 11º fluxo do usuário → `{ok:false, motivo:'Limite de 10 fluxos'}`
- `apagar('⭐ Piloto clássico')` → `{ok:false}`; `salvar` com nome de modelo → `{ok:false}`
- `marcarAtual(id)` + nova instância → `atual().id === id`
- JSON corrompido na chave → volta aos modelos sem lançar erro

**Comando:** `npm test` · **Commit:** `feat(fluxos): modelos fixos e até 10 fluxos salvos no localStorage`

### Tarefa 8 — Migração na 1ª abertura

Arquivo: `src/puro/migracao.js` + teste. Marca `rf_rodbot_migracao_v1` para rodar uma vez só.

**Testes primeiro**
- `rf_rodbot_auto_msg_v1 = 'Olá'` → Enviar do ⭐ Auto clássico tem `mensagem:'Olá'`
- mensagem/pasta salvas do Piloto antigo → Enviar e Mover do ⭐ Piloto clássico preenchidos
  (as chaves exatas são lidas de `15-piloto.js` ao implementar)
- `rf_rodbot_tab_v1` ∈ `pasta|mensagem|fila|auto|piloto` → `'montar'`; `'acompanhar'` → `'montar'` (sempre abre em Montar
  quando nada roda); valor desconhecido → `'montar'`
- segunda execução → não sobrescreve nada
- chaves antigas **não** são apagadas (permite voltar ao HTML anterior)

**Comando:** `npm test` · **Commit:** `feat(fluxos): migra mensagem, pasta e aba salvas do painel antigo`

### Tarefa 9 — Base dos testes de tela + casca com duas abas

**Arquivos:** `test/e2e/util.mjs` (abre Chromium, carrega uma página de teste e executa o bookmarklet gerado por
`gerarHtml()`), `test/e2e/abas.test.mjs`, `src/04-painel-html.js`, `src/05-painel-ui.js`, `src/02-estilos.js`.

A partir daqui as abas antigas ficam **escondidas** (o DOM delas continua, porque as funções atuais leem esses
campos) até a Tarefa 18 removê-las. Até lá o `rodbot-final.html` gerado é de desenvolvimento: não distribuir.

**Testes primeiro**
- painel aberto → existem exatamente 2 abas visíveis: "🧩 Montar" e "📊 Acompanhar"
- `localStorage.rf_rodbot_tab_v1='fila'` antes de abrir → abre em Montar
- cabeçalho: "rod bot", status "Parado", botão Tema, fechar — como hoje; trocar tema continua funcionando
- abrir duas vezes não duplica o painel (`__rodBotCleanup` continua valendo)

**Comando:** `npm run build && npm run e2e` · **Commit:** `feat(painel): abas Montar e Acompanhar no lugar das cinco abas`

### Tarefa 10 — Para quem? + paleta + lista de passos

**Arquivos:** `src/05-painel-ui.js` (ou novo `src/19-montar.js`), `src/02-estilos.js` (paleta da B),
`test/e2e/montar.test.mjs`.

**Testes primeiro**
- fluxo vazio → paleta com classe de destaque; lista vazia
- tocar ✉️ → passo "1 · ✉️ Enviar" no fim da lista; tocar 📁 → "2 · 📁 Mover"
- ▲ no passo 2 → vira 1; ▼ no último fica desabilitado; ✕ remove e renumera
- 8 passos → paleta desabilitada com dica "Máximo 8 passos"
- 🆕 selecionado → 📥 Atender desabilitado na paleta; Espera mostra só Pausar
- 👥 → Atender desabilitado, Despausar disponível
- sem "Para quem?" escolhido, tocar ✉️ → seletor recebe a animação de piscar
- trocar modo com passo incompatível → passo fica vermelho (não é apagado; ver ambiguidade 6)

**Comando:** `npm run build && npm run e2e` · **Commit:** `feat(montar): seletor Para quem?, paleta e lista de passos com ▲ ▼ ✕`

### Tarefa 11 — Campos dos passos

**Testes primeiro**
- Enviar: alterna "Só enviar" | "Enviar + Finalizar"; Tag aparece só no Finalizar; "Usar padrão" preenche `MENSAGEM_PADRAO`
- Espera: Pausar | Despausar (Despausar oculto em 🆕)
- Mover: chips `nv2`, `default` e recentes; tocar chip preenche o campo
- Transferir: campo "Nome do atendente"
- campo obrigatório vazio → borda vermelha + Iniciar desabilitado; preencher → libera
- Velocidade do passo `1.5` → selo `×1.5` no cartão; `9` → corrige para `2.0` com aviso no campo

**Comando:** `npm run build && npm run e2e` · **Commit:** `feat(montar): campos de cada passo com velocidade própria e bloqueio de vazio`

### Tarefa 12 — Validação na tela + modal (layout-M)

**Testes primeiro**
- montar ⏳ `[E,P]` e tocar ✉️ → passo 3 vermelho com a frase curta **e** modal "⛔ Esta ordem não é aceita",
  texto "O passo 3 · Enviar vem depois de 2 · Pausar.", botões "Entendi" e "Remover passo 3"
- "Remover passo 3" → passo some, modal fecha, Iniciar volta a valer
- "Entendi" → modal fecha, passo continua vermelho, Iniciar bloqueado
- clicar Iniciar com ordem inválida → abre o modal do 1º erro
- erro sem correção (ex.: loop) → modal só com "Entendi"

**Comando:** `npm run build && npm run e2e` · **Commit:** `feat(montar): passo inválido em vermelho e modal com correção`

### Tarefa 13 — ⚙️ Ajustes

**Testes primeiro**
- Ajustes começa recolhido com resumo "Velocidade 1.0 · Loop ligado · 1 s entre ciclos"
- velocidade `3` → corrige para `2.0` com aviso
- ⏳ sem Atender em 1º → interruptor de loop desligado e travado, com o motivo ao lado
- ⏳ com Atender em 1º → interruptor habilitado, ligado por padrão
- pausa entre ciclos aceita 0–60; `90` → 60 com aviso
- "Também puxar a fila" só aparece em 🆕/👥, desligada por padrão; loop/pausa entre ciclos somem em 🆕/👥

**Comando:** `npm run build && npm run e2e` · **Commit:** `feat(montar): ajustes de velocidade, loop, pausa entre ciclos e puxar fila`

### Tarefa 14 — Fluxos salvos na tela

**Testes primeiro**
- 1ª abertura → seletor mostra "⭐ Piloto clássico" carregado (com migração aplicada)
- 💾 → pede nome → aparece no seletor; recarregar a página e reabrir → o último usado abre
- trocar para "⭐ Auto clássico" → Para quem? = 🆕, passos `[E, P]`
- modelos não mostram opção de apagar

**Comando:** `npm run build && npm run e2e` · **Commit:** `feat(montar): seletor de fluxos salvos com modelos e último usado`

### Tarefa 15 — Acompanhar

Puro: `src/puro/stepper.js` → `montarStepper(passos, execucao)` (rótulos e status por passo) + teste de unidade;
tela: `test/e2e/acompanhar.test.mjs`.

**Testes primeiro**
- unidade: `montarStepper([A,E,P,M], {passoAtual:1, feitos:[0]})` → status `['Feito','Rodando','Aguardando','Aguardando']`;
  rótulo do Mover = `'📁 Mover → nv2'`; falha no passo 2 → `'Falha'`
- tela: Acompanhar mostra nome do fluxo + "Ciclo #N", o stepper na ordem do usuário, Pausar/Parar e o log
- contadores do Auto (Novos chats, Contador Blip, Na fila do BM, lista, Retomar, Repetir pausas pendentes, Zerar
  contador) visíveis só com 🆕/👥

**Comando:** `npm test && npm run build && npm run e2e` · **Commit:** `feat(acompanhar): stepper com os passos do usuário, contadores e log`

---

## Bloco 5 — Motor (§5, §7, §8, §10, §12.5)

### Tarefa 16 — Funções atuais parametrizadas e pausas pela velocidade

As funções de ação (`passo1…5`, `executarModoEsperaTodos`, `executarMoverParaPastaTodos`, `executarEscreverParaTodos`,
`executarAtendimentoAutomatico`, `tTransferirTicket`, `autoProcessarTicket`) passam a receber mensagem, tag, pasta,
atendente por parâmetro (sem o fallback `CONFIG → pilot… → aba`) e a usar `pausaAcao(ms)` (= `sleep(pausa(ms,
velocidadeAtual))`) **só** nas pausas entre ações: `delayAcoes`, `delayTrocaTicket`, Atender 500 ms, `sleep`
curtos (120/150/550 ms). `waitFor`, `AUTO_T`, `TRANSF_T`, debounce/reconciliação/observers ficam intactos.

**Testes primeiro**
- unidade (guarda no código-fonte): nos trechos de ação não sobra `sleep(CONFIG.delay…)` nem `sleep(<número>)`
  fora da lista de exceções documentada; `AUTO_T` e `TRANSF_T` não são lidos por `pausaAcao`
- unidade: `pausaAcao` com velocidade 2 chama `sleep(600)` para 1200 (relógio falso)
- e2e mínimo: com velocidade 1.0 o bookmarklet abre sem erro no console

**Comando:** `npm test && npm run build && npm run e2e` · **Commit:** `refactor(motor): ações recebem parâmetros e pausas seguem a velocidade`

### Tarefa 17 — Motor ⏳ Aguardando (puro, ações injetadas)

Arquivo: `src/puro/motor.js` → `executarFluxo(fluxo, acoes, relogio, eventos)`; `acoes` são as funções reais no
bookmarklet e falsas no teste.

**Testes primeiro**
- `[A,E,P,M]` loop off → chama `atender, enviar, pausar, mover` uma vez, nessa ordem, com os campos do passo
- loop on, fila falsa `[3, 0, 0, 2]` → 1º ciclo roda; fila 0 ⇒ sentinela espera até 2 e roda o 2º ciclo
- pausa entre ciclos 1 s → relógio falso registra 1000 ms entre ciclos (não muda com a velocidade)
- falha de item (enviar devolve `{falhas:1}`) → segue, log "… 1 falha"
- falha geral (ação lança `ErroGeral('botão Atender não encontrado')`) → para, passo marcado `Falha`, motivo no log
- ticket já enviado (mesmo id) não recebe Enviar de novo em ciclo seguinte (controle por número do ticket)
- log antes de iniciar: `"Fila: 12 · Na tela: 8 · Pausados: 3"`; fim do ciclo:
  `"Ciclo #3: 5 atendidos · 5 enviados · 5 pausados · 5 movidos · 0 falhas"`
- Pausar/Parar globais: `parar()` no meio do passo 2 → não chama o passo 3

**Comando:** `npm test` · **Commit:** `feat(motor): executa os passos do usuário em lote com loop, sentinela e falhas`

### Tarefa 18 — Motor 🆕 Que vão cair e 👥 Ambos

Reaproveita o observador do Auto (`16b`/`16c`): cada chat novo entra na fila do motor e recebe os passos, um chat
por vez, cada passo só depois de **confirmar** o anterior.

**Testes primeiro** (unidade, observador falso)
- 🆕 `[E,P]`, chegam ids 101 e 102 → 101 recebe enviar→confirmar→pausar, depois 102; nunca intercalados
- envio não confirmado → não pausa, chat marcado falha de item, segue para o próximo
- id 101 chega de novo (re-render) → ignorado (`rf_rodbot_auto_tickets_v1`, 24 h)
- chats presentes **antes** de ativar → ignorados em 🆕
- 👥 → roda o fluxo uma vez nos que aguardam (sem loop), depois passa a vigiar; um ticket do lote que "cai" de
  novo não recebe o fluxo outra vez
- "Também puxar a fila" ligada → motor chama `atender`; puxados contam como "caiu"
- 🆕 `[EF]` → finaliza só o chat atual (não abre o próximo da lista; ver ambiguidade 12)

**Comando:** `npm test` · **Commit:** `feat(motor): modos Que vão cair e Ambos com um chat por vez e sem envio duplo`

### Tarefa 19 — Ligar a tela ao motor e remover o painel antigo

**Arquivos:** `src/05-painel-ui.js`, `src/13-loop-controles.js`, `src/15-piloto.js` (sai), trechos do Auto/Envio/Pastas
que só serviam às abas antigas (saem), `src/ordem.txt`.

**Testes primeiro** (e2e, página em branco + ações espionadas)
- Iniciar válido → painel pula para Acompanhar, status "Rodando", stepper do fluxo
- Parar → status "Parado", volta a permitir Iniciar; Pausar alterna para "Retomar"
- só um fluxo por vez: Iniciar fica desabilitado enquanto roda
- DOM não contém mais os ids das abas Pastas/Envio/Fila/Auto/Piloto antigo
- unidade: nenhuma referência restante a `executarPilotoLoop`, `pilotoEtapa*`, `autoBloqueiaOutras`, `obterCamposPainel`

**Comando:** `npm run verificar` · **Commit:** `feat: Iniciar roda o fluxo montado e remove as abas antigas`

---

## Bloco 6 — Tela com Blip falso (§12.6)

### Tarefa 20 — Página falsa do Blip

**Arquivos:** `test/e2e/blip-falso/index.html` + `blip-falso.js` (dados fictícios): botão Atender e contador da fila,
lista de tickets com os seletores que o código usa (`AUTO_SEL`, `TRANSF_SEL`, menu do ticket, opções de espera,
"Mover para"), campo de mensagem, tag, finalizar + modal de confirmação, modal de transferência com autocomplete.
Comportamento configurável: S1 (mover tira da lista), S2, S3, atrasos, falhas forçadas.

**Testes primeiro**
- a página sozinha: clicar Atender com fila 3 → lista ganha 1 ticket e contador vira 2
- pausar via menu → ticket marcado pausado; mover → ticket sai da lista
- seletores: cada seletor de `AUTO_SEL`/`TRANSF_SEL` encontra ao menos 1 elemento

**Comando:** `npm run e2e` · **Commit:** `test(e2e): página falsa do Blip com dados fictícios`

### Tarefa 21 — Cenários de ponta a ponta

**Testes primeiro**
- ⭐ Piloto clássico, fila 3 → 3 atendidos · 3 enviados · 3 pausados · 3 movidos; log com o resumo do ciclo
- ⭐ Auto clássico → chat que cai depois de ativar recebe 1 mensagem e é pausado; chat antigo não
- 👥 `[E,P]` → antigos e novos recebem exatamente 1 mensagem cada
- Transferir `"Atendente Fictício"` → tickets saem da lista
- botão Atender sumido → fluxo para, passo vermelho, motivo no log
- velocidade 2.0 vs 1.0 no mesmo fluxo → tempo total menor, e nenhuma pausa medida abaixo de 50% da original
- campo vazio / ordem inválida → Iniciar não executa nada

**Comando:** `npm run verificar` · **Commit:** `test(e2e): cenários dos três modos, falhas e velocidade no Blip falso`

### Tarefa 22 — Entrega

**Arquivos:** `docs/plano/entrega-piloto.md`, `README.md`.

Conteúdo: o que foi testado e **o que não foi testado no site real**: S1–S3 (§11), tempos reais do Blip, CSP do Blip
(bookmarklet grande), seletores só verificados na página falsa, contagem de "Na tela/Pausados". Checklist para o BM
conferir no Blip real antes de liberar.

**Teste:** `npm run verificar` verde; `html-sincronizado` verde. · **Commit:** `docs: notas de entrega do novo Piloto e o que falta testar no Blip real`

---

## Pontos ambíguos da spec (propostas a confirmar)

1. **Enviar → Pausar → Despausar → Enviar**: passa na regra 1, mas a regra 4 bloqueia. O texto do modal (layout-M)
   sugere "coloque Despausar antes", o que leva a outro erro. *Proposta:* regra 4 vence; o modal só sugere
   Despausar quando não houve envio antes.
2. **Atender no meio** libera reenvio (regra 4) mas não libera envio após pausa (regra 1). Em ⏳ os tickets antigos
   continuam na tela, então quem evita mensagem dupla é o controle por ticket no motor. *Proposta:* manter assim.
3. **Volta do loop**: o validador simula a passagem do fim do ciclo para o próximo? Com loop, `[A,E,P]` deixaria
   pausados na tela e o Enviar do ciclo 2 cairia na regra 1. *Proposta:* não simular a volta; o motor envia só a
   ativos ainda não enviados.
4. **Despausar em ⏳ sem Pausar antes** é proibido (regra 3), mas pode haver pausados na tela (o log mostra
   "Pausados: 3"). Some o "Despausar todos" de hoje. *Proposta:* seguir a spec e registrar como perda conhecida.
5. **"Mesmo envio duas vezes"**: vale para qualquer Enviar (Só enviar ou + Finalizar, mesma ou outra mensagem)?
   *Proposta:* qualquer Enviar.
6. **Trocar "Para quem?"** com passos que não existem no modo novo (Atender em 🆕/👥, Despausar em 🆕): apagar
   sozinho ou marcar em vermelho? *Proposta:* vermelho, nunca apagar sem o usuário.
7. **Velocidade × `AUTO_T`**: `AUTO_T.entreTickets` (600 ms) e `AUTO_T.espera` (1000 ms) são pausas, mas estão em
   `AUTO_T`, que a spec manda nunca mudar. Idem atrasos de digitação do Transferir. A "pausa entre ciclos" também
   não diz se segue a velocidade. *Proposta:* não mexer em nada de `AUTO_T`/`TRANSF_T`; a pausa entre ciclos é valor
   do usuário e ignora a velocidade.
8. **Modelos ⭐ e o botão "+"**: o modelo pode ser editado e salvo por cima? O limite de 10 inclui os modelos? O
   layout A tem "+" (novo fluxo), a spec cita só 💾. *Proposta:* editar um modelo vale só em memória; 💾 sempre
   salva como fluxo novo com nome; 10 = só os do usuário; "+" cria fluxo vazio (sem "Para quem?").
9. **Mensagem inicial dos modelos**: se não houver mensagem salva para migrar, o Enviar do ⭐ Piloto clássico abre
   vazio (vermelho, Iniciar bloqueado). *Proposta:* preencher com `MENSAGEM_PADRAO` nesse caso. E a pasta/mensagem
   salvas das abas Pastas/Envio (não citadas no §9) — migrar também? *Proposta:* só se o Piloto antigo estiver vazio.
10. **"Para quem?" vazio**: o §5 implica fluxo sem modo escolhido, mas os modelos sempre têm um. *Proposta:* só um
    fluxo novo ("+") começa sem modo; Iniciar bloqueado até escolher.
11. **"+ Adicionar passo" (layout A)** é um segundo jeito de adicionar, ao lado da paleta (B). *Proposta:* não ter o
    botão; só a paleta. Campos do passo: abertos no cartão tocado (um por vez), resumo nos demais, como no A.
12. **Enviar + Finalizar em 🆕**: hoje o `loop()` abre o primeiro da lista depois de finalizar (`passo5_proximoFila`).
    Por chat isso abriria outro cliente. *Proposta:* em 🆕/👥 finaliza só o chat atual.
13. **Loop ligado por padrão** × só habilita com Atender em 1º: ao recolocar Atender em 1º depois de removê-lo, o
    loop volta a ligar sozinho? *Proposta:* sim, volta ao padrão (ligado).
14. **Ordem do §12** põe a UI antes do motor: entre as Tarefas 9 e 19 o HTML gerado fica com as abas antigas
    escondidas e o Iniciar ainda não roda o fluxo. *Proposta:* não distribuir `rodbot-final.html` nesse intervalo.
