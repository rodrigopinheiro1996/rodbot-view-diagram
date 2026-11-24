// Tarefa 9: motor ⏳ Aguardando como função pura, com ações, relógio e controle falsos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { carregarPuro } from '../util/carregar-puro.mjs';

const m = carregarPuro('velocidade.js', 'validar-fluxo.js', 'validar-campos.js', 'motor.js');

// ── Blip de mentira: tickets na tela, fila e registro de chamadas
// visiveis: como o Blip real, a lista só mostra os N primeiros tickets (os seguintes aparecem quando uns saem).
function criarBlip({ naTela = ['1', '2', '3'], pausados = [], fila = [0], semNumero = 0, visiveis = Infinity } = {}) {
  let prox = 100;
  const b = {
    tela: naTela.map((id) => ({ id, pausado: pausados.includes(id) })),
    filas: [...fila], // leituras sucessivas de filaAtual(); a última se repete
    chamadas: [],
    velocidades: [],
    falhas: {}, // { 'enviar:2': 'motivo' } → falha de item; { atender: 'motivo' } → falha geral
  };
  const cardsSemNumero = () => Array.from({ length: semNumero }, () => ({ id: null, pausado: null }));
  const registrar = (nome, ...args) => b.chamadas.push([nome, ...args]);
  const falhaItem = (acao, id) => b.falhas[`${acao}:${id}`];
  b.acoes = {
    definirVelocidade: (v) => b.velocidades.push(v),
    contar: () => ({ fila: b.filas[0], naTela: b.tela.length, pausados: b.tela.filter((t) => t.pausado).length }),
    filaAtual: () => (b.filas.length > 1 ? b.filas.shift() : b.filas[0]),
    atender: async () => {
      registrar('atender');
      if (b.falhas.atender) throw m.ErroGeral(b.falhas.atender);
      const n = b.filas[0] || 0;
      for (let i = 0; i < n; i++) b.tela.unshift({ id: String(prox++), pausado: false });
      b.filas[0] = 0;
      return { atendidos: n };
    },
    listarTickets: () => [...b.tela.slice(0, visiveis).map((t) => ({ ...t })), ...cardsSemNumero()],
    enviar: async (id, op) => {
      registrar('enviar', id, op.mensagem, op.modo, op.abrirProximo);
      if (falhaItem('enviar', id)) return { ok: false, motivo: falhaItem('enviar', id) };
      if (op.modo === 'finalizar') b.tela = b.tela.filter((t) => t.id !== id);
      return { ok: true };
    },
    pausar: async (id) => {
      registrar('pausar', id);
      const t = b.tela.find((x) => x.id === id);
      if (t.pausado) return { ok: true, nota: 'já estava em espera' };
      t.pausado = true;
      return { ok: true };
    },
    despausar: async (id) => {
      registrar('despausar', id);
      b.tela.find((x) => x.id === id).pausado = false;
      return { ok: true };
    },
    mover: async (id, pasta) => {
      registrar('mover', id, pasta);
      b.tela = b.tela.filter((t) => t.id !== id);
      return { ok: true };
    },
    transferir: async (id, nome, para) => {
      registrar('transferir', id, nome, para);
      b.tela = b.tela.filter((t) => t.id !== id);
      return { ok: true };
    },
  };
  return b;
}

function criarDeps(blip, { pararApos, pausarApos } = {}) {
  const log = [];
  const passos = [];
  const esperas = [];
  let parado = false;
  let pausado = false;
  const deps = {
    acoes: blip.acoes,
    relogio: { esperar: async (ms) => { esperas.push(ms); } },
    eventos: {
      log: (t) => log.push(t),
      passo: (indice, status, detalhe) => {
        passos.push([indice, status, detalhe]);
        if (pararApos && pararApos(indice, status)) parado = true;
        if (pausarApos && pausarApos(indice, status)) pausado = true;
      },
      ciclo: () => {},
    },
    controle: {
      parado: () => parado,
      aguardar: async () => {
        while (pausado && !parado) { pausado = false; deps.retomadas = (deps.retomadas || 0) + 1; }
        return !parado;
      },
    },
  };
  return { deps, log, passos, esperas };
}

