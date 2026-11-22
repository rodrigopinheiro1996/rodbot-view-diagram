// Estrutura do build (permanente). A prova de ida e volta da Tarefa 1 ficou no histórico (commit 46f3091).
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gerarHtml, gerarCodigo, listarTrechos, RAIZ, MARCA } from '../../scripts/build.mjs';
import { decodificar } from '../../scripts/codec.mjs';

test('o bundle é JavaScript válido', () => {
  assert.doesNotThrow(() => new vm.Script(gerarCodigo(), { filename: 'bundle.js' }));
});

test('as duas cópias do código (href e value de bm-code) são idênticas e decodificam para o bundle', () => {
  const h = gerarHtml();
  const a = h.indexOf('href="javascript:') + 17;
  const b = h.indexOf('value="javascript:') + 18;
  const href = h.slice(a, h.indexOf('"', a));
  assert.equal(href, h.slice(b, h.indexOf('"', b)));
  assert.equal(decodificar(href), gerarCodigo());
});

test('instalacao.html tem o marcador exatamente 2x e nenhum trecho o contém', () => {
  const modelo = readFileSync(join(RAIZ, 'src/pagina/instalacao.html'), 'utf8');
  assert.equal(modelo.split(MARCA).length - 1, 2);
  for (const n of listarTrechos()) assert.ok(!readFileSync(join(RAIZ, 'src/js', n), 'utf8').includes(MARCA), n);
});

test('todo arquivo de ordem.txt existe e todo .js da raiz de src/js está listado', () => {
  const listados = listarTrechos();
  for (const n of listados) assert.ok(existsSync(join(RAIZ, 'src/js', n)), n);
  const raiz = readdirSync(join(RAIZ, 'src/js')).filter((f) => f.endsWith('.js'));
  for (const f of raiz) assert.ok(listados.includes(f), f + ' fora de ordem.txt');
});

test('o código começa abrindo a IIFE e termina em "})();;void 0;"', () => {
  const c = gerarCodigo();
  assert.ok(c.startsWith('(function () {'));
  assert.ok(c.endsWith('})();;void 0;'));
});
