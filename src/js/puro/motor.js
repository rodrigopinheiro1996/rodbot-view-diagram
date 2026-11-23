/* Motor do fluxo — ⏳ Aguardando (Tarefa 9), 🆕 Que vão cair e 👥 Ambos (Tarefa 10). Spec §5, §6 (regra 9), §7, §10.
 *
 * Puro: nada aqui toca o DOM. Tudo que mexe no Blip chega em deps.acoes (as funções reais no bookmarklet,
 * falsas nos testes). Precisa de velocidade.js, validar-fluxo.js e validar-campos.js carregados antes.
 *
 * executarFluxo(fluxo, deps) → Promise<{ status, ciclos, motivo?, totais }>
 *   fluxo: { paraQuem, passos, loopEscolha, pausaCiclos (s), velocidade }
 *   deps.acoes:
 *     contar() → { fila, naTela, pausados }          (null = desconhecido; só para o log inicial)
 *     filaAtual() → número | null                    (sentinela)
 *     atender() → { atendidos }                      (puxa até zerar)
 *     listarTickets() → [{ id | null, pausado: true | false | null }]
 *     enviar(id, { mensagem, modo, tag, abrirProximo }) · pausar(id) · despausar(id)
 *     mover(id, pasta) · transferir(id, nome, para)  → { ok, motivo?, nota?, pulado? }
 *       para: 'atendente' (padrão, passo sem `para`) ou 'fila'; nome = passo.atendente ou passo.fila
 *       pulado: ok mas nada foi feito (ex.: ticket em espera não recebe mensagem); não conta; em 🆕/👥 encerra o chat
 *       semEfeito: o ticket já estava no estado pedido (ex.: já em espera); não conta e o chat segue
 *     definirVelocidade(v)
 *     🆕/👥: novosChats() → [id] (chats que caíram desde a última leitura; o observador do Auto por baixo)
 *            entreChats() (pausa de ritmo AUTO_T.entreTickets) · memoria24h.{ tem(id), gravar(id) }
 *     Falha de ITEM: devolver { ok:false, motivo } (ou lançar um Error comum). Falha GERAL: lançar ErroGeral(motivo).
 *   deps.relogio.esperar(ms) · deps.controle.{ parado(), aguardar() → false se parou }
 *   deps.eventos.{ log(texto), passo(indice, 'aguardando'|'rodando'|'feito'|'falha', detalhe), ciclo(n) }
 *
 * Memória por ticket (§5):
 *   ⏳: só desta execução (zera a cada Iniciar). Um ticket recebe no máximo UM envio na execução inteira; cada
 *       passo age no máximo uma vez em cada ticket (por isso [P, D, P] funciona e o loop não repete).
 *   🆕: a de 24 h do Auto; o id é gravado ANTES do primeiro passo (nunca envia duas vezes).
 *   👥: o lote usa a da execução (ticket que já está nas 24 h é tratado de novo, com aviso); a vigia usa as 24 h e
 *       ignora os tratados no lote.
 *   🆕/👥: chats presentes ao ativar não são tratados pela vigia. Só um fluxo roda por vez.
 */

// Passo Transferir → [nome, para]. Passo antigo (sem `para`) é para atendente.
function destinoTransferir(passo) {
  return passo.para === 'fila' ? [passo.fila, 'fila'] : [passo.atendente, 'atendente'];
}

function ErroGeral(mensagem) {
  const e = new Error(mensagem);
  e.geral = true;
  return e;
}

const MOTOR_SENTINELA_MS = 1500;
const MOTOR_VIGIA_MS = 500; // leitura de chats novos quando não há nenhum na fila (não muda com a velocidade)
let motorOcupado = false;

function motorChavesResumo(passos) {
  const chaves = [];
  const add = (k) => { if (chaves.indexOf(k) === -1) chaves.push(k); };
  for (const p of passos) {
    if (p.tipo === 'atender') add('atendidos');
    else if (p.tipo === 'enviar') { add('enviados'); if (p.modo === 'finalizar') add('finalizados'); }
    else if (p.tipo === 'espera') add(p.modo === 'despausar' ? 'despausados' : 'pausados');
    else if (p.tipo === 'mover') add('movidos');
    else if (p.tipo === 'transferir') add('transferidos');
  }
  return chaves;
}

