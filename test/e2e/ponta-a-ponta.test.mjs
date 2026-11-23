// Tarefa 23: cenários de ponta a ponta pela TELA (sem gancho de teste): monta na paleta, preenche os campos,
// toca em Iniciar e confere o resultado no Blip falso. Dados fictícios.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBlip, injetarBookmarklet, estado, fecharNavegador } from './util.mjs';

after(fecharNavegador);

const card = (i) => `.rb-passo[data-i="${i}"]`;
const dismiss = async (page) => { if (await page.$('.rb-modal')) await page.click('.rb-modal-btns button:has-text("Entendi")'); };

async function abrir(config = {}, antes = null) {
  const { page, erros, fechar } = await abrirBlip(config);
  if (antes) await page.evaluate(antes);
  await injetarBookmarklet(page);
  return { page, erros, fechar };
}

// Monta um fluxo novo pela tela. passos: [{ tipo, modo?, mensagem?, tag?, pasta?, atendente?, velocidade? }]
async function montar(page, paraQuem, passos, { loop, velocidade, puxarFila } = {}) {
  await page.click('#rb-novo');
  if (await page.$('.rb-modal')) await page.click('.rb-modal-btns button:has-text("Descartar")');
  await page.click(`.rb-pq[data-pq="${paraQuem}"]`);
  for (const [i, p] of passos.entries()) {
    await page.click(`#rb-paleta [data-tipo="${p.tipo}"]`);
    await dismiss(page);
    if (!(await page.$eval(card(i), (e) => e.classList.contains('aberto')))) await page.click(`${card(i)} .rb-passo-tit`);
    if (p.modo) await page.click(`${card(i)} .rb-seg [data-v="${p.modo}"]`);
    for (const campo of ['mensagem', 'tag', 'pasta', 'atendente']) {
      if (p[campo] !== undefined) await page.fill(`${card(i)} [data-campo="${campo}"]`, p[campo]);
    }
    if (p.velocidade !== undefined) {
      await page.fill(`${card(i)} [data-campo="velocidade"]`, String(p.velocidade));
      await page.press(`${card(i)} [data-campo="velocidade"]`, 'Tab');
    }
  }
  await page.click('#rb-ajustes-topo');
  if (velocidade !== undefined) { await page.fill('#rb-vel', String(velocidade)); await page.press('#rb-vel', 'Tab'); }
  if (loop !== undefined && (await page.isChecked('#rb-loop')) !== loop && !(await page.isDisabled('#rb-loop'))) await page.click('#rb-loop');
  if (puxarFila !== undefined && (await page.isChecked('#rb-puxar')) !== puxarFila) await page.click('#rb-puxar');
  await page.click('#rb-ajustes-topo');
}
const esperarTopo = (page, texto, timeout = 60000) =>
  page.waitForFunction((t) => document.querySelector('#rb-acomp-ciclo').textContent === t, texto, { timeout });
const etapas = (page) => page.$$eval('#rb-stepper .rb-etapa', (els) => els.map((e) => e.dataset.status));

