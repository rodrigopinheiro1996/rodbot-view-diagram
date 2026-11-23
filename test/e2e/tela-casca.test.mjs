// Tarefa 15: casca da tela nova (abas Montar | Acompanhar) atrás do interruptor provisório rf_rodbot_ui_nova_v1.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBlip, injetarBookmarklet, fecharNavegador } from './util.mjs';

after(fecharNavegador);

async function abrirPainel({ telaNova, abaAntiga } = {}) {
  const { page, erros, fechar } = await abrirBlip();
  await page.evaluate(({ telaNova, abaAntiga }) => {
    if (telaNova) localStorage.setItem('rf_rodbot_ui_nova_v1', '1');
    else localStorage.removeItem('rf_rodbot_ui_nova_v1');
    if (abaAntiga) localStorage.setItem('rf_rodbot_tab_v1', abaAntiga);
  }, { telaNova, abaAntiga });
  await injetarBookmarklet(page);
  return { page, erros, fechar };
}
// vistas ainda vazias (as Tarefas 16–21 as preenchem): confere pelo display, não pelo tamanho
const exibido = (page, sel) => page.$eval(sel, (e) => getComputedStyle(e).display !== 'none');
const visiveis = (page, sel) => page.$$eval(sel, (els) => els.filter((e) => e.offsetParent !== null).map((e) => e.textContent.trim()));

test('interruptor ligado: só as duas abas novas aparecem; as 5 antigas somem', async () => {
  const { page, erros, fechar } = await abrirPainel({ telaNova: true });
  assert.deepEqual(await visiveis(page, '.rb-aba'), ['🧩 Montar', '📊 Acompanhar']);
  assert.deepEqual(await visiveis(page, '.ba-tab-btn'), []);
  assert.deepEqual(await visiveis(page, '.ba-pane'), []);
  assert.deepEqual(erros, []);
  await fechar();
});

test('interruptor desligado (padrão): painel antigo exatamente como era, sem a casca nova', async () => {
  const { page, erros, fechar } = await abrirPainel({ telaNova: false });
  assert.equal((await visiveis(page, '.ba-tab-btn')).length, 5);
  assert.equal(await page.$('#rb-abas'), null);
  assert.equal(await page.getAttribute('#ba-win', 'data-ui'), null);
  assert.deepEqual(erros, []);
  await fechar();
});

test('aba antiga salva ("fila") abre em Montar', async () => {
  const { page, fechar } = await abrirPainel({ telaNova: true, abaAntiga: 'fila' });
  assert.equal(await page.getAttribute('#ba-win', 'data-rb-aba'), 'montar');
  assert.ok(await exibido(page, '#rb-montar'));
  assert.ok(!(await exibido(page, '#rb-acompanhar')));
  await fechar();
});

test('Montar fica limpo (sem log); Acompanhar mostra Pausar/Parar e o log', async () => {
  const { page, fechar } = await abrirPainel({ telaNova: true });
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
  const { page, fechar } = await abrirPainel({ telaNova: true });
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
  const { page, erros, fechar } = await abrirPainel({ telaNova: true });
  await injetarBookmarklet(page);
  assert.equal(await page.$$eval('#blip-auto-panel', (e) => e.length), 1);
  assert.equal(await page.$$eval('#rb-abas', (e) => e.length), 1);
  assert.deepEqual(erros, []);
  await fechar();
});
