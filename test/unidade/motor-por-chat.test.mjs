// Tarefa 10: motor 🆕 Que vão cair e 👥 Ambos (puro), com observador, memória de 24 h e relógio falsos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { carregarPuro } from '../util/carregar-puro.mjs';

const carregar = () => carregarPuro('velocidade.js', 'validar-fluxo.js', 'validar-campos.js', 'motor.js');
const m = carregar();

// Blip de mentira: tela, chegadas (cada leitura de novosChats devolve o próximo lote) e memória de 24 h.
function criarBlip({ naTela = [], pausados = [], chegadas = [], fila = 0, memoria24h = new Set() } = {}) {
  const b = {
    tela: naTela.map((id) => ({ id, pausado: pausados.includes(id) })),
    chegadas: chegadas.map((l) => [...l]),
    fila,
    chamadas: [],
    velocidades: [],
    falhas: {},
    memoria24h,
    ocioso: false,
    puxados: [],
  };
  const reg = (...c) => b.chamadas.push(c);
  const item = (acao, id) => (b.falhas[`${acao}:${id}`] ? { ok: false, motivo: b.falhas[`${acao}:${id}`] } : null);
  b.acoes = {
    definirVelocidade: (v) => b.velocidades.push(v),
    contar: () => ({ fila: b.fila, naTela: b.tela.length, pausados: null }),
    filaAtual: () => b.fila,
    atender: async () => {
      reg('atender');
      const n = b.fila;
      for (let i = 0; i < n; i++) {
        const id = 'P' + (b.puxados.length + 1);
        b.puxados.push(id);
        b.tela.unshift({ id, pausado: false });
        b.chegadas.push([id]); // o observador vê o puxado como um chat que caiu
      }
      b.fila = 0;
      return { atendidos: n };
    },
    listarTickets: () => b.tela.map((t) => ({ ...t })),
    novosChats: () => (b.chegadas.length ? b.chegadas.shift() : []),
    entreChats: async () => reg('entreChats'),
    enviar: async (id, op) => {
      if (b.falhas[`geral:${id}`]) throw m.ErroGeral(b.falhas[`geral:${id}`]);
      reg('enviar', id, op.modo, op.abrirProximo);
      return item('enviar', id) || { ok: true };
    },
    pausar: async (id) => { reg('pausar', id); return item('pausar', id) || { ok: true }; },
    despausar: async (id) => { reg('despausar', id); return { ok: true }; },
    mover: async (id, pasta) => { reg('mover', id, pasta); return { ok: true }; },
    transferir: async (id, nome, para) => { reg('transferir', id, nome, para); return { ok: true }; },
    memoria24h: { tem: (id) => b.memoria24h.has(id), gravar: (id) => b.memoria24h.add(id) },
  };
  return b;
}

// Para quando o motor fica ocioso (fila de chats vazia) e não há mais chegadas.
function criarDeps(blip, extra = {}) {
  const log = [];
  const deps = {
    acoes: blip.acoes,
    relogio: {
      esperar: async () => {
        if (!blip.chegadas.length && blip.fila === 0) blip.ocioso = true;
        await new Promise((r) => setImmediate(r));
      },
    },
    eventos: { log: (t) => log.push(t), passo: () => {}, ciclo: () => {} },
    controle: { parado: () => blip.ocioso, aguardar: async () => !blip.ocioso },
    ...extra,
  };
  return { deps, log };
}

const E = { tipo: 'enviar', modo: 'so', mensagem: 'Olá' };
const EF = { tipo: 'enviar', modo: 'finalizar', mensagem: 'Tchau', tag: 'Resolvido' };
const P = { tipo: 'espera', modo: 'pausar' };
const M = { tipo: 'mover', pasta: 'nv2' };
const fluxo = (paraQuem, passos, extra = {}) =>
  ({ paraQuem, passos, loopEscolha: true, pausaCiclos: 1, velocidade: 1, puxarFila: false, ...extra });
const semEntre = (b) => b.chamadas.filter((c) => c[0] !== 'entreChats');

test('🆕 [E,P]: cada chat novo recebe enviar → pausar, um chat por vez, nunca intercalados', async () => {
  const blip = criarBlip({ chegadas: [['101', '102']] });
  const r = await m.executarFluxo(fluxo('caindo', [E, P]), criarDeps(blip).deps);
  assert.equal(r.status, 'parado');
  assert.deepEqual(semEntre(blip), [
    ['enviar', '101', 'so', false], ['pausar', '101'],
    ['enviar', '102', 'so', false], ['pausar', '102'],
  ]);
});

