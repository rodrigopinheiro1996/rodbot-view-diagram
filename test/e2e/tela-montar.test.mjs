// Tarefa 16: Para quem?, paleta e lista de passos na tela Montar (opção 2), atrás do interruptor.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBlip, injetarBookmarklet, fecharNavegador } from './util.mjs';

after(fecharNavegador);

async function abrirMontar() {
  const { page, erros, fechar } = await abrirBlip();
  await page.evaluate(() => localStorage.setItem('rf_rodbot_ui_nova_v1', '1'));
  await injetarBookmarklet(page);
  return { page, erros, fechar };
}
const titulos = (page) => page.$$eval('#rb-passos .rb-passo', (els) =>
  els.map((e) => e.querySelector('.rb-num').textContent + ' · ' + e.querySelector('.rb-passo-tit').textContent));
const novo = async (page) => page.click('#rb-novo');
const pq = (page, modo) => page.click(`.rb-pq[data-pq="${modo}"]`);
const add = (page, tipo) => page.click(`#rb-paleta [data-tipo="${tipo}"]`);

test('abre no ⭐ Piloto clássico com os 4 passos e o Iniciar bloqueado (mensagem e pasta vazias)', async () => {
  const { page, erros, fechar } = await abrirMontar();
  assert.equal(await page.$eval('#rb-fluxo-sel', (s) => s.selectedOptions[0].textContent), '⭐ Piloto clássico');
  assert.deepEqual(await titulos(page), ['1 · 📥 Atender fila', '2 · ✉️ Enviar · Só enviar', '3 · ⏸️ Pausar', '4 · 📁 Mover']);
  assert.ok(await page.isDisabled('#rb-iniciar'));
  assert.match(await page.textContent('#rb-iniciar-dica'), /Preencha o passo 2/);
  assert.deepEqual(erros, []);
  await fechar();
});

test('fluxo novo ("+") nasce sem modo: paleta apagada com a dica e Iniciar bloqueado; tocar na paleta faz o "Para quem?" piscar', async () => {
  const { page, fechar } = await abrirMontar();
  await novo(page);
  assert.equal(await page.$$eval('.rb-pq.on', (e) => e.length), 0);
  assert.ok(await page.$eval('#rb-paleta', (e) => e.classList.contains('rb-off')));
  assert.equal(await page.textContent('#rb-pal-dica'), 'Escolha para quem primeiro');
  assert.ok(await page.isDisabled('#rb-iniciar'));
  await add(page, 'enviar');
  assert.ok(await page.$eval('#rb-pq', (e) => e.classList.contains('rb-pisca')));
  assert.deepEqual(await titulos(page), [], 'nada é adicionado sem modo');
  await fechar();
});

test('fluxo vazio com modo: paleta em destaque; tocar adiciona no fim e abre só o cartão novo', async () => {
  const { page, fechar } = await abrirMontar();
  await novo(page);
  await pq(page, 'aguardando');
  assert.ok(await page.$eval('#rb-paleta', (e) => e.classList.contains('rb-destaque')));
  await add(page, 'enviar');
  await add(page, 'mover');
  assert.deepEqual(await titulos(page), ['1 · ✉️ Enviar · Só enviar', '2 · 📁 Mover']);
  assert.deepEqual(await page.$$eval('.rb-passo.aberto', (e) => e.map((x) => x.dataset.i)), ['1']);
  assert.ok(!(await page.$eval('#rb-paleta', (e) => e.classList.contains('rb-destaque'))));
  await fechar();
});

test('▲ ▼ ✕ reordenam, removem e renumeram; ▲ do 1º e ▼ do último ficam desabilitados', async () => {
  const { page, fechar } = await abrirMontar();
  await novo(page);
  await pq(page, 'aguardando');
  for (const t of ['atender', 'enviar', 'espera']) await add(page, t);
  assert.ok(await page.isDisabled('.rb-passo[data-i="0"] [data-acao="subir"]'));
  assert.ok(await page.isDisabled('.rb-passo[data-i="2"] [data-acao="descer"]'));
  await page.click('.rb-passo[data-i="2"] [data-acao="subir"]');
  assert.deepEqual(await titulos(page), ['1 · 📥 Atender fila', '2 · ⏸️ Pausar', '3 · ✉️ Enviar · Só enviar']);
  await page.click('.rb-passo[data-i="0"] [data-acao="remover"]');
  assert.deepEqual(await titulos(page), ['1 · ⏸️ Pausar', '2 · ✉️ Enviar · Só enviar']);
  await fechar();
});

