// Carrega um arquivo de src/js/puro/ num contexto isolado (sem DOM) e devolve as funções declaradas nele.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { RAIZ } from '../../scripts/build.mjs';

export function carregarPuro(...arquivos) {
  const ctx = vm.createContext({});
  for (const a of arquivos) {
    const caminho = join(RAIZ, 'src/js/puro', a);
    vm.runInContext(readFileSync(caminho, 'utf8'), ctx, { filename: caminho });
  }
  return ctx;
}
