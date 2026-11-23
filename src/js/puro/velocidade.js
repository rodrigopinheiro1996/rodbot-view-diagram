/* Velocidade (função pura, sem DOM). Spec §7 e §8.
 *
 * Faixa 0.5 a 2.0, passo 0.1, padrão 1.0 (= tempos de hoje). Maior = mais rápido:
 * pausa efetiva = pausa atual ÷ velocidade, com piso de 50% da pausa atual (por isso 2.0 é o máximo).
 * Só vale para as pausas de RITMO entre ações (ver docs/plano/pausas.md). A pausa entre ciclos não muda.
 */

const VEL_MIN = 0.5;
const VEL_MAX = 2;
const VEL_PADRAO = 1;
const CICLO_MIN_S = 0;
const CICLO_MAX_S = 60;
const CICLO_PADRAO_S = 1;

function velNumero(entrada) {
  if (typeof entrada === 'number') return entrada;
  if (typeof entrada !== 'string') return NaN;
  const t = entrada.trim().replace(',', '.');
  return t === '' || !/^-?\d*\.?\d+$/.test(t) ? NaN : Number(t);
}

function velVazia(entrada) {
  return entrada === null || entrada === undefined || (typeof entrada === 'string' && entrada.trim() === '');
}

// Para o campo: devolve o valor corrigido e o aviso a mostrar (null quando não houve correção).
function normalizarVelocidade(entrada) {
  if (velVazia(entrada)) return { valor: VEL_PADRAO, aviso: null };
  const n = velNumero(entrada);
  if (!Number.isFinite(n)) return { valor: VEL_PADRAO, aviso: 'Valor inválido' };
  if (n > VEL_MAX) return { valor: VEL_MAX, aviso: 'Máximo 2.0' };
  if (n < VEL_MIN) return { valor: VEL_MIN, aviso: 'Mínimo 0.5' };
  return { valor: Math.round(n * 10) / 10, aviso: null };
}

function pausa(msAtual, velocidade) {
  const n = velNumero(velocidade);
  const vel = Number.isFinite(n) ? Math.min(VEL_MAX, Math.max(VEL_MIN, n)) : VEL_PADRAO;
  return Math.max(Math.round(msAtual / vel), Math.ceil(msAtual * 0.5));
}

function velocidadeDoPasso(passo, velocidadeFluxo) {
  if (!passo || velVazia(passo.velocidade)) return velocidadeFluxo;
  return normalizarVelocidade(passo.velocidade).valor;
}

function seloVelocidade(passo) {
  if (!passo || velVazia(passo.velocidade)) return null;
  return '×' + normalizarVelocidade(passo.velocidade).valor.toFixed(1);
}

// Pausa entre ciclos (§7): valor do usuário em segundos; a velocidade é ignorada de propósito.
function pausaEntreCiclos(segundos /*, velocidade (ignorada) */) {
  return Math.round(segundos * 1000);
}

function normalizarPausaCiclos(entrada) {
  if (velVazia(entrada)) return { valor: CICLO_PADRAO_S, aviso: null };
  const n = velNumero(entrada);
  if (!Number.isFinite(n)) return { valor: CICLO_PADRAO_S, aviso: 'Valor inválido' };
  if (n > CICLO_MAX_S) return { valor: CICLO_MAX_S, aviso: 'Máximo 60 s' };
  if (n < CICLO_MIN_S) return { valor: CICLO_MIN_S, aviso: 'Mínimo 0 s' };
  return { valor: Math.round(n * 10) / 10, aviso: null };
}
