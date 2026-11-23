// Tarefa 7: a velocidade só muda as pausas de RITMO (spec §8), classificadas uma a uma em docs/plano/pausas.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../../scripts/build.mjs';
import { carregarPuro } from '../util/carregar-puro.mjs';

const TRECHOS = ['01-base.js', '03-auto.js', '04-transferir.js', '05-fluxo.js', '99-fechar.js'];
const ler = (n) => readFileSync(join(RAIZ, 'src/js', n), 'utf8');

// chamadas sleep(…)/pausaAcao(…) no código: arquivo + função de nível superior + valor
function chamadasNoCodigo() {
  const out = [];
  for (const arq of TRECHOS) {
    let funcao = '?';
    for (const linha of ler(arq).split('\n')) {
      const f = linha.match(/^ {2}(?:async\s+)?function\s+(\w+)/);
      if (f) funcao = f[1];
      const m = linha.match(/\bawait (sleep|pausaAcao)\((.*)\);\s*$/);
      if (m) out.push({ arq, funcao, valor: m[2], tipo: m[1] });
    }
  }
  return out;
}

function linhasDaTabela() {
  const md = readFileSync(join(RAIZ, 'docs/plano/pausas.md'), 'utf8');
  return md
    .split('\n')
    .filter((l) => /^\| \d+ \|/.test(l))
    .map((l) => {
      const c = l.split(' | ').map((x) => x.replace(/^\| /, '').replace(/ \|$/, '').trim());
      const tira = (s) => s.replace(/^`|`$/g, '');
      return {
        arq: tira(c[1]).split(':')[0],
        funcao: tira(c[2]),
        valor: tira(c[3]),
        decisao: c[4],
        motivo: c[5],
      };
    });
}

const chave = (x) => `${x.arq} · ${x.funcao} · ${x.valor}`;
const contar = (lista) => lista.reduce((m, x) => m.set(chave(x), (m.get(chave(x)) || 0) + 1), new Map());

test('guarda: toda pausa do código está em pausas.md, com a chamada certa para a decisão', () => {
  const tabela = linhasDaTabela();
  const codigo = chamadasNoCodigo();
  assert.ok(tabela.length > 0);
  const entra = tabela.filter((t) => t.decisao.startsWith('entra'));
  const fora = tabela.filter((t) => t.decisao.startsWith('não entra'));
  assert.equal(entra.length + fora.length, tabela.length, 'decisão deve ser "entra …" ou "não entra …"');
  const msg = 'classifique esta pausa em docs/plano/pausas.md';
  assert.deepEqual(contar(codigo.filter((c) => c.tipo === 'pausaAcao')), contar(entra), `pausaAcao ≠ "entra": ${msg}`);
  assert.deepEqual(contar(codigo.filter((c) => c.tipo === 'sleep')), contar(fora), `sleep ≠ "não entra": ${msg}`);
});

test('cada linha de pausas.md tem motivo', () => {
  for (const t of linhasDaTabela()) assert.ok(t.motivo && t.motivo.length > 10, chave(t));
});

test('o que o §8 manda deixar de fora nunca está como "entra"', () => {
  const sempreFora = [
    /AUTO_T\.espera\b/, /TRANSF_T\./, /^atraso$/, /^5000$/, /Math\.max\(800/,
  ];
  for (const t of linhasDaTabela()) {
    if (sempreFora.some((r) => r.test(t.valor))) assert.match(t.decisao, /^não entra/, chave(t));
  }
  // a pausa entre ciclos é do motor: relogio.esperar usa sleep (nunca pausaAcao)
  assert.match(ler('05-fluxo.js'), /relogio: \{ esperar: ms => sleep\(ms\) \}/, 'pausa entre ciclos ignora a velocidade');
  // e nenhum prazo/waitFor passa por pausaAcao
  for (const c of chamadasNoCodigo().filter((x) => x.tipo === 'pausaAcao')) {
    assert.doesNotMatch(c.valor, /AUTO_T\.(?!entreTickets)|TRANSF_T|waitFor/, chave(c));
  }
});

test('o que o §8 manda incluir está como "entra"', () => {
  for (const t of linhasDaTabela()) {
    if (/^CONFIG\.delayAcoes$|^AUTO_T\.entreTickets$/.test(t.valor)) assert.match(t.decisao, /^entra/, chave(t));
  }
  const atender = linhasDaTabela().filter((t) => t.valor === '500' &&
    t.funcao === 'fluxoAtender');
  assert.equal(atender.length, 1);
  for (const t of atender) assert.match(t.decisao, /^entra/, 'intervalo do Atender');
});

test('pausaAcao divide pela velocidade atual, com piso de 50%; 1.0 = hoje', () => {
  const chamadas = [];
  const p = carregarPuro({ sleep: (ms) => chamadas.push(ms) }, 'velocidade.js', 'pausas.js');
  p.pausaAcao(1200);
  p.definirVelocidadeAtual(2);
  p.pausaAcao(1200);
  p.pausaAcao(600); // AUTO_T.entreTickets
  p.pausaAcao(500); // intervalo do Atender
  p.definirVelocidadeAtual(5); // fora da faixa: vira 2.0
  p.pausaAcao(1200);
  p.definirVelocidadeAtual(0.5);
  p.pausaAcao(350);
  assert.deepEqual(chamadas, [1200, 600, 300, 250, 600, 700]);
});

// A prova "o código antigo só mudou sleep( → pausaAcao(" (Tarefa 7) ficou no histórico (commit 3d5d525):
// a partir da Tarefa 11 o código antigo muda de propósito.
