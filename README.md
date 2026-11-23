# rodbot-view-diagram

Página de instalação do bookmarklet **rod bot** (`rodbot-final.html`) para o Blip Desk.

O painel tem duas abas: **🧩 Montar** (o usuário monta o próprio fluxo com Atender, Enviar, Espera, Mover e Transferir,
para quem aguarda, para quem vai cair ou para os dois) e **📊 Acompanhar** (passo a passo, contadores e log).
**Antes de liberar, veja `docs/plano/entrega-piloto.md`**: o que foi testado, o que não foi testado no Blip real e o
checklist com tickets de teste.

## Como editar

`rodbot-final.html` é **gerado**. **Nunca edite o HTML nem o `javascript:` à mão.**

1. Edite os arquivos em `src/js/` (trechos concatenados na ordem de `src/js/ordem.txt`; o código é uma função única
   com variáveis compartilhadas, não módulos) ou a página em `src/pagina/instalacao.html`.
2. Rode `npm run build` (gera `rodbot-final.html`).
3. Rode `npm test`. O teste `html-sincronizado` falha se o HTML não corresponder ao `src/`.

| Comando | Faz |
|---|---|
| `npm run build` | `src/` → `rodbot-final.html` |
| `npm test` | testes de unidade |
| `npm run e2e` | testes de tela no Blip falso (`test/e2e/blip-falso/`, dados fictícios) |
| `npm run verificar` | `npm test` + `npm run e2e` |
| `npm run comparar-bundle [ref]` | prova que um commit só moveu linhas (bundle igual ao de `ref`, padrão `HEAD`) |

Spec, plano, nota de entrega e tabela de pausas: `docs/plano/`.