const A = { tipo: 'atender' };
const E = (mensagem = 'Olá') => ({ tipo: 'enviar', modo: 'so', mensagem });
const EF = { tipo: 'enviar', modo: 'finalizar', mensagem: 'Tchau', tag: 'Resolvido' };
const P = { tipo: 'espera', modo: 'pausar' };
const D = { tipo: 'espera', modo: 'despausar' };
const M = (pasta = 'nv2') => ({ tipo: 'mover', pasta });
const T = { tipo: 'transferir', atendente: 'Atendente Fictício' };
const fluxo = (passos, extra = {}) =>
  ({ paraQuem: 'aguardando', passos, loopEscolha: false, pausaCiclos: 1, velocidade: 1, ...extra });
const nomes = (blip) => blip.chamadas.map((c) => c[0]);

test('[A,E,P,M] sem loop: atende, envia, pausa e move cada ticket, nessa ordem de passos', async () => {
  const blip = criarBlip({ naTela: ['1', '2'], fila: [1] });
  const { deps, log } = criarDeps(blip);
  const r = await m.executarFluxo(fluxo([A, E(), P, M()]), deps);
  assert.equal(r.status, 'concluido');
  assert.equal(r.ciclos, 1);
  assert.deepEqual(nomes(blip), ['atender', 'enviar', 'enviar', 'enviar', 'pausar', 'pausar', 'pausar', 'mover', 'mover', 'mover']);
  assert.deepEqual(blip.chamadas.filter((c) => c[0] === 'mover').map((c) => c[2]), ['nv2', 'nv2', 'nv2']);
  assert.ok(log.includes('Ciclo #1: 1 atendidos · 3 enviados · 3 pausados · 3 movidos · 0 falhas'), log.join('\n'));
});

test('log antes de iniciar: "Fila: N · Na tela: N · Pausados: N"', async () => {
  const blip = criarBlip({ naTela: ['1', '2', '3'], pausados: ['3'], fila: [12] });
  const { deps, log } = criarDeps(blip);
  await m.executarFluxo(fluxo([D]), deps);
  assert.equal(log[0], 'Fila: 12 · Na tela: 3 · Pausados: 1');
});

test('log antes de iniciar: pausados desconhecido vira "?"', async () => {
  const blip = criarBlip();
  blip.acoes.contar = () => ({ fila: 0, naTela: 3, pausados: null });
  const { deps, log } = criarDeps(blip);
  await m.executarFluxo(fluxo([E()]), deps);
  assert.equal(log[0], 'Fila: 0 · Na tela: 3 · Pausados: ?');
});

test('loop efetivo: fila [3,0,0,2] → 1º ciclo; fila 0 ⇒ sentinela vigia até 2 e roda o 2º ciclo', async () => {
  const blip = criarBlip({ naTela: [], fila: [3, 3, 0, 0, 2, 2] });
  let ciclos = 0;
  const { deps, log, esperas } = criarDeps(blip);
  deps.eventos.ciclo = (n) => { ciclos = n; };
  deps.controle.parado = () => ciclos >= 3; // para no início do 3º ciclo
  const r = await m.executarFluxo(fluxo([A, E(), M()], { loopEscolha: true }), deps);
  assert.equal(r.status, 'parado');
  assert.equal(nomes(blip).filter((n) => n === 'atender').length, 2);
  assert.ok(log.some((l) => l.includes('Sentinela')), log.join('\n'));
  assert.ok(esperas.includes(1500), 'sentinela lê a fila a cada 1,5 s');
});

test('loop escolhido sem Atender em 1º não repete (loop efetivo desligado)', async () => {
  const blip = criarBlip({ fila: [5] });
  const { deps } = criarDeps(blip);
  const r = await m.executarFluxo(fluxo([E(), P], { loopEscolha: true }), deps);
  assert.equal(r.ciclos, 1);
  assert.equal(r.status, 'concluido');
});

