// Tarefa 21: passo a passo do Acompanhar (puro).
import test from 'node:test';
import assert from 'node:assert/strict';
import { carregarPuro } from '../util/carregar-puro.mjs';

const m = carregarPuro('passos-tela.js', 'stepper.js');
const plano = (x) => JSON.parse(JSON.stringify(x));
const A = { tipo: 'atender' };
const E = { tipo: 'enviar', modo: 'so', mensagem: 'Oi' };
const P = { tipo: 'espera', modo: 'pausar' };
const M = { tipo: 'mover', pasta: 'nv2' };

test('status por passo na ordem do usuário', () => {
  const s = plano(m.montarStepper([A, E, P, M], { status: { 1: 'feito', 2: 'rodando' } }));
  assert.deepEqual(s.map((x) => x.statusTexto), ['Feito', 'Rodando', 'Aguardando', 'Aguardando']);
  assert.deepEqual(s.map((x) => x.indice), [1, 2, 3, 4]);
  assert.equal(s[3].rotulo, '📁 Mover → nv2');
});

test('falha mostra o motivo; detalhe do passo (ex.: chat atual) aparece junto do status', () => {
  const s = plano(m.montarStepper([A, E], {
    status: { 1: 'falha', 2: 'rodando' },
    detalhe: { 1: 'botão Atender não encontrado', 2: '#3148001' },
  }));
  assert.equal(s[0].statusTexto, 'Falha');
  assert.equal(s[0].texto, 'Falha · botão Atender não encontrado');
  assert.equal(s[1].texto, 'Rodando · #3148001');
});

test('sem execução: tudo Aguardando', () => {
  assert.deepEqual(plano(m.montarStepper([E, P], null)).map((x) => x.status), ['aguardando', 'aguardando']);
});

test('aplicarEventoStepper: acumula os eventos do motor (passo/ciclo) num estado de execução', () => {
  let ex = m.novaExecucao({ nome: '⭐ Piloto clássico', paraQuem: 'aguardando', passos: [A, E] });
  ex = m.aplicarEventoStepper(ex, { tipo: 'ciclo', n: 2 });
  ex = m.aplicarEventoStepper(ex, { tipo: 'passo', indice: 1, status: 'aguardando' });
  ex = m.aplicarEventoStepper(ex, { tipo: 'passo', indice: 1, status: 'feito' });
  ex = m.aplicarEventoStepper(ex, { tipo: 'passo', indice: 2, status: 'rodando', detalhe: '#9' });
  ex = m.aplicarEventoStepper(ex, { tipo: 'fim', status: 'concluido' });
  assert.equal(ex.ciclo, 2);
  assert.equal(ex.fim, 'concluido');
  assert.deepEqual(plano(m.montarStepper(ex.passos, ex)).map((x) => x.texto), ['Feito', 'Rodando · #9']);
});

test('rótulo do topo: ciclo em ⏳; "Vigiando" em 🆕/👥; estado final ao terminar', () => {
  const base = (paraQuem) => m.novaExecucao({ nome: 'X', paraQuem, passos: [E] });
  assert.equal(m.rotuloExecucao(null), 'Parado');
  assert.equal(m.rotuloExecucao(m.aplicarEventoStepper(base('aguardando'), { tipo: 'ciclo', n: 3 })), 'Ciclo #3');
  assert.equal(m.rotuloExecucao(base('caindo')), 'Vigiando');
  assert.equal(m.rotuloExecucao(m.aplicarEventoStepper(base('aguardando'), { tipo: 'fim', status: 'falha' })), 'Falha');
  assert.equal(m.rotuloExecucao(m.aplicarEventoStepper(base('caindo'), { tipo: 'fim', status: 'parado' })), 'Parado');
  assert.equal(m.rotuloExecucao(m.aplicarEventoStepper(base('aguardando'), { tipo: 'fim', status: 'concluido' })), 'Concluído');
});
