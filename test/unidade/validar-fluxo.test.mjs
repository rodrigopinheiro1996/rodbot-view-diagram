import test from 'node:test';
import assert from 'node:assert/strict';
import { carregarPuro } from '../util/carregar-puro.mjs';

const { validarFluxo, erroDoModal, textoModal } = carregarPuro('validar-fluxo.js');

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

// ───────────── Tarefa 3: regras 1, 4, 5, precedência (regra 8) e escolha do erro do modal (regra 10)

const passosDe = (seq) => seq.map((k) => ({ ...PASSO[k] }));

test('regra 1: Enviar depois de Pausar sem Despausar no meio', () => {
  const r = val('⏳', ['P', 'E']);
  assert.deepEqual(regrasDo(r, 2), [1]);
  assert.equal(errosDo(r, 2)[0].mensagem, 'Cliente em espera não recebe mensagem');
});

test('regra 1 vale mesmo com Atender no meio (os pausados continuam na tela)', () => {
  assert.deepEqual(regrasDo(val('⏳', ['A', 'P', 'A', 'E']), 4), [1]);
  // o Atender libera a regra 4 (novo envio), mas não a regra 1
  assert.deepEqual(regrasDo(val('⏳', ['E', 'P', 'A', 'E']), 4), [1]);
});

test('regra 1 com pausados desconhecido em ⏳: Enviar é permitido (o motor pula os pausados)', () => {
  assert.deepEqual(val('⏳', ['E']), { ok: true });
  assert.deepEqual(val('⏳', ['A', 'E', 'P', 'M']), { ok: true });
  assert.deepEqual(val('⏳', ['A', 'E']), { ok: true });
});

test('regra 4: mesmo envio duas vezes nos mesmos tickets (qualquer Enviar)', () => {
  assert.deepEqual(regrasDo(val('⏳', ['E', 'E']), 2), [4]);
  assert.deepEqual(regrasDo(val('⏳', ['E', 'EF']), 2), [4]);
  const dupla = validarFluxo({
    paraQuem: 'aguardando',
    passos: [{ tipo: 'enviar', modo: 'so', mensagem: 'a' }, { tipo: 'enviar', modo: 'so', mensagem: 'b' }],
  });
  assert.deepEqual(plano(dupla.erros).map((e) => e.regra), [4], 'outra mensagem não escapa');
});

test('regra 4: Enviar+Finalizar seguido de Enviar cai na regra 2 (e também na 4)', () => {
  const regras = regrasDo(val('⏳', ['EF', 'E']), 2);
  assert.ok(regras.includes(2) && regras.includes(4));
});

test('regra 4: Atender no meio libera o reenvio', () => {
  assert.deepEqual(val('⏳', ['E', 'A', 'E']), { ok: true });
  assert.deepEqual(val('⏳', ['EF', 'A', 'E']), { ok: true });
});

test('regra 8: E → P → D → E bloqueia pela regra 4 (não pela 1) e só sugere remover', () => {
  const r = val('⏳', ['E', 'P', 'D', 'E']);
  assert.deepEqual(regrasDo(r, 4), [4]);
  const e = errosDo(r, 4)[0];
  assert.deepEqual(e.correcao, { acao: 'remover', indice: 4, texto: 'Remover passo 4' });
  assert.equal(e.sugestao, undefined, 'houve envio antes: não sugere Despausar');
});

test('regra 8: com 4 e 1 juntas (E → P → E) o validador devolve as duas; o modal escolhe a 4', () => {
  const r = val('⏳', ['E', 'P', 'E']);
  assert.deepEqual(regrasDo(r, 3).sort(), [1, 4]);
  assert.equal(erroDoModal(r.erros).regra, 4);
  assert.equal(errosDo(r, 3).find((e) => e.regra === 1).sugestao, undefined);
});

test('regra 8: Despausar só é sugerido quando NÃO houve envio antes', () => {
  const e = errosDo(val('⏳', ['P', 'E']), 2)[0];
  assert.deepEqual(e.correcao, { acao: 'remover', indice: 2, texto: 'Remover passo 2' });
  assert.deepEqual(e.sugestao, {
    acao: 'inserir', indice: 2, passo: 'despausar', texto: 'Colocar Despausar antes do passo 2',
  });
  assert.equal(errosDo(val('⏳', ['E', 'P', 'E']), 3).find((x) => x.regra === 1).sugestao, undefined);
  assert.equal(errosDo(val('🆕', ['P', 'E']), 2)[0].sugestao, undefined, 'Despausar não existe em 🆕');
});

