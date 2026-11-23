// Tarefa 13: modelos fixos e até 10 fluxos do usuário no localStorage (armazenamento injetado). Spec §9.
import test from 'node:test';
import assert from 'node:assert/strict';
import { carregarPuro } from '../util/carregar-puro.mjs';

const m = carregarPuro('velocidade.js', 'validar-fluxo.js', 'validar-campos.js', 'fluxos-salvos.js');
const plano = (x) => JSON.parse(JSON.stringify(x));

function memoria(inicial = {}) {
  const dados = { ...inicial };
  return {
    dados,
    getItem: (k) => (k in dados ? dados[k] : null),
    setItem: (k, v) => { dados[k] = String(v); },
  };
}
let seq = 0;
const abrir = (arm) => m.criarFluxosSalvos(arm, { gerarId: () => 'u' + ++seq });
const E = (mensagem = 'Olá') => ({ tipo: 'enviar', modo: 'so', mensagem });
const meuFluxo = (extra = {}) => ({
  paraQuem: 'aguardando', loopEscolha: true, pausaCiclos: 2, velocidade: 1.5, puxarFila: false,
  passos: [{ tipo: 'atender' }, { ...E('Oi'), velocidade: 2 }, { tipo: 'mover', pasta: 'nv2' }], ...extra,
});

test('armazenamento vazio: só os dois modelos ⭐; o atual é o Piloto clássico', () => {
  const f = abrir(memoria());
  assert.deepEqual(plano(f.listar()).map((x) => [x.nome, x.modelo]), [['⭐ Piloto clássico', true], ['⭐ Auto clássico', true]]);
  assert.equal(f.atual().nome, '⭐ Piloto clássico');
});

test('Piloto clássico e Auto clássico como na spec, com a mensagem VAZIA (nunca preenche sozinho)', () => {
  const f = abrir(memoria());
  const [piloto, auto] = plano(f.listar());
  assert.deepEqual(piloto.fluxo, {
    paraQuem: 'aguardando', loopEscolha: true, pausaCiclos: 1, velocidade: 1, puxarFila: false,
    passos: [
      { tipo: 'atender', velocidade: null },
      { tipo: 'enviar', modo: 'so', mensagem: '', tag: '', velocidade: null },
      { tipo: 'espera', modo: 'pausar', velocidade: null },
      { tipo: 'mover', pasta: '', velocidade: null },
    ],
  });
  assert.deepEqual(auto.fluxo.paraQuem, 'caindo');
  assert.deepEqual(auto.fluxo.passos.map((p) => p.tipo + ':' + (p.modo || '')), ['enviar:so', 'espera:pausar']);
  assert.equal(auto.fluxo.passos[0].mensagem, '');
  assert.equal(m.validarFluxo(piloto.fluxo).ok, true, 'a ordem é válida');
  assert.equal(m.podeIniciar(piloto.fluxo), false, 'mas o Iniciar fica bloqueado pela mensagem vazia');
});

test('salvar cria um fluxo novo com nome e ele volta igual ao reabrir', () => {
  const arm = memoria();
  const r = abrir(arm).salvar('Meu fluxo', meuFluxo());
  assert.equal(r.ok, true);
  const f2 = abrir(arm);
  const salvo = plano(f2.listar()).find((x) => x.nome === 'Meu fluxo');
  assert.equal(salvo.modelo, false);
  assert.deepEqual(salvo.fluxo, meuFluxo());
});

test('a escolha do loop é guardada como o usuário deixou (mesmo sem Atender em 1º)', () => {
  const arm = memoria();
  abrir(arm).salvar('Sem loop', meuFluxo({ loopEscolha: false }));
  abrir(arm).salvar('Loop sem Atender', meuFluxo({ loopEscolha: true, passos: [E('x')] }));
  const lista = plano(abrir(arm).listar());
  assert.equal(lista.find((x) => x.nome === 'Sem loop').fluxo.loopEscolha, false);
  const semAtender = lista.find((x) => x.nome === 'Loop sem Atender').fluxo;
  assert.equal(semAtender.loopEscolha, true, 'a escolha não se perde');
  assert.equal(m.loopEfetivo(semAtender).efetivo, false, 'mas o loop efetivo fica desligado');
  const comAtender = { ...semAtender, passos: [{ tipo: 'atender' }, ...semAtender.passos] };
  assert.equal(m.loopEfetivo(comAtender).efetivo, true, 'voltando o Atender em 1º, volta o que o usuário escolheu');
});

