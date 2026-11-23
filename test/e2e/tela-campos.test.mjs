// Tarefa 17: campos de cada passo, velocidade própria com selo e bloqueio por campo vazio.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBlip, injetarBookmarklet, fecharNavegador } from './util.mjs';

after(fecharNavegador);

async function abrirMontar(antes) {
  const { page, erros, fechar } = await abrirBlip();
  await page.evaluate((r) => {
    if (r) localStorage.setItem('rf_rodbot_recent_folders_v1', JSON.stringify(r));
  }, antes);
  await injetarBookmarklet(page);
  return { page, erros, fechar };
}
const card = (i) => `.rb-passo[data-i="${i}"]`;
const abrir = (page, i) => page.click(`${card(i)} .rb-passo-tit`);
const tit = (page, i) => page.textContent(`${card(i)} .rb-tit-txt`);
const vazio = (page, sel) => page.$eval(sel, (e) => e.classList.contains('rb-vazio'));

test('Piloto clássico: mensagem e pasta vazias em vermelho, Iniciar bloqueado; preencher libera', async () => {
  const { page, erros, fechar } = await abrirMontar();
  await abrir(page, 1);
  assert.ok(await vazio(page, `${card(1)} [data-campo="mensagem"]`));
  assert.ok(await page.isDisabled('#rb-iniciar'));
  await page.click(`${card(1)} [data-acao-campo="padrao"]`);
  assert.match(await page.inputValue(`${card(1)} [data-campo="mensagem"]`), /^Realizamos uma nova atualização/);
  assert.ok(!(await vazio(page, `${card(1)} [data-campo="mensagem"]`)));
  assert.match(await page.textContent('#rb-iniciar-dica'), /Preencha o passo 4/);
  await abrir(page, 3);
  assert.ok(await vazio(page, `${card(3)} [data-campo="pasta"]`));
  await page.click(`${card(3)} [data-pasta="nv2"]`);
  assert.equal(await tit(page, 3), '📁 Mover → nv2');
  assert.ok(!(await page.isDisabled('#rb-iniciar')), 'tudo preenchido: Iniciar libera');
  assert.equal(await page.textContent('#rb-iniciar-dica'), '');
  assert.deepEqual(erros, []);
  await fechar();
});

test('"Usar padrão" só preenche quando tocado (a mensagem começa vazia)', async () => {
  const { page, fechar } = await abrirMontar();
  await abrir(page, 1);
  assert.equal(await page.inputValue(`${card(1)} [data-campo="mensagem"]`), '');
  await fechar();
});

test('digitar a mensagem não perde o foco e atualiza o resumo e o Iniciar na hora', async () => {
  const { page, fechar } = await abrirMontar();
  await abrir(page, 1);
  await page.click(`${card(1)} [data-campo="mensagem"]`);
  await page.keyboard.type('Olá, tudo bem?');
  assert.equal(await page.inputValue(`${card(1)} [data-campo="mensagem"]`), 'Olá, tudo bem?');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.campo), 'mensagem');
  assert.equal(await page.textContent(`${card(1)} .rb-passo-res`), '“Olá, tudo bem?”');
  await page.fill(`${card(1)} [data-campo="mensagem"]`, '   ');
  assert.ok(await vazio(page, `${card(1)} [data-campo="mensagem"]`), 'só espaços conta como vazio');
  await fechar();
});

test('Enviar: Só enviar | Enviar + Finalizar; a Tag só aparece (e é obrigatória) no Finalizar', async () => {
  const { page, fechar } = await abrirMontar();
  await abrir(page, 1);
  assert.equal(await page.$(`${card(1)} [data-campo="tag"]`), null);
  await page.click(`${card(1)} .rb-seg [data-v="finalizar"]`);
  assert.equal(await tit(page, 1), '✉️ Enviar · Enviar + Finalizar');
  assert.ok(await vazio(page, `${card(1)} [data-campo="tag"]`));
  await page.fill(`${card(1)} [data-campo="tag"]`, 'Resolvido');
  assert.ok(!(await vazio(page, `${card(1)} [data-campo="tag"]`)));
  await page.click(`${card(1)} .rb-seg [data-v="so"]`);
  assert.equal(await page.$(`${card(1)} [data-campo="tag"]`), null);
  await fechar();
});

