// Tarefa 20: fluxos salvos na tela (seletor, 💾 salvar como novo, "Salvar como novo / Descartar", limite, apagar).
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBlip, injetarBookmarklet, fecharNavegador } from './util.mjs';

after(fecharNavegador);

async function abrirMontar({ msgAuto, esperarPrimeiro = true } = {}) {
  const { page, erros, fechar } = await abrirBlip();
  await page.evaluate((m) => {
    localStorage.setItem('rf_rodbot_ui_nova_v1', '1');
    if (m) localStorage.setItem('rf_rodbot_auto_msg_v1', m);
  }, msgAuto);
  await injetarBookmarklet(page);
  return { page, erros, fechar };
}
// reabre o painel na mesma página (o localStorage fica): é o "reabrir" do usuário
async function reabrir(page) {
  await page.evaluate(() => window.__rodBotCleanup && window.__rodBotCleanup());
  await injetarBookmarklet(page);
}
const opcoes = (page) => page.$$eval('#rb-fluxo-sel option', (o) => o.map((x) => x.textContent));
const selecionado = (page) => page.$eval('#rb-fluxo-sel', (s) => s.selectedOptions[0].textContent);
const titulos = (page) => page.$$eval('#rb-passos .rb-tit-txt', (els) => els.map((e) => e.textContent));
const escolher = async (page, nome) => {
  const valor = await page.$$eval('#rb-fluxo-sel option', (o, n) => o.find((x) => x.textContent === n).value, nome);
  await page.selectOption('#rb-fluxo-sel', valor);
};
const modal = (page) => page.$('.rb-modal');
const botoes = (page) => page.$$eval('.rb-modal-btns button', (els) => els.map((e) => e.textContent));
const clicarBotao = (page, texto) => page.click(`.rb-modal-btns button:has-text("${texto}")`);
async function salvarComo(page, nome) {
  await page.click('#rb-salvar');
  await page.fill('.rb-modal input', nome);
  await clicarBotao(page, 'Salvar');
}
async function editar(page) {
  await page.click('.rb-passo[data-i="1"] .rb-passo-tit');
  await page.fill('.rb-passo[data-i="1"] [data-campo="mensagem"]', 'Texto novo');
}

test('1ª abertura: ⭐ Piloto clássico carregado; o seletor lista só os 2 modelos; sem opção de apagar modelo', async () => {
  const { page, erros, fechar } = await abrirMontar();
  assert.equal(await selecionado(page), '⭐ Piloto clássico');
  assert.deepEqual(await opcoes(page), ['⭐ Piloto clássico', '⭐ Auto clássico']);
  assert.ok(!(await page.isVisible('#rb-apagar')), 'modelo não tem 🗑');
  assert.deepEqual(erros, []);
  await fechar();
});

test('trocar para ⭐ Auto clássico: 🆕 com [Enviar, Pausar] e a mensagem migrada do Auto antigo', async () => {
  const { page, fechar } = await abrirMontar({ msgAuto: 'Mensagem do Auto antigo' });
  await escolher(page, '⭐ Auto clássico');
  assert.equal(await page.getAttribute('.rb-pq.on', 'data-pq'), 'caindo');
  assert.deepEqual(await titulos(page), ['✉️ Enviar · Só enviar', '⏸️ Pausar']);
  await page.click('.rb-passo[data-i="0"] .rb-passo-tit');
  assert.equal(await page.inputValue('.rb-passo[data-i="0"] [data-campo="mensagem"]'), 'Mensagem do Auto antigo');
  assert.ok(!(await page.isDisabled('#rb-iniciar')), 'Auto clássico com mensagem migrada já pode iniciar');
  await fechar();
});

test('sem mensagem do Auto salva: o Auto clássico abre vazio e bloqueado', async () => {
  const { page, fechar } = await abrirMontar();
  await escolher(page, '⭐ Auto clássico');
  assert.ok(await page.isDisabled('#rb-iniciar'));
  await fechar();
});