test('⏳ montado na paleta [Atender, Enviar, Pausar, Mover] sem loop: todos atendidos, uma mensagem, pausados e movidos', async () => {
  const { page, erros, fechar } = await abrir({ naTela: ['Cliente Fictício 1'], fila: 2 });
  await montar(page, 'aguardando', [
    { tipo: 'atender' }, { tipo: 'enviar', mensagem: 'Olá, cliente fictício' }, { tipo: 'espera' }, { tipo: 'mover', pasta: 'Retorno' },
  ], { loop: false });
  await page.click('#rb-iniciar');
  await esperarTopo(page, 'Concluído');
  assert.deepEqual(await etapas(page), ['feito', 'feito', 'feito', 'feito']);
  const e = await estado(page);
  assert.equal(e.tickets.length, 3);
  assert.ok(e.tickets.every((t) => t.mensagens.length === 1 && t.pausado && t.pasta === 'Retorno'));
  assert.match(await page.textContent('#ba-log'), /Ciclo #1: 2 atendidos · 3 enviados · 3 pausados · 3 movidos · 0 falhas/);
  assert.deepEqual(erros, []);
  await fechar();
});

test('⏳ com loop: sentinela vigia a fila zerada, um cliente novo abre o ciclo 2 e ninguém recebe duas vezes', async () => {
  const { page, fechar } = await abrir({ naTela: [], fila: 1 });
  await montar(page, 'aguardando', [{ tipo: 'atender' }, { tipo: 'enviar', mensagem: 'Oi' }, { tipo: 'espera' }], { loop: true });
  await page.click('#rb-iniciar');
  await page.waitForFunction(() => /Sentinela/.test(document.querySelector('#ba-log').textContent), null, { timeout: 30000 });
  await page.evaluate(() => window.blipFalso.adicionarFila(1));
  await page.waitForFunction(() => /Ciclo #2:/.test(document.querySelector('#ba-log').textContent), null, { timeout: 30000 });
  await page.click('#ba-stop');
  await esperarTopo(page, 'Parado');
  const e = await estado(page);
  assert.deepEqual(e.tickets.map((t) => t.mensagens.length), [1, 1]);
  assert.ok(e.tickets.every((t) => t.pausado));
  await fechar();
});

test('🆕 montado [Enviar, Pausar]: só o chat que cai depois recebe e é pausado', async () => {
  const { page, erros, fechar } = await abrir();
  await montar(page, 'caindo', [{ tipo: 'enviar', mensagem: 'Bem-vindo' }, { tipo: 'espera' }]);
  await page.click('#rb-iniciar');
  await esperarTopo(page, 'Vigiando', 15000);
  await page.waitForTimeout(1200);
  const novo = await page.evaluate(() => window.blipFalso.chegarChat('Cliente Novo'));
  await page.waitForFunction((id) => window.blipFalso.estado().tickets.find((t) => t.id === id).pausado, novo, { timeout: 30000 });
  await page.click('#ba-stop');
  await esperarTopo(page, 'Parado');
  const e = await estado(page);
  assert.deepEqual(e.tickets.find((t) => t.id === novo).mensagens, ['Bem-vindo']);
  assert.ok(e.tickets.filter((t) => t.id !== novo).every((t) => !t.mensagens.length && !t.pausado));
  assert.equal(await page.textContent('#ba-auto-count'), '1');
  assert.deepEqual(erros, []);
  await fechar();
});

test('👥 montado [Enviar, Pausar]: os que aguardam (lote) e os que caem (vigia) recebem exatamente uma mensagem', async () => {
  const { page, fechar } = await abrir({ naTela: ['Cliente Fictício 1', 'Cliente Fictício 2'] });
  await montar(page, 'ambos', [{ tipo: 'enviar', mensagem: 'Olá' }, { tipo: 'espera' }]);
  await page.click('#rb-iniciar');
  await page.waitForFunction(() => window.blipFalso.estado().tickets.every((t) => t.pausado), null, { timeout: 30000 });
  const novo = await page.evaluate(() => window.blipFalso.chegarChat('Cliente Novo'));
  await page.waitForFunction((id) => window.blipFalso.estado().tickets.find((t) => t.id === id).pausado, novo, { timeout: 30000 });
  await page.click('#ba-stop');
  await esperarTopo(page, 'Parado');
  assert.deepEqual((await estado(page)).tickets.map((t) => t.mensagens.length), [1, 1, 1]);
  await fechar();
});

test('🆕 com "Também puxar a fila": o bot clica em Atender e os puxados recebem o fluxo uma vez', async () => {
  const { page, fechar } = await abrir({ naTela: [], fila: 2 });
  await montar(page, 'caindo', [{ tipo: 'enviar', mensagem: 'Oi' }], { puxarFila: true });
  await page.click('#rb-iniciar');
  await page.waitForFunction(() => {
    const e = window.blipFalso.estado();
    return e.tickets.length === 2 && e.tickets.every((t) => t.mensagens.length === 1);
  }, null, { timeout: 40000 });
  await page.click('#ba-stop');
  await esperarTopo(page, 'Parado');
  assert.equal((await estado(page)).filaRestante, 0);
  await fechar();
});

test('⏳ Transferir para "Atendente Fictício" (nome exato) pela tela', async () => {
  const { page, fechar } = await abrir({ naTela: ['Cliente Fictício 1', 'Cliente Fictício 2'] }, () => {
    window.__rodBotTransfTimeouts = { esperaModal: 300, pronto: 3000, filtro: 3000 };
  });
  await montar(page, 'aguardando', [{ tipo: 'transferir', atendente: 'Atendente Fictício' }]);
  await page.click('#rb-iniciar');
  await esperarTopo(page, 'Concluído', 90000);
  const e = await estado(page);
  assert.ok(e.tickets.every((t) => t.status === 'transferido' && t.atendente === 'Atendente Fictício'));
  await fechar();
});

test('ordem inválida: o modal explica e nada é executado; campo vazio: o Iniciar não roda nada', async () => {
  const { page, fechar } = await abrir();
  await montar(page, 'aguardando', [{ tipo: 'espera' }, { tipo: 'enviar', mensagem: 'Oi' }]);
  await page.click('#rb-iniciar', { force: true });
  assert.equal(await page.textContent('.rb-modal-linha'), 'O passo 2 · Enviar vem depois de 1 · Pausar.');
  await page.click('.rb-modal-btns button:has-text("Entendi")');
  await montar(page, 'aguardando', [{ tipo: 'enviar' }]); // mensagem vazia
  assert.ok(await page.isDisabled('#rb-iniciar'));
  await page.click('#rb-iniciar', { force: true });
  await page.waitForTimeout(500);
  assert.equal(await page.textContent('#ba-st'), 'Parado');
  assert.ok((await estado(page)).tickets.every((t) => !t.mensagens.length && !t.pausado), 'nada aconteceu no Blip');
  await fechar();
});

async function medir(velocidade) {
  const { page, fechar } = await abrir({}, () => {
    const orig = window.setTimeout;
    window.__tempos = [];
    window.setTimeout = (fn, ms, ...r) => { if (window.__gravando) window.__tempos.push(ms); return orig(fn, ms, ...r); };
  });
  await montar(page, 'aguardando', [{ tipo: 'espera' }], { velocidade });
  await page.evaluate(() => { window.__gravando = true; });
  const t0 = Date.now();
  await page.click('#rb-iniciar');
  await esperarTopo(page, 'Concluído');
  const duracao = Date.now() - t0;
  const tempos = await page.evaluate(() => window.__tempos);
  await fechar();
  return { duracao, tempos };
}

test('velocidade 2.0 escolhida nos Ajustes: mais rápido que 1.0 e nenhuma pausa abaixo de 50% da original', async () => {
  const v1 = await medir(1);
  const v2 = await medir(2);
  assert.ok(v2.duracao < v1.duracao, `2.0 (${v2.duracao} ms) × 1.0 (${v1.duracao} ms)`);
  const originais = new Set(v1.tempos.filter((ms) => ms > 0));
  assert.ok(originais.has(1200) && v2.tempos.includes(600));
  for (const ms of v2.tempos.filter((x) => x > 0)) {
    assert.ok(originais.has(ms) || [...originais].some((o) => Math.round(o / 2) === ms || Math.ceil(o / 2) === ms), `${ms} ms`);
  }
});

test('mensagem do Auto antigo migrada: o ⭐ Auto clássico já vem pronto e funciona', async () => {
  const { page, fechar } = await abrir({}, () => localStorage.setItem('rf_rodbot_auto_msg_v1', 'Mensagem migrada'));
  await page.selectOption('#rb-fluxo-sel', { label: '⭐ Auto clássico' });
  assert.ok(!(await page.isDisabled('#rb-iniciar')));
  await page.click('#rb-iniciar');
  await esperarTopo(page, 'Vigiando', 15000);
  await page.waitForTimeout(1200);
  const novo = await page.evaluate(() => window.blipFalso.chegarChat('Cliente Novo'));
  await page.waitForFunction((id) => window.blipFalso.estado().tickets.find((t) => t.id === id).pausado, novo, { timeout: 30000 });
  await page.click('#ba-stop');
  assert.deepEqual((await estado(page)).tickets.find((t) => t.id === novo).mensagens, ['Mensagem migrada']);
  await fechar();
});

test('o tema continua trocando e reabrir o painel mantém o último fluxo salvo', async () => {
  const { page, erros, fechar } = await abrir();
  await montar(page, 'aguardando', [{ tipo: 'espera' }, { tipo: 'mover', pasta: 'nv2' }]);
  await page.click('#rb-salvar');
  await page.fill('.rb-modal input', 'Pausar e mover');
  await page.click('.rb-modal-btns button:has-text("Salvar")');
  await page.click('#ba-theme-btn');
  const temas = await page.$$eval('.ba-theme-opt', (els) => els.map((e) => e.dataset.baTheme));
  const atual = await page.getAttribute('#ba-win', 'data-rf-theme');
  const outro = temas.find((t) => t !== atual);
  await page.click(`.ba-theme-opt[data-ba-theme="${outro}"]`);
  await page.evaluate(() => window.__rodBotCleanup());
  await injetarBookmarklet(page);
  assert.equal(await page.getAttribute('#ba-win', 'data-rf-theme'), outro);
  assert.equal(await page.$eval('#rb-fluxo-sel', (s) => s.selectedOptions[0].textContent), 'Pausar e mover');
  assert.deepEqual(await page.$$eval('#rb-passos .rb-tit-txt', (els) => els.map((e) => e.textContent)), ['⏸️ Pausar', '📁 Mover → nv2']);
  assert.deepEqual(erros, []);
  await fechar();
});
