// PROVA DA TAREFA 1: dividir em src/ e regerar o HTML não muda NADA do arquivo original (commit 3ca5940).
// Este teste e scripts/extrair.mjs são removidos no primeiro commit que muda o bundle de propósito (Tarefa 7).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gerarHtml, gerarCodigo, listarTrechos, RAIZ, MARCA } from '../../scripts/build.mjs';
import { decodificar } from '../../scripts/codec.mjs';

const ORIGINAL = execFileSync('git', ['show', '3ca5940:rodbot-final.html'], { cwd: RAIZ, maxBuffer: 1 << 28 });
const originalTxt = ORIGINAL.toString('utf8');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const href = () => {
  const i = originalTxt.indexOf('href="javascript:') + 'href="javascript:'.length;
  return originalTxt.slice(i, originalTxt.indexOf('"', i));
};

test('a concatenação de src/js/ordem.txt é igual ao código decodificado do href original', () => {
  assert.equal(gerarCodigo(), decodificar(href()));
});

test('build(src) == rodbot-final.html do commit 3ca5940, no HTML inteiro, byte a byte', () => {
  const gerado = Buffer.from(gerarHtml(), 'utf8');
  assert.equal(gerado.length, ORIGINAL.length);
  assert.equal(sha(gerado), sha(ORIGINAL));
  assert.ok(gerado.equals(ORIGINAL));
});

test('as duas cópias do código (href e value de bm-code) são idênticas entre si', () => {
  const h = gerarHtml();
  const a = h.indexOf('href="javascript:') + 17;
  const b = h.indexOf('value="javascript:') + 18;
  assert.equal(h.slice(a, h.indexOf('"', a)), h.slice(b, h.indexOf('"', b)));
});

test('instalacao.html tem o marcador exatamente 2x e nenhum trecho de src/js o contém', () => {
  const modelo = readFileSync(join(RAIZ, 'src/pagina/instalacao.html'), 'utf8');
  assert.equal(modelo.split(MARCA).length - 1, 2);
  for (const n of listarTrechos()) assert.ok(!readFileSync(join(RAIZ, 'src/js', n), 'utf8').includes(MARCA), n);
});

test('os 4 trechos: cada um termina em fronteira de linha e os 2, 3 e 4 começam na linha "/* ===="', () => {
  const nomes = listarTrechos();
  assert.equal(nomes.length, 4);
  nomes.forEach((n, k) => {
    const t = readFileSync(join(RAIZ, 'src/js', n), 'utf8');
    if (k < nomes.length - 1) assert.ok(t.endsWith('\n'), n + ' deve terminar em \\n');
    if (k > 0) assert.match(t.split('\n')[0], /^\s*\/\* =+\s*$/, n);
  });
});

test('todo arquivo de ordem.txt existe e todo .js de src/js está listado', () => {
  const listados = new Set(listarTrechos());
  const noDisco = readdirSync(join(RAIZ, 'src/js')).filter((f) => f.endsWith('.js'));
  assert.deepEqual([...listados].sort(), noDisco.sort());
});
