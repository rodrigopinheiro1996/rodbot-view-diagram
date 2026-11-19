import test from 'node:test';
import assert from 'node:assert/strict';
import { carregarPuro } from '../util/carregar-puro.mjs';

const { validarFluxo } = carregarPuro('validar-fluxo.js');

// Notação do plano: A=Atender, E=Só enviar, EF=Enviar+Finalizar, P=Pausar, D=Despausar, M=Mover, T=Transferir
const PASSO = {
  A: { tipo: 'atender' },
  E: { tipo: 'enviar', modo: 'so' },
  EF: { tipo: 'enviar', modo: 'finalizar' },
  P: { tipo: 'espera', modo: 'pausar' },
  D: { tipo: 'espera', modo: 'despausar' },
  M: { tipo: 'mover' },
  T: { tipo: 'transferir' },
};
const MODO = { '⏳': 'aguardando', '🆕': 'caindo', '👥': 'ambos' };
// objetos do vm têm outro protótipo: o JSON os traz para o mundo do teste (deepStrictEqual)
const plano = (x) => JSON.parse(JSON.stringify(x));
const val = (modo, seq) =>
  plano(validarFluxo({ paraQuem: MODO[modo], passos: seq.map((k) => ({ ...PASSO[k] })) }));
const errosDo = (r, indice) => (r.erros || []).filter((e) => e.indice === indice);
const regrasDo = (r, indice) => errosDo(r, indice).map((e) => e.regra);

test('modelos clássicos são válidos', () => {
  assert.deepEqual(val('⏳', ['A', 'E', 'P', 'M']), { ok: true }); // Piloto clássico
  assert.deepEqual(val('🆕', ['E', 'P']), { ok: true }); // Auto clássico
});

test('regra 2: depois de Enviar+Finalizar, Transferir ou Mover não sobra cliente na tela', () => {
  const r = val('⏳', ['EF', 'P']);
  assert.equal(r.ok, false);
  assert.deepEqual(regrasDo(r, 2), [2]);
  assert.equal(errosDo(r, 2)[0].mensagem, 'Não sobra cliente na tela');
  assert.deepEqual(regrasDo(val('⏳', ['M', 'E']), 2), [2]);
  assert.deepEqual(regrasDo(val('⏳', ['T', 'P']), 2), [2]);
  assert.equal(errosDo(val('⏳', ['EF', 'P']), 1).length, 0, 'o passo que esvazia não é o culpado');
});

test('regra 2: Atender é a exceção', () => {
  assert.deepEqual(val('⏳', ['EF', 'A', 'E']), { ok: true });
  assert.deepEqual(val('⏳', ['M', 'A', 'P']), { ok: true });
});

test('regra 3: Despausar como 1º passo em ⏳ é permitido (pausados desconhecido)', () => {
  assert.deepEqual(val('⏳', ['D']), { ok: true });
  assert.deepEqual(val('⏳', ['D', 'E']), { ok: true });
  assert.deepEqual(val('⏳', ['D', 'M']), { ok: true });
});

test('regra 3: Despausar logo depois de Despausar é bloqueado (já se sabe que não há pausados)', () => {
  assert.ok(regrasDo(val('⏳', ['D', 'D']), 2).includes(3));
  assert.ok(regrasDo(val('⏳', ['P', 'D', 'D']), 3).includes(3));
  assert.deepEqual(val('⏳', ['P', 'D']), { ok: true });
});

test('Despausar bloqueado em 🆕/👥: no 1º passo (regra 3 + indisponível)', () => {
  const r = val('🆕', ['D']);
  assert.equal(r.ok, false);
  assert.deepEqual(regrasDo(r, 1).sort(), [3, 'indisponivel'].sort());
});

test('Despausar bloqueado em 🆕/👥: depois de Pausar só a indisponibilidade dispara (pausados = todos)', () => {
  for (const modo of ['🆕', '👥']) {
    const r = val(modo, ['E', 'P', 'D']);
    assert.equal(r.ok, false, modo);
    assert.deepEqual(regrasDo(r, 3), ['indisponivel'], modo);
  }
});

test('Atender é indisponível em 🆕/👥 e mantém a dica do "Também puxar a fila"', () => {
  for (const modo of ['🆕', '👥']) {
    const r = val(modo, ['A', 'E']);
    assert.equal(r.ok, false);
    const e = errosDo(r, 1).find((x) => x.regra === 'indisponivel');
    assert.ok(e, modo);
    assert.match(e.dica, /Também puxar a fila/);
  }
});

test('o passo indisponível continua no fluxo (a troca de modo não apaga nada)', () => {
  const passos = ['A', 'E', 'P', 'D'];
  assert.deepEqual(val('⏳', passos), { ok: true });
  const r = val('🆕', passos);
  assert.equal(r.ok, false);
  assert.deepEqual(regrasDo(r, 1), ['indisponivel']);
  assert.deepEqual(regrasDo(r, 4), ['indisponivel']);
});

test('em 🆕/👥 a simulação é por chat: Finalizar esvazia o chat', () => {
  assert.deepEqual(regrasDo(val('🆕', ['EF', 'P']), 2), [2]);
  assert.deepEqual(regrasDo(val('👥', ['M', 'E']), 2), [2]);
});

test('todo erro traz correção "remover" com o texto "Remover passo N"', () => {
  const r = val('⏳', ['EF', 'P']);
  const e = errosDo(r, 2)[0];
  assert.deepEqual(e.correcao, { acao: 'remover', indice: 2, texto: 'Remover passo 2' });
});

test('índices são base 1 e a validação não altera o fluxo recebido', () => {
  const passos = ['EF', 'P'].map((k) => ({ ...PASSO[k] }));
  const copia = JSON.stringify(passos);
  validarFluxo({ paraQuem: 'aguardando', passos });
  assert.equal(JSON.stringify(passos), copia);
});
