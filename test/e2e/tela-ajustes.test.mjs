// Tarefa 19: ⚙️ Ajustes recolhíveis (velocidade, loop, pausa entre ciclos, "Também puxar a fila").
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBlip, injetarBookmarklet, fecharNavegador } from './util.mjs';

after(fecharNavegador);

async function abrirMontar() {
  const { page, erros, fechar } = await abrirBlip();
  await injetarBookmarklet(page);
  return { page, erros, fechar };
}
const abrirAjustes = (page) => page.click('#rb-ajustes-topo');
const resumo = (page) => page.textContent('#rb-ajustes-res');
const visivel = (page, sel) => page.$eval(sel, (e) => getComputedStyle(e).display !== 'none' && !e.closest('[hidden]'));
const dismiss = async (page) => { if (await page.$('.rb-modal')) await page.click('.rb-modal-btns button:has-text("Entendi")'); };

test('começa recolhido com o resumo "Velocidade 1.0 · 🔁 Loop ligado · 1 s entre ciclos"', async () => {
  const { page, erros, fechar } = await abrirMontar();
  assert.equal(await resumo(page), 'Velocidade 1.0 · 🔁 Loop ligado · 1 s entre ciclos');
  assert.ok(!(await visivel(page, '#rb-vel')), 'recolhido');
  await abrirAjustes(page);
  assert.ok(await visivel(page, '#rb-vel'));
  await abrirAjustes(page);
  assert.ok(!(await visivel(page, '#rb-vel')));
  assert.deepEqual(erros, []);
  await fechar();
});

test('velocidade: 3 vira 2.0 com aviso; 1,25 vira 1.3; vazio vira 1.0; o resumo acompanha', async () => {
  const { page, fechar } = await abrirMontar();
  await abrirAjustes(page);
  await page.fill('#rb-vel', '3');
  await page.press('#rb-vel', 'Tab');
  assert.equal(await page.inputValue('#rb-vel'), '2.0');
  assert.equal(await page.textContent('#rb-vel-aviso'), 'Máximo 2.0');
  assert.match(await resumo(page), /^Velocidade 2\.0/);
  await page.fill('#rb-vel', '1,25');
  await page.press('#rb-vel', 'Tab');
  assert.equal(await page.inputValue('#rb-vel'), '1.3');
  assert.equal(await page.textContent('#rb-vel-aviso'), '');
  await page.fill('#rb-vel', '');
  await page.press('#rb-vel', 'Tab');
  assert.equal(await page.inputValue('#rb-vel'), '1.0');
  await fechar();
});

test('pausa entre ciclos: 0 a 60 s; 90 vira 60 com aviso; texto diz que não muda com a velocidade', async () => {
  const { page, fechar } = await abrirMontar();
  await abrirAjustes(page);
  assert.match(await page.textContent('#rb-ciclo-bloco'), /não muda com a velocidade/i);
  await page.fill('#rb-ciclo', '90');
  await page.press('#rb-ciclo', 'Tab');
  assert.equal(await page.inputValue('#rb-ciclo'), '60');
  assert.equal(await page.textContent('#rb-ciclo-aviso'), 'Máximo 60 s');
  assert.match(await resumo(page), /60 s entre ciclos/);
  await page.fill('#rb-ciclo', '0');
  await page.press('#rb-ciclo', 'Tab');
  assert.equal(await page.inputValue('#rb-ciclo'), '0');
  assert.equal(await page.textContent('#rb-ciclo-aviso'), '');
  await fechar();
});

test('⏳ sem Atender em 1º: o interruptor do loop fica desabilitado com o motivo e MANTÉM a escolha', async () => {
  const { page, fechar } = await abrirMontar();
  await abrirAjustes(page);
  assert.ok(await page.isChecked('#rb-loop'));
  assert.ok(!(await page.isDisabled('#rb-loop')));
  await page.click('.rb-passo[data-i="0"] [data-acao="remover"]'); // tira o Atender do 1º lugar
  assert.ok(await page.isDisabled('#rb-loop'));
  assert.equal(await page.textContent('#rb-loop-motivo'), 'O loop precisa de Atender em 1º');
  assert.ok(await page.isChecked('#rb-loop'), 'a escolha do usuário não se perde');
  assert.match(await resumo(page), /Loop desligado/);
  await fechar();
});

test('o usuário desligou o loop: recolocar Atender em 1º NÃO religa; se tinha ligado, volta ligado', async () => {
  const { page, fechar } = await abrirMontar();
  await abrirAjustes(page);
  await page.click('#rb-loop'); // desliga (Atender em 1º)
  assert.ok(!(await page.isChecked('#rb-loop')));
  assert.match(await resumo(page), /Loop desligado/);
  await page.click('.rb-passo[data-i="0"] [data-acao="remover"]');
  await page.click('#rb-paleta [data-tipo="atender"]'); await dismiss(page);
  await page.click('.rb-passo[data-i="3"] [data-acao="subir"]');
  await page.click('.rb-passo[data-i="2"] [data-acao="subir"]');
  await page.click('.rb-passo[data-i="1"] [data-acao="subir"]');
  assert.equal(await page.textContent('.rb-passo[data-i="0"] .rb-tit-txt'), '📥 Atender fila');
  assert.ok(!(await page.isDisabled('#rb-loop')));
  assert.ok(!(await page.isChecked('#rb-loop')), 'continua desligado: era a escolha dele');
  await page.click('#rb-loop');
  assert.match(await resumo(page), /Loop ligado/);
  await fechar();
});

test('🆕/👥: some o loop e a pausa entre ciclos; aparece "Também puxar a fila" desligada por padrão', async () => {
  const { page, fechar } = await abrirMontar();
  await abrirAjustes(page);
  assert.ok(await visivel(page, '#rb-loop-bloco'));
  assert.ok(await visivel(page, '#rb-ciclo-bloco'));
  assert.ok(!(await visivel(page, '#rb-puxar-bloco')));
  for (const modo of ['caindo', 'ambos']) {
    await page.click(`.rb-pq[data-pq="${modo}"]`);
    assert.ok(!(await visivel(page, '#rb-loop-bloco')), modo);
    assert.ok(!(await visivel(page, '#rb-ciclo-bloco')), modo);
    assert.ok(await visivel(page, '#rb-puxar-bloco'), modo);
    assert.ok(!(await page.isChecked('#rb-puxar')), 'desligada por padrão');
    assert.equal(await resumo(page), 'Velocidade 1.0 · Sem puxar a fila', modo);
  }
  await page.click('#rb-puxar');
  assert.equal(await resumo(page), 'Velocidade 1.0 · Puxa a fila');
  await page.click('.rb-pq[data-pq="aguardando"]');
  assert.ok(await visivel(page, '#rb-loop-bloco'));
  await fechar();
});

test('as escolhas dos Ajustes ficam no fluxo ao trocar de modo e voltar', async () => {
  const { page, fechar } = await abrirMontar();
  await abrirAjustes(page);
  await page.fill('#rb-vel', '1.5'); await page.press('#rb-vel', 'Tab');
  await page.fill('#rb-ciclo', '5'); await page.press('#rb-ciclo', 'Tab');
  await page.click('#rb-loop');
  await page.click('.rb-pq[data-pq="caindo"]');
  await page.click('.rb-pq[data-pq="aguardando"]');
  assert.equal(await page.inputValue('#rb-vel'), '1.5');
  assert.equal(await page.inputValue('#rb-ciclo'), '5');
  assert.ok(!(await page.isChecked('#rb-loop')));
  assert.equal(await resumo(page), 'Velocidade 1.5 · 🔁 Loop desligado');
  await fechar();
});

