// Prova que um commit "refactor(mover)" não mudou nenhuma linha:
// a concatenação de src/js/ordem.txt agora == a do commit anterior (ou da ref dada), byte a byte.
import { execFileSync } from 'node:child_process';
import { gerarCodigo } from './build.mjs';

const ref = process.argv[2] ?? 'HEAD';
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 28 });
const ordem = git('show', `${ref}:src/js/ordem.txt`).split('\n').filter(Boolean);
const antes = ordem.map((n) => git('show', `${ref}:src/js/${n}`)).join('');
const agora = gerarCodigo();
if (antes === agora) {
  console.log(`bundle idêntico a ${ref} (${agora.length} caracteres)`);
} else {
  console.error(`bundle DIFERE de ${ref}: não é um refactor(mover)`);
  process.exit(1);
}