function motorRotuloPasso(passo) {
  return typeof fluxoRotulo === 'function' ? fluxoRotulo(passo) : passo.tipo;
}

// Executa um passo em lote nos tickets da tela. Devolve true se o usuário parou no meio.
async function motorPassoEmLote(passo, indice, ctx) {
  const { acoes, controle, log, memoria, tc } = ctx;
  const abrirProximo = ctx.abrirProximo !== false;
  if (passo.tipo === 'atender') {
    const r = await acoes.atender();
    tc.atendidos += (r && r.atendidos) || 0;
    return false;
  }

  const tickets = acoes.listarTickets() || [];
  const comNumero = tickets.filter((t) => t.id);
  const semNumero = tickets.length - comNumero.length;
  if (tickets.length && !comNumero.length) {
    throw ErroGeral('todos os ' + tickets.length + ' cards da tela estão sem número de ticket');
  }
  tc.semNumero = Math.max(tc.semNumero, semNumero);

  const feitosNestePasso = memoria.porPasso[indice];
  const pausando = passo.tipo === 'espera' && passo.modo === 'pausar';
  const despausando = passo.tipo === 'espera' && passo.modo === 'despausar';

  for (const t of comNumero) {
    if (controle.parado() || !(await controle.aguardar())) return true;
    if (feitosNestePasso.has(t.id)) continue;
    if (ctx.memoria24h && ctx.memoria24h.tem(t.id) && !memoria.avisados.has(t.id)) {
      memoria.avisados.add(t.id);
      log('ℹ️ #' + t.id + ' tratado de novo (execução anterior).');
    }
    if (passo.tipo === 'enviar') {
      if (memoria.enviados.has(t.id)) continue; // regra 9: ninguém recebe duas mensagens
      if (t.pausado === true) {
        log('⏭️ #' + t.id + ' em espera: não recebe mensagem.');
        feitosNestePasso.add(t.id);
        continue;
      }
    }
    if (pausando && t.pausado === true) {
      log('⏭️ #' + t.id + ' já estava em espera.');
      feitosNestePasso.add(t.id);
      continue;
    }
    if (despausando && t.pausado === false) continue;

    let r;
    try {
      if (passo.tipo === 'enviar') {
        r = await acoes.enviar(t.id, {
          mensagem: passo.mensagem, modo: passo.modo, tag: passo.tag, abrirProximo,
        });
      } else if (pausando) r = await acoes.pausar(t.id);
      else if (despausando) r = await acoes.despausar(t.id);
      else if (passo.tipo === 'mover') r = await acoes.mover(t.id, passo.pasta);
      else r = await acoes.transferir(t.id, ...destinoTransferir(passo));
    } catch (err) {
      if (err && err.geral) throw err;
      r = { ok: false, motivo: (err && err.message) || String(err) };
    }
    feitosNestePasso.add(t.id); // não tenta de novo nesta execução (evita repetir uma ação de resultado incerto)

    if (!r || !r.ok) {
      tc.falhas++;
      log('⚠️ #' + t.id + ': ' + ((r && r.motivo) || 'falhou') + '. Pulado.');
      continue;
    }
    if (r.pulado || r.semEfeito) {
      log('⏭️ #' + t.id + ': ' + (r.nota || 'pulado') + '.');
      continue;
    }
    if (r.nota) log('ℹ️ #' + t.id + ': ' + r.nota + '.');
    if (passo.tipo === 'enviar') {
      memoria.enviados.add(t.id);
      tc.enviados++;
      if (passo.modo === 'finalizar') tc.finalizados++;
    } else if (pausando) tc.pausados++;
    else if (despausando) tc.despausados++;
    else if (passo.tipo === 'mover') tc.movidos++;
    else tc.transferidos++;
  }
  return false;
}