test('regra 5: Pausar→Pausar e Despausar→Despausar em passos adjacentes', () => {
  assert.deepEqual(regrasDo(val('⏳', ['P', 'P']), 2), [5]);
  assert.ok(regrasDo(val('⏳', ['D', 'D']), 2).includes(5));
  assert.ok(regrasDo(val('⏳', ['D', 'D']), 2).includes(3));
  assert.ok(regrasDo(val('⏳', ['P', 'D', 'D']), 3).includes(5));
});

test('regra 5: com outro passo no meio é válido ([P,A,P], [P,D,P])', () => {
  assert.deepEqual(val('⏳', ['P', 'A', 'P']), { ok: true });
  assert.deepEqual(val('⏳', ['P', 'D', 'P']), { ok: true });
  assert.deepEqual(val('⏳', ['E', 'P', 'D']), { ok: true });
});

test('regra 10: erroDoModal devolve o erro do PRIMEIRO passo com erro, na ordem indisponível→2→3→4→1→5', () => {
  assert.equal(erroDoModal(val('⏳', ['D', 'D']).erros).regra, 3, '3 antes de 5, índice 2');
  assert.equal(erroDoModal(val('⏳', ['D', 'D']).erros).indice, 2);
  assert.equal(erroDoModal(val('🆕', ['D']).erros).regra, 'indisponivel', 'indisponível antes da 3');
  const e = erroDoModal(val('⏳', ['E', 'E', 'D', 'D']).erros);
  assert.equal(e.indice, 2);
  assert.equal(e.regra, 4);
  assert.equal(erroDoModal(val('⏳', ['EF', 'P', 'P']).erros).indice, 2);
  assert.equal(erroDoModal(val('⏳', ['EF', 'P', 'P']).erros).regra, 2);
  assert.equal(erroDoModal(val('⏳', ['E', 'P', 'D', 'E']).erros).regra, 4);
  assert.equal(erroDoModal(val('⏳', ['P', 'E']).erros).regra, 1);
  assert.equal(erroDoModal(val('⏳', ['P', 'P']).erros).regra, 5);
  assert.equal(erroDoModal([]), null);
});

test('regra 10: todos os passos com problema ficam com erro (vermelhos), só o modal mostra um', () => {
  const r = val('⏳', ['E', 'E', 'D', 'D']);
  assert.deepEqual([...new Set(r.erros.map((e) => e.indice))], [2, 4]);
});

test('regra 11: 👥 usa o estado por chat (sem diferença prática: Despausar não existe em 👥)', () => {
  assert.deepEqual(val('👥', ['E', 'P']), { ok: true });
  assert.ok(regrasDo(val('👥', ['P', 'E']), 2).includes(1));
});

test('textoModal: frase do layout-M para a regra 1', () => {
  const passos = passosDe(['A', 'P', 'E']);
  const r = plano(validarFluxo({ paraQuem: 'aguardando', passos }));
  const t = textoModal(erroDoModal(r.erros), passos);
  assert.equal(t.titulo, 'Esta ordem não é aceita');
  assert.equal(t.linha, 'O passo 3 · Enviar vem depois de 2 · Pausar.');
  assert.match(t.detalhe, /^Cliente em espera não recebe mensagem\./);
  assert.match(t.detalhe, /coloque Despausar antes/);
  assert.match(t.detalhe, /remova o passo 3/);
});

test('textoModal: quando houve envio antes, não sugere Despausar (regra 8)', () => {
  const passos = passosDe(['E', 'P', 'D', 'E']);
  const r = plano(validarFluxo({ paraQuem: 'aguardando', passos }));
  const t = textoModal(erroDoModal(r.erros), passos);
  assert.equal(t.linha, 'O passo 4 · Enviar repete o envio do passo 1 · Enviar.');
  assert.doesNotMatch(t.detalhe, /Despausar antes/);
  assert.match(t.detalhe, /Enviar duas vezes para o mesmo cliente não é permitido/);
  assert.match(t.detalhe, /remova o passo 4/);
});

test('textoModal: regras 2 e 5', () => {
  const p2 = passosDe(['EF', 'P']);
  const t2 = textoModal(erroDoModal(plano(validarFluxo({ paraQuem: 'aguardando', passos: p2 })).erros), p2);
  assert.equal(t2.linha, 'O passo 2 · Pausar vem depois de 1 · Enviar + Finalizar.');
  assert.match(t2.detalhe, /^Não sobra cliente na tela\./);
  const p5 = passosDe(['P', 'P']);
  const t5 = textoModal(erroDoModal(plano(validarFluxo({ paraQuem: 'aguardando', passos: p5 })).erros), p5);
  assert.equal(t5.linha, 'O passo 2 · Pausar repete o passo 1 · Pausar.');
});