test('pausa entre ciclos é a do usuário e não muda com a velocidade', async () => {
  for (const velocidade of [0.5, 1, 2]) {
    const blip = criarBlip({ naTela: [], fila: [1, 1, 1, 1] });
    let ciclos = 0;
    const { deps, esperas } = criarDeps(blip);
    deps.eventos.ciclo = (n) => { ciclos = n; };
    deps.controle.parado = () => ciclos >= 2 && blip.chamadas.length >= 3;
    await m.executarFluxo(fluxo([A, E(), M()], { loopEscolha: true, pausaCiclos: 1, velocidade }), deps);
    assert.ok(esperas.includes(1000), `velocidade ${velocidade}: ${esperas}`);
  }
});

test('regra 9 no motor: [A,E,P] em loop não envia nem pausa de novo quem já foi tratado', async () => {
  const blip = criarBlip({ naTela: ['11', '12'], fila: [0, 1, 1] });
  let ciclos = 0;
  const { deps, log } = criarDeps(blip);
  deps.eventos.ciclo = (n) => { ciclos = n; };
  deps.controle.parado = () => ciclos >= 3;
  await m.executarFluxo(fluxo([A, E(), P], { loopEscolha: false }), deps); // 1 ciclo: 11 e 12
  const envios1 = blip.chamadas.filter((c) => c[0] === 'enviar').map((c) => c[1]);
  assert.deepEqual(envios1.sort(), ['11', '12']);
  // agora com loop: um ticket novo no 2º ciclo recebe; 11, 12 e 100 (já enviados e pausados) não.
  // 13 já estava em espera (pausado por outra pessoa): não recebe e o log avisa uma vez.
  const blip2 = criarBlip({ naTela: ['11', '12', '13'], pausados: ['13'], fila: [1] });
  let c2 = 0;
  const d2 = criarDeps(blip2);
  d2.deps.eventos.ciclo = (n) => { c2 = n; if (n === 2) blip2.filas = [1]; };
  d2.deps.controle.parado = () => c2 >= 3;
  await m.executarFluxo(fluxo([A, E(), P], { loopEscolha: true }), d2.deps);
  const envios = blip2.chamadas.filter((c) => c[0] === 'enviar').map((c) => c[1]);
  assert.equal(new Set(envios).size, envios.length, 'ninguém recebe duas mensagens');
  assert.deepEqual(envios.sort(), ['100', '101', '11', '12']);
  const pausas = blip2.chamadas.filter((c) => c[0] === 'pausar').map((c) => c[1]);
  assert.equal(new Set(pausas).size, pausas.length, 'ninguém é pausado duas vezes');
  assert.ok(!pausas.includes('13'));
  assert.equal(d2.log.filter((l) => l.includes('#13 já estava em espera')).length, 1, d2.log.join('\n'));
  assert.ok(!d2.log.some((l) => l.includes('#11 já estava em espera')), 'quem o fluxo pausou não gera aviso no ciclo seguinte');
});

test('Enviar com pausados na tela (estado desconhecido): envia só aos ativos e anota o pulo', async () => {
  const blip = criarBlip({ naTela: ['1', '2'], pausados: ['2'] });
  const { deps, log } = criarDeps(blip);
  await m.executarFluxo(fluxo([E()]), deps);
  assert.deepEqual(blip.chamadas, [['enviar', '1', 'Olá', 'so', true]]);
  assert.ok(log.some((l) => l.includes('#2') && l.includes('em espera')), log.join('\n'));
});

test('Despausar como 1º passo em ⏳: despausa sem Atender', async () => {
  const blip = criarBlip({ naTela: ['1', '2', '3'], pausados: ['1', '3'] });
  const { deps } = criarDeps(blip);
  await m.executarFluxo(fluxo([D, M()]), deps);
  assert.deepEqual(blip.chamadas.filter((c) => c[0] === 'despausar').map((c) => c[1]), ['1', '3']);
  assert.ok(!nomes(blip).includes('atender'));
});

