/* Passo a passo do Acompanhar (puro). Spec §3: os passos do usuário, na ordem dele, com status
 * Aguardando / Rodando / Feito / Falha. Precisa de passos-tela.js (tituloPasso). */

const STEPPER_TEXTOS = { aguardando: 'Aguardando', rodando: 'Rodando', feito: 'Feito', falha: 'Falha' };

// execucao: { status: { [indice]: 'aguardando'|'rodando'|'feito'|'falha' }, detalhe: { [indice]: texto } } (índice base 1)
function montarStepper(passos, execucao) {
  const st = (execucao && execucao.status) || {};
  const det = (execucao && execucao.detalhe) || {};
  return passos.map((p, i) => {
    const indice = i + 1;
    const status = STEPPER_TEXTOS[st[indice]] ? st[indice] : 'aguardando';
    const statusTexto = STEPPER_TEXTOS[status];
    const detalhe = det[indice] || '';
    return { indice, rotulo: tituloPasso(p), status, statusTexto, detalhe,
      texto: detalhe && status !== 'aguardando' ? statusTexto + ' · ' + detalhe : statusTexto };
  });
}

function novaExecucao({ nome, paraQuem, passos }) {
  return { nome, paraQuem, passos: JSON.parse(JSON.stringify(passos)), ciclo: 0, status: {}, detalhe: {}, fim: null };
}

// Eventos do motor: { tipo:'ciclo', n } | { tipo:'passo', indice, status, detalhe } | { tipo:'fim', status }
function aplicarEventoStepper(ex, ev) {
  const novo = { ...ex, status: { ...ex.status }, detalhe: { ...ex.detalhe } };
  if (ev.tipo === 'ciclo') novo.ciclo = ev.n;
  else if (ev.tipo === 'passo') {
    novo.status[ev.indice] = ev.status;
    if (ev.detalhe !== undefined) novo.detalhe[ev.indice] = ev.detalhe;
    else if (ev.status === 'aguardando') delete novo.detalhe[ev.indice];
  } else if (ev.tipo === 'fim') novo.fim = ev.status;
  return novo;
}

function rotuloExecucao(ex) {
  if (!ex) return 'Parado';
  if (ex.fim) return { concluido: 'Concluído', falha: 'Falha', parado: 'Parado' }[ex.fim] || 'Parado';
  if (ex.paraQuem === 'aguardando') return ex.ciclo ? 'Ciclo #' + ex.ciclo : 'Iniciando';
  return 'Vigiando';
}
