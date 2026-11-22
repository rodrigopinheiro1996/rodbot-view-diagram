/* Campos obrigatórios dos passos (função pura, sem DOM). Spec §4.
 * Campo vazio (ou só com espaços) ⇒ campo em vermelho e Iniciar bloqueado. Nada é pulado em silêncio.
 *
 * validarCampos(passo) → [{ campo }]   (campo ∈ 'mensagem' | 'tag' | 'pasta' | 'atendente')
 * podeIniciar(fluxo)   → boolean       (precisa de validar-fluxo.js carregado antes)
 */

function campoVazio(valor) {
  return typeof valor !== 'string' || valor.trim() === '';
}

function validarCampos(passo) {
  const faltando = [];
  if (passo.tipo === 'enviar') {
    if (campoVazio(passo.mensagem)) faltando.push({ campo: 'mensagem' });
    if (passo.modo === 'finalizar' && campoVazio(passo.tag)) faltando.push({ campo: 'tag' });
  } else if (passo.tipo === 'mover') {
    if (campoVazio(passo.pasta)) faltando.push({ campo: 'pasta' });
  } else if (passo.tipo === 'transferir') {
    if (campoVazio(passo.atendente)) faltando.push({ campo: 'atendente' });
  }
  return faltando;
}

// Iniciar só libera com a ordem válida (inclui "Para quem?" e 1 a 8 passos) E todos os campos preenchidos.
function podeIniciar(fluxo) {
  if (!validarFluxo(fluxo).ok) return false;
  return fluxo.passos.every((passo) => validarCampos(passo).length === 0);
}