test('💾 pede um nome, cria um fluxo NOVO e ele passa a ser o atual; reabrir carrega o último usado', async () => {
  const { page, erros, fechar } = await abrirMontar();
  await editar(page);
  await page.click('#rb-salvar');
  assert.ok(await modal(page));
  await page.fill('.rb-modal input', 'Meu fluxo');
  await page.keyboard.press('Enter');
  assert.equal(await modal(page), null);
  assert.equal(await selecionado(page), 'Meu fluxo');
  assert.deepEqual(await opcoes(page), ['⭐ Piloto clássico', '⭐ Auto clássico', 'Meu fluxo']);
  assert.ok(!(await page.isVisible('#rb-alterado')), 'recém-salvo: sem alterações pendentes');
  await reabrir(page);
  assert.equal(await selecionado(page), 'Meu fluxo');
  await page.click('.rb-passo[data-i="1"] .rb-passo-tit');
  assert.equal(await page.inputValue('.rb-passo[data-i="1"] [data-campo="mensagem"]'), 'Texto novo');
  assert.deepEqual(erros, []);
  await fechar();
});

test('o nome é validado dentro do modal: vazio, repetido e nome de modelo não salvam', async () => {
  const { page, fechar } = await abrirMontar();
  await salvarComo(page, 'Primeiro');
  await page.click('#rb-salvar');
  for (const [nome, msg] of [['  ', /Dê um nome/], ['primeiro', /Já existe/], ['Piloto clássico', /modelo/]]) {
    await page.fill('.rb-modal input', nome);
    await clicarBotao(page, 'Salvar');
    assert.ok(await modal(page), 'o modal continua aberto');
    assert.match(await page.textContent('.rb-modal-erro'), msg);
  }
  await clicarBotao(page, 'Cancelar');
  assert.equal(await modal(page), null);
  assert.deepEqual(await opcoes(page), ['⭐ Piloto clássico', '⭐ Auto clássico', 'Primeiro']);
  await fechar();
});

test('editar mostra "alterações não salvas"; trocar de fluxo pergunta Salvar como novo / Descartar', async () => {
  const { page, fechar } = await abrirMontar();
  assert.ok(!(await page.isVisible('#rb-alterado')));
  await editar(page);
  assert.ok(await page.isVisible('#rb-alterado'));
  await escolher(page, '⭐ Auto clássico');
  assert.ok(await modal(page));
  assert.deepEqual(await botoes(page), ['Voltar', 'Descartar', 'Salvar como novo']);
  assert.equal(await selecionado(page), '⭐ Piloto clássico', 'enquanto não decide, continua no atual');
  await fechar();
});

test('Descartar: vai para o outro fluxo e o modelo editado volta ao original', async () => {
  const { page, fechar } = await abrirMontar();
  await editar(page);
  await escolher(page, '⭐ Auto clássico');
  await clicarBotao(page, 'Descartar');
  assert.equal(await selecionado(page), '⭐ Auto clássico');
  await escolher(page, '⭐ Piloto clássico');
  assert.equal(await modal(page), null, 'o Auto clássico não tinha alterações');
  await page.click('.rb-passo[data-i="1"] .rb-passo-tit');
  assert.equal(await page.inputValue('.rb-passo[data-i="1"] [data-campo="mensagem"]'), '', 'o modelo voltou ao original');
  await fechar();
});

test('Salvar como novo (na troca): pede o nome, guarda o editado e segue para o outro fluxo', async () => {
  const { page, fechar } = await abrirMontar();
  await editar(page);
  await escolher(page, '⭐ Auto clássico');
  await clicarBotao(page, 'Salvar como novo');
  await page.fill('.rb-modal input', 'Guardado');
  await clicarBotao(page, 'Salvar');
  assert.equal(await selecionado(page), '⭐ Auto clássico');
  assert.deepEqual(await opcoes(page), ['⭐ Piloto clássico', '⭐ Auto clássico', 'Guardado']);
  await escolher(page, 'Guardado');
  await page.click('.rb-passo[data-i="1"] .rb-passo-tit');
  assert.equal(await page.inputValue('.rb-passo[data-i="1"] [data-campo="mensagem"]'), 'Texto novo');
  await fechar();
});

