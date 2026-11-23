// Tarefa 12: o motor de ponta a ponta na página falsa, pelo gancho de teste, SEM a tela nova.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBlip, injetarBookmarklet, estado, fecharNavegador } from './util.mjs';

after(fecharNavegador);

const A = { tipo: 'atender' };
const E = (mensagem = 'Olá') => ({ tipo: 'enviar', modo: 'so', mensagem });
const P = { tipo: 'espera', modo: 'pausar' };
const D = { tipo: 'espera', modo: 'despausar' };
const M = { tipo: 'mover', pasta: 'nv2' };
const T = { tipo: 'transferir', atendente: 'Atendente Fictício' };
const fluxo = (paraQuem, passos, extra = {}) =>
  ({ paraQuem, passos, loopEscolha: false, pausaCiclos: 1, velocidade: 2, puxarFila: false, ...extra });

async function comMotor(config, corpo, { gravarTempos = false } = {}) {
  const { page, erros, fechar } = await abrirBlip(config);
  if (gravarTempos) {
    // registra todo setTimeout (é assim que sleep/pausaAcao esperam) para medir as pausas
    await page.evaluate(() => {
      const orig = window.setTimeout;
      window.__tempos = [];
      window.setTimeout = (fn, ms, ...r) => { if (window.__gravando) window.__tempos.push(ms); return orig(fn, ms, ...r); };
    });
  }
  await injetarBookmarklet(page, { teste: true, transfTimeouts: { esperaModal: 300, pronto: 3000, filtro: 3000 } });
  try {
    await corpo(page);
    assert.deepEqual(erros, []);
  } finally {
    await fechar();
  }
}
const rodar = (page, f) => page.evaluate((x) => window.__rodBot.executarFluxo(x), f);
const logDoPainel = (page) => page.textContent('#ba-log');

