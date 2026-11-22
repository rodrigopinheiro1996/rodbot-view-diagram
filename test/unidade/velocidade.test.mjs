import test from 'node:test';
import assert from 'node:assert/strict';
import { carregarPuro } from '../util/carregar-puro.mjs';

const v = carregarPuro('velocidade.js');
const plano = (x) => JSON.parse(JSON.stringify(x));

test('pausa efetiva = pausa atual ÷ velocidade (maior = mais rápido)', () => {
  assert.equal(v.pausa(1200, 1), 1200, '1.0 = tempos de hoje');
  assert.equal(v.pausa(1200, 2), 600);
  assert.equal(v.pausa(1200, 0.5), 2400);
  assert.equal(v.pausa(500, 2), 250, 'ritmo do Atender');
  assert.equal(v.pausa(1000, 1.5), 667, 'arredonda para ms inteiro');
  assert.equal(v.pausa(0, 2), 0);
});

test('piso de 50%: nenhuma pausa abaixo da metade; fora da faixa vira o limite', () => {
  assert.equal(v.pausa(1200, 3), 600);
  assert.equal(v.pausa(1200, 0.1), 2400);
  for (const ms of [120, 150, 500, 550, 600, 700, 1200]) {
    for (const vel of [0.5, 1, 1.3, 1.9, 2, 5]) assert.ok(v.pausa(ms, vel) >= ms * 0.5, `${ms} ${vel}`);
  }
});

test('pausa com velocidade ausente ou inválida usa 1.0', () => {
  assert.equal(v.pausa(1200, undefined), 1200);
  assert.equal(v.pausa(1200, NaN), 1200);
  assert.equal(v.pausa(1200, 'abc'), 1200);
});

test('normalizarVelocidade: faixa 0.5 a 2.0, passo 0.1, padrão 1.0, com aviso no campo', () => {
  assert.deepEqual(plano(v.normalizarVelocidade('1.25')), { valor: 1.3, aviso: null });
  assert.deepEqual(plano(v.normalizarVelocidade(2.5)), { valor: 2, aviso: 'Máximo 2.0' });
  assert.deepEqual(plano(v.normalizarVelocidade(0.2)), { valor: 0.5, aviso: 'Mínimo 0.5' });
  assert.deepEqual(plano(v.normalizarVelocidade('')), { valor: 1, aviso: null });
  assert.deepEqual(plano(v.normalizarVelocidade('abc')), { valor: 1, aviso: 'Valor inválido' });
  assert.deepEqual(plano(v.normalizarVelocidade('1,5')), { valor: 1.5, aviso: null }, 'vírgula decimal');
  assert.deepEqual(plano(v.normalizarVelocidade(2)), { valor: 2, aviso: null });
});

test('velocidade do passo: vazia = a do fluxo; preenchida mostra o selo', () => {
  assert.equal(v.velocidadeDoPasso({ velocidade: null }, 1.2), 1.2);
  assert.equal(v.velocidadeDoPasso({}, 1.2), 1.2);
  assert.equal(v.velocidadeDoPasso({ velocidade: '' }, 1.2), 1.2);
  assert.equal(v.velocidadeDoPasso({ velocidade: 1.5 }, 1.2), 1.5);
  assert.equal(v.velocidadeDoPasso({ velocidade: 9 }, 1.2), 2, 'corrige para o limite');
  assert.equal(v.seloVelocidade({ velocidade: 1.5 }), '×1.5');
  assert.equal(v.seloVelocidade({ velocidade: 2 }), '×2.0');
  assert.equal(v.seloVelocidade({ velocidade: null }), null);
  assert.equal(v.seloVelocidade({}), null);
});

test('pausa entre ciclos ignora a velocidade (§7/§8)', () => {
  assert.equal(v.pausaEntreCiclos(1, 2), 1000);
  assert.equal(v.pausaEntreCiclos(1, 0.5), 1000);
  assert.equal(v.pausaEntreCiclos(2.5), 2500);
});

test('normalizarPausaCiclos: 0 a 60 s, padrão 1 s', () => {
  assert.deepEqual(plano(v.normalizarPausaCiclos(75)), { valor: 60, aviso: 'Máximo 60 s' });
  assert.deepEqual(plano(v.normalizarPausaCiclos(-1)), { valor: 0, aviso: 'Mínimo 0 s' });
  assert.deepEqual(plano(v.normalizarPausaCiclos('')), { valor: 1, aviso: null });
  assert.deepEqual(plano(v.normalizarPausaCiclos('x')), { valor: 1, aviso: 'Valor inválido' });
  assert.deepEqual(plano(v.normalizarPausaCiclos('0')), { valor: 0, aviso: null });
  assert.deepEqual(plano(v.normalizarPausaCiclos(30)), { valor: 30, aviso: null });
});
