// Gera rodbot-final.html a partir de src/. Nunca edite o HTML à mão.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { codificar } from './codec.mjs';

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
export const MARCA = '@@RODBOT_BOOKMARKLET@@';

export function listarTrechos(raiz = RAIZ) {
  return readFileSync(join(raiz, 'src/js/ordem.txt'), 'utf8').split('\n').filter(Boolean);
}

export function gerarCodigo(raiz = RAIZ) {
  return listarTrechos(raiz).map((n) => readFileSync(join(raiz, 'src/js', n), 'utf8')).join('');
}

export function gerarHtml(raiz = RAIZ) {
  const modelo = readFileSync(join(raiz, 'src/pagina/instalacao.html'), 'utf8');
  const codificado = codificar(gerarCodigo(raiz));
  return modelo.split(MARCA).join(codificado);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(join(RAIZ, 'rodbot-final.html'), gerarHtml());
  console.log('rodbot-final.html gerado');
}