function motorContar(tc, passo, ok) {
  if (!ok) return;
  if (passo.tipo === 'enviar') {
    tc.enviados++;
    if (passo.modo === 'finalizar') tc.finalizados++;
  } else if (passo.tipo === 'espera') {
    if (passo.modo === 'despausar') tc.despausados++;
    else tc.pausados++;
  } else if (passo.tipo === 'mover') tc.movidos++;
  else if (passo.tipo === 'transferir') tc.transferidos++;
}

function motorContadores() {
  return { falhas: 0, semNumero: 0, atendidos: 0, enviados: 0, finalizados: 0, pausados: 0,
    despausados: 0, movidos: 0, transferidos: 0 };
}

function motorResumo(rotulo, tc, chaves) {
  return rotulo + ': ' + chaves.map((k) => tc[k] + ' ' + k).concat(tc.falhas + ' falhas').join(' · ');
}

// Só um fluxo por vez (§10). A trava é pega antes de qualquer await.
async function executarFluxo(fluxo, deps) {
  if (motorOcupado) return { status: 'recusado', ciclos: 0, motivo: 'Já há um fluxo rodando' };
  if (!podeIniciar(fluxo)) return { status: 'invalido', ciclos: 0, motivo: 'fluxo inválido ou com campo vazio' };
  motorOcupado = true;
  try {
    const eventos = deps.eventos || {};
    const log = (t) => { if (eventos.log) eventos.log(t); };
    if (deps.acoes.contar) {
      const c = deps.acoes.contar() || {};
      const v = (x) => (x === null || x === undefined ? '?' : x);
      log('Fila: ' + v(c.fila) + ' · Na tela: ' + v(c.naTela) + ' · Pausados: ' + v(c.pausados));
    }
    if (fluxo.paraQuem === 'aguardando') return await motorAguardando(fluxo, deps, log);
    return await motorPorChat(fluxo, deps, log);
  } finally {
    motorOcupado = false;
  }
}

// ⏳ Aguardando: em lote nos tickets da tela, com loop e sentinela.
async function motorAguardando(fluxo, deps, log) {
  const acoes = deps.acoes;
  const relogio = deps.relogio;
  const controle = deps.controle;
  const eventos = deps.eventos || {};
  const marcar = (i, s, d) => { if (eventos.passo) eventos.passo(i, s, d); };

  const passos = fluxo.passos;
  const loop = loopEfetivo(fluxo).efetivo;
  const chaves = motorChavesResumo(passos);
  const memoria = { enviados: new Set(), avisados: new Set(), porPasso: passos.map(() => new Set()) };
  const totais = { falhas: 0 };
  chaves.forEach((k) => { totais[k] = 0; });
  let ciclos = 0;
  let passoAtual = 0;
  const fim = (status, motivo) => ({ status, ciclos, motivo, totais });

  try {
    for (let n = 1; ; n++) {
      if (eventos.ciclo) eventos.ciclo(n);
      if (controle.parado()) return fim('parado');
      passos.forEach((_, i) => marcar(i + 1, 'aguardando'));

      if (loop) {
        let fila = acoes.filaAtual();
        if (fila === 0) {
          log('👁️ Sentinela: fila zerada (0). Vigiando até surgir cliente...');
          while (fila === 0) {
            if (controle.parado() || !(await controle.aguardar())) return fim('parado');
            await relogio.esperar(MOTOR_SENTINELA_MS);
            fila = acoes.filaAtual();
          }
        }
      }

      const tc = motorContadores();
      const ctx = { acoes, controle, log, memoria, tc, abrirProximo: true };
      for (let i = 0; i < passos.length; i++) {
        if (controle.parado() || !(await controle.aguardar())) return fim('parado');
        const passo = passos[i];
        passoAtual = i + 1;
        if (acoes.definirVelocidade) acoes.definirVelocidade(velocidadeDoPasso(passo, fluxo.velocidade));
        marcar(i + 1, 'rodando');
        const parou = await motorPassoEmLote(passo, i, ctx);
        if (parou) return fim('parado');
        marcar(i + 1, 'feito');
      }
      passoAtual = 0;

      ciclos = n;
      log(motorResumo('Ciclo #' + n, tc, chaves));
      if (tc.semNumero) log('⚠️ ' + tc.semNumero + ' card(s) sem número, pulado(s)');
      chaves.forEach((k) => { totais[k] += tc[k]; });
      totais.falhas += tc.falhas;

      if (!loop) return fim('concluido');
      if (controle.parado() || !(await controle.aguardar())) return fim('parado');
      await relogio.esperar(pausaEntreCiclos(fluxo.pausaCiclos === undefined ? 1 : fluxo.pausaCiclos));
    }
  } catch (err) {
    return motorFalhaGeral(err, passoAtual, passos, marcar, log, fim);
  }
}

