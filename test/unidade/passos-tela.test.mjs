// Tarefa 16: textos e operações dos passos da tela Montar (puro).
import test from 'node:test';
import assert from 'node:assert/strict';
import { carregarPuro } from '../util/carregar-puro.mjs';

const m = carregarPuro('passos-tela.js');
const plano = (x) => JSON.parse(JSON.stringify(x));

test('novoPasso: valores iniciais de cada bloco (campos vazios, velocidade do fluxo)', () => {
  assert.deepEqual(plano(m.novoPasso('atender')), { tipo: 'atender', velocidade: null });
  assert.deepEqual(plano(m.novoPasso('enviar')), { tipo: 'enviar', modo: 'so', mensagem: '', tag: '', velocidade: null });
  assert.deepEqual(plano(m.novoPasso('espera')), { tipo: 'espera', modo: 'pausar', velocidade: null });
  assert.deepEqual(plano(m.novoPasso('mover')), { tipo: 'mover', pasta: '', velocidade: null });
  assert.deepEqual(plano(m.novoPasso('transferir')), { tipo: 'transferir', atendente: '', velocidade: null });
});

test('titulo e resumo de uma linha', () => {
  assert.equal(m.tituloPasso({ tipo: 'atender' }), '📥 Atender fila');
  assert.equal(m.tituloPasso({ tipo: 'enviar', modo: 'so' }), '✉️ Enviar · Só enviar');
  assert.equal(m.tituloPasso({ tipo: 'enviar', modo: 'finalizar' }), '✉️ Enviar · Enviar + Finalizar');
  assert.equal(m.tituloPasso({ tipo: 'espera', modo: 'pausar' }), '⏸️ Pausar');
  assert.equal(m.tituloPasso({ tipo: 'espera', modo: 'despausar' }), '▶️ Despausar');
  assert.equal(m.tituloPasso({ tipo: 'mover', pasta: 'nv2' }), '📁 Mover → nv2');
  assert.equal(m.tituloPasso({ tipo: 'mover', pasta: '' }), '📁 Mover');
  assert.equal(m.tituloPasso({ tipo: 'transferir', atendente: 'Ana' }), '🔁 Transferir → Ana');
  assert.equal(m.resumoPasso({ tipo: 'atender' }), 'Puxa até zerar · sentinela quando a fila esvaziar');
  assert.equal(m.resumoPasso({ tipo: 'enviar', modo: 'so', mensagem: '' }), 'Mensagem vazia');
  assert.equal(m.resumoPasso({ tipo: 'enviar', modo: 'so', mensagem: 'Realizamos uma nova atualização no seu aplicativo' }),
    '“Realizamos uma nova atualização no…”');
  assert.equal(m.resumoPasso({ tipo: 'enviar', modo: 'finalizar', mensagem: 'Oi', tag: 'Resolvido' }), '“Oi” · tag Resolvido');
  assert.equal(m.resumoPasso({ tipo: 'mover', pasta: '' }), 'Escolha a pasta');
  assert.equal(m.resumoPasso({ tipo: 'transferir', atendente: '' }), 'Escolha o atendente (nome exato)');
});

test('mover passo para cima/baixo e remover não alteram a lista original', () => {
  const p = ['a', 'b', 'c'].map((x) => ({ tipo: x }));
  assert.deepEqual(plano(m.moverPasso(p, 1, -1)).map((x) => x.tipo), ['b', 'a', 'c']);
  assert.deepEqual(plano(m.moverPasso(p, 2, 1)).map((x) => x.tipo), ['a', 'b', 'c'], 'último não desce');
  assert.deepEqual(plano(m.moverPasso(p, 0, -1)).map((x) => x.tipo), ['a', 'b', 'c'], 'primeiro não sobe');
  assert.deepEqual(plano(m.removerPasso(p, 1)).map((x) => x.tipo), ['a', 'c']);
  assert.deepEqual(p.map((x) => x.tipo), ['a', 'b', 'c']);
});
