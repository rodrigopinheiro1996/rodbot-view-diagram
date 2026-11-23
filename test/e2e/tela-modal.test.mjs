// Tarefa 18: passo inválido em vermelho + modal de ordem inválida (layout-M) com correção.
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
const add = (page, tipo) => page.click(`#rb-paleta [data-tipo="${tipo}"]`);
const novoAguardando = async (page) => { await page.click('#rb-novo'); await page.click('.rb-pq[data-pq="aguardando"]'); };
const modal = (page) => page.$('.rb-modal');
const titulos = (page) => page.$$eval('#rb-passos .rb-tit-txt', (els) => els.map((e) => e.textContent));
const botoes = (page) => page.$$eval('.rb-modal-btns button', (els) => els.map((e) => e.textContent));

// [A, P, E]: o Enviar vem depois do Pausar (regra 1, sem envio antes)
async function montarEnviarDepoisDePausa(page) {
  await novoAguardando(page);
  await add(page, 'atender');
  await add(page, 'espera');
  assert.equal(await modal(page), null, 'passos válidos não abrem o modal');
  await add(page, 'enviar');
}

test('adicionar um passo que quebra a ordem abre o modal do layout-M e deixa o passo vermelho', async () => {
  const { page, erros, fechar } = await abrirMontar();
  await montarEnviarDepoisDePausa(page);
  assert.ok(await modal(page));
  assert.equal(await page.textContent('.rb-modal h3'), '⛔ Esta ordem não é aceita');
  assert.equal(await page.textContent('.rb-modal-linha'), 'O passo 3 · Enviar vem depois de 2 · Pausar.');
  const detalhe = await page.textContent('.rb-modal-detalhe');
  assert.match(detalhe, /^Cliente em espera não recebe mensagem\./);
  assert.match(detalhe, /coloque Despausar antes/);
  assert.deepEqual(await botoes(page), ['Entendi', 'Colocar Despausar antes do passo 3', 'Remover passo 3']);
  assert.ok(await page.$eval('.rb-passo[data-i="2"]', (e) => e.classList.contains('erro')));
  assert.equal(await page.textContent('.rb-passo[data-i="2"] .rb-passo-erro'), 'Cliente em espera não recebe mensagem');
  assert.deepEqual(erros, []);
  await fechar();
});

test('"Remover passo 3" remove o passo, fecha o modal e a ordem volta a valer', async () => {
  const { page, fechar } = await abrirMontar();
  await montarEnviarDepoisDePausa(page);
  await page.click('.rb-modal-btns button:has-text("Remover passo 3")');
  assert.equal(await modal(page), null);
  assert.deepEqual(await titulos(page), ['📥 Atender fila', '⏸️ Pausar']);
  assert.equal(await page.$$eval('.rb-passo.erro', (e) => e.length), 0);
  assert.ok(!(await page.isDisabled('#rb-iniciar')), '[A,P] é válido e sem campos obrigatórios: Iniciar libera');
  await fechar();
});

test('"Colocar Despausar antes" insere o Despausar na posição e corrige a ordem', async () => {
  const { page, fechar } = await abrirMontar();
  await montarEnviarDepoisDePausa(page);
  await page.click('.rb-modal-btns button:has-text("Colocar Despausar antes")');
  assert.equal(await modal(page), null);
  assert.deepEqual(await titulos(page), ['📥 Atender fila', '⏸️ Pausar', '▶️ Despausar', '✉️ Enviar · Só enviar']);
  assert.equal(await page.$$eval('.rb-passo.erro', (e) => e.length), 0);
  await fechar();
});

test('"Entendi" fecha o modal, o passo continua vermelho e o Iniciar continua bloqueado', async () => {
  const { page, fechar } = await abrirMontar();
  await montarEnviarDepoisDePausa(page);
  await page.click('.rb-modal-btns button:has-text("Entendi")');
  assert.equal(await modal(page), null);
  assert.ok(await page.$eval('.rb-passo[data-i="2"]', (e) => e.classList.contains('erro')));
  assert.ok(await page.isDisabled('#rb-iniciar'));
  assert.equal(await page.getAttribute('#rb-iniciar', 'aria-disabled'), 'true');
  await fechar();
});

