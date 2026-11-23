// Utilitário dos testes de tela: abre o Blip falso no Chromium e injeta o bookmarklet gerado de src/.
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gerarCodigo, RAIZ } from '../../scripts/build.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
export const URL_BLIP = pathToFileURL(join(RAIZ, 'test/e2e/blip-falso/index.html')).href;

let navegador = null;
export async function navegadorCompartilhado() {
  navegador ??= await chromium.launch();
  return navegador;
}
export async function fecharNavegador() {
  await navegador?.close();
  navegador = null;
}

// Abre o Blip falso. `config` vai para blipFalso.reiniciar. Devolve { page, erros, fechar }.
export async function abrirBlip(config = {}) {
  const ctx = await (await navegadorCompartilhado()).newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  await page.goto(URL_BLIP);
  await page.evaluate((c) => window.blipFalso.reiniciar(c), config);
  return { page, erros, fechar: () => ctx.close() };
}

// Injeta o bookmarklet como o clique no favorito faria. Prazos do Auto/Transferir podem ser encurtados.
export async function injetarBookmarklet(page, { autoTimeouts, transfTimeouts, teste = false } = {}) {
  await page.evaluate(({ a, t, teste }) => {
    if (a) window.__rodBotAutoTimeouts = a;
    if (t) window.__rodBotTransfTimeouts = t;
    if (teste) window.__rodBotTeste = true;
  }, { a: autoTimeouts, t: transfTimeouts, teste });
  await page.evaluate(gerarCodigo());
}

export const estado = (page) => page.evaluate(() => window.blipFalso.estado());

// Espera uma condição sobre o estado do Blip falso (função serializável que recebe o estado).
export async function esperarEstado(page, condicao, timeout = 20000) {
  await page.waitForFunction(
    (fonte) => new Function('e', `return (${fonte})(e)`)(window.blipFalso.estado()),
    condicao.toString(),
    { timeout, polling: 100 },
  );
  return estado(page);
}

// Clica num elemento do painel do rod bot mesmo que a aba dele esteja escondida.
export const clicarPainel = (page, seletor) => page.evaluate((s) => document.querySelector(s).click(), seletor);
export const preencherPainel = (page, seletor, valor) => page.evaluate(([s, v]) => {
  const el = document.querySelector(s);
  el.value = v;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}, [seletor, valor]);