test('🆕 [Transferir para fila]: cada chat novo vai para a fila do passo', async () => {
  const blip = criarBlip({ chegadas: [['101']] });
  const TF = { tipo: 'transferir', para: 'fila', fila: 'Nível 2', atendente: '' };
  await m.executarFluxo(fluxo('caindo', [TF]), criarDeps(blip).deps);
  assert.deepEqual(semEntre(blip), [['transferir', '101', 'Nível 2', 'fila']]);
});

test('🆕: envio não confirmado → não pausa, falha de item, segue para o próximo', async () => {
  const blip = criarBlip({ chegadas: [['101', '102']] });
  blip.falhas['enviar:101'] = 'envio não confirmado';
  const { deps, log } = criarDeps(blip);
  const r = await m.executarFluxo(fluxo('caindo', [E, P]), deps);
  assert.deepEqual(semEntre(blip).map((c) => c.slice(0, 2).join(':')), ['enviar:101', 'enviar:102', 'pausar:102']);
  assert.equal(r.totais.falhas, 1);
  assert.ok(log.some((l) => l.includes('#101') && l.includes('envio não confirmado')), log.join('\n'));
});

test('🆕 usa a memória de 24 h: id que reaparece é ignorado, mesmo numa nova execução', async () => {
  const memoria = new Set();
  const b1 = criarBlip({ chegadas: [['101'], ['101']], memoria24h: memoria });
  await m.executarFluxo(fluxo('caindo', [E]), criarDeps(b1).deps);
  assert.deepEqual(semEntre(b1).map((c) => c[1]), ['101']);
  assert.ok(memoria.has('101'), 'o id é gravado na memória de 24 h');
  const b2 = criarBlip({ chegadas: [['101', '105']], memoria24h: memoria });
  await m.executarFluxo(fluxo('caindo', [E]), criarDeps(b2).deps);
  assert.deepEqual(semEntre(b2).map((c) => c[1]), ['105']);
});

test('🆕: chats presentes antes de ativar são ignorados', async () => {
  const blip = criarBlip({ naTela: ['1', '2'], chegadas: [['1', '103', '2']] });
  await m.executarFluxo(fluxo('caindo', [E]), criarDeps(blip).deps);
  assert.deepEqual(semEntre(blip).map((c) => c[1]), ['103']);
});

test('👥 [E,P]: roda uma vez nos que aguardam (sem loop) e depois vigia os que caem', async () => {
  const blip = criarBlip({ naTela: ['1', '2'], chegadas: [[], ['104', '1']] });
  const { deps, log } = criarDeps(blip);
  await m.executarFluxo(fluxo('ambos', [E, P]), deps);
  assert.deepEqual(semEntre(blip).map((c) => c.slice(0, 2).join(':')), [
    'enviar:1', 'enviar:2', 'pausar:1', 'pausar:2', // lote, uma vez
    'enviar:104', 'pausar:104', // vigia
  ]);
  assert.ok(semEntre(blip).filter((c) => c[0] === 'enviar').every((c) => c[3] === false), 'Finalizar não abre o próximo');
  assert.ok(log.some((l) => l.startsWith('Lote:')), log.join('\n'));
});

test('👥: ticket de execução anterior (24 h) ainda na tela é tratado de novo, com aviso no log', async () => {
  const blip = criarBlip({ naTela: ['1'], memoria24h: new Set(['1']) });
  const { deps, log } = criarDeps(blip);
  await m.executarFluxo(fluxo('ambos', [E]), deps);
  assert.deepEqual(semEntre(blip).map((c) => c[1]), ['1']);
  assert.equal(log.filter((l) => l.includes('#1 tratado de novo (execução anterior)')).length, 1);
});

test('👥: na vigia, a memória de 24 h vale', async () => {
  const blip = criarBlip({ chegadas: [['200']], memoria24h: new Set(['200']) });
  await m.executarFluxo(fluxo('ambos', [E]), criarDeps(blip).deps);
  assert.deepEqual(semEntre(blip), []);
});

test('"Também puxar a fila" ligada: o motor clica em Atender e os puxados recebem o fluxo uma vez', async () => {
  const blip = criarBlip({ fila: 2 });
  await m.executarFluxo(fluxo('caindo', [E, P], { puxarFila: true }), criarDeps(blip).deps);
  assert.equal(semEntre(blip).filter((c) => c[0] === 'atender').length, 1);
  assert.deepEqual(semEntre(blip).filter((c) => c[0] === 'enviar').map((c) => c[1]).sort(), ['P1', 'P2']);
});

test('"Também puxar a fila" desligada: nunca clica em Atender', async () => {
  const blip = criarBlip({ fila: 2, chegadas: [['101']] });
  blip.acoes.filaAtual = () => 2;
  const deps = criarDeps(blip).deps;
  deps.relogio.esperar = async () => { blip.ocioso = !blip.chegadas.length; };
  await m.executarFluxo(fluxo('caindo', [E], { puxarFila: false }), deps);
  assert.ok(!blip.chamadas.some((c) => c[0] === 'atender'));
});

