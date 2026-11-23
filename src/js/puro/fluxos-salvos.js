/* Fluxos salvos (função pura; o armazenamento é injetado). Spec §9.
 *
 * - Modelos fixos ⭐ Piloto clássico e ⭐ Auto clássico: não são gravados, não se apagam e não se sobrescrevem.
 *   Editar um modelo vale só em memória: listar() sempre devolve cópias novas do original.
 * - Até 10 fluxos do usuário (os modelos não contam), gravados em rf_rodbot_fluxos_v1; o último usado em
 *   rf_rodbot_fluxo_atual_v1. 💾 sempre cria um fluxo NOVO com nome.
 * - Mensagens dos modelos começam VAZIAS (nunca se preenche MENSAGEM_PADRAO sozinho).
 *
 * criarFluxosSalvos(armazenamento, { gerarId? }) → { listar, atual, salvar, apagar, marcarAtual, novoVazio }
 *   item: { id, nome, modelo, fluxo }
 */

const FLUXOS_CHAVE = 'rf_rodbot_fluxos_v1';
const FLUXO_ATUAL_CHAVE = 'rf_rodbot_fluxo_atual_v1';
const FLUXOS_MAX_USUARIO = 10;

function fluxoBase(paraQuem, passos) {
  return { paraQuem, loopEscolha: true, pausaCiclos: 1, velocidade: 1, puxarFila: false, passos };
}

function fluxosModelos() {
  return [
    {
      id: 'modelo:piloto', nome: '⭐ Piloto clássico', modelo: true,
      fluxo: fluxoBase('aguardando', [
        { tipo: 'atender', velocidade: null },
        { tipo: 'enviar', modo: 'so', mensagem: '', tag: '', velocidade: null },
        { tipo: 'espera', modo: 'pausar', velocidade: null },
        { tipo: 'mover', pasta: '', velocidade: null },
      ]),
    },
    {
      id: 'modelo:auto', nome: '⭐ Auto clássico', modelo: true,
      fluxo: fluxoBase('caindo', [
        { tipo: 'enviar', modo: 'so', mensagem: '', tag: '', velocidade: null },
        { tipo: 'espera', modo: 'pausar', velocidade: null },
      ]),
    },
  ];
}

function fluxoCopia(x) {
  return JSON.parse(JSON.stringify(x));
}

function fluxoNomeChave(nome) {
  return String(nome || '').replace(/⭐/g, '').trim().toLowerCase();
}

function temAlteracoes(editado, original) {
  return JSON.stringify(editado) !== JSON.stringify(original);
}

function criarFluxosSalvos(armazenamento, opcoes) {
  const gerarId = (opcoes && opcoes.gerarId) || (() => 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));

  function lerUsuario() {
    try {
      const lista = JSON.parse(armazenamento.getItem(FLUXOS_CHAVE) || '[]');
      if (!Array.isArray(lista)) return [];
      return lista.filter((x) => x && typeof x.id === 'string' && typeof x.nome === 'string' && x.fluxo && Array.isArray(x.fluxo.passos));
    } catch (e) {
      return [];
    }
  }
  function gravarUsuario(lista) {
    try {
      armazenamento.setItem(FLUXOS_CHAVE, JSON.stringify(lista));
      return true;
    } catch (e) {
      return false;
    }
  }

  function listar() {
    return fluxoCopia(fluxosModelos().concat(lerUsuario().map((x) => ({ id: x.id, nome: x.nome, modelo: false, fluxo: x.fluxo }))));
  }

  function atual() {
    let id = null;
    try { id = armazenamento.getItem(FLUXO_ATUAL_CHAVE); } catch (e) { id = null; }
    const todos = listar();
    return todos.find((x) => x.id === id) || todos[0];
  }

  function marcarAtual(id) {
    try { armazenamento.setItem(FLUXO_ATUAL_CHAVE, id); } catch (e) { /* sem persistência: só não lembra */ }
  }

  function salvar(nome, fluxo) {
    const limpo = String(nome || '').trim();
    if (!limpo) return { ok: false, motivo: 'Dê um nome ao fluxo' };
    const chave = fluxoNomeChave(limpo);
    if (fluxosModelos().some((x) => fluxoNomeChave(x.nome) === chave)) {
      return { ok: false, motivo: 'Esse nome é de um modelo ⭐; escolha outro' };
    }
    const usuario = lerUsuario();
    if (usuario.some((x) => fluxoNomeChave(x.nome) === chave)) return { ok: false, motivo: 'Já existe um fluxo com esse nome' };
    if (usuario.length >= FLUXOS_MAX_USUARIO) return { ok: false, motivo: 'Limite de ' + FLUXOS_MAX_USUARIO + ' fluxos' };
    const id = gerarId();
    usuario.push({ id, nome: limpo, fluxo: fluxoCopia(fluxo) });
    if (!gravarUsuario(usuario)) return { ok: false, motivo: 'Não foi possível salvar neste navegador' };
    return { ok: true, id };
  }

  function apagar(id) {
    if (fluxosModelos().some((x) => x.id === id)) return { ok: false, motivo: 'Modelos ⭐ não podem ser apagados' };
    const usuario = lerUsuario();
    const resto = usuario.filter((x) => x.id !== id);
    if (resto.length === usuario.length) return { ok: false, motivo: 'Fluxo não encontrado' };
    if (!gravarUsuario(resto)) return { ok: false, motivo: 'Não foi possível apagar neste navegador' };
    return { ok: true };
  }

  function novoVazio() {
    return fluxoBase(null, []);
  }

  return { listar, atual, salvar, apagar, marcarAtual, novoVazio };
}
