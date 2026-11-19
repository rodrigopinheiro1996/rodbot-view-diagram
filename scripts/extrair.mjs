// Uso ÚNICO (Tarefa 1): lê rodbot-final.html, decodifica o javascript: e divide o código
// SÓ nas linhas dos blocos de comentário "/* ====", sem alterar nenhum caractere.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { decodificar } from './codec.mjs';

const linhas_ = (t) => t.split('\n');

if (existsSync('src/js')) {
  console.error('src/js já existe: extração é de uso único.');
  process.exit(1);
}
const html = readFileSync('rodbot-final.html', 'utf8');
const ini = html.indexOf('href="javascript:') + 'href="javascript:'.length;
const fim = html.indexOf('"', ini);
const codificado = html.slice(ini, fim);
const js = decodificar(codificado);

const MARCA = '@@RODBOT_BOOKMARKLET@@';
const valIni = html.indexOf('value="javascript:') + 'value="javascript:'.length;
const valFim = html.indexOf('"', valIni);
if (html.slice(valIni, valFim) !== codificado) throw new Error('as duas cópias do código diferem');
const modelo = html.slice(0, ini) + MARCA + html.slice(fim, valIni) + MARCA + html.slice(valFim);
mkdirSync('src/pagina', { recursive: true });
writeFileSync('src/pagina/instalacao.html', modelo);

// cortes: a linha de abertura de cada comentário em bloco ("/* ====…"); o corte é ANTES dela
const aberturas = [];
linhas_(js).forEach((l, i) => { if (/^\s*\/\* =+\s*$/.test(l)) aberturas.push(i); });
if (aberturas.length !== 3) throw new Error('esperava 3 blocos ====, achei ' + aberturas.length);
const linhas = linhas_(js);

const nomes = ['01-base.js', '02-piloto.js', '03-auto.js', '04-transferir-e-fechar.js'];
const limites = [0, ...aberturas, linhas.length];
mkdirSync('src/js', { recursive: true });
nomes.forEach((nome, k) => {
  const parte = linhas.slice(limites[k], limites[k + 1]).join('\n') + (k < nomes.length - 1 ? '\n' : '');
  writeFileSync('src/js/' + nome, parte);
});
writeFileSync('src/js/ordem.txt', nomes.join('\n') + '\n');
console.log('ok', nomes.join(', '));