test('só o cartão tocado fica aberto; os outros mostram o resumo de uma linha', async () => {
  const { page, fechar } = await abrirMontar();
  await page.click('.rb-passo[data-i="1"] .rb-passo-tit');
  assert.deepEqual(await page.$$eval('.rb-passo.aberto', (e) => e.map((x) => x.dataset.i)), ['1']);
  await page.click('.rb-passo[data-i="3"] .rb-passo-tit');
  assert.deepEqual(await page.$$eval('.rb-passo.aberto', (e) => e.map((x) => x.dataset.i)), ['3']);
  assert.equal(await page.textContent('.rb-passo[data-i="0"] .rb-passo-res'), 'Puxa até zerar · sentinela quando a fila esvaziar');
  await page.click('.rb-passo[data-i="3"] .rb-passo-tit');
  assert.equal(await page.$$eval('.rb-passo.aberto', (e) => e.length), 0, 'tocar de novo fecha');
  await fechar();
});

test('8 passos: paleta desabilitada com "Máximo 8 passos"', async () => {
  const { page, fechar } = await abrirMontar();
  await novo(page);
  await pq(page, 'aguardando');
  for (let i = 0; i < 9; i++) await add(page, i % 2 ? 'espera' : 'mover');
  assert.equal((await titulos(page)).length, 8);
  assert.ok(await page.$eval('#rb-paleta', (e) => e.classList.contains('rb-off')));
  assert.equal(await page.textContent('#rb-pal-dica'), 'Máximo 8 passos');
  await fechar();
});

test('não existe o botão "+ Adicionar passo" (só a paleta adiciona)', async () => {
  const { page, fechar } = await abrirMontar();
  const textos = await page.$$eval('#rb-montar button', (els) => els.map((e) => e.textContent));
  assert.ok(!textos.some((t) => /Adicionar passo/i.test(t)));
  await fechar();
});

test('🆕/👥: Atender some da paleta; ⏳ mostra os 5', async () => {
  const { page, fechar } = await abrirMontar();
  const visiveis = () => page.$$eval('#rb-paleta button', (els) => els.filter((e) => !e.hidden).map((e) => e.dataset.tipo));
  assert.deepEqual(await visiveis(), ['atender', 'enviar', 'espera', 'mover', 'transferir']);
  for (const modo of ['caindo', 'ambos']) {
    await pq(page, modo);
    assert.deepEqual(await visiveis(), ['enviar', 'espera', 'mover', 'transferir'], modo);
  }
  await fechar();
});

test('trocar o modo com Atender e Despausar: os passos ficam, em vermelho com o motivo, e o Iniciar bloqueia', async () => {
  const { page, fechar } = await abrirMontar();
  await novo(page);
  await pq(page, 'aguardando');
  await add(page, 'atender');
  await add(page, 'enviar');
  await page.evaluate(() => {
    // monta [A, E(Oi), P, D] direto no estado da tela para não depender dos campos (Tarefa 17)
    const sel = document.querySelector('#rb-paleta [data-tipo="espera"]');
    sel.click(); sel.click();
  });
  // ainda sem campo de modo da Espera (Tarefa 17): os dois Esperas são Pausar → a regra 5 marca o 4º
  assert.equal(await page.$$eval('.rb-passo.erro', (e) => e.length), 1);
  await pq(page, 'caindo');
  const erros = await page.$$eval('.rb-passo', (els) => els.map((e) => [e.dataset.i, e.classList.contains('erro'), e.querySelector('.rb-passo-erro').textContent]));
  assert.equal(erros.length, 4, 'nenhum passo é apagado');
  assert.deepEqual(erros[0].slice(0, 2), ['0', true]);
  assert.match(erros[0][2], /Atender não existe neste modo.*Também puxar a fila/);
  assert.ok(await page.isDisabled('#rb-iniciar'));
  await fechar();
});

test('o painel antigo continua igual sem o interruptor', async () => {
  const { page, erros, fechar } = await abrirBlip();
  await injetarBookmarklet(page);
  assert.equal(await page.$('#rb-montar'), null);
  assert.deepEqual(erros, []);
  await fechar();
});
