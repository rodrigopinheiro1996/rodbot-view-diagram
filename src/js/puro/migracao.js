/* Migração na 1ª abertura do painel novo (função pura; armazenamento injetado). Spec §9.
 *
 * Fato lido no código antigo: só são gravados tema, aba, pastas recentes, mensagem do Auto, contador e tickets do Auto.
 * Mensagem e pasta do Piloto/Envio/Pastas NÃO são persistidas, então só a mensagem do Auto migra (para o Enviar do
 * ⭐ Auto clássico). Roda uma vez (marca rf_rodbot_migracao_v1, que guarda a mensagem migrada) e não apaga nem
 * altera nenhuma chave antiga (dá para voltar ao HTML anterior). Nunca preenche MENSAGEM_PADRAO sozinho.
 */

const MIGRACAO_CHAVE = 'rf_rodbot_migracao_v1';
const MIGRACAO_AUTO_MSG_CHAVE = 'rf_rodbot_auto_msg_v1';

function migracaoLer(armazenamento) {
  try {
    const bruto = armazenamento.getItem(MIGRACAO_CHAVE);
    if (!bruto) return null;
    const o = JSON.parse(bruto);
    return o && typeof o === 'object' ? o : null;
  } catch (e) {
    return null;
  }
}

function migrarPrimeiraAbertura(armazenamento) {
  const feita = migracaoLer(armazenamento);
  if (feita) return { jaMigrado: true, mensagemAuto: feita.mensagemAuto || '' };
  let mensagemAuto = '';
  try {
    const msg = armazenamento.getItem(MIGRACAO_AUTO_MSG_CHAVE);
    if (typeof msg === 'string' && msg.trim()) mensagemAuto = msg;
  } catch (e) {
    mensagemAuto = '';
  }
  try {
    armazenamento.setItem(MIGRACAO_CHAVE, JSON.stringify({ v: 1, mensagemAuto }));
  } catch (e) {
    /* sem armazenamento: roda de novo na próxima abertura, sem prejuízo */
  }
  return { jaMigrado: false, mensagemAuto };
}

function mensagemAutoMigrada(armazenamento) {
  const feita = migracaoLer(armazenamento);
  return (feita && typeof feita.mensagemAuto === 'string') ? feita.mensagemAuto : '';
}

// A aba antiga salva (piloto|pasta|mensagem|fila|auto) ou qualquer outro valor abre em Montar (§3/§9).
// Acompanhar só aparece sozinho quando um fluxo é iniciado.
// (a chave antiga rf_rodbot_tab_v1 nem precisa ser lida: o resultado é sempre o mesmo)
function abaInicial(/* armazenamento */) {
  return 'montar';
}
