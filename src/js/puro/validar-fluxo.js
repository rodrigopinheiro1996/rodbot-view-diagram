/* Validador do fluxo (função pura, sem DOM). Spec §6.
 *
 * validarFluxo({ paraQuem, passos }) → { ok:true } | { ok:false, erros:[{ indice, regra, mensagem, correcao?, dica? }] }
 *   - paraQuem: 'aguardando' (⏳) | 'caindo' (🆕) | 'ambos' (👥)
 *   - passo: { tipo:'atender' } | { tipo:'enviar', modo:'so'|'finalizar' } | { tipo:'espera', modo:'pausar'|'despausar' }
 *            | { tipo:'mover' } | { tipo:'transferir' }
 *   - indice: base 1 (como o usuário vê). O validador devolve TODOS os erros de cada passo.
 *
 * Estado simulado: tickets ∈ {'ha','vazio'}; pausados ∈ {'desconhecido','nenhum','alguns','todos'}.
 * Início em ⏳: há + desconhecido. Em 🆕/👥 (por chat, regra 11): há + nenhum.
 * Cada passo é avaliado contra o estado e depois APLICADO (mesmo com erro), para os passos
 * seguintes serem avaliados como o usuário os enxerga.
 */

function fluxoEstadoInicial(paraQuem) {
  return paraQuem === 'caindo' || paraQuem === 'ambos'
    ? { tickets: 'ha', pausados: 'nenhum' }
    : { tickets: 'ha', pausados: 'desconhecido' };
}

function fluxoPassoDisponivel(paraQuem, passo) {
  const porChat = paraQuem === 'caindo' || paraQuem === 'ambos';
  if (!porChat) return true;
  if (passo.tipo === 'atender') return false;
  if (passo.tipo === 'espera' && passo.modo === 'despausar') return false;
  return true;
}

function fluxoErro(indice, regra, mensagem, extra) {
  return Object.assign(
    { indice, regra, mensagem, correcao: { acao: 'remover', indice, texto: 'Remover passo ' + indice } },
    extra || {}
  );
}

// aplica o efeito do passo ao estado (spec §6, coluna "Deixa")
function fluxoAplicar(estado, passo) {
  switch (passo.tipo) {
    case 'atender':
      estado.tickets = 'ha'; // pausados não muda
      break;
    case 'enviar':
      if (passo.modo === 'finalizar') estado.tickets = 'vazio';
      break;
    case 'espera':
      estado.pausados = passo.modo === 'pausar' ? 'todos' : 'nenhum';
      break;
    case 'mover':
    case 'transferir':
      estado.tickets = 'vazio';
      break;
  }
}

function validarFluxo(fluxo) {
  const passos = (fluxo && fluxo.passos) || [];
  const paraQuem = fluxo && fluxo.paraQuem;
  const estado = fluxoEstadoInicial(paraQuem);
  const erros = [];

  passos.forEach((passo, i) => {
    const indice = i + 1;

    // indisponível no modo (Atender e Despausar não existem em 🆕/👥)
    if (!fluxoPassoDisponivel(paraQuem, passo)) {
      const atender = passo.tipo === 'atender';
      erros.push(
        fluxoErro(
          indice,
          'indisponivel',
          atender ? 'Atender não existe neste modo' : 'Despausar só existe em Aguardando',
          atender ? { dica: "Use 'Também puxar a fila' nos Ajustes" } : {}
        )
      );
    }

    // regra 2: depois de Enviar+Finalizar, Transferir ou Mover não sobra cliente (exceto Atender)
    if (estado.tickets === 'vazio' && passo.tipo !== 'atender') {
      erros.push(fluxoErro(indice, 2, 'Não sobra cliente na tela'));
    }

    // regra 3: Despausar só é bloqueado quando já se sabe que não há pausados
    if (passo.tipo === 'espera' && passo.modo === 'despausar' && estado.pausados === 'nenhum') {
      erros.push(fluxoErro(indice, 3, 'Não há cliente em espera para despausar'));
    }

    fluxoAplicar(estado, passo);
  });

  return erros.length ? { ok: false, erros } : { ok: true };
}