function motorFalhaGeral(err, passoAtual, passos, marcar, log, fim) {
  const motivo = (err && err.message) || String(err);
  if (passoAtual) {
    marcar(passoAtual, 'falha', motivo);
    log('❌ Passo ' + passoAtual + ' · ' + motorRotuloPasso(passos[passoAtual - 1]) + ' falhou: ' + motivo + '. Fluxo parado.');
  } else {
    log('❌ ' + motivo + '. Fluxo parado.');
  }
  return fim('falha', motivo);
}

// Aplica todos os passos a UM chat, em ordem; cada passo só começa se o anterior deu certo (o adaptador só
// devolve ok depois de CONFIRMAR, ex.: envio confirmado antes de pausar). Devolve 'ok' | 'falhou' | 'parado'.
async function motorPassosNoChat(id, fluxo, ctx) {
  const { acoes, controle, log, tc, marcar } = ctx;
  const passos = fluxo.passos;
  passos.forEach((_, i) => marcar(i + 1, 'aguardando', '#' + id));
  for (let i = 0; i < passos.length; i++) {
    if (controle.parado() || !(await controle.aguardar())) return 'parado';
    const passo = passos[i];
    ctx.passoAtual = i + 1;
    if (acoes.definirVelocidade) acoes.definirVelocidade(velocidadeDoPasso(passo, fluxo.velocidade));
    marcar(i + 1, 'rodando', '#' + id);
    let r;
    try {
      if (passo.tipo === 'enviar') {
        r = await acoes.enviar(id, { mensagem: passo.mensagem, modo: passo.modo, tag: passo.tag, abrirProximo: false });
      } else if (passo.tipo === 'espera' && passo.modo === 'pausar') r = await acoes.pausar(id);
      else if (passo.tipo === 'espera') r = await acoes.despausar(id);
      else if (passo.tipo === 'mover') r = await acoes.mover(id, passo.pasta);
      else if (passo.tipo === 'transferir') r = await acoes.transferir(id, ...destinoTransferir(passo));
      else r = { ok: false, motivo: 'passo indisponível neste modo' };
    } catch (err) {
      if (err && err.geral) throw err;
      r = { ok: false, motivo: (err && err.message) || String(err) };
    }
    if (!r || !r.ok) {
      tc.falhas++;
      marcar(i + 1, 'falha', '#' + id);
      log('⚠️ Chat #' + id + ' · passo ' + (i + 1) + ': ' + ((r && r.motivo) || 'falhou') +
        '. Os passos seguintes deste chat não rodam.');
      ctx.passoAtual = 0;
      return 'falhou';
    }
    if (r.pulado) {
      log('⏭️ Chat #' + id + ' · passo ' + (i + 1) + ': ' + (r.nota || 'pulado') + '. Os passos seguintes deste chat não rodam.');
      marcar(i + 1, 'feito', '#' + id);
      ctx.passoAtual = 0;
      return 'pulado';
    }
    if (r.semEfeito) {
      log('⏭️ Chat #' + id + ': ' + (r.nota || 'sem efeito') + '.');
      marcar(i + 1, 'feito', '#' + id);
      continue;
    }
    if (r.nota) log('ℹ️ #' + id + ': ' + r.nota + '.');
    motorContar(tc, passo, true);
    marcar(i + 1, 'feito', '#' + id);
  }
  ctx.passoAtual = 0;
  return 'ok';
}

