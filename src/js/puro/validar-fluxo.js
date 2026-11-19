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

function fluxoRotulo(passo) {
  if (passo.tipo === 'atender') return 'Atender';
  if (passo.tipo === 'enviar') return passo.modo === 'finalizar' ? 'Enviar + Finalizar' : 'Enviar';
  if (passo.tipo === 'espera') return passo.modo === 'despausar' ? 'Despausar' : 'Pausar';
  if (passo.tipo === 'mover') return 'Mover';
  return 'Transferir';
}

// Validação (spec §6). Cada passo é avaliado contra o estado e depois aplicado, mesmo com erro.
// Devolve TODOS os erros de cada passo (regra 10); `causa` = índice do passo que provocou o erro.
function validarFluxo(fluxo) {
  const passos = (fluxo && fluxo.passos) || [];
  const paraQuem = fluxo && fluxo.paraQuem;
  const estado = fluxoEstadoInicial(paraQuem);
  const porChat = paraQuem === 'caindo' || paraQuem === 'ambos';
  // rastros do que já aconteceu (índices base 1), só para apontar a causa
  const rastro = { pausou: null, despausou: null, enviou: null, esvaziou: null };
  const erros = [];

  passos.forEach((passo, i) => {
    const indice = i + 1;
    const anterior = i > 0 ? passos[i - 1] : null;
    const enviando = passo.tipo === 'enviar';
    const despausando = passo.tipo === 'espera' && passo.modo === 'despausar';
    const pausando = passo.tipo === 'espera' && passo.modo === 'pausar';

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
      erros.push(fluxoErro(indice, 2, 'Não sobra cliente na tela', { causa: rastro.esvaziou }));
    }

    // regra 3: Despausar só é bloqueado quando já se sabe que não há pausados
    if (despausando && estado.pausados === 'nenhum') {
      erros.push(fluxoErro(indice, 3, 'Não há cliente em espera para despausar', { causa: rastro.despausou }));
    }

    // regra 4: mesmo envio duas vezes nos mesmos tickets (qualquer Enviar; Atender no meio libera)
    if (enviando && rastro.enviou !== null) {
      erros.push(fluxoErro(indice, 4, 'Não duplique a mensagem para o mesmo cliente', { causa: rastro.enviou }));
    }

    // regra 1: Enviar com pausados (depois de Pausar, sem Despausar). Com `desconhecido` é permitido.
    if (enviando && (estado.pausados === 'todos' || estado.pausados === 'alguns')) {
      // regra 8: só sugere Despausar se não houve envio antes (senão a regra 4 também vale) e se ele existe no modo
      const sugestao =
        rastro.enviou === null && !porChat
          ? { acao: 'inserir', indice, passo: 'despausar', texto: 'Colocar Despausar antes do passo ' + indice }
          : undefined;
      erros.push(
        fluxoErro(indice, 1, 'Cliente em espera não recebe mensagem', {
          causa: rastro.pausou,
          ...(sugestao ? { sugestao } : {}),
        })
      );
    }

    // regra 5: Pausar→Pausar ou Despausar→Despausar em passos adjacentes
    if (
      anterior &&
      anterior.tipo === 'espera' &&
      passo.tipo === 'espera' &&
      anterior.modo === passo.modo
    ) {
      erros.push(fluxoErro(indice, 5, 'Sem efeito: repete o passo anterior', { causa: indice - 1 }));
    }

    // aplica o efeito (spec §6, coluna "Deixa") e atualiza os rastros
    if (passo.tipo === 'atender') {
      estado.tickets = 'ha'; // pausados não muda
      rastro.enviou = null; // tickets novos: o envio pode se repetir
      rastro.esvaziou = null;
    } else if (enviando) {
      rastro.enviou = indice;
      if (passo.modo === 'finalizar') {
        estado.tickets = 'vazio';
        rastro.esvaziou = indice;
      }
    } else if (pausando) {
      estado.pausados = 'todos';
      rastro.pausou = indice;
    } else if (despausando) {
      estado.pausados = 'nenhum';
      rastro.pausou = null;
      rastro.despausou = indice;
    } else {
      // mover | transferir
      estado.tickets = 'vazio';
      rastro.esvaziou = indice;
    }
  });

  return erros.length ? { ok: false, erros } : { ok: true };
}

// Regra 10: o modal mostra UM erro: o do primeiro passo com erro, escolhendo a regra nesta ordem.
const FLUXO_ORDEM_REGRAS = ['indisponivel', 2, 3, 4, 1, 5];

function erroDoModal(erros) {
  if (!erros || !erros.length) return null;
  const primeiro = Math.min.apply(null, erros.map((e) => e.indice));
  const doPasso = erros.filter((e) => e.indice === primeiro);
  doPasso.sort((a, b) => FLUXO_ORDEM_REGRAS.indexOf(a.regra) - FLUXO_ORDEM_REGRAS.indexOf(b.regra));
  return doPasso[0];
}

// Texto do modal (layout-M): { titulo, linha, detalhe }. `passos` é o fluxo validado.
function textoModal(erro, passos) {
  const rot = (n) => n + ' · ' + fluxoRotulo(passos[n - 1]);
  const atual = rot(erro.indice);
  const remover = 'remova o passo ' + erro.indice;
  const titulo = 'Esta ordem não é aceita';
  let linha;
  let detalhe;
  switch (erro.regra) {
    case 1:
      linha = 'O passo ' + atual + ' vem depois de ' + rot(erro.causa) + '.';
      detalhe = erro.sugestao
        ? 'Cliente em espera não recebe mensagem. Para enviar, coloque Despausar antes ou ' + remover + '.'
        : 'Cliente em espera não recebe mensagem. Para enviar, ' + remover + '.';
      break;
    case 2:
      linha = 'O passo ' + atual + ' vem depois de ' + rot(erro.causa) + '.';
      detalhe = 'Não sobra cliente na tela. Para corrigir, ' + remover + '.';
      break;
    case 3:
      linha = 'O passo ' + atual + ' não tem cliente em espera para despausar.';
      detalhe = 'Só dá para despausar depois de Pausar. Coloque Pausar antes ou ' + remover + '.';
      break;
    case 4:
      linha = 'O passo ' + atual + ' repete o envio do passo ' + rot(erro.causa) + '.';
      detalhe = 'Enviar duas vezes para o mesmo cliente não é permitido. Para corrigir, ' + remover + '.';
      break;
    case 5:
      linha = 'O passo ' + atual + ' repete o passo ' + rot(erro.causa) + '.';
      detalhe = 'Repetir em seguida não tem efeito. Para corrigir, ' + remover + '.';
      break;
    default:
      linha = 'O passo ' + atual + ' não existe neste modo.';
      detalhe = erro.dica ? erro.dica + '. Ou ' + remover + '.' : remover.charAt(0).toUpperCase() + remover.slice(1) + '.';
  }
  return { titulo, linha, detalhe };
}