test('memória só da execução: novo Iniciar trata os mesmos tickets de novo', async () => {
  const blip = criarBlip({ naTela: ['7'] });
  await m.executarFluxo(fluxo([E()]), criarDeps(blip).deps);
  await m.executarFluxo(fluxo([E()]), criarDeps(blip).deps);
  assert.deepEqual(blip.chamadas.map((c) => c[1]), ['7', '7']);
});

test('[P,D,P] na mesma execução: o 2º Pausar age de novo (memória por passo, não por tipo)', async () => {
  const blip = criarBlip({ naTela: ['1'] });
  await m.executarFluxo(fluxo([P, D, P]), criarDeps(blip).deps);
  assert.deepEqual(nomes(blip), ['pausar', 'despausar', 'pausar']);
});

test('[E,A,E]: o 2º Enviar só vai para os recém-atendidos', async () => {
  const blip = criarBlip({ naTela: ['1'], fila: [1] });
  await m.executarFluxo(fluxo([E('a'), A, E('b')]), criarDeps(blip).deps);
  const envios = blip.chamadas.filter((c) => c[0] === 'enviar').map((c) => `${c[1]}:${c[2]}`);
  assert.deepEqual(envios, ['1:a', '100:b']);
});

test('card sem número é pulado, nunca recebe envio, e o ciclo avisa', async () => {
  const blip = criarBlip({ naTela: ['1'], semNumero: 2 });
  const { deps, log } = criarDeps(blip);
  const r = await m.executarFluxo(fluxo([E()]), deps);
  assert.equal(r.status, 'concluido');
  assert.deepEqual(blip.chamadas.map((c) => c[1]), ['1']);
  assert.ok(log.includes('⚠️ 2 card(s) sem número, pulado(s)'), log.join('\n'));
});

test('nenhum card com número na tela → falha geral do passo', async () => {
  const blip = criarBlip({ naTela: [], semNumero: 3 });
  const { deps, log, passos } = criarDeps(blip);
  const r = await m.executarFluxo(fluxo([E(), P]), deps);
  assert.equal(r.status, 'falha');
  assert.deepEqual(passos.at(-1).slice(0, 2), [1, 'falha']);
  assert.ok(!nomes(blip).includes('pausar'));
  assert.ok(log.some((l) => l.includes('sem número')), log.join('\n'));
});

test('tela vazia sem cards não é falha: o passo termina sem fazer nada', async () => {
  const blip = criarBlip({ naTela: [] });
  const { deps } = criarDeps(blip);
  const r = await m.executarFluxo(fluxo([E(), P]), deps);
  assert.equal(r.status, 'concluido');
});

test('falha de item: segue para o próximo e conta no resumo', async () => {
  const blip = criarBlip({ naTela: ['1', '2'] });
  blip.falhas['enviar:1'] = 'chat não aceitou texto';
  const { deps, log } = criarDeps(blip);
  const r = await m.executarFluxo(fluxo([E()]), deps);
  assert.equal(r.status, 'concluido');
  assert.deepEqual(blip.chamadas.map((c) => c[1]), ['1', '2']);
  assert.ok(log.some((l) => l.includes('#1') && l.includes('chat não aceitou texto')));
  assert.ok(log.includes('Ciclo #1: 1 enviados · 1 falhas'), log.join('\n'));
});

test('exceção comum numa ação de item também é falha de item (não derruba o fluxo)', async () => {
  const blip = criarBlip({ naTela: ['1', '2'] });
  blip.acoes.pausar = async (id) => { if (id === '1') throw new Error('menu não abriu'); return { ok: true }; };
  const r = await m.executarFluxo(fluxo([P]), criarDeps(blip).deps);
  assert.equal(r.status, 'concluido');
  assert.equal(r.totais.falhas, 1);
});

