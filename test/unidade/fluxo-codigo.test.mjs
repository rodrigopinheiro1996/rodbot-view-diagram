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

test('passo2_tag só recebe a tag por parâmetro (não existe mais a caixa antiga)', () => {
  const c = ler('01-base.js');
  assert.match(c, /async function passo2_tag\(tagParam\)/);
  assert.doesNotMatch(c, /tagEl/);
});

test('o painel antigo e o interruptor provisório saíram do código (Tarefa 22)', () => {
  const tudo = listarTrechos().map(ler).join('\n');
  for (const nome of ['executarPilotoLoop', 'pilotoEtapa', 'autoBloqueiaOutras', 'obterCamposPainel',
    'rf_rodbot_ui_nova_v1', 'ba-pane-', 'ba-tab-btn', 'executarTransferenciaAtendente', 'executarModoEsperaTodos',
    'executarEscreverParaTodos', 'executarMoverParaPastaTodos', 'executarAtendimentoAutomatico']) {
    assert.ok(!tudo.includes(nome), nome);
  }
  assert.ok(!listarTrechos().includes('02-piloto.js'));
});

test('o motor, o validador e os adaptadores estão no bundle, antes do fechamento da IIFE', () => {
  const ordem = listarTrechos();
  for (const f of ['puro/validar-fluxo.js', 'puro/validar-campos.js', 'puro/motor.js', '05-fluxo.js']) {
    assert.ok(ordem.includes(f), f);
    assert.ok(ordem.indexOf(f) < ordem.indexOf('99-fechar.js'), f);
  }
  assert.equal(ordem.at(-1), '99-fechar.js');
});

test('o gancho de teste só é criado com window.__rodBotTeste === true', () => {
  const c = ler('05-fluxo.js');
  assert.match(c, /if \(window\.__rodBotTeste === true\) \{\n\s+window\.__rodBot = \{/);
  assert.equal((c.match(/window\.__rodBot\s*=/g) || []).length, 1);
});
