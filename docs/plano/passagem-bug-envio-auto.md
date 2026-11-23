# Passagem — bug no envio automático do rod bot novo

Para a sessão que vai corrigir o bug. Leia isto primeiro; só abra a spec e o plano se precisar.

## Situação

- Branch: `claude/admiring-newton-97ebst`. O `rodbot-final.html` dela é o painel novo (🧩 Montar | 📊 Acompanhar).
- O BM testou no **Blip real** e o **envio automático** tem bugs. Os detalhes vêm do usuário: pergunte antes de mexer
  (modo usado, o que esperava, o que aconteceu, texto do log do Acompanhar).
- Enquanto isso o BM usa a versão antiga: `rodbot-anterior.html` (idêntico ao commit `3ca5940`). Não apague.
- Tudo até aqui foi testado só numa **página falsa do Blip**. O que nunca foi conferido no site está na seção 3 de
  `docs/plano/entrega-piloto.md`. Comece a investigação por lá.

## Regras do projeto (não quebre)

- **Nunca edite `rodbot-final.html` nem o `javascript:` à mão.** Edite `src/`, rode `npm run build` e commite o HTML
  regerado junto. O teste `html-sincronizado` falha se o HTML não bater com `src/`.
- O código é **uma função única (IIFE)** concatenada de trechos na ordem de `src/js/ordem.txt`. Não são módulos: tudo
  compartilha variáveis (`rodando`, `pausado`, `modoAtual`, `CONFIG`, `auto`…). `src/js/puro/` = funções sem DOM,
  testadas no Node.
- **Teste primeiro**: escreva o teste que reproduz o bug, veja falhar, corrija, veja passar.
- Commits em pt-BR, no estilo `fix(…): …`.
- Fonte das regras de negócio: `docs/plano/spec-piloto.md` (§5 memória por ticket, §6 validação, §8 velocidade, §10 falhas).

## Comandos

| Comando | Faz |
|---|---|
| `npm run build` | `src/` → `rodbot-final.html` |
| `npm test` | 147 testes de unidade (segundos) |
| `npm run e2e` | 99 testes de tela no Blip falso (≈ 4,5 min) |
| `node --test --test-concurrency=1 test/e2e/<arquivo>.test.mjs` | um arquivo de tela só |

Playwright e Chromium já estão na máquina. Em script ESM, carregue com `createRequire(import.meta.url)('playwright')`.

## Caminho do envio automático (🆕 Que vão cair / 👥 Ambos / ⭐ Auto clássico)

1. `src/js/06-tela.js` → `telaIniciar()` passa uma **cópia** do fluxo para `fluxoIniciar`.
2. `src/js/05-fluxo.js` → `fluxoIniciar(fluxo, {nome})`: põe `rodando = true`, `modoAtual = 'fluxo'` e chama
   `autoAtivar(id => fluxoNovos.push(id))`, que liga **só o observador** do Auto antigo, com o worker do Auto parado.
3. `src/js/03-auto.js` → `autoReexaminar()`. No 1º scan registra os chats presentes (baseline; eles não recebem nada).
   Depois, cada id novo:
   - é **pulado** se já está em `rf_rodbot_auto_tickets_v1` com `contado` (memória de 24 h, compartilhada com o Auto
     antigo);
   - é **absorvido sem contar** se `autoMotivoAbsorcao()` acusa filtro aberto, rolagem ou interação recente na lista
     (`AUTO_T.janelaFiltro` 3 s / `janelaRolagem` 4 s). `rodando` do próprio fluxo **não** absorve (exceção
     `auto.consumidor && modoAtual === 'fluxo'`);
   - senão, ganha `contado: true`, soma em "Novos chats" e vai para `auto.consumidor(id)` → `fluxoNovos`.
4. `src/js/puro/motor.js` → `motorPorChat`: em 👥 faz antes uma passada em lote (`motorPassoEmLote`). Depois lê
   `novosChats()` a cada 0,5 s, ignora ids presentes no início, ids tratados na execução e os da memória de 24 h
   (`memoria24h.tem` = `fluxo` ou `envio` no registro), **grava o id nas 24 h antes do 1º passo** e chama
   `motorPassosNoChat` (um chat por vez; um passo só começa se o anterior deu ok).
5. `src/js/05-fluxo.js` → `fluxoEnviar(id, op)`:
   1. `fluxoLerEspera(id)` **abre o menu ⋮ do ticket** para ver se está em espera (se estiver: `pulado`, e o chat não
      segue para os outros passos). É código novo, nunca rodou no Blip.
   2. Clica no card e espera `autoIndicioChatAtivo(id)` (cabeçalho "Ticket: #id").
   3. `#text-input` habilitado; recusa se houver rascunho.
   4. `preencherCampoMensagem` → `dispararEnvioEnter` → `autoConfirmarEnvio` (campo vazio + texto novo na conversa,
      prazo `AUTO_T.confirmarEnvio` 8 s).
   5. Em "Enviar + Finalizar": `passo2_tag(tag)`, `passo3_finalizar`, `passo4_confirmarModal`.
6. `fluxoPausar(id)` → `autoTentarPausa(id)` (menu → `option-setStandbyMode`, com verificação).
7. O log do painel mostra cada etapa; o Acompanhar mostra o passo de cada chat (`fluxoOuvintes` → `06-tela.js`).

**Diferenças em relação ao Auto antigo que funcionava** (bons suspeitos):
- O Auto antigo **não** abria o menu antes de enviar. O novo abre (`fluxoLerEspera`), o que pode fechar ou atrapalhar o
  chat, ou deixar o menu aberto.
- O antigo era processado pelo `autoWorker` (com `AUTO_T.espera` quando havia outra automação ou rascunho). O novo é o
  motor; `AUTO_T.entreTickets` entra na velocidade, então com 2.0 ele cai pela metade.
- A memória de 24 h é a mesma chave: chats que o Auto antigo já tinha contado são ignorados pelo 🆕.
- `autoLerMensagem()` agora devolve `''`: a mensagem vem do passo Enviar, não da caixa antiga.

## Testes e ferramentas que ajudam

- Página falsa: `test/e2e/blip-falso/` (`blipFalso.reiniciar(config)`, `estado()`, `chegarChat(nome)`,
  `adicionarFila(n)`; S1/S2/S3 configuráveis). Partes **deduzidas** do código estão marcadas no topo de `blip-falso.js`.
  Se o bug vier de diferença com o Blip real, **peça o `outerHTML` do trecho ao BM**; não invente seletor.
- Gancho de teste: com `window.__rodBotTeste = true` antes de injetar, `window.__rodBot.executarFluxo(fluxo, {nome})`
  roda o motor sem a tela (`test/e2e/util.mjs` → `injetarBookmarklet(page, { teste: true })`).
- Testes do envio automático: `test/unidade/motor-por-chat.test.mjs`, `test/e2e/motor-blip-falso.test.mjs`,
  `test/e2e/fluxo-gancho.test.mjs`, `test/e2e/ponta-a-ponta.test.mjs` (🆕, 👥, Auto clássico).
- Pausas e velocidade: `docs/plano/pausas.md`. Um teste confere cada `sleep`/`pausaAcao` contra essa tabela; código novo
  com pausa precisa de linha nela.

## Pendência conhecida

Ainda sem resposta do BM: o card de um ticket **pausado** mostra algum sinal na lista? Se mostrar, com o `outerHTML`
dele dá para trocar a leitura pelo menu (`fluxoLerEspera`) por uma leitura do card.
