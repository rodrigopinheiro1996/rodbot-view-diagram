# rodbot-view-diagram

Página de instalação do bookmarklet **rod bot** (`rodbot-final.html`) para o Blip Desk.

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
| `npm run comparar-bundle [ref]` | prova que um commit só moveu linhas (bundle igual ao de `ref`, padrão `HEAD`) |

Plano e spec do novo Piloto: `docs/plano/`.