test('falha geral: para o fluxo, passo em Falha, motivo no log, passos seguintes não rodam', async () => {
  const blip = criarBlip({ fila: [2] });
  blip.falhas.atender = 'botão Atender não encontrado';
  const { deps, log, passos } = criarDeps(blip);
  const r = await m.executarFluxo(fluxo([A, E(), P]), deps);
  assert.equal(r.status, 'falha');
  assert.equal(r.motivo, 'botão Atender não encontrado');
  assert.deepEqual(passos.at(-1), [1, 'falha', 'botão Atender não encontrado']);
  assert.ok(log.some((l) => l.includes('botão Atender não encontrado')));
  assert.deepEqual(nomes(blip), ['atender']);
});

test('Parar no meio do passo 2: o passo 3 não roda', async () => {
  const blip = criarBlip({ naTela: ['1', '2', '3'] });
  const { deps } = criarDeps(blip, { pararApos: (i, s) => i === 2 && s === 'rodando' });
  const r = await m.executarFluxo(fluxo([E(), P, M()]), deps);
  assert.equal(r.status, 'parado');
  assert.ok(!nomes(blip).includes('mover'));
  assert.ok(!nomes(blip).includes('pausar'), 'nenhum item começa depois de Parar');
});

test('Pausar global segura antes do próximo passo e retoma', async () => {
  const blip = criarBlip({ naTela: ['1'] });
  const { deps } = criarDeps(blip, { pausarApos: (i, s) => i === 1 && s === 'feito' });
  const r = await m.executarFluxo(fluxo([P, M()]), deps);
  assert.equal(r.status, 'concluido');
  assert.ok(deps.retomadas >= 1);
  assert.deepEqual(nomes(blip), ['pausar', 'mover']);
});

test('status por passo: rodando → feito, na ordem do usuário', async () => {
  const blip = criarBlip({ naTela: ['1'] });
  const { deps, passos } = criarDeps(blip);
  await m.executarFluxo(fluxo([E(), P]), deps);
  const resumo = passos.filter(([, s]) => s !== 'aguardando').map(([i, s]) => `${i}:${s}`);
  assert.deepEqual(resumo, ['1:rodando', '1:feito', '2:rodando', '2:feito']);
});

test('EF em ⏳ abre o próximo (abrirProximo:true) e conta enviados e finalizados', async () => {
  const blip = criarBlip({ naTela: ['1', '2'] });
  const { deps, log } = criarDeps(blip);
  await m.executarFluxo(fluxo([EF]), deps);
  assert.deepEqual(blip.chamadas.map((c) => c[4]), [true, true]);
  assert.ok(log.includes('Ciclo #1: 2 enviados · 2 finalizados · 0 falhas'), log.join('\n'));
});

test('Transferir e Mover usam os campos do passo', async () => {
  const blip = criarBlip({ naTela: ['1'] });
  await m.executarFluxo(fluxo([T]), criarDeps(blip).deps);
  assert.deepEqual(blip.chamadas, [['transferir', '1', 'Atendente Fictício', 'atendente']]);
});

test('Transferir para fila: manda o nome da fila e o destino "fila" (o nome de atendente é ignorado)', async () => {
  const blip = criarBlip({ naTela: ['1'] });
  const TF = { tipo: 'transferir', para: 'fila', fila: 'Nível 2', atendente: 'Atendente Fictício' };
  await m.executarFluxo(fluxo([TF]), criarDeps(blip).deps);
  assert.deepEqual(blip.chamadas, [['transferir', '1', 'Nível 2', 'fila']]);
});

test('velocidade: cada passo usa a sua ou a do fluxo', async () => {
  const blip = criarBlip({ naTela: ['1'] });
  await m.executarFluxo(fluxo([{ ...E(), velocidade: 1.5 }, P], { velocidade: 0.8 }), criarDeps(blip).deps);
  assert.deepEqual(blip.velocidades, [1.5, 0.8]);
});

test('fluxo inválido não executa nada', async () => {
  const blip = criarBlip();
  const r = await m.executarFluxo(fluxo([P, E()]), criarDeps(blip).deps);
  assert.equal(r.status, 'invalido');
  assert.deepEqual(blip.chamadas, []);
  const r2 = await m.executarFluxo(fluxo([E('')]), criarDeps(blip).deps);
  assert.equal(r2.status, 'invalido', 'campo vazio também bloqueia');
});

