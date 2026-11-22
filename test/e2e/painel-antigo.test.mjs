// Tarefa 8: as funções ANTIGAS do painel rodando na página falsa. Prova que a página imita o que o código espera
// (e serve de regressão: o painel antigo tem de continuar funcionando até a Tarefa 22).
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import {
  abrirBlip, injetarBookmarklet, esperarEstado, clicarPainel, preencherPainel, fecharNavegador,
} from './util.mjs';

after(fecharNavegador);

const TRANSF_RAPIDO = { esperaModal: 300, pronto: 3000, filtro: 3000, leituraVazia: 200 };

async function comPainel(config, corpo) {
  const { page, erros, fechar } = await abrirBlip(config);
  page.on('dialog', (d) => d.accept());
  await injetarBookmarklet(page, { transfTimeouts: TRANSF_RAPIDO });
  try {
    await corpo(page);
    assert.deepEqual(erros, []);
  } finally {
    await fechar();
  }
}

test('painel antigo: "Pausar todos" pausa os 3 tickets da tela', async () => {
  await comPainel({}, async (page) => {
    await clicarPainel(page, '#ba-pause-all');
    await esperarEstado(page, (e) => e.tickets.every((t) => t.pausado), 30000);
  });
});

test('painel antigo: "Despausar todos" tira todos da espera', async () => {
  await comPainel({ pausadosIniciais: [0, 1, 2] }, async (page) => {
    await clicarPainel(page, '#ba-unpause-all');
    await esperarEstado(page, (e) => e.tickets.every((t) => !t.pausado), 30000);
  });
});

test('painel antigo: Fila → Atender puxa até zerar', async () => {
  await comPainel({ fila: 3 }, async (page) => {
    await clicarPainel(page, '#ba-claim-auto');
    const e = await esperarEstado(page, (e) => e.filaRestante === 0, 20000);
    assert.equal(e.naLista.length, 6);
  });
});

test('painel antigo: Pastas → mover todos para "nv2"', async () => {
  await comPainel({}, async (page) => {
    await preencherPainel(page, '#ba-folder', 'nv2');
    await clicarPainel(page, '#ba-move-folder');
    const e = await esperarEstado(page, (e) => e.tickets.filter((t) => t.pasta === 'nv2').length === 3, 40000);
    assert.equal(e.naLista.length, 0);
  });
});

test('painel antigo: Envio → "Só enviar" escreve para todos uma vez', async () => {
  await comPainel({}, async (page) => {
    await preencherPainel(page, '#ba-msg', 'Mensagem fictícia');
    await clicarPainel(page, '#ba-play');
    const e = await esperarEstado(page,
      (e) => e.tickets.every((t) => t.mensagens.length === 1) && e.eventos.length > 0, 40000);
    assert.ok(e.tickets.every((t) => t.mensagens[0] === 'Mensagem fictícia'));
  });
});

test('painel antigo: Envio → "Enviar + Finalizar" com tag finaliza todos', async () => {
  await comPainel({}, async (page) => {
    await page.click('article.chat-list-item .nome'); // o modo antigo começa no chat aberto
    await clicarPainel(page, '#ba-mode-finalizar');
    await preencherPainel(page, '#ba-msg', 'Até logo');
    await preencherPainel(page, '#ba-tag', 'Resolvido');
    await clicarPainel(page, '#ba-play');
    const e = await esperarEstado(page, (e) => e.tickets.every((t) => t.status === 'finalizado'), 90000);
    assert.ok(e.tickets.every((t) => t.mensagens[0] === 'Até logo' && t.tags.includes('Resolvido')));
  });
});

test('painel antigo: Transferir em massa para "Atendente Fictício"', async () => {
  await comPainel({}, async (page) => {
    await preencherPainel(page, '#ba-transfer-name', 'Atendente Fictício');
    await clicarPainel(page, '#ba-transfer-start');
    const e = await esperarEstado(page, (e) => e.tickets.every((t) => t.status === 'transferido'), 90000);
    assert.ok(e.tickets.every((t) => t.atendente === 'Atendente Fictício'), 'não pode escolher "Atendente Fictício Dois"');
  });
});

test('painel antigo: Auto responde e pausa só o chat que chega depois de ativar', async () => {
  await comPainel({}, async (page) => {
    await preencherPainel(page, '#ba-auto-msg', 'Resposta automática fictícia');
    await clicarPainel(page, '#ba-auto-toggle');
    await page.waitForTimeout(1500);
    const novo = await page.evaluate(() => window.blipFalso.chegarChat('Cliente Novo'));
    const e = await esperarEstado(page, (e) => e.tickets.some((t) => t.pausado), 60000);
    const t = e.tickets.find((x) => x.id === novo);
    assert.deepEqual(t.mensagens, ['Resposta automática fictícia']);
    assert.equal(t.pausado, true);
    assert.ok(e.tickets.filter((x) => x.id !== novo).every((x) => x.mensagens.length === 0 && !x.pausado));
  });
});
