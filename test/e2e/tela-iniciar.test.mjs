// Tarefa 22: o Iniciar da tela roda o fluxo montado e pula para o Acompanhar.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBlip, injetarBookmarklet, estado, fecharNavegador } from './util.mjs';

after(fecharNavegador);

async function abrir(config = {}) {
  const { page, erros, fechar } = await abrirBlip(config);
  await page.evaluate(() => localStorage.setItem('rf_rodbot_ui_nova_v1', '1'));
  await injetarBookmarklet(page);
  return { page, erros, fechar };
}
const card = (i) => `.rb-passo[data-i="${i}"]`;
// deixa o ⭐ Piloto clássico pronto: mensagem padrão + pasta nv2; loop desligado (termina sozinho)
async function prepararPiloto(page, { loop = false } = {}) {
  await page.click(`${card(1)} .rb-passo-tit`);
  await page.click(`${card(1)} [data-acao-campo="padrao"]`);
  await page.click(`${card(3)} .rb-passo-tit`);
  await page.click(`${card(3)} [data-pasta="nv2"]`);
  if (!loop) { await page.click('#rb-ajustes-topo'); await page.click('#rb-loop'); }
  assert.ok(!(await page.isDisabled('#rb-iniciar')));
}
const etapas = (page) => page.$$eval('#rb-stepper .rb-etapa', (els) => els.map((e) => e.dataset.status));

test('Iniciar válido: pula para Acompanhar, status "Rodando" e o fluxo roda até o fim no Blip', async () => {
  const { page, erros, fechar } = await abrir({ naTela: [], fila: 2 });
  await prepararPiloto(page);
  await page.click('#rb-iniciar');
  assert.equal(await page.getAttribute('#ba-win', 'data-rb-aba'), 'acompanhar');
  assert.equal(await page.textContent('#ba-st'), 'Rodando');
  await page.waitForFunction(() => document.querySelector('#rb-acomp-ciclo').textContent === 'Concluído', null, { timeout: 60000 });
  assert.deepEqual(await etapas(page), ['feito', 'feito', 'feito', 'feito']);
  assert.equal(await page.textContent('#ba-st'), 'Parado');
  const e = await estado(page);
  assert.equal(e.tickets.length, 2);
  assert.ok(e.tickets.every((t) => t.mensagens.length === 1 && t.pausado && t.pasta === 'nv2'));
  assert.deepEqual(erros, []);
  await fechar();
});

test('só um fluxo por vez: enquanto roda, o Iniciar fica bloqueado ("Fluxo rodando…"); ao terminar, libera', async () => {
  const { page, fechar } = await abrir({ naTela: ['Cliente Fictício 1', 'Cliente Fictício 2', 'Cliente Fictício 3'], fila: 0 });
  await prepararPiloto(page);
  await page.click('#rb-iniciar');
  await page.click('#rb-aba-montar');
  assert.ok(await page.isDisabled('#rb-iniciar'));
  assert.equal(await page.textContent('#rb-iniciar'), '⏳ Fluxo rodando…');
  await page.click('#rb-aba-acompanhar');
  await page.click('#ba-stop');
  await page.waitForFunction(() => document.querySelector('#ba-st').textContent === 'Parado', null, { timeout: 30000 });
  await page.click('#rb-aba-montar');
  assert.ok(!(await page.isDisabled('#rb-iniciar')));
  assert.equal(await page.textContent('#rb-iniciar'), '⚡ Iniciar fluxo');
  await fechar();
});

test('Parar → "Parado"; Pausar alterna para "Retomar" e volta', async () => {
  const { page, fechar } = await abrir({ naTela: ['Cliente Fictício 1', 'Cliente Fictício 2', 'Cliente Fictício 3'], fila: 0 });
  await prepararPiloto(page);
  await page.click('#rb-iniciar');
  await page.click('#ba-pause');
  assert.match(await page.textContent('#ba-pause'), /Retomar/);
  await page.click('#ba-pause');
  assert.match(await page.textContent('#ba-pause'), /Pausar/);
  await page.click('#ba-stop');
  await page.waitForFunction(() => document.querySelector('#rb-acomp-ciclo').textContent === 'Parado', null, { timeout: 30000 });
  assert.equal(await page.textContent('#ba-st'), 'Parado');
  await fechar();
});

test('falha geral: o passo fica vermelho no Acompanhar e o motivo vai para o log', async () => {
  const { page, fechar } = await abrir({ semBotaoAtender: true, fila: 2 });
  await prepararPiloto(page);
  await page.click('#rb-iniciar');
  await page.waitForFunction(() => document.querySelector('#rb-acomp-ciclo').textContent === 'Falha', null, { timeout: 30000 });
  assert.deepEqual(await etapas(page), ['falha', 'aguardando', 'aguardando', 'aguardando']);
  assert.match(await page.textContent('#ba-log'), /Passo 1 · Atender falhou/);
  await fechar();
});

test('editar o Montar durante a execução não muda o fluxo que está rodando', async () => {
  const { page, fechar } = await abrir({ naTela: ['Cliente Fictício 1', 'Cliente Fictício 2'], fila: 0 });
  await prepararPiloto(page);
  await page.click('#rb-iniciar');
  await page.click('#rb-aba-montar');
  await page.click(`${card(1)} .rb-passo-tit`);
  await page.fill(`${card(1)} [data-campo="mensagem"]`, 'Outro texto');
  await page.waitForFunction(() => document.querySelector('#ba-st').textContent === 'Parado', null, { timeout: 60000 });
  const e = await estado(page);
  assert.ok(e.tickets.every((t) => t.mensagens.length === 1 && /^Realizamos/.test(t.mensagens[0])));
  await fechar();
});
