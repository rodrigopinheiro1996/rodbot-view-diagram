import test from 'node:test';
import assert from 'node:assert/strict';
import { carregarPuro } from '../util/carregar-puro.mjs';

const { validarCampos, podeIniciar } = carregarPuro('validar-fluxo.js', 'validar-campos.js');
const plano = (x) => JSON.parse(JSON.stringify(x));
const campos = (passo) => plano(validarCampos(passo));

test('Enviar: mensagem vazia ou só com espaços é obrigatória', () => {
  assert.deepEqual(campos({ tipo: 'enviar', modo: 'so', mensagem: '  ' }), [{ campo: 'mensagem' }]);
  assert.deepEqual(campos({ tipo: 'enviar', modo: 'so' }), [{ campo: 'mensagem' }]);
  assert.deepEqual(campos({ tipo: 'enviar', modo: 'so', mensagem: 'oi' }), []);
});

test('Enviar + Finalizar: a Tag também é obrigatória', () => {
  assert.deepEqual(campos({ tipo: 'enviar', modo: 'finalizar', mensagem: 'oi', tag: '' }), [{ campo: 'tag' }]);
  assert.deepEqual(campos({ tipo: 'enviar', modo: 'finalizar', mensagem: '', tag: ' ' }), [
    { campo: 'mensagem' },
    { campo: 'tag' },
  ]);
  assert.deepEqual(campos({ tipo: 'enviar', modo: 'finalizar', mensagem: 'oi', tag: 'x' }), []);
  assert.deepEqual(campos({ tipo: 'enviar', modo: 'so', mensagem: 'oi', tag: '' }), [], 'Só enviar não pede Tag');
});

test('Mover pede Pasta; Transferir pede o nome do atendente', () => {
  assert.deepEqual(campos({ tipo: 'mover', pasta: '' }), [{ campo: 'pasta' }]);
  assert.deepEqual(campos({ tipo: 'mover', pasta: 'nv2' }), []);
  assert.deepEqual(campos({ tipo: 'transferir', atendente: '' }), [{ campo: 'atendente' }]);
  assert.deepEqual(campos({ tipo: 'transferir', atendente: 'Atendente Fictício' }), []);
  // Para fila: o campo obrigatório é a fila; o nome de atendente antigo não conta.
  assert.deepEqual(campos({ tipo: 'transferir', para: 'fila', fila: '', atendente: 'Atendente Fictício' }), [{ campo: 'fila' }]);
  assert.deepEqual(campos({ tipo: 'transferir', para: 'fila', fila: 'Nível 2', atendente: '' }), []);
});

test('Espera e Atender não têm campo obrigatório', () => {
  assert.deepEqual(campos({ tipo: 'espera', modo: 'pausar' }), []);
  assert.deepEqual(campos({ tipo: 'espera', modo: 'despausar' }), []);
  assert.deepEqual(campos({ tipo: 'atender' }), []);
});

const ok = {
  paraQuem: 'aguardando',
  passos: [
    { tipo: 'atender' },
    { tipo: 'enviar', modo: 'so', mensagem: 'Olá' },
    { tipo: 'espera', modo: 'pausar' },
    { tipo: 'mover', pasta: 'nv2' },
  ],
};

test('podeIniciar: fluxo válido e preenchido', () => {
  assert.equal(podeIniciar(ok), true);
});

test('podeIniciar: campo vazio bloqueia (nada é pulado em silêncio)', () => {
  const f = structuredClone(ok);
  f.passos[1].mensagem = '';
  assert.equal(podeIniciar(f), false);
});

test('podeIniciar: erro de ordem bloqueia', () => {
  const f = structuredClone(ok);
  f.passos.push({ tipo: 'enviar', modo: 'so', mensagem: 'de novo' }); // depois de Mover: regra 2
  assert.equal(podeIniciar(f), false);
});

test('podeIniciar: sem "Para quem?" bloqueia; fluxo vazio bloqueia', () => {
  assert.equal(podeIniciar({ ...structuredClone(ok), paraQuem: null }), false);
  assert.equal(podeIniciar({ paraQuem: 'aguardando', passos: [] }), false);
});