test('limite de 10 fluxos do usuário (os 2 modelos não contam)', () => {
  const f = abrir(memoria());
  for (let i = 1; i <= 10; i++) assert.equal(f.salvar('F' + i, meuFluxo()).ok, true);
  assert.equal(plano(f.listar()).length, 12);
  assert.deepEqual(plano(f.salvar('F11', meuFluxo())), { ok: false, motivo: 'Limite de 10 fluxos' });
});

test('modelos não são apagados nem sobrescritos; nomes não se repetem', () => {
  const f = abrir(memoria());
  const [piloto] = plano(f.listar());
  assert.equal(f.apagar(piloto.id).ok, false);
  assert.equal(f.salvar('⭐ Piloto clássico', meuFluxo()).ok, false);
  assert.equal(f.salvar('Piloto clássico', meuFluxo()).ok, false, 'sem a estrela também é nome de modelo');
  assert.equal(f.salvar('Meu', meuFluxo()).ok, true);
  assert.deepEqual(plano(f.salvar('meu ', meuFluxo())), { ok: false, motivo: 'Já existe um fluxo com esse nome' });
  assert.equal(f.salvar('   ', meuFluxo()).ok, false, 'nome vazio');
});

test('editar um modelo só vale em memória: ao reabrir, volta ao original', () => {
  const arm = memoria();
  const f = abrir(arm);
  const piloto = f.listar()[0];
  piloto.fluxo.passos[1].mensagem = 'mudei';
  piloto.fluxo.passos.pop();
  assert.equal(abrir(arm).listar()[0].fluxo.passos.length, 4);
  assert.equal(f.listar()[0].fluxo.passos[1].mensagem, '', 'nem na mesma instância o original muda');
});

test('apagar um fluxo do usuário', () => {
  const arm = memoria();
  const f = abrir(arm);
  const { id } = f.salvar('Temporário', meuFluxo());
  assert.equal(f.apagar(id).ok, true);
  assert.ok(!plano(abrir(arm).listar()).some((x) => x.nome === 'Temporário'));
});

test('o último usado abre carregado; id que não existe mais cai no Piloto clássico', () => {
  const arm = memoria();
  const f = abrir(arm);
  const { id } = f.salvar('Meu', meuFluxo());
  f.marcarAtual(id);
  assert.equal(abrir(arm).atual().nome, 'Meu');
  f.apagar(id);
  assert.equal(abrir(arm).atual().nome, '⭐ Piloto clássico');
  f.marcarAtual(plano(f.listar())[1].id);
  assert.equal(abrir(arm).atual().nome, '⭐ Auto clássico');
});

test('"+" cria um fluxo vazio e sem "Para quem?"', () => {
  assert.deepEqual(plano(abrir(memoria()).novoVazio()), {
    paraQuem: null, loopEscolha: true, pausaCiclos: 1, velocidade: 1, puxarFila: false, passos: [],
  });
});

test('temAlteracoes compara o fluxo editado com o salvo (para o "Salvar como novo / Descartar")', () => {
  const f = abrir(memoria());
  const original = f.listar()[0].fluxo;
  const editado = JSON.parse(JSON.stringify(original));
  assert.equal(m.temAlteracoes(editado, original), false);
  editado.passos[1].mensagem = 'Olá';
  assert.equal(m.temAlteracoes(editado, original), true);
});

test('JSON corrompido ou armazenamento que lança erro: volta aos modelos sem quebrar', () => {
  const corrompido = memoria({ rf_rodbot_fluxos_v1: '{nao é json', rf_rodbot_fluxo_atual_v1: 'u9' });
  assert.equal(plano(abrir(corrompido).listar()).length, 2);
  assert.equal(abrir(corrompido).atual().nome, '⭐ Piloto clássico');
  const quebrado = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('cheio'); } };
  const f = abrir(quebrado);
  assert.equal(plano(f.listar()).length, 2);
  assert.deepEqual(plano(f.salvar('X', meuFluxo())), { ok: false, motivo: 'Não foi possível salvar neste navegador' });
});
