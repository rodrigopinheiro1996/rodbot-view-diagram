/* Textos e operações dos passos da tela Montar (puro). Spec §3/§4. */

const PASSO_INFO = {
  atender: { icone: '📥', nome: 'Atender', titulo: 'Atender fila' },
  enviar: { icone: '✉️', nome: 'Enviar', titulo: 'Enviar' },
  espera: { icone: '⏸️', nome: 'Espera', titulo: 'Pausar' },
  mover: { icone: '📁', nome: 'Mover', titulo: 'Mover' },
  transferir: { icone: '🔁', nome: 'Transf.', titulo: 'Transferir' },
};
const PASSO_ORDEM_PALETA = ['atender', 'enviar', 'espera', 'mover', 'transferir'];

function novoPasso(tipo) {
  if (tipo === 'enviar') return { tipo, modo: 'so', mensagem: '', tag: '', velocidade: null };
  if (tipo === 'espera') return { tipo, modo: 'pausar', velocidade: null };
  if (tipo === 'mover') return { tipo, pasta: '', velocidade: null };
  if (tipo === 'transferir') return { tipo, atendente: '', velocidade: null };
  return { tipo: 'atender', velocidade: null };
}

function tituloPasso(p) {
  if (p.tipo === 'enviar') return '✉️ Enviar · ' + (p.modo === 'finalizar' ? 'Enviar + Finalizar' : 'Só enviar');
  if (p.tipo === 'espera') return p.modo === 'despausar' ? '▶️ Despausar' : '⏸️ Pausar';
  if (p.tipo === 'mover') return '📁 Mover' + ((p.pasta || '').trim() ? ' → ' + p.pasta.trim() : '');
  if (p.tipo === 'transferir' && p.para === 'fila') return '🔁 Transferir' + ((p.fila || '').trim() ? ' → fila ' + p.fila.trim() : '');
  if (p.tipo === 'transferir') return '🔁 Transferir' + ((p.atendente || '').trim() ? ' → ' + p.atendente.trim() : '');
  return '📥 Atender fila';
}

function passoCurto(texto, max) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const corte = t.slice(0, max);
  const espaco = corte.lastIndexOf(' ');
  return (espaco > max * 0.5 ? corte.slice(0, espaco) : corte).replace(/[\s.,;:!?]+$/, '') + '…';
}

function resumoPasso(p) {
  if (p.tipo === 'atender') return 'Puxa até zerar · sentinela quando a fila esvaziar';
  if (p.tipo === 'enviar') {
    if (!(p.mensagem || '').trim()) return 'Mensagem vazia';
    const msg = '“' + passoCurto(p.mensagem, 36) + '”';
    return p.modo === 'finalizar' ? msg + ' · tag ' + ((p.tag || '').trim() || '(vazia)') : msg;
  }
  if (p.tipo === 'espera') return p.modo === 'despausar' ? 'Tira os clientes da espera' : 'Coloca os clientes em espera';
  if (p.tipo === 'mover') return (p.pasta || '').trim() ? 'Move para a pasta' : 'Escolha a pasta';
  if (p.para === 'fila') return (p.fila || '').trim() ? 'Transfere para a fila' : 'Escolha a fila (nome exato)';
  return (p.atendente || '').trim() ? 'Transfere para o atendente' : 'Escolha o atendente (nome exato)';
}

function moverPasso(passos, i, delta) {
  const lista = passos.slice();
  const j = i + delta;
  if (j < 0 || j >= lista.length) return lista;
  const t = lista[i];
  lista[i] = lista[j];
  lista[j] = t;
  return lista;
}

function removerPasso(passos, i) {
  return passos.filter((_, k) => k !== i);
}