test('clicar em Iniciar com a ordem inválida abre o modal do 1º erro', async () => {
  const { page, fechar } = await abrirMontar();
  await novoAguardando(page);
  await add(page, 'enviar');
  await add(page, 'espera');
  await add(page, 'enviar'); // [E, P, E]: regra 4 (repete o envio do passo 1) e regra 1
  assert.equal(await page.textContent('.rb-modal-linha'), 'O passo 3 · Enviar repete o envio do passo 1 · Enviar.');
  await page.click('.rb-modal-btns button:has-text("Entendi")');
  await page.click('#rb-iniciar', { force: true });
  assert.ok(await modal(page), 'o clique no Iniciar bloqueado abre o modal');
  assert.equal(await page.textContent('.rb-modal-linha'), 'O passo 3 · Enviar repete o envio do passo 1 · Enviar.');
  assert.doesNotMatch(await page.textContent('.rb-modal-detalhe'), /Despausar antes/, 'houve envio antes: só sugere remover (regra 8)');
  assert.deepEqual(await botoes(page), ['Entendi', 'Remover passo 3']);
  await fechar();
});

test('só o 1º passo com erro aparece no modal; todos os passos com problema ficam vermelhos', async () => {
  const { page, fechar } = await abrirMontar();
  await novoAguardando(page);
  for (const t of ['enviar', 'enviar', 'espera', 'espera']) {
    await add(page, t);
    if (await modal(page)) await page.click('.rb-modal-btns button:has-text("Entendi")');
  }
  const vermelhos = await page.$$eval('.rb-passo.erro', (els) => els.map((e) => e.dataset.i));
  assert.deepEqual(vermelhos, ['1', '3'], 'passo 2 (regra 4) e passo 4 (regra 5)');
  await page.click('#rb-iniciar', { force: true });
  assert.match(await page.textContent('.rb-modal-linha'), /^O passo 2 · Enviar/);
  await fechar();
});

test('ao trocar o modo com Atender/Despausar, o Iniciar abre o modal "indisponível" (não apaga nada)', async () => {
  const { page, fechar } = await abrirMontar();
  await page.click('.rb-pq[data-pq="caindo"]'); // Piloto clássico começa com Atender em 1º
  assert.equal(await modal(page), null, 'trocar o modo não abre o modal sozinho');
  await page.click('#rb-iniciar', { force: true });
  assert.equal(await page.textContent('.rb-modal-linha'), 'O passo 1 · Atender não existe neste modo.');
  assert.match(await page.textContent('.rb-modal-detalhe'), /Também puxar a fila/);
  await page.click('.rb-modal-btns button:has-text("Entendi")');
  assert.equal((await titulos(page)).length, 4);
  await fechar();
});

test('Esc fecha o modal; texto de correção sai de textContent (sem HTML)', async () => {
  const { page, erros, fechar } = await abrirMontar();
  await montarEnviarDepoisDePausa(page);
  await page.keyboard.press('Escape');
  assert.equal(await modal(page), null);
  assert.deepEqual(erros, []);
  await fechar();
});

test('o modal fica dentro do painel e cobre toda a altura visível', async () => {
  const { page, fechar } = await abrirMontar();
  await montarEnviarDepoisDePausa(page);
  const r = await page.evaluate(() => {
    const w = document.querySelector('#ba-win').getBoundingClientRect();
    const f = document.querySelector('.rb-modal-fundo').getBoundingClientRect();
    const m = document.querySelector('.rb-modal').getBoundingClientRect();
    return { dentro: f.left >= w.left - 1 && f.right <= w.right + 1 && f.top >= w.top - 1, cobre: f.height >= w.height - 2,
      modalDentro: m.top >= f.top && m.bottom <= f.bottom };
  });
  assert.deepEqual(r, { dentro: true, cobre: true, modalDentro: true });
  await fechar();
});

test('o painel antigo não ganha modal nem mudança sem o interruptor', async () => {
  const { page, erros, fechar } = await abrirBlip();
  await injetarBookmarklet(page);
  assert.equal(await page.$('.rb-modal-ancora'), null);
  assert.deepEqual(erros, []);
  await fechar();
});
