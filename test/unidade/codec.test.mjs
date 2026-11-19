import test from 'node:test';
import assert from 'node:assert/strict';
import { codificar, decodificar } from '../../scripts/codec.mjs';

test('escapa espaço, parênteses, !, * e aspas simples em maiúsculas', () => {
  assert.equal(codificar("a b(c)!*'é"), 'a%20b%28c%29%21%2A%27%C3%A9');
});
test('não altera A-Z a-z 0-9 - _ .', () => {
  assert.equal(codificar('A-z_0.9'), 'A-z_0.9');
});
test('ida e volta com quebras de linha e acentos', () => {
  const x = "(function () {\n  const a = `olá ${1}`; // 'x' (y) !*\n})();;void 0;";
  assert.equal(decodificar(codificar(x)), x);
});