test('Voltar na pergunta: fica no fluxo editado, com as alterações', async () => {
  const { page, fechar } = await abrirMontar();
  await editar(page);
  await escolher(page, '⭐ Auto clássico');
  await clicarBotao(page, 'Voltar');
  assert.equal(await modal(page), null);
  assert.equal(await selecionado(page), '⭐ Piloto clássico');
  assert.ok(await page.isVisible('#rb-alterado'));
  assert.equal(await page.inputValue('.rb-passo[data-i="1"] [data-campo="mensagem"]'), 'Texto novo');
  await fechar();
});

test('"＋" cria um fluxo vazio sem "Para quem?"; com alterações pendentes pergunta antes', async () => {
  const { page, fechar } = await abrirMontar();
  await editar(page);
  await page.click('#rb-novo');
  assert.ok(await modal(page));
  await clicarBotao(page, 'Descartar');
  assert.equal(await selecionado(page), 'Novo fluxo');
  assert.equal(await page.$$eval('.rb-pq.on', (e) => e.length), 0);
  assert.deepEqual(await titulos(page), []);
  assert.ok(!(await page.isVisible('#rb-alterado')), 'fluxo vazio recém-criado não conta como alterado');
  await fechar();
});

test('limite: o 11º fluxo do usuário recebe "Limite de 10 fluxos" (os modelos não contam)', async () => {
  const { page, fechar } = await abrirMontar();
  for (let i = 1; i <= 10; i++) await salvarComo(page, 'F' + i);
  assert.equal((await opcoes(page)).length, 12);
  await page.click('#rb-salvar');
  await page.fill('.rb-modal input', 'F11');
  await clicarBotao(page, 'Salvar');
  assert.equal(await page.textContent('.rb-modal-erro'), 'Limite de 10 fluxos');
  await clicarBotao(page, 'Cancelar');
  assert.equal((await opcoes(page)).length, 12);
  await fechar();
});

test('🗑 só aparece em fluxo do usuário; pede confirmação e volta ao ⭐ Piloto clássico', async () => {
  const { page, fechar } = await abrirMontar();
  await salvarComo(page, 'Descartável');
  assert.ok(await page.isVisible('#rb-apagar'));
  await page.click('#rb-apagar');
  assert.match(await page.textContent('.rb-modal-linha'), /Descartável/);
  await clicarBotao(page, 'Cancelar');
  assert.deepEqual(await opcoes(page), ['⭐ Piloto clássico', '⭐ Auto clássico', 'Descartável']);
  await page.click('#rb-apagar');
  await clicarBotao(page, 'Apagar');
  assert.deepEqual(await opcoes(page), ['⭐ Piloto clássico', '⭐ Auto clássico']);
  assert.equal(await selecionado(page), '⭐ Piloto clássico');
  await reabrir(page);
  assert.equal(await selecionado(page), '⭐ Piloto clássico');
  await fechar();
});

test('o nome do fluxo aparece como texto (sem HTML)', async () => {
  const { page, erros, fechar } = await abrirMontar();
  await salvarComo(page, '<img src=x onerror="window.__xss=1">');
  assert.equal(await selecionado(page), '<img src=x onerror="window.__xss=1">');
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.deepEqual(erros, []);
  await fechar();
});

test('o painel antigo não ganha 💾 nem seletor sem o interruptor', async () => {
  const { page, erros, fechar } = await abrirBlip();
  await injetarBookmarklet(page);
  assert.equal(await page.$('#rb-salvar'), null);
  assert.deepEqual(erros, []);
  await fechar();
});