test('resultado "pulado" do adaptador (ex.: ticket em espera lido pelo menu) não conta como enviado', async () => {
  const blip = criarBlip({ naTela: ['1', '2'] });
  blip.acoes.enviar = async (id) => (id === '2' ? { ok: true, pulado: true, nota: 'em espera: não recebe mensagem' } : { ok: true });
  const { deps, log } = criarDeps(blip);
  const r = await m.executarFluxo(fluxo([E()]), deps);
  assert.equal(r.totais.enviados, 1);
  assert.ok(log.includes('⏭️ #2: em espera: não recebe mensagem.'), log.join('\n'));
});

test('⏳: "semEfeito" do adaptador (já estava no estado) não conta no resumo', async () => {
  const blip = criarBlip({ naTela: ['1', '2'], pausados: ['1', '2'] });
  blip.acoes.despausar = async (id) => (id === '2' ? { ok: true, semEfeito: true, nota: 'não estava em espera' } : { ok: true });
  const r = await m.executarFluxo(fluxo([D]), criarDeps(blip).deps);
  assert.equal(r.totais.despausados, 1);
});

// Bug do Blip real (24/11/2026): 322 atendidos, só 30 enviados e finalizados. A lista do Blip só mostra uma parte
// dos tickets; o passo lia a lista uma vez e parava nos que estavam na tela.
test('⏳ [EF] com a lista mostrando só 3 de 7: relê a lista e finaliza os 7', async () => {
  const blip = criarBlip({ naTela: ['1', '2', '3', '4', '5', '6', '7'], visiveis: 3 });
  const { deps, log } = criarDeps(blip);
  const r = await m.executarFluxo(fluxo([EF]), deps);
  assert.equal(r.status, 'concluido');
  assert.equal(blip.chamadas.filter((c) => c[0] === 'enviar').length, 7);
  assert.equal(blip.tela.length, 0);
  assert.ok(log.includes('Ciclo #1: 7 enviados · 7 finalizados · 0 falhas'), log.join('\n'));
});

test('⏳ [E] só enviar com a lista mostrando 3 de 7: relê, não acha ninguém novo e termina (sem repetir)', async () => {
  const blip = criarBlip({ naTela: ['1', '2', '3', '4', '5', '6', '7'], visiveis: 3 });
  const r = await m.executarFluxo(fluxo([E()]), criarDeps(blip).deps);
  assert.equal(r.status, 'concluido');
  assert.deepEqual(blip.chamadas.filter((c) => c[0] === 'enviar').map((c) => c[1]), ['1', '2', '3']);
});

test('⏳ [EF] relendo a lista: ticket que falhou não é tentado de novo no mesmo passo', async () => {
  const blip = criarBlip({ naTela: ['1', '2', '3', '4'], visiveis: 2 });
  blip.falhas['enviar:1'] = 'campo indisponível';
  const r = await m.executarFluxo(fluxo([EF]), criarDeps(blip).deps);
  assert.equal(r.status, 'concluido');
  assert.deepEqual(blip.chamadas.filter((c) => c[0] === 'enviar').map((c) => c[1]), ['1', '2', '3', '4']);
});

test('⏳ [E, P] relendo a lista: ticket que aparece durante o Pausar não é pausado sem ter recebido a mensagem', async () => {
  const blip = criarBlip({ naTela: ['1', '2'] });
  const pausarOriginal = blip.acoes.pausar;
  blip.acoes.pausar = async (id) => {
    if (id === '1') blip.tela.push({ id: '9', pausado: false }); // chega um ticket no meio do passo
    return pausarOriginal(id);
  };
  await m.executarFluxo(fluxo([E(), P]), criarDeps(blip).deps);
  assert.ok(!blip.chamadas.some((c) => c[0] === 'pausar' && c[1] === '9'), JSON.stringify(blip.chamadas));
});
