// Tarefas 15 e 22: a tela nova (abas Montar | Acompanhar) é a única; o painel antigo de 5 abas foi removido.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBlip, injetarBookmarklet, fecharNavegador } from './util.mjs';

after(fecharNavegador);

async function abrirPainel({ abaAntiga, interruptorAntigo } = {}) {
  const { page, erros, fechar } = await abrirBlip();
  await page.evaluate(({ abaAntiga, interruptorAntigo }) => {
    if (abaAntiga) localStorage.setItem('rf_rodbot_tab_v1', abaAntiga);
    if (interruptorAntigo !== undefined) localStorage.setItem('rf_rodbot_ui_nova_v1', interruptorAntigo);
  }, { abaAntiga, interruptorAntigo });
  await injetarBookmarklet(page);
  return { page, erros, fechar };
}
// vistas ainda vazias (as Tarefas 16–21 as preenchem): confere pelo display, não pelo tamanho
const exibido = (page, sel) => page.$eval(sel, (e) => getComputedStyle(e).display !== 'none');
const visiveis = (page, sel) => page.$$eval(sel, (els) => els.filter((e) => e.offsetParent !== null).map((e) => e.textContent.trim()));

test('o painel abre direto na tela nova: só as abas Montar e Acompanhar; não existem as 5 abas antigas', async () => {
  const { page, erros, fechar } = await abrirPainel();
  assert.deepEqual(await visiveis(page, '.rb-aba'), ['🧩 Montar', '📊 Acompanhar']);
  for (const id of ['ba-tabs', 'ba-pane-piloto', 'ba-pane-pasta', 'ba-pane-mensagem', 'ba-pane-fila', 'ba-pane-auto',
    'ba-play', 'ba-pilot-start', 'ba-claim-auto', 'ba-move-folder', 'ba-transfer-start', 'ba-auto-toggle', 'ba-pause-all']) {
    assert.equal(await page.$('#' + id), null, id);
  }
  assert.deepEqual(erros, []);
  await fechar();
});

test('a chave provisória rf_rodbot_ui_nova_v1 não muda nada (nem "0" volta ao painel antigo) e não é criada', async () => {
  for (const valor of ['0', '1']) {
    const { page, erros, fechar } = await abrirPainel({ interruptorAntigo: valor });
    assert.deepEqual(await visiveis(page, '.rb-aba'), ['🧩 Montar', '📊 Acompanhar'], valor);
    assert.deepEqual(erros, []);
    await fechar();
  }
  const { page, fechar } = await abrirPainel();
  assert.equal(await page.evaluate(() => localStorage.getItem('rf_rodbot_ui_nova_v1')), null);
  await fechar();
});

test('aba antiga salva ("fila") abre em Montar', async () => {
  const { page, fechar } = await abrirPainel({ abaAntiga: 'fila' });
  assert.equal(await page.getAttribute('#ba-win', 'data-rb-aba'), 'montar');
  assert.ok(await exibido(page, '#rb-montar'));
  assert.ok(!(await exibido(page, '#rb-acompanhar')));
  await fechar();
});

test('Montar fica limpo (sem log); Acompanhar mostra Pausar/Parar e o log', async () => {
  const { page, fechar } = await abrirPainel();
  assert.ok(!(await page.isVisible('#ba-log')));
  await page.click('#rb-aba-acompanhar');
  assert.ok(await exibido(page, '#rb-acompanhar'));
  assert.ok(!(await exibido(page, '#rb-montar')));
  assert.ok(await page.isVisible('#ba-log'));
  await page.click('#rb-aba-montar');
  assert.ok(!(await page.isVisible('#ba-log')));
  await fechar();
});

test('cabeçalho igual (rod bot, status, Tema, fechar) e o tema continua trocando', async () => {
  const { page, fechar } = await abrirPainel();
  assert.match(await page.textContent('#ba-hdr .ba-brand'), /rod bot/);
  assert.equal(await page.textContent('#ba-st'), 'Parado');
  await page.click('#ba-theme-btn');
  const temas = await page.$$eval('.ba-theme-opt', (els) => els.map((e) => e.dataset.baTheme));
  const atual = await page.getAttribute('#ba-win', 'data-rf-theme');
  const outro = temas.find((t) => t !== atual);
  await page.click(`.ba-theme-opt[data-ba-theme="${outro}"]`);
  assert.equal(await page.getAttribute('#ba-win', 'data-rf-theme'), outro);
  assert.ok(await page.isVisible('#ba-close'));
  await fechar();
});

test('abrir duas vezes não duplica o painel nem a casca', async () => {
  const { page, erros, fechar } = await abrirPainel();
  await injetarBookmarklet(page);
  assert.equal(await page.$$eval('#blip-auto-panel', (e) => e.length), 1);
  assert.equal(await page.$$eval('#rb-abas', (e) => e.length), 1);
  assert.deepEqual(erros, []);
  await fechar();
});
