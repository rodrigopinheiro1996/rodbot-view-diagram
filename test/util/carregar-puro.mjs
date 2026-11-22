// Carrega um arquivo de src/js/puro/ num contexto isolado (sem DOM) e devolve as funções declaradas nele.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { RAIZ } from '../../scripts/build.mjs';

// O 1º argumento pode ser um objeto com globais falsas (ex.: { sleep }) que o arquivo usa.
export function carregarPuro(...arquivos) {
  const globais = typeof arquivos[0] === 'object' ? arquivos.shift() : {};
  const ctx = vm.createContext({ ...globais });
  for (const a of arquivos) {
    const caminho = join(RAIZ, 'src/js/puro', a);
    vm.runInContext(readFileSync(caminho, 'utf8'), ctx, { filename: caminho });
  }
  return ctx;
}
