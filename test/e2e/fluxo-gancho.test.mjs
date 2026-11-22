// Tarefa 11: motor ligado às funções reais, acionado pelo gancho de teste na página falsa.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBlip, injetarBookmarklet, estado, fecharNavegador } from './util.mjs';

after(fecharNavegador);

const E = (mensagem = 'Olá') => ({ tipo: 'enviar', modo: 'so', mensagem });
const P = { tipo: 'espera', modo: 'pausar' };
const fluxo = (paraQuem, passos, extra = {}) =>
  ({ paraQuem, passos, loopEscolha: false, pausaCiclos: 1, velocidade: 2, puxarFila: false, ...extra });
const rodar = (page, f) => page.evaluate((x) => window.__rodBot.executarFluxo(x), f);

test('sem window.__rodBotTeste o gancho não existe', async () => {
  const { page, erros, fechar } = await abrirBlip();
  await injetarBookmarklet(page);
  assert.equal(await page.evaluate(() => typeof window.__rodBot), 'undefined');
  assert.deepEqual(erros, []);
  await fechar();
});

test('com o gancho: [E] "Olá" chega 1× a cada ticket da tela', async () => {
  const { page, erros, fechar } = await abrirBlip();
  await injetarBookmarklet(page, { teste: true });
  const r = await rodar(page, fluxo('aguardando', [E()]));
  assert.equal(r.status, 'concluido', JSON.stringify(r));
  const e = await estado(page);
  assert.ok(e.tickets.every((t) => t.mensagens.length === 1 && t.mensagens[0] === 'Olá'));
  assert.deepEqual(erros, []);
  await fechar();
});

test('⏳ [E]: ticket em espera é pulado (o motor lê o menu), os ativos recebem', async () => {
  const { page, fechar } = await abrirBlip({ pausadosIniciais: [1] });
  await injetarBookmarklet(page, { teste: true });
  const r = await rodar(page, fluxo('aguardando', [E()]));
  const e = await estado(page);
  assert.deepEqual(e.tickets.map((t) => t.mensagens.length), [1, 0, 1]);
  assert.equal(r.totais.enviados, 2);
  await fechar();
});

test('⏳ [E+Finalizar] usa a tag do passo (a caixa antiga está vazia)', async () => {
  const { page, fechar } = await abrirBlip({ naTela: ['Cliente Fictício 1'] });
  await injetarBookmarklet(page, { teste: true });
  const r = await rodar(page, fluxo('aguardando', [{ tipo: 'enviar', modo: 'finalizar', mensagem: 'Tchau', tag: 'Resolvido' }]));
  assert.equal(r.status, 'concluido', JSON.stringify(r));
  const t = (await estado(page)).tickets[0];
  assert.equal(t.status, 'finalizado');
  assert.deepEqual(t.tags, ['Resolvido']);
  await fechar();
});

test('🆕 [E,P]: o chat que cai depois recebe e é pausado; o painel antigo fica bloqueado enquanto roda', async () => {
  const { page, erros, fechar } = await abrirBlip();
  await injetarBookmarklet(page, { teste: true });
  const execucao = page.evaluate((f) => window.__rodBot.executarFluxo(f), fluxo('caindo', [E('Bem-vindo'), P]));
  await page.waitForTimeout(1500);
  const novo = await page.evaluate(() => window.blipFalso.chegarChat('Cliente Novo'));
  await page.waitForFunction((id) => window.blipFalso.estado().tickets.find((t) => t.id === id).pausado, novo, { timeout: 30000 });
  const recusa = await page.evaluate((f) => window.__rodBot.executarFluxo(f), fluxo('aguardando', [E()]));
  assert.equal(recusa.status, 'recusado');
  await page.evaluate(() => window.__rodBot.parar());
  assert.equal((await execucao).status, 'parado');
  const e = await estado(page);
  assert.deepEqual(e.tickets.find((t) => t.id === novo).mensagens, ['Bem-vindo']);
  assert.ok(e.tickets.filter((t) => t.id !== novo).every((t) => t.mensagens.length === 0 && !t.pausado));
  assert.deepEqual(erros, []);
  await fechar();
});