test('⏳ Piloto clássico, fila 3, S1 ligada: 3 atendidos · 3 enviados · 3 pausados · 3 movidos', async () => {
  await comMotor({ naTela: [], fila: 3, S1: true }, async (page) => {
    const r = await rodar(page, fluxo('aguardando', [A, E('Olá'), P, M]));
    assert.equal(r.status, 'concluido', JSON.stringify(r));
    const e = await estado(page);
    assert.equal(e.tickets.length, 3);
    assert.ok(e.tickets.every((t) => t.mensagens.length === 1 && t.pausado && t.pasta === 'nv2'));
    assert.equal(e.naLista.length, 0);
    assert.match(await logDoPainel(page), /Ciclo #1: 3 atendidos · 3 enviados · 3 pausados · 3 movidos · 0 falhas/);
  });
});

test('⏳ [D] com 2 pausados na tela: os dois voltam a ficar ativos', async () => {
  await comMotor({ pausadosIniciais: [0, 2] }, async (page) => {
    const r = await rodar(page, fluxo('aguardando', [D]));
    assert.equal(r.status, 'concluido', JSON.stringify(r));
    assert.ok((await estado(page)).tickets.every((t) => !t.pausado));
    assert.equal(r.totais.despausados, 2);
  });
});

test('⏳ [A,E,P] em loop: ticket novo no 2º ciclo recebe; ninguém recebe duas mensagens', async () => {
  await comMotor({ naTela: ['Cliente Fictício 1'], fila: 1 }, async (page) => {
    const execucao = page.evaluate((f) => window.__rodBot.executarFluxo(f), fluxo('aguardando', [A, E(), P], { loopEscolha: true }));
    await page.waitForFunction(() => /Sentinela/.test(document.querySelector('#ba-log').textContent), null, { timeout: 30000 });
    await page.evaluate(() => window.blipFalso.adicionarFila(1));
    await page.waitForFunction(() => window.blipFalso.estado().tickets.length === 3 &&
      window.blipFalso.estado().tickets.every((t) => t.pausado), null, { timeout: 30000 });
    await page.waitForFunction(() => /Ciclo #2/.test(document.querySelector('#ba-log').textContent), null, { timeout: 30000 });
    await page.evaluate(() => window.__rodBot.parar());
    assert.equal((await execucao).status, 'parado');
    const e = await estado(page);
    assert.deepEqual(e.tickets.map((t) => t.mensagens.length), [1, 1, 1]);
    const pausas = e.eventos.filter((x) => x.tipo === 'pausar').map((x) => x.id);
    assert.equal(new Set(pausas).size, pausas.length, 'ninguém pausado duas vezes');
  });
});

test('🆕 Auto clássico: o chat que cai depois recebe 1 mensagem e é pausado; os antigos não', async () => {
  await comMotor({}, async (page) => {
    const execucao = page.evaluate((f) => window.__rodBot.executarFluxo(f), fluxo('caindo', [E('Oi'), P]));
    await page.waitForTimeout(1500);
    const novo = await page.evaluate(() => window.blipFalso.chegarChat('Cliente Novo'));
    await page.waitForFunction((id) => window.blipFalso.estado().tickets.find((t) => t.id === id).pausado, novo, { timeout: 30000 });
    await page.evaluate(() => window.__rodBot.parar());
    await execucao;
    const e = await estado(page);
    assert.deepEqual(e.tickets.find((t) => t.id === novo).mensagens, ['Oi']);
    assert.ok(e.tickets.filter((t) => t.id !== novo).every((t) => !t.mensagens.length && !t.pausado));
    assert.match(await page.textContent('#ba-auto-count'), /^1$/, 'o contador "Novos chats" conta o chat');
  });
});

test('👥 [E,P]: antigos (lote) e novos (vigia) recebem exatamente 1 mensagem cada', async () => {
  await comMotor({ naTela: ['Cliente Fictício 1', 'Cliente Fictício 2'] }, async (page) => {
    const execucao = page.evaluate((f) => window.__rodBot.executarFluxo(f), fluxo('ambos', [E('Olá'), P]));
    await page.waitForFunction(() => window.blipFalso.estado().tickets.every((t) => t.pausado), null, { timeout: 30000 });
    const novo = await page.evaluate(() => window.blipFalso.chegarChat('Cliente Novo'));
    await page.waitForFunction((id) => window.blipFalso.estado().tickets.find((t) => t.id === id).pausado, novo, { timeout: 30000 });
    await page.evaluate(() => window.__rodBot.parar());
    await execucao;
    const e = await estado(page);
    assert.deepEqual(e.tickets.map((t) => t.mensagens.length), [1, 1, 1]);
    assert.match(await logDoPainel(page), /Lote: 2 enviados · 2 pausados · 0 falhas/);
  });
});

// Bug do Blip real (23/11/2026): o menu ⋮ aberto para ler "em espera" não fechava. O menu aberto de um ticket pausado
// fazia os tickets ativos seguintes parecerem pausados, e ninguém recebia a mensagem.
test('👥 [E] com menus que não fecham (Blip real): o pausado é pulado e os ativos recebem 1 mensagem', async () => {
  await comMotor({ pausadosIniciais: [0], menuNaoFecha: true }, async (page) => {
    const execucao = page.evaluate((f) => window.__rodBot.executarFluxo(f), fluxo('ambos', [E('Olá')]));
    await page.waitForFunction(() => /Lote:/.test(document.querySelector('#ba-log').textContent), null, { timeout: 30000 });
    await page.evaluate(() => window.__rodBot.parar());
    await execucao;
    const e = await estado(page);
    assert.deepEqual(e.tickets.map((t) => t.mensagens.length), [0, 1, 1], await logDoPainel(page));
    assert.match(await logDoPainel(page), /Lote: 2 enviados · 0 falhas/);
  });
});

test('⏳ Transferir para "Atendente Fictício": os tickets saem da lista', async () => {
  await comMotor({}, async (page) => {
    const r = await rodar(page, fluxo('aguardando', [T]));
    assert.equal(r.status, 'concluido', JSON.stringify(r));
    const e = await estado(page);
    assert.ok(e.tickets.every((t) => t.status === 'transferido' && t.atendente === 'Atendente Fictício'));
    assert.equal(r.totais.transferidos, 3);
  });
});

test('falha geral: botão Atender ausente para o fluxo, passo em Falha e motivo no log', async () => {
  await comMotor({ semBotaoAtender: true, fila: 2 }, async (page) => {
    const r = await rodar(page, fluxo('aguardando', [A, E(), P]));
    assert.equal(r.status, 'falha');
    assert.match(r.motivo, /Atender/);
    const eventos = await page.evaluate(() => window.__rodBot.eventos());
    assert.deepEqual(eventos.filter((x) => x.tipo === 'passo').at(-1).status, 'falha');
    assert.match(await logDoPainel(page), /Passo 1 · Atender falhou/);
    assert.ok((await estado(page)).tickets.every((t) => !t.mensagens.length), 'nada depois da falha');
  });
});

async function medirPausas(velocidade) {
  let tempos;
  let duracao;
  await comMotor({}, async (page) => {
    await page.evaluate(() => { window.__gravando = true; });
    const t0 = Date.now();
    const r = await rodar(page, fluxo('aguardando', [P], { velocidade }));
    duracao = Date.now() - t0;
    assert.equal(r.status, 'concluido');
    tempos = await page.evaluate(() => window.__tempos);
  }, { gravarTempos: true });
  return { tempos, duracao };
}

test('velocidade 2.0 vs 1.0: mais rápido e nenhuma pausa abaixo de 50% da original', async () => {
  const v1 = await medirPausas(1);
  const v2 = await medirPausas(2);
  assert.ok(v2.duracao < v1.duracao, `2.0 (${v2.duracao} ms) deveria ser mais rápido que 1.0 (${v1.duracao} ms)`);
  const originais = new Set(v1.tempos.filter((ms) => ms > 0));
  assert.ok(originais.has(1200), 'com 1.0 o ritmo entre tickets é 1200 ms (delayAcoes)');
  assert.ok(v2.tempos.includes(600), 'com 2.0 o ritmo vira 600 ms');
  assert.ok(!v2.tempos.includes(1200), 'com 2.0 o delayAcoes não aparece inteiro');
  for (const ms of v2.tempos.filter((x) => x > 0)) {
    const ok = originais.has(ms) || [...originais].some((o) => Math.max(Math.round(o / 2), Math.ceil(o / 2)) === ms);
    assert.ok(ok, `pausa de ${ms} ms com 2.0 não é original nem metade de uma original`);
  }
});

test('pausa entre ciclos igual com velocidade 0.5 e 2.0 (1 s)', async () => {
  for (const velocidade of [0.5, 2]) {
    await comMotor({ naTela: [], fila: 1 }, async (page) => {
      await page.evaluate(() => { window.__gravando = true; });
      const execucao = page.evaluate((f) => window.__rodBot.executarFluxo(f),
        fluxo('aguardando', [A, M], { loopEscolha: true, pausaCiclos: 1, velocidade }));
      await page.waitForFunction(() => /Ciclo #1/.test(document.querySelector('#ba-log').textContent), null, { timeout: 30000 });
      await page.waitForTimeout(300);
      await page.evaluate(() => window.__rodBot.parar());
      await execucao;
      assert.ok((await page.evaluate(() => window.__tempos)).includes(1000), `velocidade ${velocidade}`);
    }, { gravarTempos: true });
  }
});
