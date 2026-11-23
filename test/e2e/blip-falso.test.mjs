// Tarefa 8: a página falsa do Blip sozinha, os seletores que o código usa e o bookmarklet injetado nela.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBlip, injetarBookmarklet, estado, esperarEstado, fecharNavegador } from './util.mjs';

after(fecharNavegador);

const clicarComposto = (page, js) => page.evaluate(js);

test('página sozinha: Atender com fila 3 → +1 ticket na lista e contador 2', async () => {
  const { page, fechar } = await abrirBlip({ fila: 3 });
  const antes = await estado(page);
  await page.click('#claim-ticket-button');
  const depois = await estado(page);
  assert.equal(depois.naLista.length, antes.naLista.length + 1);
  const novo = depois.naLista.find((id) => !antes.naLista.includes(id));
  assert.equal(depois.naLista[0], novo, 'o puxado entra no topo (confirmado pelo BM)');
  assert.equal(await page.getAttribute('article.chat-list-item:first-child', 'data-id'), novo);
  assert.equal(depois.filaRestante, 2);
  assert.equal(await page.textContent('#waiting-tickets-count'), '2');
  await fechar();
});

test('página sozinha: Atender desabilita com a fila zerada', async () => {
  const { page, fechar } = await abrirBlip({ fila: 0 });
  assert.equal(await page.getAttribute('#claim-ticket-button', 'disabled'), '');
  await fechar();
});

test('página sozinha: pausar e despausar pelo menu do ticket', async () => {
  const { page, fechar } = await abrirBlip();
  const id = (await estado(page)).naLista[0];
  await page.click(`#menu-${id}`);
  assert.ok(await page.isVisible(`#menu-${id} ~ bds-menu bds-menu-action[data-testid="option-setStandbyMode"]`));
  assert.ok(!(await page.isVisible(`#menu-${id} ~ bds-menu bds-menu-action[data-testid="option-unsetStandbyMode"]`)));
  await clicarComposto(page, `document.querySelector('#menu-${id} ~ bds-menu bds-menu-action[data-testid="option-setStandbyMode"]').shadowRoot.querySelector('button').click()`);
  assert.equal((await estado(page)).tickets.find((t) => t.id === id).pausado, true);
  await page.click(`#menu-${id}`);
  assert.ok(await page.isVisible(`#menu-${id} ~ bds-menu bds-menu-action[data-testid="option-unsetStandbyMode"]`));
  await fechar();
});

async function moverPrimeiro(page, pasta) {
  const id = (await estado(page)).naLista[0];
  await page.click(`#menu-${id}`);
  await page.dispatchEvent(`#menu-${id} ~ bds-menu bds-menu-action[button-text="Mover para"]`, 'mouseenter');
  await page.click(`#menu-${id} ~ bds-menu .folder-submenu-container .custom-submenu-item:has-text("${pasta}")`);
  return id;
}

test('página sozinha: mover tira o ticket da lista com S1 ligada', async () => {
  const { page, fechar } = await abrirBlip({ S1: true });
  const id = await moverPrimeiro(page, 'nv2');
  const e = await estado(page);
  assert.equal(e.tickets.find((t) => t.id === id).pasta, 'nv2');
  assert.ok(!e.naLista.includes(id));
  await fechar();
});

test('página sozinha: mover mantém o ticket na lista com S1 desligada', async () => {
  const { page, fechar } = await abrirBlip({ S1: false });
  const id = await moverPrimeiro(page, 'nv2');
  assert.ok((await estado(page)).naLista.includes(id));
  await fechar();
});

test('página sozinha: chat aberto recebe mensagem com Enter; pausado não recebe (S3)', async () => {
  const { page, fechar } = await abrirBlip({ pausadosIniciais: [1] });
  const [a, b] = (await estado(page)).naLista;
  await page.click(`article[data-id="${a}"] .nome`);
  await page.fill('#text-input', 'Olá');
  await page.press('#text-input', 'Enter');
  assert.deepEqual((await estado(page)).tickets.find((t) => t.id === a).mensagens, ['Olá']);
  assert.equal(await page.inputValue('#text-input'), '');
  await page.click(`article[data-id="${b}"] .nome`);
  assert.equal(await page.isDisabled('#text-input'), true);
  await fechar();
});

test('página sozinha: finalizar pelo modal tira o ticket da lista', async () => {
  const { page, fechar } = await abrirBlip();
  const id = (await estado(page)).naLista[0];
  await page.click(`article[data-id="${id}"] .nome`);
  await page.click('#close-ticket-button-icon');
  await page.click('#modal-finalizar bds-button.confirmar');
  const e = await estado(page);
  assert.equal(e.tickets.find((t) => t.id === id).status, 'finalizado');
  assert.ok(!e.naLista.includes(id));
  await fechar();
});

