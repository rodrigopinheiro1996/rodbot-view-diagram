// Tarefa 11: o motor e os adaptadores não dependem dos campos/abas antigos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, listarTrechos } from '../../scripts/build.mjs';

const ler = (n) => readFileSync(join(RAIZ, 'src/js', n), 'utf8');

test('motor e adaptadores não usam o Piloto antigo nem os campos das abas', () => {
  for (const arq of ['puro/motor.js', '05-fluxo.js']) {
    const c = ler(arq);
    for (const proibido of [/\bpilot\w*/i, /obterCamposPainel/, /\bmsgEl\b/, /\btagEl\b/, /\bfolderEl\b/, /transfNomeEl/, /autoLerMensagem/]) {
      assert.doesNotMatch(c, proibido, `${arq} não deve usar ${proibido}`);
    }
  }
});

test('passo2_tag aceita a tag por parâmetro e, sem ele, continua lendo a caixa antiga', () => {
  const c = ler('01-base.js');
  assert.match(c, /async function passo2_tag\(tagParam\)/);
  assert.match(c, /tagParam !== undefined \? String\(tagParam\) : tagEl\.value/);
});

test('o motor, o validador e os adaptadores estão no bundle, antes do fechamento da IIFE', () => {
  const ordem = listarTrechos();
  for (const f of ['puro/validar-fluxo.js', 'puro/validar-campos.js', 'puro/motor.js', '05-fluxo.js']) {
    assert.ok(ordem.includes(f), f);
    assert.ok(ordem.indexOf(f) < ordem.indexOf('06-fechar.js'), f);
  }
  assert.equal(ordem.at(-1), '06-fechar.js');
});

test('o gancho de teste só é criado com window.__rodBotTeste === true', () => {
  const c = ler('05-fluxo.js');
  assert.match(c, /if \(window\.__rodBotTeste === true\) \{\n\s+window\.__rodBot = \{/);
  assert.equal((c.match(/window\.__rodBot\s*=/g) || []).length, 1);
});
