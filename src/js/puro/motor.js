/* Motor do fluxo — modo ⏳ Aguardando (Tarefa 9). Spec §5, §6 (regra 9), §7, §10.
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
 *     mover(id, pasta) · transferir(id, atendente)   → { ok, motivo?, nota? }
 *     definirVelocidade(v)
 *     Falha de ITEM: devolver { ok:false, motivo } (ou lançar um Error comum). Falha GERAL: lançar ErroGeral(motivo).
 *   deps.relogio.esperar(ms) · deps.controle.{ parado(), aguardar() → false se parou }
 *   deps.eventos.{ log(texto), passo(indice, 'aguardando'|'rodando'|'feito'|'falha', detalhe), ciclo(n) }
 *
 * Memória por ticket (§5): só desta execução (zera a cada Iniciar). Um ticket recebe no máximo UM envio na
 * execução inteira; cada passo age no máximo uma vez em cada ticket (por isso [P, D, P] funciona e o loop não
 * repete pausa/movimento em quem já foi tratado).
 */

function ErroGeral(mensagem) {
  const e = new Error(mensagem);
  e.geral = true;
  return e;
}

const MOTOR_SENTINELA_MS = 1500;

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
          mensagem: passo.mensagem, modo: passo.modo, tag: passo.tag, abrirProximo: true,
        });
      } else if (pausando) r = await acoes.pausar(t.id);
      else if (despausando) r = await acoes.despausar(t.id);
      else if (passo.tipo === 'mover') r = await acoes.mover(t.id, passo.pasta);
      else r = await acoes.transferir(t.id, passo.atendente);
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

async function executarFluxo(fluxo, deps) {
  const acoes = deps.acoes;
  const relogio = deps.relogio;
  const controle = deps.controle;
  const eventos = deps.eventos || {};
  const log = (t) => { if (eventos.log) eventos.log(t); };
  const marcar = (i, s, d) => { if (eventos.passo) eventos.passo(i, s, d); };

  if (!podeIniciar(fluxo)) return { status: 'invalido', ciclos: 0, motivo: 'fluxo inválido ou com campo vazio' };
  if (fluxo.paraQuem !== 'aguardando') {
    return { status: 'invalido', ciclos: 0, motivo: 'modo ainda não suportado pelo motor' };
  }

  const passos = fluxo.passos;
  const loop = loopEfetivo(fluxo).efetivo;
  const chaves = motorChavesResumo(passos);
  const memoria = { enviados: new Set(), porPasso: passos.map(() => new Set()) };
  const totais = { falhas: 0 };
  chaves.forEach((k) => { totais[k] = 0; });
  let ciclos = 0;
  let passoAtual = 0;
  const fim = (status, motivo) => ({ status, ciclos, motivo, totais });

  if (acoes.contar) {
    const c = acoes.contar() || {};
    const v = (x) => (x === null || x === undefined ? '?' : x);
    log('Fila: ' + v(c.fila) + ' · Na tela: ' + v(c.naTela) + ' · Pausados: ' + v(c.pausados));
  }

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

      const tc = { falhas: 0, semNumero: 0, atendidos: 0, enviados: 0, finalizados: 0, pausados: 0,
        despausados: 0, movidos: 0, transferidos: 0 };
      const ctx = { acoes, controle, log, memoria, tc };
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
      log('Ciclo #' + n + ': ' + chaves.map((k) => tc[k] + ' ' + k).concat(tc.falhas + ' falhas').join(' · '));
      if (tc.semNumero) log('⚠️ ' + tc.semNumero + ' card(s) sem número, pulado(s)');
      chaves.forEach((k) => { totais[k] += tc[k]; });
      totais.falhas += tc.falhas;

      if (!loop) return fim('concluido');
      if (controle.parado() || !(await controle.aguardar())) return fim('parado');
      await relogio.esperar(pausaEntreCiclos(fluxo.pausaCiclos === undefined ? 1 : fluxo.pausaCiclos));
    }
  } catch (err) {
    const motivo = (err && err.message) || String(err);
    if (passoAtual) {
      marcar(passoAtual, 'falha', motivo);
      log('❌ Passo ' + passoAtual + ' · ' + motorRotuloPasso(passos[passoAtual - 1]) + ' falhou: ' + motivo + '. Fluxo parado.');
    } else {
      log('❌ ' + motivo + '. Fluxo parado.');
    }
    return fim('falha', motivo);
  }
}