test('página sozinha: transferir para um atendente pelo modal', async () => {
  const { page, fechar } = await abrirBlip();
  const id = (await estado(page)).naLista[0];
  await page.click(`article[data-id="${id}"] .nome`);
  await page.click('bds-button-icon[icon="transfer"]');
  assert.match(await page.textContent('#modal-transf h3'), new RegExp(`Ticket #${id}`));
  await page.click('bds-radio[label="Atendente"] >> input');
  await page.fill('bds-autocomplete#autocompleteAttendant >> input', 'Outra');
  await page.click('bds-select-option[aria-label="Outra Pessoa"]');
  await page.click('bds-button#confirm-transfer-btn');
  const e = await estado(page);
  assert.equal(e.tickets.find((t) => t.id === id).atendente, 'Outra Pessoa');
  assert.ok(!e.naLista.includes(id));
  await fechar();
});

test('seletores do código (AUTO_SEL, TRANSF_SEL) encontram elementos na página falsa', async () => {
  const { page, fechar } = await abrirBlip();
  const id = (await estado(page)).naLista[0];
  const conta = (sel) => page.evaluate((s) => document.querySelectorAll(s).length, sel);
  const AUTO = {
    filaContainer: 'div#sidenav-div > div:nth-of-type(3) > div > div > div:nth-of-type(3) > div:nth-of-type(1) > div',
    areaLista: 'div#sidenav-div > div:nth-of-type(3) > div > div',
    sidenav: '#sidenav-div',
    filtroDropdown: 'bds-dropdown#ticket-filter-dropdown',
    contadorChip: 'bds-dropdown#ticket-filter-dropdown > div > bds-chip-tag',
    menuTicket: 'button.ticket-info-options[id^="menu-"]',
    card: 'article.chat-list-item',
    opcaoPausar: 'bds-menu-action[data-testid="option-setStandbyMode"]',
    opcaoDespausar: 'bds-menu-action[data-testid="option-unsetStandbyMode"]',
    atender: '#claim-ticket-button',
    contagemFila: '#waiting-tickets-count',
  };
  const faltando = [];
  for (const [nome, sel] of Object.entries(AUTO)) if ((await conta(sel)) < 1) faltando.push(nome);
  // a lista de tickets fica dentro do contêiner da fila
  assert.equal(await conta(`${AUTO.filaContainer} ${AUTO.menuTicket}`), 3);
  // com o chat aberto
  await page.click(`article[data-id="${id}"] .nome`);
  const CHAT = {
    campoTexto: '#text-input',
    cabecalhoTicket: '#pane-chat-div [id="ticket-sequential-id"]',
    botaoTransferir: 'bds-button-icon[icon="transfer"][variant="secondary"]',
    finalizar: '#close-ticket-button-icon',
  };
  for (const [nome, sel] of Object.entries(CHAT)) if ((await conta(sel)) < 1) faltando.push(nome);
  // com o modal de transferência aberto
  await page.click('bds-button-icon[icon="transfer"]');
  await page.click('bds-radio[label="Atendente"] >> input');
  const TRANSF = {
    radioAtendente: 'bds-radio[label="Atendente"]',
    autocomplete: 'bds-autocomplete#autocompleteAttendant',
    confirmar: 'bds-button#confirm-transfer-btn',
  };
  for (const [nome, sel] of Object.entries(TRANSF)) if ((await conta(sel)) < 1) faltando.push(nome);
  const opcoes = await page.evaluate(() =>
    document.querySelector('bds-autocomplete#autocompleteAttendant').shadowRoot.querySelectorAll('bds-select-option').length);
  if (opcoes < 1) faltando.push('opcao');
  assert.deepEqual(faltando, [], 'seletores sem elemento (pedir o outerHTML ao BM se for do Blip real)');
  await fechar();
});

test('o bookmarklet gerado injeta sem erro no console e abre a tela nova (Montar | Acompanhar)', async () => {
  const { page, erros, fechar } = await abrirBlip();
  await injetarBookmarklet(page);
  assert.ok(await page.isVisible('#ba-win'));
  const abas = await page.$$eval('.rb-aba', (els) => els.map((e) => e.dataset.rbAba));
  assert.deepEqual(abas, ['montar', 'acompanhar']);
  assert.deepEqual(erros, []);
  await fechar();
});
