// Tarefa 21: Acompanhar (layout D) — nome + ciclo, passo a passo do usuário, contadores do Auto só em 🆕/👥, Pausar/Parar e log.
// O Iniciar da tela só é ligado ao motor na Tarefa 22: aqui o fluxo roda pelo gancho de teste e a tela acompanha.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBlip, injetarBookmarklet, estado, fecharNavegador } from './util.mjs';

after(fecharNavegador);

async function abrir(config = {}) {
  const { page, erros, fechar } = await abrirBlip(config);
  await injetarBookmarklet(page, { teste: true });
  return { page, erros, fechar };
}
const etapas = (page) => page.$$eval('#rb-stepper .rb-etapa', (els) =>
  els.map((e) => [e.querySelector('.rb-etapa-tit').textContent, e.querySelector('.rb-etapa-sub').textContent]));
const A = { tipo: 'atender' };
const E = (mensagem = 'Olá') => ({ tipo: 'enviar', modo: 'so', mensagem });
const P = { tipo: 'espera', modo: 'pausar' };
const M = { tipo: 'mover', pasta: 'nv2' };
const fluxo = (paraQuem, passos, extra = {}) =>
  ({ paraQuem, passos, loopEscolha: false, pausaCiclos: 1, velocidade: 2, puxarFila: false, ...extra });
const rodar = (page, f, nome) => page.evaluate(([x, n]) => window.__rodBot.executarFluxo(x, { nome: n }), [f, nome]);

test('parado: mostra o fluxo do Montar, "Parado" e todos os passos Aguardando', async () => {
  const { page, erros, fechar } = await abrir();
  await page.click('#rb-aba-acompanhar');
  assert.equal(await page.textContent('#rb-acomp-nome'), '⭐ Piloto clássico');
  assert.equal(await page.textContent('#rb-acomp-ciclo'), 'Parado');
  assert.deepEqual(await etapas(page), [
    ['📥 Atender fila', 'Aguardando'], ['✉️ Enviar · Só enviar', 'Aguardando'],
    ['⏸️ Pausar', 'Aguardando'], ['📁 Mover', 'Aguardando'],
  ]);
  assert.ok(await page.isVisible('#ba-log'));
  assert.deepEqual(erros, []);
  await fechar();
});

test('contadores do Auto (Novos chats, Contador Blip, Na fila do BM, Zerar contador) só em 🆕/👥', async () => {
  const { page, fechar } = await abrir();
  await page.click('#rb-aba-acompanhar');
  assert.ok(!(await page.isVisible('#ba-auto-count')), '⏳ não mostra');
  await page.click('#rb-aba-montar');
  await page.click('.rb-pq[data-pq="caindo"]');
  await page.click('#rb-aba-acompanhar');
  for (const sel of ['#ba-auto-count', '#ba-auto-native', '#ba-auto-queue', '#ba-auto-reset']) {
    assert.ok(await page.isVisible(sel), sel);
  }
  await page.click('#rb-aba-montar');
  await page.click('.rb-pq[data-pq="ambos"]');
  await page.click('#rb-aba-acompanhar');
  assert.ok(await page.isVisible('#ba-auto-count'));
  await fechar();
});

test('rodando ⏳ [A,E,P,M]: nome do fluxo, "Ciclo #1" e cada passo termina Feito, na ordem do usuário', async () => {
  const { page, erros, fechar } = await abrir({ naTela: [], fila: 2 });
  await page.click('#rb-aba-acompanhar');
  const r = await rodar(page, fluxo('aguardando', [A, E(), P, M]), 'Meu fluxo');
  assert.equal(r.status, 'concluido', JSON.stringify(r));
  assert.equal(await page.textContent('#rb-acomp-nome'), 'Meu fluxo');
  assert.equal(await page.textContent('#rb-acomp-ciclo'), 'Concluído');
  assert.deepEqual(await etapas(page), [
    ['📥 Atender fila', 'Feito'], ['✉️ Enviar · Só enviar', 'Feito'], ['⏸️ Pausar', 'Feito'], ['📁 Mover → nv2', 'Feito'],
  ]);
  assert.match(await page.textContent('#ba-log'), /Ciclo #1: 2 atendidos · 2 enviados · 2 pausados · 2 movidos · 0 falhas/);
  assert.deepEqual(erros, []);
  await fechar();
});

test('durante a execução: o passo atual aparece Rodando, o topo mostra o ciclo e Pausar/Parar ficam visíveis', async () => {
  const { page, fechar } = await abrir({ naTela: ['Cliente Fictício 1', 'Cliente Fictício 2'] });
  await page.click('#rb-aba-acompanhar');
  const execucao = rodar(page, fluxo('aguardando', [P, M], { velocidade: 0.5 }), 'Lento');
  await page.waitForFunction(() => [...document.querySelectorAll('#rb-stepper .rb-etapa')]
    .some((e) => e.dataset.status === 'rodando'), null, { timeout: 15000 });
  assert.equal(await page.textContent('#rb-acomp-ciclo'), 'Ciclo #1');
  assert.ok(await page.isVisible('#ba-pause'));
  assert.ok(await page.isVisible('#ba-stop'));
  await page.click('#ba-stop');
  assert.equal((await execucao).status, 'parado');
  assert.equal(await page.textContent('#rb-acomp-ciclo'), 'Parado');
  await fechar();
});

test('falha geral: o passo fica Falha com o motivo e o topo mostra "Falha"', async () => {
  const { page, fechar } = await abrir({ semBotaoAtender: true, fila: 2 });
  await page.click('#rb-aba-acompanhar');
  await rodar(page, fluxo('aguardando', [A, E()]), 'Com falha');
  const [primeira, segunda] = await etapas(page);
  assert.equal(primeira[1].startsWith('Falha · '), true, primeira[1]);
  assert.match(primeira[1], /Atender/);
  assert.equal(segunda[1], 'Aguardando');
  assert.equal(await page.textContent('#rb-acomp-ciclo'), 'Falha');
  assert.equal(await page.$eval('.rb-etapa', (e) => e.dataset.status), 'falha');
  await fechar();
});

test('🆕: topo "Vigiando", o passo mostra o chat atual e os contadores aparecem', async () => {
  const { page, fechar } = await abrir();
  await page.click('#rb-aba-acompanhar');
  const execucao = rodar(page, fluxo('caindo', [E('Oi'), P]), '⭐ Auto clássico');
  await page.waitForTimeout(1200);
  assert.equal(await page.textContent('#rb-acomp-ciclo'), 'Vigiando');
  assert.ok(await page.isVisible('#ba-auto-count'));
  const novo = await page.evaluate(() => window.blipFalso.chegarChat('Cliente Novo'));
  await page.waitForFunction((id) => window.blipFalso.estado().tickets.find((t) => t.id === id).pausado, novo, { timeout: 30000 });
  const [envio] = await etapas(page);
  assert.equal(envio[1], `Feito · #${novo}`);
  assert.equal(await page.textContent('#ba-auto-count'), '1');
  await page.click('#ba-stop');
  await execucao;
  assert.equal((await estado(page)).tickets.find((t) => t.id === novo).mensagens.length, 1);
  await fechar();
});

test('os contadores do Auto ficam no Acompanhar (não existe mais a aba Auto)', async () => {
  const { page, erros, fechar } = await abrir();
  assert.ok(await page.$eval('#ba-auto-count', (e) => !!e.closest('#rb-acompanhar')));
  assert.equal(await page.$('#ba-pane-auto'), null);
  assert.deepEqual(erros, []);
  await fechar();
});