test('Espera: Pausar | Despausar em ⏳; Despausar some em 🆕 e 👥 e o passo Despausar fica vermelho ao trocar', async () => {
  const { page, fechar } = await abrirMontar();
  await page.click('#rb-novo');
  await page.click('.rb-pq[data-pq="aguardando"]');
  await page.click('#rb-paleta [data-tipo="espera"]');
  await page.click('#rb-paleta [data-tipo="espera"]'); // [P, P]: abre o modal da regra 5
  await page.click('.rb-modal-btns button:has-text("Entendi")');
  await page.click(`${card(1)} .rb-seg [data-v="despausar"]`);
  assert.equal(await tit(page, 1), '▶️ Despausar');
  assert.equal(await page.$$eval('.rb-passo.erro', (e) => e.length), 0, '[P, D] é válido');
  await abrir(page, 0);
  assert.ok(await page.isVisible(`${card(0)} .rb-seg [data-v="despausar"]`));
  for (const modo of ['caindo', 'ambos']) {
    await page.click(`.rb-pq[data-pq="${modo}"]`);
    await abrir(page, 0);
    assert.ok(!(await page.isVisible(`${card(0)} .rb-seg [data-v="despausar"]`)), modo);
    assert.ok(await page.$eval(card(1), (e) => e.classList.contains('erro')), modo);
    assert.match(await page.textContent(`${card(1)} .rb-passo-erro`), /Despausar só existe em Aguardando/);
  }
  await fechar();
});

test('Mover: chips nv2, default e as pastas recentes; tocar no chip preenche', async () => {
  const { page, fechar } = await abrirMontar(['Retorno', 'nv2']);
  await abrir(page, 3);
  const chips = await page.$$eval(`${card(3)} [data-pasta]`, (els) => els.map((e) => e.textContent));
  assert.deepEqual(chips, ['nv2', 'default', 'Retorno']);
  await page.click(`${card(3)} [data-pasta="Retorno"]`);
  assert.equal(await page.inputValue(`${card(3)} [data-campo="pasta"]`), 'Retorno');
  await fechar();
});

test('Transferir: nome do atendente obrigatório', async () => {
  const { page, fechar } = await abrirMontar();
  await page.click('#rb-paleta [data-tipo="transferir"]');
  assert.ok(await vazio(page, `${card(4)} [data-campo="atendente"]`));
  await page.fill(`${card(4)} [data-campo="atendente"]`, 'Atendente Fictício');
  assert.equal(await tit(page, 4), '🔁 Transferir → Atendente Fictício');
  assert.ok(!(await vazio(page, `${card(4)} [data-campo="atendente"]`)));
  await fechar();
});

test('Transferir: escolha Atendente | Fila; em Fila o nome da fila é obrigatório', async () => {
  const { page, fechar } = await abrirMontar();
  await page.click('#rb-paleta [data-tipo="transferir"]');
  // o modelo tem Mover antes: o aviso de ordem aparece e é fechado (só os campos importam aqui)
  if (await page.$('.rb-modal')) await page.click('.rb-modal-btns button:has-text("Entendi")');
  const seg = `${card(4)} .rb-seg[data-campo="para"]`;
  assert.equal(await page.textContent(`${seg} button.on`), '👤 Atendente', 'atendente é o padrão');
  await page.click(`${seg} [data-v="fila"]`);
  assert.equal(await page.$(`${card(4)} [data-campo="atendente"]`), null, 'em Fila não mostra o campo de atendente');
  assert.ok(await vazio(page, `${card(4)} [data-campo="fila"]`));
  await page.fill(`${card(4)} [data-campo="fila"]`, 'Nível 2');
  assert.equal(await tit(page, 4), '🔁 Transferir → fila Nível 2');
  assert.ok(!(await vazio(page, `${card(4)} [data-campo="fila"]`)));
  await fechar();
});

test('velocidade do passo: 1.5 mostra o selo ×1.5; 9 vira 2.0 com aviso; vazio volta à do fluxo', async () => {
  const { page, fechar } = await abrirMontar();
  await abrir(page, 3);
  const vel = `${card(3)} [data-campo="velocidade"]`;
  await page.fill(vel, '1,5');
  await page.press(vel, 'Tab');
  assert.equal(await page.textContent(`${card(3)} .rb-selo`), '×1.5');
  await page.fill(vel, '9');
  await page.press(vel, 'Tab');
  assert.equal(await page.inputValue(vel), '2.0');
  assert.equal(await page.textContent(`${card(3)} .rb-aviso`), 'Máximo 2.0');
  assert.equal(await page.textContent(`${card(3)} .rb-selo`), '×2.0');
  await page.fill(vel, '');
  await page.press(vel, 'Tab');
  assert.equal(await page.textContent(`${card(3)} .rb-selo`), '');
  await fechar();
});

test('texto do usuário não vira HTML (mensagem com <b> aparece como texto)', async () => {
  const { page, erros, fechar } = await abrirMontar();
  await abrir(page, 1);
  await page.fill(`${card(1)} [data-campo="mensagem"]`, '<img src=x onerror="window.__xss=1">oi');
  await page.click(`${card(3)} .rb-passo-tit`);
  assert.match(await page.textContent(`${card(1)} .rb-passo-res`), /<img/);
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.deepEqual(erros, []);
  await fechar();
});
