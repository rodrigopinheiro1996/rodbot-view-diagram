  function fecharPainel() {
    painelFechado = true;
    window.removeEventListener('click', onCapturaControles, true);
    autoDestruir();
    clearInterval(queueTimer);
    rodando = false;
    pausado = false;
    modoAtual = null;
    liberarWakeLock();
    document.removeEventListener('visibilitychange', onVisChange);
    document.removeEventListener('mousemove', onDocMouseMove);
    document.removeEventListener('mouseup', onDocMouseUp);
    document.removeEventListener('click', onDocClickCloseTheme);
    window.removeEventListener('rf-bm-theme-change', onSyncTheme);
    p.remove();
    styleEl.remove();
    if (window.__rodBot) delete window.__rodBot;
    if (window.__rodBotCleanup === fecharPainel) {
      delete window.__rodBotCleanup;
    }
  }
  btnClose.onclick = fecharPainel;
  window.__rodBotCleanup = fecharPainel;
  btnPauseAll.onclick = () => { if (!autoBloqueiaOutras()) executarModoEsperaTodos('pausar'); };
  btnUnpauseAll.onclick = () => { if (!autoBloqueiaOutras()) executarModoEsperaTodos('despausar'); };
  log("🤖 rod bot pronto! Escolha uma aba acima.");
})();;void 0;