test('🆕 [EF]: finaliza só o chat atual (abrirProximo false)', async () => {
  const blip = criarBlip({ chegadas: [['101']] });
  await m.executarFluxo(fluxo('caindo', [EF]), criarDeps(blip).deps);
  assert.deepEqual(semEntre(blip), [['enviar', '101', 'finalizar', false]]);
});

test('velocidade: pausa entre chats (AUTO_T.entreTickets) a cada chat; velocidade definida por passo', async () => {
  const blip = criarBlip({ chegadas: [['101', '102']] });
  await m.executarFluxo(fluxo('caindo', [{ ...E, velocidade: 2 }, P], { velocidade: 0.5 }), criarDeps(blip).deps);
  assert.equal(blip.chamadas.filter((c) => c[0] === 'entreChats').length, 2);
  assert.deepEqual(blip.velocidades, [2, 0.5, 2, 0.5]);
});

test('falha geral no meio de um chat para o fluxo', async () => {
  const blip = criarBlip({ chegadas: [['101', '102']] });
  blip.falhas['geral:101'] = 'campo de texto não encontrado';
  const r = await m.executarFluxo(fluxo('caindo', [E, P]), criarDeps(blip).deps);
  assert.equal(r.status, 'falha');
  assert.equal(r.motivo, 'campo de texto não encontrado');
  assert.deepEqual(semEntre(blip), []);
});

test('o id é gravado na memória de 24 h ANTES do envio (nunca envia duas vezes, mesmo se algo cair no meio)', async () => {
  const blip = criarBlip({ chegadas: [['101']] });
  let gravadoAntes = false;
  const enviar = blip.acoes.enviar;
  blip.acoes.enviar = async (id, op) => { gravadoAntes = blip.memoria24h.has(id); return enviar(id, op); };
  await m.executarFluxo(fluxo('caindo', [E]), criarDeps(blip).deps);
  assert.ok(gravadoAntes);
});

test('um fluxo por vez: iniciar outro enquanto um roda é recusado', async () => {
  const m2 = carregar();
  const blip = criarBlip({ chegadas: [['101']] });
  let soltar;
  const segura = new Promise((r) => { soltar = r; });
  const deps = criarDeps(blip).deps;
  deps.relogio.esperar = async () => { await segura; blip.ocioso = true; };
  const primeiro = m2.executarFluxo(fluxo('caindo', [E]), deps);
  await new Promise((r) => setImmediate(r));
  const outro = await m2.executarFluxo(fluxo('aguardando', [E]), criarDeps(criarBlip()).deps);
  assert.deepEqual([outro.status, outro.motivo], ['recusado', 'Já há um fluxo rodando']);
  soltar();
  assert.equal((await primeiro).status, 'parado');
  const depois = await m2.executarFluxo(fluxo('aguardando', [E]), criarDeps(criarBlip({ naTela: ['9'] })).deps);
  assert.equal(depois.status, 'concluido', 'terminado o primeiro, libera');
});

test('Parar no meio de um chat: os passos seguintes desse chat não rodam', async () => {
  const blip = criarBlip({ chegadas: [['101']] });
  const deps = criarDeps(blip).deps;
  deps.eventos.passo = (i, s) => { if (i === 1 && s === 'feito') blip.ocioso = true; };
  const r = await m.executarFluxo(fluxo('caindo', [E, P]), deps);
  assert.equal(r.status, 'parado');
  assert.deepEqual(semEntre(blip).map((c) => c[0]), ['enviar']);
});

test('🆕: passo "pulado" encerra aquele chat sem falha e sem os passos seguintes', async () => {
  const blip = criarBlip({ chegadas: [['101']] });
  blip.acoes.enviar = async () => ({ ok: true, pulado: true, nota: 'em espera: não recebe mensagem' });
  const r = await m.executarFluxo(fluxo('caindo', [E, P]), criarDeps(blip).deps);
  assert.equal(r.totais.falhas, 0);
  assert.equal(r.totais.enviados, 0);
  assert.ok(!blip.chamadas.some((c) => c[0] === 'pausar'));
});

test('🆕: "semEfeito" (já estava em espera) não conta e o chat segue para o próximo passo', async () => {
  const blip = criarBlip({ chegadas: [['101']] });
  blip.acoes.pausar = async () => ({ ok: true, semEfeito: true, nota: 'já estava em espera' });
  const r = await m.executarFluxo(fluxo('caindo', [E, P, M]), criarDeps(blip).deps);
  assert.equal(r.totais.pausados, 0);
  assert.deepEqual(semEntre(blip).map((c) => c[0]), ['enviar', 'mover']);
});