// 🆕 Que vão cair / 👥 Ambos: (👥) uma passada em lote nos que aguardam; depois vigia, um chat por vez, até Parar.
async function motorPorChat(fluxo, deps, log) {
  const acoes = deps.acoes;
  const relogio = deps.relogio;
  const controle = deps.controle;
  const eventos = deps.eventos || {};
  const marcar = (i, s, d) => { if (eventos.passo) eventos.passo(i, s, d); };
  const passos = fluxo.passos;
  const chaves = motorChavesResumo(passos);
  const memoria = { enviados: new Set(), avisados: new Set(), porPasso: passos.map(() => new Set()) };
  const tc = motorContadores();
  const ctx = { acoes, controle, log, memoria, tc, marcar, passoAtual: 0, abrirProximo: false };
  const fim = (status, motivo) => {
    log(motorResumo('Resumo', tc, chaves));
    return { status, ciclos: 0, motivo, totais: tc };
  };

  const presentes = new Set((acoes.listarTickets() || []).map((t) => t.id).filter(Boolean));
  const tratados = new Set(); // memória da execução (lote + vigia)

  try {
    if (fluxo.paraQuem === 'ambos') {
      const lote = motorContadores();
      const ctxLote = { acoes, controle, log, memoria, tc: lote, abrirProximo: false, memoria24h: acoes.memoria24h };
      for (let i = 0; i < passos.length; i++) {
        if (controle.parado() || !(await controle.aguardar())) return fim('parado');
        ctx.passoAtual = i + 1;
        if (acoes.definirVelocidade) acoes.definirVelocidade(velocidadeDoPasso(passos[i], fluxo.velocidade));
        marcar(i + 1, 'rodando', 'lote');
        if (await motorPassoEmLote(passos[i], i, ctxLote)) return fim('parado');
        marcar(i + 1, 'feito', 'lote');
      }
      ctx.passoAtual = 0;
      memoria.porPasso.forEach((set) => set.forEach((id) => tratados.add(id)));
      log(motorResumo('Lote', lote, chaves));
      if (lote.semNumero) log('⚠️ ' + lote.semNumero + ' card(s) sem número, pulado(s)');
      Object.keys(tc).forEach((k) => { tc[k] += lote[k]; });
    }

    log('👁️ Vigiando chats que caírem' + (fluxo.puxarFila ? ' (e puxando a fila)' : '') + '...');
    const fila = [];
    const naFila = new Set();
    for (;;) {
      if (controle.parado() || !(await controle.aguardar())) return fim('parado');
      if (fluxo.puxarFila) {
        const f = acoes.filaAtual();
        if (f !== null && f > 0) {
          const r = await acoes.atender();
          tc.atendidos += (r && r.atendidos) || 0;
        }
      }
      for (const id of acoes.novosChats() || []) {
        if (!id || naFila.has(id) || presentes.has(id) || tratados.has(id)) continue;
        if (acoes.memoria24h && acoes.memoria24h.tem(id)) continue;
        naFila.add(id);
        fila.push(id);
      }
      if (!fila.length) {
        await relogio.esperar(MOTOR_VIGIA_MS);
        continue;
      }
      const id = fila.shift();
      tratados.add(id);
      if (acoes.memoria24h) acoes.memoria24h.gravar(id); // antes do 1º passo: nunca envia duas vezes
      const r = await motorPassosNoChat(id, fluxo, ctx);
      if (r === 'parado') return fim('parado');
      if (r === 'ok') log('✅ Chat #' + id + ': ' + passos.length + ' passo(s) feitos.');
      if (acoes.entreChats) await acoes.entreChats();
    }
  } catch (err) {
    return motorFalhaGeral(err, ctx.passoAtual, passos, marcar, log, fim);
  }
}
