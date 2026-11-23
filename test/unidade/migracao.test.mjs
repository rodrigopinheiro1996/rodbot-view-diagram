// Tarefa 14: migração na 1ª abertura. Só a mensagem do Auto migra (fato do código: Piloto/Envio/Pastas não gravam
// mensagem nem pasta). Spec §9.
import test from 'node:test';
import assert from 'node:assert/strict';
import { carregarPuro } from '../util/carregar-puro.mjs';

const m = carregarPuro('velocidade.js', 'validar-fluxo.js', 'validar-campos.js', 'fluxos-salvos.js', 'migracao.js');
const plano = (x) => JSON.parse(JSON.stringify(x));

// armazenamento que registra o que foi lido e gravado
function memoria(inicial = {}) {
  const dados = { ...inicial };
  const lidas = new Set();
  const gravadas = new Set();
  return {
    dados, lidas, gravadas,
    getItem: (k) => { lidas.add(k); return k in dados ? dados[k] : null; },
    setItem: (k, v) => { gravadas.add(k); dados[k] = String(v); },
    removeItem: (k) => { throw new Error('não pode apagar chave: ' + k); },
  };
}
const ANTIGAS = {
  rf_rodbot_auto_msg_v1: 'Olá, mensagem antiga do Auto',
  rf_rodbot_tab_v1: 'fila',
  rf_rodbot_recent_folders_v1: '["nv2","Retorno"]',
  rf_widget_theme_v1: 'verde',
  rf_rodbot_auto_count_v1: '7',
  rf_rodbot_auto_tickets_v1: '{"123":{"contado":true}}',
};
const modelos = (arm) => {
  const lista = plano(m.criarFluxosSalvos(arm, { mensagemAuto: m.mensagemAutoMigrada(arm) }).listar());
  return { piloto: lista[0], auto: lista[1] };
};

test('a mensagem do Auto vai para o Enviar do ⭐ Auto clássico', () => {
  const arm = memoria(ANTIGAS);
  m.migrarPrimeiraAbertura(arm);
  const { auto, piloto } = modelos(arm);
  assert.equal(auto.fluxo.passos[0].mensagem, 'Olá, mensagem antiga do Auto');
  assert.equal(piloto.fluxo.passos[1].mensagem, '', 'o Piloto clássico abre sempre vazio');
});

test('sem mensagem do Auto salva (ou só com espaços): os dois modelos abrem vazios', () => {
  for (const msg of [undefined, '   ']) {
    const arm = memoria(msg === undefined ? {} : { rf_rodbot_auto_msg_v1: msg });
    m.migrarPrimeiraAbertura(arm);
    const { auto, piloto } = modelos(arm);
    assert.equal(auto.fluxo.passos[0].mensagem, '');
    assert.equal(piloto.fluxo.passos[1].mensagem, '');
  }
});

test('nunca preenche MENSAGEM_PADRAO sozinho', () => {
  const arm = memoria({});
  m.migrarPrimeiraAbertura(arm);
  const texto = JSON.stringify(arm.dados) + JSON.stringify(modelos(arm));
  assert.doesNotMatch(texto, /Realizamos uma nova atualização/);
});

test('só lê as chaves da migração (nada de mensagem/pasta do Piloto, Envio ou Pastas)', () => {
  const arm = memoria(ANTIGAS);
  m.migrarPrimeiraAbertura(arm);
  m.abaInicial(arm);
  const permitidas = ['rf_rodbot_auto_msg_v1', 'rf_rodbot_migracao_v1', 'rf_rodbot_tab_v1'];
  assert.deepEqual([...arm.lidas].filter((k) => !permitidas.includes(k)), []);
});

test('só grava a marca da migração; nenhuma chave antiga é apagada nem alterada', () => {
  const arm = memoria(ANTIGAS);
  m.migrarPrimeiraAbertura(arm);
  assert.deepEqual([...arm.gravadas], ['rf_rodbot_migracao_v1']);
  for (const [k, v] of Object.entries(ANTIGAS)) assert.equal(arm.dados[k], v, k);
});

test('roda uma vez só: a 2ª abertura não sobrescreve (mesmo se a mensagem antiga mudar)', () => {
  const arm = memoria(ANTIGAS);
  assert.equal(m.migrarPrimeiraAbertura(arm).jaMigrado, false);
  arm.dados.rf_rodbot_auto_msg_v1 = 'mudou depois';
  assert.equal(m.migrarPrimeiraAbertura(arm).jaMigrado, true);
  assert.equal(modelos(arm).auto.fluxo.passos[0].mensagem, 'Olá, mensagem antiga do Auto');
});

test('as pastas recentes continuam alimentando os chips do Mover (a chave antiga fica intacta)', () => {
  const arm = memoria(ANTIGAS);
  m.migrarPrimeiraAbertura(arm);
  assert.equal(arm.dados.rf_rodbot_recent_folders_v1, '["nv2","Retorno"]');
});

test('aba: qualquer aba antiga, "acompanhar" ou valor desconhecido abre em Montar', () => {
  for (const aba of ['pasta', 'mensagem', 'fila', 'auto', 'piloto', 'acompanhar', 'xyz', undefined]) {
    const arm = memoria(aba === undefined ? {} : { rf_rodbot_tab_v1: aba });
    assert.equal(m.abaInicial(arm), 'montar', String(aba));
  }
});

test('armazenamento bloqueado ou marca corrompida: não quebra e os modelos abrem vazios', () => {
  const quebrado = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('cheio'); } };
  assert.doesNotThrow(() => m.migrarPrimeiraAbertura(quebrado));
  assert.equal(m.mensagemAutoMigrada(quebrado), '');
  assert.equal(m.abaInicial(quebrado), 'montar');
  const corrompido = memoria({ rf_rodbot_migracao_v1: '{x' });
  assert.equal(m.mensagemAutoMigrada(corrompido), '');
});
