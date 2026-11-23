/* Pausas de RITMO entre ações (Tarefa 7, spec §8). Precisa de velocidade.js e de `sleep` (01-base.js).
 *
 * Só as pausas classificadas como "entra" em docs/plano/pausas.md chamam pausaAcao; as esperas de UI,
 * polling, recuos e prazos continuam com sleep/waitFor. Com velocidade 1.0 nada muda.
 */

let velocidadeAtual = 1; // o motor define ao iniciar cada passo; o painel antigo usa 1.0

function definirVelocidadeAtual(v) {
  velocidadeAtual = normalizarVelocidade(v).valor;
  return velocidadeAtual;
}

function pausaAcao(ms) {
  return sleep(pausa(ms, velocidadeAtual));
}
