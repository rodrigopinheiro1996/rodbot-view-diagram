(function () {
  if (typeof window.__rodBotCleanup === 'function') {
    window.__rodBotCleanup();
  } else {
    document.getElementById('blip-auto-panel')?.remove();
    document.getElementById('rf-rodbot-css')?.remove();
  }

  const MENSAGEM_PADRAO = `Realizamos uma nova atualização no seu aplicativo. Por gentileza, verifique se as informações foram esclarecidas. Caso a situação ainda não tenha sido resolvida ou permaneça com alguma dúvida, pedimos que entre em contato conosco novamente para que possamos ajudá-lo(a).`;
  const CONFIG = {
    mensagem: "",
    tagBusca: "",
    pastaDestino: "",
    delayAcoes: 1200,
    delayTrocaTicket: 700
  };
  let rodando = false, pausado = false, tickets = 0, modoAtual = null, modoChave = 'enviar', abaAtiva = 'pasta';
  let wakeLock = null;
  let logOculto = false;

  const THEME_KEY = 'rf_widget_theme_v1';
  const TAB_KEY = 'rf_rodbot_tab_v1';
  const FOLDERS_KEY = 'rf_rodbot_recent_folders_v1';
  const DEFAULT_FOLDERS = ['nv2', 'default'];

  const THEME_LIST = [
    { id: 'lime', label: '🟢 Verde', short: '🟢' },
    { id: 'classic', label: '🔵 Azul', short: '🔵' },
    { id: 'pink', label: '🌸 Rosa', short: '🌸' },
    { id: 'red', label: '🔴 Vermelho', short: '🔴' },
    { id: 'rgb', label: '🌈 LGTV', short: '🌈' }
  ];

  function getSavedTheme() {
    try {
      const t = localStorage.getItem(THEME_KEY);
      return THEME_LIST.some(x => x.id === t) ? t : 'lime';
    } catch {
      return 'lime';
    }
  }
  function saveTheme(t) {
    try { localStorage.setItem(THEME_KEY, t); } catch {}
    try { window.dispatchEvent(new CustomEvent('rf-bm-theme-change', { detail: t })); } catch {}
  }

  function getSavedTab() {
    try {
      const tab = localStorage.getItem(TAB_KEY);
      return ['piloto', 'pasta', 'mensagem', 'fila', 'auto'].includes(tab) ? tab : 'piloto';
    } catch {
      return 'piloto';
    }
  }
  function saveTab(tab) {
    try { localStorage.setItem(TAB_KEY, tab); } catch {}
  }

  function getRecentFolders() {
    try {
      const raw = JSON.parse(localStorage.getItem(FOLDERS_KEY) || '[]');
      const list = Array.isArray(raw) ? raw.filter(x => typeof x === 'string' && x.trim()) : [];
      const merged = [...list];
      for (const d of DEFAULT_FOLDERS) {
        if (!merged.some(x => x.toLowerCase() === d.toLowerCase())) merged.push(d);
      }
      return merged.slice(0, 6);
    } catch {
      return [...DEFAULT_FOLDERS];
    }
  }
  function saveRecentFolder(name) {
    const clean = (name || '').trim();
    if (!clean) return;
    try {
      const cur = getRecentFolders().filter(x => x.toLowerCase() !== clean.toLowerCase());
      cur.unshift(clean);
      localStorage.setItem(FOLDERS_KEY, JSON.stringify(cur.slice(0, 6)));
    } catch {}
  }

  abaAtiva = getSavedTab();

  const styleEl = document.createElement('style');
  styleEl.id = 'rf-rodbot-css';
  styleEl.textContent = `
    @property --rb-rgb-c { syntax: '<color>'; inherits: true; initial-value: #ef4444; }
    @property --rb-rgb-on { syntax: '<color>'; inherits: true; initial-value: #0a0a0a; }
    @property --rb-rgb-dim { syntax: '<color>'; inherits: true; initial-value: rgba(239,68,68,0.14); }
    @property --rb-rgb-glow { syntax: '<color>'; inherits: true; initial-value: rgba(239,68,68,0.30); }
    @keyframes rb-rgb-sync {
      0%   { --rb-rgb-c: #ef4444; --rb-rgb-on: #ffffff; --rb-rgb-dim: rgba(239,68,68,0.14); --rb-rgb-glow: rgba(239,68,68,0.32); }
      16%  { --rb-rgb-c: #f97316; --rb-rgb-on: #0a0a0a; --rb-rgb-dim: rgba(249,115,22,0.14); --rb-rgb-glow: rgba(249,115,22,0.32); }
      33%  { --rb-rgb-c: #eab308; --rb-rgb-on: #0a0a0a; --rb-rgb-dim: rgba(234,179,8,0.14);  --rb-rgb-glow: rgba(234,179,8,0.32); }
      50%  { --rb-rgb-c: #89f336; --rb-rgb-on: #0a0f08; --rb-rgb-dim: rgba(137,243,54,0.14); --rb-rgb-glow: rgba(137,243,54,0.32); }
      66%  { --rb-rgb-c: #22d3ee; --rb-rgb-on: #0a0f08; --rb-rgb-dim: rgba(34,211,238,0.14); --rb-rgb-glow: rgba(34,211,238,0.32); }
      83%  { --rb-rgb-c: #8b5cf6; --rb-rgb-on: #ffffff; --rb-rgb-dim: rgba(139,92,246,0.14); --rb-rgb-glow: rgba(139,92,246,0.32); }
      100% { --rb-rgb-c: #ec4899; --rb-rgb-on: #0a0f08; --rb-rgb-dim: rgba(236,72,153,0.14); --rb-rgb-glow: rgba(236,72,153,0.32); }
    }
    @keyframes rb-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.45; transform: scale(0.85); }
    }
    #ba-win {
      --rb-bg: rgba(16, 19, 23, 0.94);
      --rb-elevated: rgba(11, 15, 20, 0.92);
      --rb-card: rgba(22, 27, 34, 0.92);
      --rb-border: rgba(255, 255, 255, 0.08);
      --rb-border-strong: rgba(255, 255, 255, 0.14);
      --rb-text: #f1f5f9;
      --rb-muted: #94a3b8;
      --rb-accent: #89f336;
      --rb-on-accent: #0a0f08;
      --rb-accent-dim: rgba(137, 243, 54, 0.13);
      --rb-accent-border: rgba(137, 243, 54, 0.34);
      --rb-accent-glow: rgba(137, 243, 54, 0.22);
      position: fixed; top: 16px; right: 16px; z-index: 2147483647; pointer-events: auto;
      width: min(438px, calc(100vw - 20px)); min-width: 330px; max-height: 94vh; overflow-y: auto;
      border-radius: 18px; border: 1px solid var(--rb-border-strong);
      background: radial-gradient(circle at 18% 0%, var(--rb-accent-dim), transparent 55%), var(--rb-bg);
      backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      color: var(--rb-text);
      box-shadow: 0 22px 54px rgba(0, 0, 0, 0.68), 0 0 0 1px rgba(255,255,255,0.03);
      font: 13px/1.45 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      user-select: none;
    }
    #ba-win[data-rf-theme="classic"] {
      --rb-bg: rgba(15, 23, 42, 0.95);
      --rb-elevated: rgba(7, 11, 20, 0.92);
      --rb-card: rgba(21, 31, 51, 0.92);
      --rb-border: rgba(148, 163, 184, 0.15);
      --rb-border-strong: rgba(148, 163, 184, 0.25);
      --rb-accent: #22d3ee;
      --rb-on-accent: #052e20;
      --rb-accent-dim: rgba(34, 211, 238, 0.13);
      --rb-accent-border: rgba(34, 211, 238, 0.38);
      --rb-accent-glow: rgba(34, 211, 238, 0.24);
    }
    #ba-win[data-rf-theme="pink"] {
      --rb-accent: #ec4899;
      --rb-on-accent: #0a0f08;
      --rb-accent-dim: rgba(236, 72, 153, 0.13);
      --rb-accent-border: rgba(236, 72, 153, 0.36);
      --rb-accent-glow: rgba(236, 72, 153, 0.22);
    }
    #ba-win[data-rf-theme="red"] {
      --rb-accent: #ef4444;
      --rb-on-accent: #ffffff;
      --rb-accent-dim: rgba(239, 68, 68, 0.14);
      --rb-accent-border: rgba(239, 68, 68, 0.36);
      --rb-accent-glow: rgba(239, 68, 68, 0.22);
    }
    #ba-win[data-rf-theme="rgb"] {
      --rb-accent: var(--rb-rgb-c);
      --rb-on-accent: var(--rb-rgb-on);
      --rb-accent-dim: var(--rb-rgb-dim);
      --rb-accent-border: var(--rb-rgb-c);
      --rb-accent-glow: var(--rb-rgb-glow);
      animation: rb-rgb-sync 4s linear infinite;
    }
    #ba-win::-webkit-scrollbar, #ba-log::-webkit-scrollbar { width: 5px; }
    #ba-win::-webkit-scrollbar-thumb, #ba-log::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 99px; }
    #ba-hdr {
      position: relative; padding: 12px 14px; cursor: grab;
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      background: var(--rb-elevated);
      border-bottom: 1px solid var(--rb-border);
      border-radius: 18px 18px 0 0;
    }
    .ba-brand { display: flex; align-items: center; gap: 9px; font-weight: 700; font-size: 14px; letter-spacing: -0.02em; color: var(--rb-text); }
    .ba-brand-badge {
      width: 28px; height: 28px; border-radius: 9px; display: grid; place-items: center;
      background: var(--rb-accent-dim); border: 1px solid var(--rb-accent-border);
      box-shadow: 0 0 12px var(--rb-accent-glow); font-size: 14px; line-height: 1;
    }
    .ba-hdr-right { display: flex; align-items: center; gap: 6px; position: relative; }
    #ba-st {
      padding: 3px 9px; border-radius: 999px; font-size: 10.5px; font-weight: 700;
      color: #fff; background: rgba(100,116,139,0.55); border: 1px solid rgba(255,255,255,0.1);
    }
    #ba-theme-btn {
      border: 1px solid var(--rb-accent-border); background: var(--rb-accent-dim);
      color: var(--rb-accent); border-radius: 999px; padding: 3px 9px;
      font: 600 11px inherit; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;
    }
    #ba-theme-btn:hover { filter: brightness(1.12); }
    #ba-theme-menu {
      position: absolute; top: calc(100% + 6px); right: 26px; z-index: 99;
      min-width: 148px; padding: 5px; border-radius: 12px;
      background: var(--rb-card); border: 1px solid var(--rb-border-strong);
      box-shadow: 0 12px 32px rgba(0,0,0,0.65); display: none;
    }
    #ba-theme-menu[data-open="true"] { display: block; }
    .ba-theme-opt {
      display: flex; width: 100%; align-items: center; gap: 6px;
      padding: 7px 9px; border: 1px solid transparent; border-radius: 8px;
      background: transparent; color: var(--rb-text); font: 500 12px inherit; cursor: pointer; text-align: left;
    }
    .ba-theme-opt:hover, .ba-theme-opt.active {
      background: var(--rb-accent-dim); border-color: var(--rb-accent-border); color: var(--rb-accent);
    }
    #ba-close {
      background: rgba(248, 113, 113, 0.14); color: #fca5a5; border: 1px solid rgba(248, 113, 113, 0.28);
      border-radius: 8px; width: 25px; height: 25px; cursor: pointer; font-weight: 700; font-size: 12px;
      display: flex; align-items: center; justify-content: center; padding: 0; transition: all 0.14s ease;
    }
    #ba-close:hover { background: #ef4444; color: #fff; border-color: #ef4444; }
    .ba-body { padding: 14px; display: flex; flex-direction: column; gap: 12px; }
    .ba-tabs {
      display: grid; grid-template-columns: repeat(5, 1fr); gap: 3px;
      background: var(--rb-elevated); border: 1px solid var(--rb-border);
      border-radius: 12px; padding: 4px;
    }
    .ba-tab-btn {
      border: 1px solid transparent; border-radius: 8px; padding: 7px 4px;
      background: transparent; color: var(--rb-muted); font: 600 11px inherit;
      cursor: pointer; transition: all 0.15s ease; display: flex; align-items: center; justify-content: center; gap: 4px;
      white-space: nowrap;
    }
    .ba-tab-btn:hover { color: var(--rb-text); background: rgba(255,255,255,0.03); }
    .ba-tab-btn.active {
      background: var(--rb-accent-dim); color: var(--rb-accent);
      border-color: var(--rb-accent-border); box-shadow: 0 2px 10px var(--rb-accent-glow);
      font-weight: 700;
    }
    .ba-pane { display: none; flex-direction: column; gap: 11px; }
    .ba-pane.active { display: flex; }
    .ba-card {
      background: var(--rb-card); border: 1px solid var(--rb-border); border-radius: 14px; padding: 12px;
    }
    .ba-row-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px; gap: 8px; }
    .ba-label { font-size: 12px; color: var(--rb-text); font-weight: 600; letter-spacing: -0.01em; }
    .ba-sub { font-size: 11px; color: var(--rb-muted); line-height: 1.4; }
    .ba-pill-btn {
      background: var(--rb-accent-dim); color: var(--rb-accent); border: 1px solid var(--rb-accent-border);
      border-radius: 999px; padding: 3px 10px; font: 600 10.5px inherit; cursor: pointer; transition: filter 0.14s;
    }
    .ba-pill-btn:hover { filter: brightness(1.14); }
    #ba-transfer-status:empty { display: none; }
    #ba-transfer-status[data-tone="err"] { color: #fca5a5; }
    #ba-transfer-status[data-tone="ok"] { color: #4ade80; }
    #ba-msg, #ba-tag, #ba-folder, #ba-auto-msg, #ba-transfer-name {
      width: 100%; box-sizing: border-box; background: var(--rb-elevated); color: var(--rb-text);
      border: 1px solid var(--rb-border-strong); border-radius: 10px; padding: 9px 11px;
      font: 12.5px/1.45 inherit; outline: none; user-select: text; transition: border-color 0.15s, box-shadow 0.15s;
    }
    #ba-msg, #ba-auto-msg { resize: vertical; }
    #ba-msg:focus, #ba-tag:focus, #ba-folder:focus, #ba-auto-msg:focus {
      border-color: var(--rb-accent-border); box-shadow: 0 0 0 3px var(--rb-accent-glow);
    }
    .ba-chips-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 9px; }
    .ba-chip-caption { font-size: 10.5px; color: var(--rb-muted); font-weight: 500; }
    .ba-chip {
      background: var(--rb-elevated); border: 1px solid var(--rb-border-strong); color: var(--rb-text);
      border-radius: 999px; padding: 3px 10px; font: 500 11px inherit; cursor: pointer;
      display: inline-flex; align-items: center; gap: 4px; transition: all 0.14s ease;
    }
    .ba-chip:hover {
      border-color: var(--rb-accent-border); color: var(--rb-accent); background: var(--rb-accent-dim);
      transform: translateY(-1px);
    }
    #ba-mode-switch {
      display: grid; grid-template-columns: 1fr 1fr; gap: 4px;
      background: var(--rb-elevated); border: 1px solid var(--rb-border); border-radius: 10px; padding: 3px;
    }
    #ba-mode-enviar, #ba-mode-finalizar {
      border: none; border-radius: 7px; padding: 7px 8px; font: 700 11.5px inherit; cursor: pointer; transition: all 0.15s;
    }
    #ba-mode-hint {
      margin-top: 8px; font-size: 11px; color: var(--rb-muted); line-height: 1.4;
    }
    .ba-cta {
      width: 100%; padding: 11px 14px; border: none; border-radius: 11px;
      font: 700 13px inherit; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 7px;
      background: var(--rb-accent); color: var(--rb-on-accent);
      box-shadow: 0 4px 18px var(--rb-accent-glow); transition: transform 0.12s ease, filter 0.15s ease;
    }
    .ba-cta:hover { filter: brightness(1.08); }
    .ba-cta:active { transform: scale(0.985); }
    /* Visual Pipeline Stepper */
    .ba-pipeline {
      display: flex; flex-direction: column; gap: 0;
      background: var(--rb-card); border: 1px solid var(--rb-border); border-radius: 14px; padding: 12px 13px;
    }
    .ba-step {
      display: flex; gap: 11px; position: relative;
    }
    .ba-step-rail {
      display: flex; flex-direction: column; align-items: center; width: 26px; flex-shrink: 0;
    }
    .ba-step-icon {
      width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-size: 13px; background: var(--rb-elevated); border: 1.5px solid var(--rb-border-strong);
      color: var(--rb-muted); transition: all 0.22s ease; z-index: 2;
    }
    .ba-step-line {
      width: 2px; flex-grow: 1; min-height: 20px; background: var(--rb-border); margin: 3px 0; transition: all 0.22s ease;
    }
    .ba-step:last-of-type .ba-step-line { display: none; }
    .ba-step-body {
      flex-grow: 1; padding-bottom: 11px; min-width: 0;
    }
    .ba-step:last-of-type .ba-step-body { padding-bottom: 3px; }
    .ba-step-hdr {
      display: flex; align-items: center; justify-content: space-between; gap: 6px;
    }
    .ba-step-title {
      font-size: 12px; font-weight: 700; color: var(--rb-text); letter-spacing: -0.01em; transition: color 0.2s ease;
    }
    .ba-step-status {
      font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 999px;
      background: rgba(255,255,255,0.06); color: var(--rb-muted); border: 1px solid var(--rb-border);
      transition: all 0.22s ease; white-space: nowrap;
    }
    .ba-step-desc {
      font-size: 11px; color: var(--rb-muted); margin: 2px 0 0; line-height: 1.35;
    }
    .ba-step[data-status="active"] .ba-step-icon {
      background: var(--rb-accent-dim); border-color: var(--rb-accent); color: var(--rb-accent);
      box-shadow: 0 0 12px var(--rb-accent-glow); animation: rb-pulse 1.3s ease-in-out infinite;
    }
    .ba-step[data-status="active"] .ba-step-title {
      color: var(--rb-accent);
    }
    .ba-step[data-status="active"] .ba-step-status {
      background: var(--rb-accent-dim); color: var(--rb-accent); border-color: var(--rb-accent-border);
      box-shadow: 0 0 8px var(--rb-accent-glow);
    }
    .ba-step[data-status="active"] .ba-step-line {
      background: linear-gradient(to bottom, var(--rb-accent), var(--rb-border));
    }
    .ba-step[data-status="done"] .ba-step-icon {
      background: rgba(34, 197, 94, 0.16); border-color: #22c55e; color: #4ade80;
    }
    .ba-step[data-status="done"] .ba-step-title {
      color: #f1f5f9;
    }
    .ba-step[data-status="done"] .ba-step-status {
      background: rgba(34, 197, 94, 0.16); color: #4ade80; border-color: rgba(34, 197, 94, 0.36);
    }
    .ba-step[data-status="done"] .ba-step-line {
      background: #22c55e;
    }
    .ba-step[data-status="waiting"] .ba-step-icon {
      background: rgba(245, 158, 11, 0.18); border-color: #f59e0b; color: #fbbf24;
      box-shadow: 0 0 10px rgba(245, 158, 11, 0.3); animation: rb-pulse 1.5s ease-in-out infinite;
    }
    .ba-step[data-status="waiting"] .ba-step-title {
      color: #fbbf24;
    }
    .ba-step[data-status="waiting"] .ba-step-status {
      background: rgba(245, 158, 11, 0.18); color: #fbbf24; border-color: rgba(245, 158, 11, 0.4);
    }
    .ba-loop-card {
      margin-top: 6px; padding: 9px 11px; border-radius: 11px;
      background: var(--rb-elevated); border: 1px dashed var(--rb-border-strong);
      display: flex; align-items: center; gap: 9px; transition: all 0.22s ease;
    }
    .ba-loop-card.active {
      border-style: solid; border-color: var(--rb-accent-border);
      background: var(--rb-accent-dim); box-shadow: 0 0 14px var(--rb-accent-glow);
    }
    .ba-loop-icon {
      font-size: 16px; line-height: 1; flex-shrink: 0;
    }
    .ba-loop-card.active .ba-loop-icon {
      animation: rb-spin 4s linear infinite;
    }
    @keyframes rb-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .ba-loop-title {
      font-size: 11.5px; font-weight: 700; color: var(--rb-text); letter-spacing: -0.01em;
    }
    .ba-loop-desc {
      font-size: 10.5px; color: var(--rb-muted); line-height: 1.35; margin-top: 1px;
    }
    #ba-pilot-start {
      background: var(--rb-accent); color: var(--rb-on-accent);
      font-weight: 700; font-size: 13px; letter-spacing: -0.01em;
      border-radius: 12px; box-shadow: 0 4px 18px var(--rb-accent-glow);
      transition: all 0.15s ease;
    }
    #ba-pilot-start:hover { filter: brightness(1.1); transform: translateY(-1px); }
    #ba-pilot-start:active { transform: scale(0.985); }

    #ba-claim-auto {
      background: #1e6bf1;
      color: #ffffff;
      font-weight: 700;
      font-size: 13.5px;
      letter-spacing: -0.01em;
      border-radius: 12px;
      box-shadow: 0 4px 16px rgba(30, 107, 241, 0.42);
      transition: all 0.15s ease;
    }
    #ba-claim-auto:hover {
      background: #175bd3;
      filter: brightness(1.06);
      box-shadow: 0 6px 20px rgba(30, 107, 241, 0.55);
      transform: translateY(-1px);
    }
    #ba-claim-auto:active {
      transform: scale(0.985);
      background: #134fb8;
    }
    .ba-actions-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    #ba-pause-all, #ba-unpause-all {
      padding: 11px 10px; border-radius: 11px; font: 600 12px inherit; cursor: pointer;
      border: 1px solid var(--rb-border-strong); background: var(--rb-elevated); color: var(--rb-text);
      display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.15s ease;
    }
    #ba-pause-all:hover { border-color: rgba(167, 139, 250, 0.55); color: #ddd6fe; background: rgba(139, 92, 246, 0.16); }
    #ba-unpause-all:hover { border-color: var(--rb-accent-border); color: var(--rb-accent); background: var(--rb-accent-dim); }
    #ba-run-bar {
      display: none; align-items: center; justify-content: space-between; gap: 8px;
      padding: 9px 11px; border-radius: 12px;
      background: var(--rb-accent-dim); border: 1px solid var(--rb-accent-border);
    }
    .ba-run-info { display: flex; align-items: center; gap: 7px; min-width: 0; }
    .ba-run-dot {
      width: 8px; height: 8px; border-radius: 99px; background: var(--rb-accent);
      box-shadow: 0 0 8px var(--rb-accent); animation: rb-pulse 1.3s ease-in-out infinite; flex-shrink: 0;
    }
    #ba-run-label { font-size: 11.5px; font-weight: 700; color: var(--rb-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ba-run-btns { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
    #ba-pause {
      padding: 6px 10px; border: none; border-radius: 8px; font: 700 11.5px inherit; cursor: pointer;
      background: #fbbf24; color: #0a0f08;
    }
    #ba-stop {
      padding: 6px 10px; border: 1px solid rgba(248, 113, 113, 0.38); border-radius: 8px;
      background: rgba(248, 113, 113, 0.18); color: #fca5a5; font: 700 11.5px inherit; cursor: pointer;
    }
    #ba-pause:hover, #ba-stop:hover { filter: brightness(1.1); }
    .ba-telemetry {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      padding: 2px 2px 0; font-size: 11.5px; color: var(--rb-muted);
    }
    #ba-cnt { color: var(--rb-accent); font-weight: 700; font-size: 13px; }
    .ba-mini-actions { display: flex; align-items: center; gap: 6px; }
    .ba-link-btn {
      background: transparent; border: none; color: var(--rb-muted); font: 500 11px inherit;
      cursor: pointer; padding: 2px 5px; border-radius: 6px; transition: color 0.14s, background 0.14s;
    }
    .ba-link-btn:hover { color: var(--rb-text); background: rgba(255,255,255,0.05); }
    #ba-log {
      background: var(--rb-elevated); border: 1px solid var(--rb-border); border-radius: 11px;
      padding: 9px 11px; max-height: 92px; overflow-y: auto;
      font: 11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--rb-accent);
    }
    #ba-auto-pill {
      display: none; padding: 3px 8px; border-radius: 999px; font-size: 10.5px; font-weight: 700;
      background: var(--rb-accent-dim); color: var(--rb-accent); border: 1px solid var(--rb-accent-border);
    }
    .ba-auto-state {
      padding: 2px 8px; border-radius: 999px; font-size: 10.5px; font-weight: 700; white-space: nowrap;
      background: rgba(100,116,139,0.35); color: #e2e8f0; border: 1px solid rgba(255,255,255,0.1);
    }
    .ba-auto-state[data-tone="on"] { background: rgba(34,197,94,0.18); color: #4ade80; border-color: rgba(34,197,94,0.4); }
    .ba-auto-state[data-tone="wait"] { background: rgba(245,158,11,0.18); color: #fbbf24; border-color: rgba(245,158,11,0.4); }
    .ba-auto-state[data-tone="err"] { background: rgba(248,113,113,0.18); color: #fca5a5; border-color: rgba(248,113,113,0.4); }
    .ba-auto-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .ba-auto-stats > div {
      display: flex; flex-direction: column; gap: 2px; padding: 7px 8px; border-radius: 10px;
      background: var(--rb-elevated); border: 1px solid var(--rb-border);
    }
    .ba-auto-stats b { font-size: 16px; color: var(--rb-accent); }
    #ba-auto-detail[data-tone="err"] { color: #fca5a5; }
    #ba-auto-detail[data-tone="wait"] { color: #fbbf24; }
    .ba-auto-list { display: flex; flex-direction: column; gap: 3px; margin-top: 8px; font: 10.5px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; }
    .ba-auto-list:empty { display: none; }
    .ba-auto-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 9px; }
  `;
  document.documentElement.appendChild(styleEl);

  async function ativarWakeLock() {
    if (!navigator.wakeLock || wakeLock) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener?.('release', () => { wakeLock = null; });
      log("🔆 Tela mantida ativa.");
    } catch {}
  }
  async function liberarWakeLock() {
    if (!wakeLock) return;
    try {
      await wakeLock.release();
    } catch {} finally {
      wakeLock = null;
    }
  }
  function onVisChange() {
    if (document.visibilityState === 'visible' && rodando && !pausado) {
      ativarWakeLock();
    }
  }
  document.addEventListener('visibilitychange', onVisChange);

  const p = document.createElement('div');
  p.id = 'blip-auto-panel';
  p.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;margin:0;padding:0;border:0;overflow:visible;z-index:2147483647;pointer-events:none;';
  p.innerHTML = `
  <div id="ba-win" data-rf-theme="${getSavedTheme()}">
    <div id="ba-hdr">
      <span class="ba-brand"><span class="ba-brand-badge">🤖</span> rod bot</span>
      <div class="ba-hdr-right">
        <span id="ba-auto-pill" title="Resposta automática a novos chats"></span>
        <span id="ba-st">Parado</span>
        <button id="ba-theme-btn" type="button" title="Alterar tema">🎨</button>
        <div id="ba-theme-menu">
          ${THEME_LIST.map(t => `<button type="button" class="ba-theme-opt" data-ba-theme="${t.id}">${t.label}</button>`).join('')}
        </div>
        <button id="ba-close" type="button" title="Fechar painel">✕</button>
      </div>
    </div>
    <div class="ba-body">
      <div id="ba-tabs" class="ba-tabs" role="tablist">
        <button id="ba-tab-piloto" class="ba-tab-btn" type="button" data-ba-tab="piloto">⚡ Piloto</button>
        <button id="ba-tab-pasta" class="ba-tab-btn" type="button" data-ba-tab="pasta">📁 Pastas</button>
        <button id="ba-tab-mensagem" class="ba-tab-btn" type="button" data-ba-tab="mensagem">✉️ Envio</button>
        <button id="ba-tab-fila" class="ba-tab-btn" type="button" data-ba-tab="fila">📥 Fila</button>
        <button id="ba-tab-auto" class="ba-tab-btn" type="button" data-ba-tab="auto">💬 Auto</button>
      </div>

      <div id="ba-pane-piloto" class="ba-pane">
        <div class="ba-pipeline">
          <div class="ba-step" id="ba-step-1" data-status="idle">
            <div class="ba-step-rail">
              <div class="ba-step-icon">📥</div>
              <div class="ba-step-line"></div>
            </div>
            <div class="ba-step-body">
              <div class="ba-step-hdr">
                <span class="ba-step-title">1. Puxar Fila (Atender)</span>
                <span class="ba-step-status" id="ba-status-1">Aguardando</span>
              </div>
              <p class="ba-step-desc">Clica em Atender a cada 0.5s até zerar a fila</p>
            </div>
          </div>

          <div class="ba-step" id="ba-step-2" data-status="idle">
            <div class="ba-step-rail">
              <div class="ba-step-icon">✉️</div>
              <div class="ba-step-line"></div>
            </div>
            <div class="ba-step-body">
              <div class="ba-step-hdr">
                <span class="ba-step-title">2. Enviar Mensagens</span>
                <span class="ba-step-status" id="ba-status-2">Pendente</span>
              </div>
              <p class="ba-step-desc">Dispara texto configurado sem finalizar ticket</p>
            </div>
          </div>

          <div class="ba-step" id="ba-step-3" data-status="idle">
            <div class="ba-step-rail">
              <div class="ba-step-icon">⏸️</div>
              <div class="ba-step-line"></div>
            </div>
            <div class="ba-step-body">
              <div class="ba-step-hdr">
                <span class="ba-step-title">3. Pausar Todos</span>
                <span class="ba-step-status" id="ba-status-3">Pendente</span>
              </div>
              <p class="ba-step-desc">Coloca todos os clientes atendidos em espera</p>
            </div>
          </div>

          <div class="ba-step" id="ba-step-4" data-status="idle">
            <div class="ba-step-rail">
              <div class="ba-step-icon">📁</div>
              <div class="ba-step-line"></div>
            </div>
            <div class="ba-step-body">
              <div class="ba-step-hdr">
                <span class="ba-step-title">4. Mover para Pasta</span>
                <span class="ba-step-status" id="ba-status-4">Pendente</span>
              </div>
              <p class="ba-step-desc">Envia os tickets para a pasta selecionada</p>
            </div>
          </div>

          <div class="ba-loop-card" id="ba-loop-card">
            <div class="ba-loop-icon">🔄</div>
            <div class="ba-loop-text">
              <div class="ba-loop-title">Loop Contínuo com Sentinela</div>
              <div class="ba-loop-desc" id="ba-loop-desc">Repete o ciclo. Se fila zerar, vigia até surgir 1 ou + clientes.</div>
            </div>
          </div>
        </div>

        <div class="ba-card">
          <div class="ba-row-head" style="margin-bottom:6px;">
            <span class="ba-label">⚙️ Configurações Rápidas</span>
            <span class="ba-sub" id="ba-pilot-cycle-badge" style="color:var(--rb-accent);font-weight:700;">Ciclo: #0</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <div>
              <div class="ba-row-head" style="margin-bottom:3px;">
                <label for="ba-pilot-folder" class="ba-sub" style="font-weight:600;color:var(--rb-text);">📁 Pasta Destino:</label>
              </div>
              <input id="ba-pilot-folder" type="text" placeholder="Ex: nv2, default..." />
              <div id="ba-pilot-folder-chips" class="ba-chips-row" style="margin-top:5px;"></div>
            </div>
            <div>
              <div class="ba-row-head" style="margin-bottom:3px;">
                <label for="ba-pilot-msg" class="ba-sub" style="font-weight:600;color:var(--rb-text);">✉️ Mensagem do Envio:</label>
                <button id="ba-pilot-fill-default" class="ba-pill-btn" type="button" title="Preencher mensagem padrão">📋 Usar padrão</button>
              </div>
              <textarea id="ba-pilot-msg" rows="2" placeholder="Digite a mensagem para os clientes..."></textarea>
            </div>
          </div>
        </div>

        <button id="ba-pilot-start" class="ba-cta" type="button">
          ⚡ Iniciar Piloto Automático
        </button>
      </div>

      <div id="ba-pane-pasta" class="ba-pane">
        <div class="ba-card">
          <div class="ba-row-head" style="margin-bottom:4px;">
            <label for="ba-folder" class="ba-label">Nome exato da pasta</label>
          </div>
          <p class="ba-sub" style="margin:0 0 9px;">Percorre a fila e move cada cliente para a pasta correspondente no Blip.</p>
          <input id="ba-folder" type="text" placeholder="Ex: nv2, default..." />
          <div id="ba-folder-chips" class="ba-chips-row"></div>
        </div>
        <button id="ba-move-folder" class="ba-cta" type="button">📁 Mover todos para pasta</button>
      </div>

      <div id="ba-pane-mensagem" class="ba-pane">
        <div class="ba-card">
          <div class="ba-row-head">
            <label for="ba-msg" class="ba-label">Mensagem para enviar</label>
            <button id="ba-fill-default" class="ba-pill-btn" type="button" title="Preencher com a mensagem padrão">📋 Usar padrão</button>
          </div>
          <textarea id="ba-msg" rows="3" placeholder="Digite ou cole o texto para os clientes da fila..."></textarea>
        </div>
        <div class="ba-card">
          <div class="ba-row-head">
            <span class="ba-label">Modo de operação</span>
          </div>
          <div id="ba-mode-switch">
            <button id="ba-mode-enviar" type="button" aria-pressed="true">🛡️ Só Enviar</button>
            <button id="ba-mode-finalizar" type="button" aria-pressed="false">⚡ Enviar + Finalizar</button>
          </div>
          <div id="ba-mode-hint"></div>
          <div id="ba-tag-wrap" style="display:none;margin-top:9px;padding-top:9px;border-top:1px solid var(--rb-border);">
            <label for="ba-tag" class="ba-label" style="display:block;margin-bottom:5px;">Tag para finalizar</label>
            <input id="ba-tag" type="text" placeholder="Ex: revi, cobran..." />
          </div>
        </div>
        <button id="ba-play" class="ba-cta" type="button">▶ Enviar para todos</button>
      </div>

      <div id="ba-pane-fila" class="ba-pane">
        <div class="ba-card">
          <div class="ba-row-head" style="margin-bottom:4px;">
            <span class="ba-label">📥 Atendimento Automático</span>
            <span class="ba-sub">Aguardando: <b id="ba-queue-count" style="color:var(--rb-accent);font-size:12px;">--</b></span>
          </div>
          <p class="ba-sub" style="margin:0 0 10px;">Clica em "Atender" a cada meio segundo (0.5s) até que a contagem da fila zere.</p>
          <button id="ba-claim-auto" class="ba-cta" type="button">Atender Automático</button>
        </div>
        <div class="ba-card">
          <div class="ba-label" style="margin-bottom:4px;">Controle de espera sem mensagem</div>
          <p class="ba-sub" style="margin:0 0 10px;">Altera o status de espera de todos os clientes visíveis na fila atual.</p>
          <div class="ba-actions-row">
            <button id="ba-pause-all" type="button">⏸️ Pausar todos</button>
            <button id="ba-unpause-all" type="button">▶️ Despausar todos</button>
          </div>
        </div>
        <div class="ba-card">
          <div class="ba-row-head" style="margin-bottom:4px;">
            <label for="ba-transfer-name" class="ba-label">🔁 Transferir para atendente</label>
          </div>
          <p class="ba-sub" style="margin:0 0 9px;">Transfere um ticket por vez, sempre o primeiro da lista atual, para o atendente pesquisado no Blip pelo nome exato. Não envia mensagens nem finaliza.</p>
          <input id="ba-transfer-name" type="text" placeholder="Nome do atendente (exato, como aparece no Blip)" autocomplete="off" />
          <div id="ba-transfer-status" class="ba-sub" style="margin-top:6px;"></div>
          <button id="ba-transfer-start" class="ba-cta" type="button" style="margin-top:9px;">🔁 Transferir todos para o atendente</button>
        </div>
      </div>

      <div id="ba-pane-auto" class="ba-pane">
        <div class="ba-card">
          <div class="ba-row-head">
            <span class="ba-label">💬 Resposta a novos chats</span>
            <span id="ba-auto-state" class="ba-auto-state" data-tone="off">Desativada</span>
          </div>
          <p class="ba-sub" style="margin:0 0 9px;">Envia a mensagem abaixo a cada chat que chegar depois da ativação e pausa o cliente só após confirmar o envio. Chats já presentes na ativação não recebem nada.</p>
          <button id="ba-auto-toggle" class="ba-cta" type="button">▶ Ativar resposta automática</button>
        </div>
        <div class="ba-card">
          <div class="ba-row-head">
            <label for="ba-auto-msg" class="ba-label">Mensagem automática</label>
            <button id="ba-auto-fill-default" class="ba-pill-btn" type="button" title="Preencher com a mensagem padrão">📋 Usar padrão</button>
          </div>
          <textarea id="ba-auto-msg" rows="3" placeholder="Texto enviado a cada novo chat..."></textarea>
          <p class="ba-sub" style="margin:6px 0 0;">Alterações valem a partir do próximo atendimento.</p>
        </div>
        <div class="ba-card">
          <div class="ba-auto-stats">
            <div><span class="ba-sub">Novos chats (BM)</span><b id="ba-auto-count">0</b></div>
            <div><span class="ba-sub">Contador Blip</span><b id="ba-auto-native">--</b></div>
            <div><span class="ba-sub">Na fila do BM</span><b id="ba-auto-queue">0</b></div>
          </div>
          <div id="ba-auto-detail" class="ba-sub" style="margin-top:8px;">Desativada.</div>
          <div id="ba-auto-list" class="ba-auto-list"></div>
          <div class="ba-auto-actions">
            <button id="ba-auto-resume" class="ba-pill-btn" type="button" style="display:none;">▶ Retomar</button>
            <button id="ba-auto-retry-pause" class="ba-pill-btn" type="button" style="display:none;">⏸️ Repetir pausas pendentes</button>
            <button id="ba-auto-reset" class="ba-link-btn" type="button">Zerar contador</button>
          </div>
        </div>
      </div>

      <div id="ba-run-bar">
        <div class="ba-run-info">
          <span class="ba-run-dot"></span>
          <span id="ba-run-label">Executando...</span>
        </div>
        <div class="ba-run-btns">
          <button id="ba-pause" type="button">⏸ Pausar</button>
          <button id="ba-stop" type="button">⏹ Parar</button>
        </div>
      </div>

      <div class="ba-telemetry">
        <span>Concluídos: <span id="ba-cnt">0</span></span>
        <div class="ba-mini-actions">
          <button id="ba-toggle-log" class="ba-link-btn" type="button">Ocultar log</button>
          <button id="ba-clear-log" class="ba-link-btn" type="button">Limpar</button>
        </div>
      </div>
      <div id="ba-log">Pronto para iniciar.</div>
    </div>
  </div>
  `;
  document.documentElement.appendChild(p);

  const win = document.getElementById('ba-win'), hdr = document.getElementById('ba-hdr');
  const themeBtn = document.getElementById('ba-theme-btn'), themeMenu = document.getElementById('ba-theme-menu');

  function applyTheme(t) {
    const valid = THEME_LIST.find(x => x.id === t) || THEME_LIST[0];
    win.setAttribute('data-rf-theme', valid.id);
    themeBtn.textContent = valid.short + ' Tema';
    themeMenu.querySelectorAll('.ba-theme-opt').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.baTheme === valid.id);
    });
  }
  applyTheme(getSavedTheme());

  themeBtn.onclick = e => {
    e.stopPropagation();
    const isOpen = themeMenu.getAttribute('data-open') === 'true';
    themeMenu.setAttribute('data-open', isOpen ? 'false' : 'true');
  };
  themeMenu.querySelectorAll('.ba-theme-opt').forEach(opt => {
    opt.onclick = e => {
      e.stopPropagation();
      const t = opt.dataset.baTheme;
      saveTheme(t);
      applyTheme(t);
      themeMenu.setAttribute('data-open', 'false');
    };
  });
  function onDocClickCloseTheme(e) {
    if (themeMenu && !themeMenu.contains(e.target) && e.target !== themeBtn) {
      themeMenu.setAttribute('data-open', 'false');
    }
  }
  function onSyncTheme(e) {
    if (e && e.detail) applyTheme(e.detail);
  }
  document.addEventListener('click', onDocClickCloseTheme);
  window.addEventListener('rf-bm-theme-change', onSyncTheme);

  let dg = false, dx = 0, dy = 0;
  hdr.onmousedown = e => {
    if (e.target.closest('button') || e.target.closest('#ba-theme-menu')) return;
    dg = true;
    dx = e.clientX - win.getBoundingClientRect().left;
    dy = e.clientY - win.getBoundingClientRect().top;
    hdr.style.cursor = 'grabbing';
    e.preventDefault();
  };
  function onDocMouseMove(e) {
    if (!dg) return;
    win.style.left = Math.max(0, Math.min(window.innerWidth - 60, e.clientX - dx)) + 'px';
    win.style.top = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - dy)) + 'px';
    win.style.right = 'auto';
  }
  function onDocMouseUp() {
    if (dg) {
      dg = false;
      hdr.style.cursor = 'grab';
    }
  }
  document.addEventListener('mousemove', onDocMouseMove);
  document.addEventListener('mouseup', onDocMouseUp);

  const stEl = document.getElementById('ba-st'), logEl = document.getElementById('ba-log');
  const cntEl = document.getElementById('ba-cnt'), btnPlay = document.getElementById('ba-play');
  const btnPause = document.getElementById('ba-pause'), btnStop = document.getElementById('ba-stop');
  const btnClose = document.getElementById('ba-close');
  const btnFillDefault = document.getElementById('ba-fill-default');
  const btnModeEnviar = document.getElementById('ba-mode-enviar');
  const btnModeFinalizar = document.getElementById('ba-mode-finalizar');
  const modeHintEl = document.getElementById('ba-mode-hint');
  const tagWrapEl = document.getElementById('ba-tag-wrap');
  const btnPauseAll = document.getElementById('ba-pause-all'), btnUnpauseAll = document.getElementById('ba-unpause-all');
  const msgEl = document.getElementById('ba-msg'), tagEl = document.getElementById('ba-tag');
  const folderEl = document.getElementById('ba-folder'), btnMoveFolder = document.getElementById('ba-move-folder');
  const folderChipsEl = document.getElementById('ba-folder-chips');
  const runBarEl = document.getElementById('ba-run-bar'), runLabelEl = document.getElementById('ba-run-label');
  const btnClearLog = document.getElementById('ba-clear-log'), btnToggleLog = document.getElementById('ba-toggle-log');
  const btnClaimAuto = document.getElementById('ba-claim-auto'), queueCountEl = document.getElementById('ba-queue-count');

  const pilotFolderEl = document.getElementById('ba-pilot-folder');
  const pilotMsgEl = document.getElementById('ba-pilot-msg');
  const pilotFolderChipsEl = document.getElementById('ba-pilot-folder-chips');
  const pilotFillDefaultBtn = document.getElementById('ba-pilot-fill-default');
  const btnPilotStart = document.getElementById('ba-pilot-start');

  const tabBtns = [...document.querySelectorAll('.ba-tab-btn')];
  const panes = {
    piloto: document.getElementById('ba-pane-piloto'),
    pasta: document.getElementById('ba-pane-pasta'),
    mensagem: document.getElementById('ba-pane-mensagem'),
    fila: document.getElementById('ba-pane-fila'),
    auto: document.getElementById('ba-pane-auto')
  };

  function aplicarAba(novaAba) {
    if (!panes[novaAba]) return;
    abaAtiva = novaAba;
    saveTab(novaAba);
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.baTab === novaAba));
    Object.keys(panes).forEach(k => panes[k].classList.toggle('active', k === novaAba));
  }
  tabBtns.forEach(b => {
    b.onclick = () => {
      if (rodando) return;
      aplicarAba(b.dataset.baTab);
    };
  });
  aplicarAba(abaAtiva);

  function renderFolderChips() {
    const folders = getRecentFolders();
    const html = `<span class="ba-chip-caption">Rápidas:</span>` +
      folders.map(f => `<button type="button" class="ba-chip" data-folder-chip="${f.replace(/"/g, '&quot;')}">📁 ${f.replace(/</g, '&lt;')}</button>`).join('');
    [folderChipsEl, pilotFolderChipsEl].forEach(container => {
      if (!container) return;
      container.innerHTML = html;
      container.querySelectorAll('.ba-chip').forEach(ch => {
        ch.onclick = () => {
          if (rodando) return;
          const val = ch.dataset.folderChip;
          if (folderEl) folderEl.value = val;
          if (pilotFolderEl) pilotFolderEl.value = val;
          CONFIG.pastaDestino = val;
        };
      });
    });
  }
  renderFolderChips();

  if (pilotFolderEl) {
    bindPanelInput(pilotFolderEl, CONFIG.pastaDestino, val => {
      CONFIG.pastaDestino = val;
      if (folderEl && folderEl.value !== val) folderEl.value = val;
    });
  }
  if (folderEl) {
    folderEl.addEventListener('input', () => {
      if (pilotFolderEl && pilotFolderEl.value !== folderEl.value) {
        pilotFolderEl.value = folderEl.value;
      }
    });
  }

  if (pilotMsgEl) {
    bindPanelInput(pilotMsgEl, CONFIG.mensagem, val => {
      CONFIG.mensagem = val;
      if (msgEl && msgEl.value !== val) msgEl.value = val;
    });
  }
  if (msgEl) {
    msgEl.addEventListener('input', () => {
      if (pilotMsgEl && pilotMsgEl.value !== msgEl.value) {
        pilotMsgEl.value = msgEl.value;
      }
    });
  }

  if (pilotFillDefaultBtn) {
    pilotFillDefaultBtn.onclick = () => {
      if (rodando) return;
      if (pilotMsgEl) {
        pilotMsgEl.value = MENSAGEM_PADRAO;
        pilotMsgEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (msgEl) {
        msgEl.value = MENSAGEM_PADRAO;
        msgEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
      CONFIG.mensagem = MENSAGEM_PADRAO;
      log("📋 Mensagem padrão carregada no Piloto.");
    };
  }

  function bindPanelInput(el, initialVal, onUpdate) {
    el.value = initialVal;
    el.addEventListener('input', () => onUpdate(el.value));
    ['keydown', 'keyup', 'keypress'].forEach(evt => {
      el.addEventListener(evt, e => e.stopPropagation());
    });
  }
  bindPanelInput(msgEl, CONFIG.mensagem, val => { CONFIG.mensagem = val; });
  bindPanelInput(tagEl, CONFIG.tagBusca, val => { CONFIG.tagBusca = val; });
  bindPanelInput(folderEl, CONFIG.pastaDestino, val => { CONFIG.pastaDestino = val; });

  btnClearLog.onclick = () => {
    logEl.innerHTML = '';
    log('🧹 Log limpo.');
  };
  btnToggleLog.onclick = () => {
    logOculto = !logOculto;
    logEl.style.display = logOculto ? 'none' : 'block';
    btnToggleLog.textContent = logOculto ? 'Mostrar log' : 'Ocultar log';
  };

  function aplicarModoVisual() {
    const ehFinalizar = modoChave === 'finalizar';
    btnModeEnviar.setAttribute('aria-pressed', ehFinalizar ? 'false' : 'true');
    btnModeFinalizar.setAttribute('aria-pressed', ehFinalizar ? 'true' : 'false');
    btnModeEnviar.style.background = ehFinalizar ? 'transparent' : 'var(--rb-accent)';
    btnModeEnviar.style.color = ehFinalizar ? 'var(--rb-muted)' : 'var(--rb-on-accent)';
    btnModeEnviar.style.boxShadow = ehFinalizar ? 'none' : '0 2px 12px var(--rb-accent-glow)';
    btnModeFinalizar.style.background = ehFinalizar ? '#0ea5e9' : 'transparent';
    btnModeFinalizar.style.color = ehFinalizar ? '#ffffff' : 'var(--rb-muted)';
    btnModeFinalizar.style.boxShadow = ehFinalizar ? '0 2px 12px rgba(14,165,233,0.4)' : 'none';
    if (ehFinalizar) {
      modeHintEl.innerHTML = '⚡ <b>Modo completo:</b> envia, aplica a tag e finaliza cada ticket.';
      modeHintEl.style.color = '#7dd3fc';
      tagWrapEl.style.display = 'block';
    } else {
      modeHintEl.innerHTML = '🛡️ <b>Modo seguro:</b> escreve para toda a fila sem encerrar tickets.';
      modeHintEl.style.color = 'var(--rb-muted)';
      tagWrapEl.style.display = 'none';
    }
    if (!rodando) {
      btnPlay.textContent = ehFinalizar ? '▶ Atender e Finalizar' : '▶ Enviar para todos';
      btnPlay.style.background = ehFinalizar ? '#0ea5e9' : 'var(--rb-accent)';
      btnPlay.style.color = ehFinalizar ? '#ffffff' : 'var(--rb-on-accent)';
      btnPlay.style.boxShadow = ehFinalizar ? '0 4px 16px rgba(14,165,233,0.35)' : '0 4px 16px var(--rb-accent-glow)';
    }
  }
  function definirModoChave(novoModo) {
    if (rodando || modoChave === novoModo) return;
    modoChave = novoModo;
    aplicarModoVisual();
    log(novoModo === 'finalizar'
      ? '⚡ Modo selecionado: Enviar + Finalizar'
      : '🛡️ Modo selecionado: Só Enviar (sem finalizar)');
  }
  aplicarModoVisual();

  function escapeRegExp(str) {
    return (str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  function normalizarTexto(str) {
    return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toUpperCase().trim();
  }
  function isElementoVisivel(el) {
    if (!el || el.hasAttribute?.('hidden')) return false;
    const style = typeof getComputedStyle === 'function' ? getComputedStyle(el) : el.style;
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
    if (typeof el.getBoundingClientRect === 'function') {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return false;
    }
    return true;
  }
  function log(m) {
    const t = new Date().toLocaleTimeString('pt-BR');
    logEl.innerHTML += `<div>[${t}] ${m}</div>`;
    logEl.scrollTop = logEl.scrollHeight;
    console.log('[BA] ' + m);
  }
  function setSt(t, c) { stEl.textContent = t; stEl.style.background = c; }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function clickUnico(el) {
    if (!el) return;
    el.focus?.();
    if (el.shadowRoot) {
      const inner = el.shadowRoot.querySelector('button, div, [role="button"]') || el;
      inner.click();
    } else {
      el.click();
    }
  }
  function waitFor(fn, timeout = 10000, interval = 300) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        try {
          const el = fn();
          if (el) return resolve(el);
        } catch(e) {}
        if (Date.now() - start > timeout) return reject(new Error('Timeout aguardando elemento'));
        setTimeout(check, interval);
      };
      check();
    });
  }
  async function fecharAvisosPendentes() {
    const toasts = document.querySelectorAll('button, bds-button, [role="alert"] button');
    for (const b of toasts) {
      const txt = (b.textContent || b.getAttribute('label') || '').trim().toLowerCase();
      if (txt === 'ok' || txt === 'fechar') {
        b.click();
        await sleep(300);
      }
    }
  }
  async function enviarTextoNoChat(texto) {
    await fecharAvisosPendentes();
    const input = await waitFor(() => {
      const el = document.querySelector('#text-input');
      return el && !el.disabled && isElementoVisivel(el) ? el : null;
    }, 8000);
    await preencherCampoMensagem(input, texto);
    dispararEnvioEnter(input);
    log("✅ Mensagem enviada!");
    await sleep(CONFIG.delayAcoes);
  }
  // Preenche o #text-input como a aplicação espera (setter nativo + eventos input/change).
  async function preencherCampoMensagem(input, texto) {
    input.focus();
    await sleep(250);
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter) setter.call(input, texto);
    else input.value = texto;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(400);
  }
  function dispararEnvioEnter(input) {
    input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true
    }));
  }
  async function passo1_mensagem() {
    const mensagemAtual = msgEl.value.trim();
    if (!mensagemAtual) throw new Error("A caixa de mensagem está vazia.");
    CONFIG.mensagem = mensagemAtual;
    log("📝 Enviando mensagem...");
    await enviarTextoNoChat(mensagemAtual);
  }
  async function passo2_tag() {
    const tagAtual = tagEl.value.trim();
    if (!tagAtual) throw new Error("A caixa da tag está vazia.");
    CONFIG.tagBusca = tagAtual;
    log("🏷️ Abrindo 'Adicionar tags'...");
    const addTagDiv = await waitFor(() => {
      const typo = [...document.querySelectorAll('bds-typo')].find(t => t.textContent.trim() === 'Adicionar tags');
      if (typo) return typo.parentElement;
      return document.querySelector('.tags-container div.pointer');
    });
    clickUnico(addTagDiv);
    await sleep(CONFIG.delayAcoes);
    const selectChips = await waitFor(() => document.querySelector('bds-select-chips'));
    if (!selectChips.shadowRoot) throw new Error("ShadowRoot indisponível");
    log(`🔍 Digitando '${tagAtual}'...`);
    const tagInput = await waitFor(() => {
      return selectChips.shadowRoot.querySelector('input') ||
      selectChips.shadowRoot.querySelector('bds-input')?.shadowRoot?.querySelector('input');
    });
    tagInput.focus();
    await sleep(200);
    const iSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (iSetter) iSetter.call(tagInput, tagAtual);
    else tagInput.value = tagAtual;
    tagInput.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    tagInput.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    tagInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, composed: true }));
    await sleep(1200);
    log("📋 Selecionando resultado abaixo da pesquisa...");
    const termoBusca = normalizarTexto(tagAtual);
    const inicioBusca = Date.now();
    const tagOption = await waitFor(() => {
      const container = selectChips.shadowRoot.querySelector('div.select__options--open') || selectChips.shadowRoot;
      const options = [...container.querySelectorAll('bds-select-option')];
      const visiveis = options.filter(isElementoVisivel);
      if (visiveis.length === 0) return null;
      const match = visiveis.find(opt => {
        const txt = normalizarTexto(
          opt.textContent || opt.innerText || opt.shadowRoot?.textContent ||
          opt.getAttribute?.('title-text') || opt.getAttribute?.('value') || ''
        );
        return txt.includes(termoBusca);
      });
      if (match) return match;
      if (visiveis.length === 1 || Date.now() - inicioBusca > 2000) {
        return visiveis[0];
      }
      return null;
    });
    clickUnico(tagOption);
    log("✅ Tag selecionada!");
    await sleep(CONFIG.delayAcoes);
  }
  async function passo3_finalizar() {
    log("🔵 Clicando em 'Finalizar'...");
    const btnFinalizar = await waitFor(() => {
      const btnIcon = document.querySelector('#close-ticket-button-icon');
      if (btnIcon) {
        return btnIcon.shadowRoot?.querySelector('button') || btnIcon;
      }
      return document.querySelector('.pane-chat-buttons button, button#close-ticket-button');
    });
    clickUnico(btnFinalizar);
    log("✅ Clicou em Finalizar");
    await sleep(700);
  }
  async function passo4_confirmarModal() {
    log("📋 Confirmando no modal...");
    const btnConfirmar = await waitFor(() => {
      const btns = document.querySelectorAll('button, bds-button');
      for (const b of btns) {
        const txt = (b.textContent || b.getAttribute('label') || '').trim().toLowerCase();
        if (txt.includes('finalizar ticket')) {
          return b.shadowRoot?.querySelector('button') || b;
        }
      }
      const modal = document.querySelector('[class*="modal"], [role="dialog"], bds-modal');
      if (modal) {
        const mBtn = modal.querySelector('button.primary, button[variant="primary"], bds-button');
        if (mBtn) return mBtn.shadowRoot?.querySelector('button') || mBtn;
      }
      return null;
    }, 12000);
    await sleep(500);
    btnConfirmar.click();
    log("✅ Ticket finalizado!");
    await sleep(1000);
    await fecharAvisosPendentes();
    await sleep(CONFIG.delayTrocaTicket);
  }
  async function passo5_proximoFila() {
    log("👤 Mudando para o próximo da fila...");
    await fecharAvisosPendentes();
    await sleep(1500);
    const items = document.querySelectorAll('article.chat-list-item');
    if (items.length > 0) {
      clickUnico(items[0]);
      log(`✅ Cliente selecionado! (${items.length} restantes)`);
      log("⏳ Aguardando novo chat carregar...");
      await waitFor(() => document.querySelector('#text-input'), 8000);
      await sleep(CONFIG.delayAcoes);
      return true;
    }
    log("🏁 Nenhum cliente restante na fila.");
    return false;
  }

  function atualizarBotoesEstado(emExecucao, tituloExec = '') {
    const controlesBloqueados = [
      btnModeEnviar, btnModeFinalizar, btnFillDefault, pilotFillDefaultBtn,
      btnPauseAll, btnUnpauseAll, btnPlay, btnMoveFolder, btnClaimAuto, ...tabBtns,
      document.getElementById('ba-transfer-name'), document.getElementById('ba-transfer-start')
    ].filter(Boolean);

    if (emExecucao) {
      setSt('Rodando', '#16a34a');
      runBarEl.style.display = 'flex';
      runLabelEl.textContent = tituloExec || 'Automação em execução...';
      btnPause.textContent = '⏸ Pausar';

      if (modoAtual === 'piloto') {
        if (btnPilotStart) {
          btnPilotStart.disabled = false;
          btnPilotStart.style.opacity = '1';
          btnPilotStart.style.cursor = 'pointer';
          btnPilotStart.textContent = '⏹ Interromper Piloto Contínuo';
          btnPilotStart.style.background = '#ef4444';
          btnPilotStart.style.color = '#ffffff';
        }
      } else {
        if (btnPilotStart) {
          btnPilotStart.disabled = true;
          btnPilotStart.style.opacity = '0.52';
          btnPilotStart.style.cursor = 'not-allowed';
        }
      }
    } else {
      setSt('Parado', 'rgba(100,116,139,0.55)');
      runBarEl.style.display = 'none';
      aplicarModoVisual();

      if (btnPilotStart) {
        btnPilotStart.disabled = false;
        btnPilotStart.style.opacity = '1';
        btnPilotStart.style.cursor = 'pointer';
        btnPilotStart.textContent = '⚡ Iniciar Piloto Automático';
        btnPilotStart.style.background = '';
        btnPilotStart.style.color = '';
      }
    }

    for (const b of controlesBloqueados) {
      b.disabled = emExecucao;
      b.style.opacity = emExecucao ? '0.52' : '1';
      b.style.cursor = emExecucao ? 'not-allowed' : 'pointer';
    }
  }
  async function aguardarPausaSeNecessario() {
    while (pausado && rodando) {
      setSt('Pausado', '#d97706');
      await sleep(400);
    }
    if (rodando) setSt('Rodando', '#16a34a');
    return rodando;
  }
  function isAcaoMenuVisivel(el) {
    if (!el) return false;
    if (isElementoVisivel(el)) return true;
    const inner = el.shadowRoot?.querySelector('button, div');
    return !!(inner && isElementoVisivel(inner));
  }
  function encontrarOpcaoMenu(wrap, testId) {
    const local = wrap?.querySelector(`bds-menu-action[data-testid="${testId}"]`);
    if (isAcaoMenuVisivel(local)) return local;
    const abertos = document.querySelectorAll(`bds-menu[open] bds-menu-action[data-testid="${testId}"], div.ticket-menu.visible bds-menu-action[data-testid="${testId}"]`);
    for (const el of abertos) {
      if (isAcaoMenuVisivel(el)) return el;
    }
    return null;
  }
  function menuEstaAberto(wrap) {
    if (!wrap) return false;
    const menu = wrap.querySelector('bds-menu');
    if (menu && (menu.open === true || menu.hasAttribute('open'))) return true;
    return [...wrap.querySelectorAll('bds-menu-action')].some(isAcaoMenuVisivel);
  }
  async function fecharMenuTicket(wrap, btn) {
    const menu = wrap?.querySelector('bds-menu');
    if (menu && typeof menu.open === 'boolean') menu.open = false;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
    await sleep(150);
    if (menuEstaAberto(wrap)) {
      clickUnico(btn);
      await sleep(150);
    }
  }
  function dispararCliqueReal(el) {
    if (!el) return;
    try { el.focus?.(); } catch {}
    const rect = el.getBoundingClientRect?.() || { left: 0, top: 0, width: 10, height: 10 };
    const clientX = Math.round(rect.left + (rect.width || 10) / 2);
    const clientY = Math.round(rect.top + (rect.height || 10) / 2);
    const evInit = { bubbles: true, cancelable: true, composed: true, view: window, clientX, clientY };
    try { el.dispatchEvent(new PointerEvent('pointerover', evInit)); } catch {}
    try { el.dispatchEvent(new MouseEvent('mouseover', evInit)); } catch {}
    try { el.dispatchEvent(new PointerEvent('pointerenter', evInit)); } catch {}
    try { el.dispatchEvent(new PointerEvent('pointerdown', evInit)); } catch {}
    try { el.dispatchEvent(new MouseEvent('mousedown', evInit)); } catch {}
    try { el.dispatchEvent(new PointerEvent('pointerup', evInit)); } catch {}
    try { el.dispatchEvent(new MouseEvent('mouseup', evInit)); } catch {}
    try { el.dispatchEvent(new MouseEvent('click', evInit)); } catch {}
    if (typeof el.click === 'function') {
      try { el.click(); } catch {}
    }
  }

  function obterScrollContainerGeral() {
    const seletores = [
      '.infinite-scroll',
      '.chat-list',
      '[class*="chat-list"]',
      'aside.chat-list',
      '.list-container',
      'aside',
      'main [class*="list"]'
    ];
    for (const sel of seletores) {
      const el = document.querySelector(sel);
      if (el && el.scrollHeight > el.clientHeight + 5) return el;
    }
    return null;
  }

  function encontrarContainerScroll(el) {
    let cur = el?.parentElement;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      try {
        const st = getComputedStyle(cur);
        if ((st.overflowY === 'auto' || st.overflowY === 'scroll' || st.overflowY === 'overlay') && cur.scrollHeight > cur.clientHeight + 5) {
          return cur;
        }
      } catch {}
      cur = cur.parentElement;
    }
    return obterScrollContainerGeral();
  }

  function obterChaveElemento(el, idxFallback) {
    if (el.id) return el.id;
    const card = el.closest('article.chat-list-item, [class*="chat-list-item"], [class*="ticket"]') || el;
    const aria = card.getAttribute?.('aria-label');
    if (aria) return aria;
    const txt = (card.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    return txt || `idx-${idxFallback}`;
  }

  function rolarCardNoContainer(card, scrollContainer) {
    if (!card) return;
    if (scrollContainer) {
      const cRect = scrollContainer.getBoundingClientRect();
      const eRect = card.getBoundingClientRect();
      if (eRect.top < cRect.top || eRect.bottom > cRect.bottom) {
        scrollContainer.scrollTop += (eRect.top - cRect.top) - (cRect.height / 2) + (eRect.height / 2);
      }
    } else {
      card.scrollIntoView?.({ block: 'nearest', behavior: 'instant' });
    }
  }

  function encontrarAcaoMoverPara(wrap) {
    const roots = [
      wrap?.querySelector('bds-menu'),
      wrap,
      document.querySelector('div.ticket-menu.visible bds-menu'),
      document.querySelector('div.ticket-menu.visible'),
      document.querySelector('bds-menu[open]')
    ].filter(Boolean);

    for (const r of roots) {
      const actions = [...r.querySelectorAll('bds-menu-action')];
      for (const a of actions) {
        const btnText = normalizarTexto(a.getAttribute('button-text'));
        const sub = normalizarTexto(a.getAttribute('subtitle'));
        const icon = (a.getAttribute('icon-left') || '').toLowerCase();
        if ((btnText === 'MOVER PARA' || btnText.includes('MOVER PARA') || (icon === 'folder' && sub.includes('PASTA'))) && isAcaoMenuVisivel(a)) {
          return a;
        }
      }
    }
    return null;
  }

  function coletarElementosProfundos(root, out = [], depth = 0) {
    if (!root || depth > 8) return out;
    const children = root.children || [];
    for (const ch of children) {
      const tag = ch.tagName ? ch.tagName.toLowerCase() : '';
      if (tag === 'svg' || tag === 'path' || tag === 'style' || tag === 'script') continue;
      out.push(ch);
      if (ch.shadowRoot) {
        coletarElementosProfundos(ch.shadowRoot, out, depth + 1);
      }
      coletarElementosProfundos(ch, out, depth + 1);
    }
    return out;
  }

  function coletarCandidatosPasta(acaoMover, wrap) {
    const lista = [];
    const seen = new Set();
    const pushAll = arr => {
      for (const el of arr) {
        if (!seen.has(el)) {
          seen.add(el);
          lista.push(el);
        }
      }
    };
    if (acaoMover) {
      pushAll(coletarElementosProfundos(acaoMover));
      if (acaoMover.shadowRoot) pushAll(coletarElementosProfundos(acaoMover.shadowRoot));
    }
    if (wrap) {
      const vis = wrap.querySelectorAll('bds-menu-action *, [class*="submenu"] *, [class*="sub-menu"] *');
      pushAll(vis);
    }
    const openSub = document.querySelectorAll('div.ticket-menu.visible bds-menu-action *, bds-menu[open] bds-menu-action *');
    pushAll(openSub);
    return lista;
  }

  function testarCorrespondenciaPasta(alvoNorm, textoBruto) {
    if (!alvoNorm || !textoBruto) return false;
    const candNorm = normalizarTexto(textoBruto);
    if (!candNorm) return false;
    if (candNorm === alvoNorm) return true;
    const pat = new RegExp('^' + escapeRegExp(alvoNorm) + '(?:\\s*\\(?\\d+\\)?|\\s+\\d+)$', 'i');
    if (pat.test(candNorm)) return true;
    const semNum = candNorm.replace(/\\d+/g, '').replace(/[\\(\\)\\[\\]]/g, '').trim();
    if (semNum === alvoNorm) return true;
    return false;
  }

  function coletarNomesPastasVisiveis(acaoMover, wrap) {
    const nomes = [];
    const seen = new Set();
    const candidatos = coletarCandidatosPasta(acaoMover, wrap);
    for (const el of candidatos) {
      const raw = (el.innerText || el.textContent || el.getAttribute?.('button-text') || el.getAttribute?.('label') || '').replace(/\s+/g, ' ').trim();
      if (!raw || raw.length > 35) continue;
      const semCont = raw.replace(/\s*\(\d+\)$|\s+\d+$/, '').trim();
      const lower = semCont.toLowerCase();
      if (!semCont || /^\d+$/.test(semCont) || lower.includes('mover para') || lower.includes('mover o ticket') || lower === 'arrow-right' || lower === 'folder') continue;
      if (!seen.has(lower)) {
        seen.add(lower);
        nomes.push(semCont);
      }
    }
    return nomes.slice(0, 12);
  }

  async function percorrerItensFila({ modo, seletor, tituloInicio, tituloBarra, verboPassado, processarItem, aoErro }) {
    if (rodando) return;
    rodando = true;
    pausado = false;
    modoAtual = modo;
    ativarWakeLock();
    atualizarBotoesEstado(true, tituloBarra || tituloInicio);
    const processados = new Set();
    let alterados = 0;
    let pulados = 0;
    let scrollContainer = null;
    let tentativasFim = 0;
    try {
      const iniciais = [...document.querySelectorAll(seletor)];
      if (iniciais.length === 0) {
        log('⚠️ Nenhum cliente encontrado na fila.');
        return;
      }
      scrollContainer = encontrarContainerScroll(iniciais[0]);
      if (scrollContainer && scrollContainer.scrollTop > 0) {
        scrollContainer.scrollTop = 0;
        await sleep(350);
      }
      cntEl.textContent = '0';
      log(`🚀 ${tituloInicio} (${iniciais.length} visíveis)...`);
      while (rodando) {
        if (!(await aguardarPausaSeNecessario())) break;
        const lista = [...document.querySelectorAll(seletor)];
        let alvo = null;
        let chave = '';
        for (let i = 0; i < lista.length; i++) {
          const item = lista[i];
          const k = obterChaveElemento(item, i);
          if (!processados.has(k)) {
            alvo = item;
            chave = k;
            break;
          }
        }
        if (!alvo) {
          tentativasFim++;
          if (tentativasFim <= 4) {
            scrollContainer = scrollContainer || encontrarContainerScroll(lista[lista.length - 1]);
            log(`⏳ Rolando fila para carregar mais atendimentos (${tentativasFim}/4)...`);
            if (scrollContainer) {
              scrollContainer.scrollTop += Math.max(300, Math.floor(scrollContainer.clientHeight * 0.8));
              scrollContainer.dispatchEvent(new Event('scroll', { bubbles: true }));
            }
            window.dispatchEvent(new Event('scroll'));
            await sleep(1400);
            continue;
          }
          break;
        }
        tentativasFim = 0;
        processados.add(chave);
        try {
          const res = await processarItem(alvo, chave, alterados, scrollContainer);
          if (res === 'alterado') {
            alterados++;
            cntEl.textContent = alterados;
          } else if (res === 'pulado') {
            pulados++;
          }
        } catch (err) {
          log(`❌ Erro (${chave}): ${err.message}`);
          if (aoErro) await aoErro(alvo, err);
          await fecharAvisosPendentes();
        }
        await sleep(350);
      }
      log(`🏁 Finalizado: ${alterados} ${verboPassado}(s)${pulados ? `, ${pulados} pulado(s)` : ''}.`);
    } finally {
      rodando = false;
      pausado = false;
      modoAtual = null;
      await liberarWakeLock();
      atualizarBotoesEstado(false);
      log("⏹ Automação parada.");
    }
  }

  async function rolarFila() {
    const sc = obterScrollContainerGeral();
    if (sc) {
      sc.scrollTop += Math.max(300, Math.floor(sc.clientHeight * 0.8));
      sc.dispatchEvent(new Event('scroll', { bubbles: true }));
    }
    const articles = document.querySelectorAll('article.chat-list-item');
    if (articles.length > 0) {
      articles[articles.length - 1].scrollIntoView?.({ block: 'end', behavior: 'instant' });
    }
    window.dispatchEvent(new Event('scroll'));
  }

  async function processarMoverTicket(alvo, pasta, alvoNorm, labelId, totalAtual) {
    const wrap = alvo.closest('.ticket-menu') || alvo.parentElement;
    const card = alvo.closest('article.chat-list-item, [class*="chat-list-item"], [class*="ticket"]') || wrap;

    card?.scrollIntoView?.({ block: 'nearest', behavior: 'instant' });
    card?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    card?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    wrap?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await sleep(150);

    // 1. Abre o menu dos 3 pontinhos
    clickUnico(alvo);
    await sleep(250);

    // 2. Localiza a opção "Mover para"
    const acaoMover = await waitFor(() => encontrarAcaoMoverPara(wrap), 3500, 100).catch(() => null);
    if (!acaoMover) {
      log(`⏭️ Opção "Mover para" não disponível no ticket ${labelId}.`);
      await fecharMenuTicket(wrap, alvo);
      return 'pulado';
    }

    if (!(await aguardarPausaSeNecessario())) {
      await fecharMenuTicket(wrap, alvo);
      return 'parado';
    }

    // 3. Hover sobre "Mover para" para abrir o submenu de pastas
    acaoMover.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    acaoMover.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    acaoMover.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    const innerBtn = acaoMover.shadowRoot?.querySelector('button.menuaction__button, button') || acaoMover;
    innerBtn.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    innerBtn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    innerBtn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    await sleep(350);

    // 4. Busca a pasta correspondente no container exato: div.folder-submenu-container > span.custom-submenu-item > span.sub-menu
    const resultado = await waitFor(() => {
      const containers = [
        acaoMover.querySelector('.folder-submenu-container'),
        ...document.querySelectorAll('div.folder-submenu-container, .folder-submenu-container')
      ].filter(Boolean);

      let itens = [];
      for (const c of containers) {
        itens.push(...c.querySelectorAll('.custom-submenu-item, span.custom-submenu-item, [class*="submenu-item"]'));
      }
      if (itens.length === 0) {
        itens = [...acaoMover.querySelectorAll('.custom-submenu-item, span.custom-submenu-item, [class*="submenu-item"], span.sub-menu')];
      }

      for (const item of itens) {
        const nameEl = item.querySelector('.sub-menu, [class*="sub-menu"]') || item;
        const raw = (nameEl.textContent || nameEl.innerText || '').trim();
        if (!raw) continue;
        if (testarCorrespondenciaPasta(alvoNorm, raw)) {
          return { item, nameEl, raw };
        }
      }
      return null;
    }, 2800, 100).catch(() => null);

    if (!(await aguardarPausaSeNecessario())) {
      await fecharMenuTicket(wrap, alvo);
      return 'parado';
    }

    if (!resultado) {
      const vistas = coletarNomesPastasVisiveis(acaoMover, wrap);
      const extra = vistas.length ? ` (Vistas: ${vistas.join(', ')})` : '';
      log(`⚠️ Pasta "${pasta}" não encontrada no ticket ${labelId}${extra}.`);
      await fecharMenuTicket(wrap, alvo);
      return 'pulado';
    }

    // 5. Dispara clique real no item da pasta e no span interno
    const alvoClick = resultado.item;
    const nameClick = resultado.nameEl;
    dispararCliqueReal(alvoClick);
    if (nameClick !== alvoClick) {
      dispararCliqueReal(nameClick);
    }

    saveRecentFolder(pasta);
    renderFolderChips();
    log(`✅ Ticket ${labelId} movido para "${pasta}"! (${totalAtual + 1})`);

    // 6. Aguarda o Blip processar a mudança de pasta
    await sleep(750);
    await fecharAvisosPendentes();
    if (menuEstaAberto(wrap)) {
      await fecharMenuTicket(wrap, alvo);
    }
    return 'alterado';
  }

  async function executarMoverParaPastaTodos(nomePasta) {
    const pasta = (nomePasta || folderEl.value).trim();
    if (!pasta) {
      log('⚠️ Digite o nome exato da pasta antes de iniciar.');
      folderEl.focus();
      return;
    }
    CONFIG.pastaDestino = pasta;
    const alvoNorm = normalizarTexto(pasta);

    if (rodando) return;
    rodando = true;
    pausado = false;
    modoAtual = 'pasta';
    ativarWakeLock();
    atualizarBotoesEstado(true, `Movendo → ${pasta}`);

    cntEl.textContent = '0';
    let alterados = 0;
    let pulados = 0;
    const falhasSeguidas = new Map();
    let tentativasSemTickets = 0;

    log(`🚀 Iniciando movimentação para a pasta "${pasta}"...`);

    try {
      while (rodando) {
        if (!(await aguardarPausaSeNecessario())) break;

        const lista = [...document.querySelectorAll('button.ticket-info-options')];
        if (lista.length === 0) {
          tentativasSemTickets++;
          if (tentativasSemTickets <= 4) {
            log(`⏳ Carregando fila (${tentativasSemTickets}/4)...`);
            await rolarFila();
            await sleep(1200);
            continue;
          }
          log('🏁 Fila vazia ou nenhum cliente restante.');
          break;
        }

        // Pega o primeiro da fila que não esteja em loop de falha
        let alvo = null;
        let chave = '';
        for (let i = 0; i < lista.length; i++) {
          const item = lista[i];
          const k = obterChaveElemento(item, i);
          const falhas = falhasSeguidas.get(k) || 0;
          if (falhas < 2) {
            alvo = item;
            chave = k;
            break;
          }
        }

        if (!alvo) {
          tentativasSemTickets++;
          if (tentativasSemTickets <= 3) {
            log(`⏳ Tentando carregar novos tickets além dos pulados (${tentativasSemTickets}/3)...`);
            await rolarFila();
            await sleep(1400);
            continue;
          }
          log('🏁 Todos os tickets restantes foram processados ou pulados.');
          break;
        }

        tentativasSemTickets = 0;
        const labelId = alvo.id ? `#${alvo.id.replace('menu-', '')}` : chave;

        try {
          const res = await processarMoverTicket(alvo, pasta, alvoNorm, labelId, alterados);
          if (res === 'alterado') {
            alterados++;
            cntEl.textContent = alterados;
            falhasSeguidas.delete(chave);
          } else {
            pulados++;
            const f = falhasSeguidas.get(chave) || 0;
            falhasSeguidas.set(chave, f + 1);
          }
        } catch (err) {
          log(`❌ Erro no ticket ${labelId}: ${err.message}`);
          pulados++;
          const f = falhasSeguidas.get(chave) || 0;
          falhasSeguidas.set(chave, f + 1);
          await fecharAvisosPendentes();
        }

        // Aguarda a fila atualizar (o ticket sair e o próximo tomar o lugar no topo!)
        await sleep(CONFIG.delayAcoes);
      }

      log(`🏁 Finalizado: ${alterados} movido(s) para "${pasta}"${pulados ? `, ${pulados} pulado(s)` : ''}.`);
    } finally {
      rodando = false;
      pausado = false;
      modoAtual = null;
      await liberarWakeLock();
      atualizarBotoesEstado(false);
      log("⏹ Automação parada.");
    }
  }

  async function executarModoEsperaTodos(acao) {
    const ehPausar = acao === 'pausar';
    const targetTestId = ehPausar ? 'option-setStandbyMode' : 'option-unsetStandbyMode';
    const oppositeTestId = ehPausar ? 'option-unsetStandbyMode' : 'option-setStandbyMode';
    const verbo = ehPausar ? 'Pausando' : 'Despausando';
    const verboPassado = ehPausar ? 'pausado' : 'despausado';
    await percorrerItensFila({
      modo: acao,
      seletor: 'button.ticket-info-options',
      tituloInicio: `${verbo} todos os clientes`,
      tituloBarra: `${verbo} fila`,
      verboPassado,
      processarItem: async (alvo, chave, totalAtual, scrollContainer) => {
        const wrap = alvo.closest('.ticket-menu') || alvo.parentElement;
        const card = alvo.closest('article.chat-list-item, [class*="chat-list-item"], [class*="ticket"]') || wrap;
        const labelId = alvo.id ? `#${alvo.id.replace('menu-', '')}` : chave;
        rolarCardNoContainer(card, scrollContainer);
        card?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        card?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        wrap?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        await sleep(120);
        clickUnico(alvo);
        const acaoEncontrada = await waitFor(() => {
          const t = encontrarOpcaoMenu(wrap, targetTestId);
          if (t) return { tipo: 'alvo', el: t };
          const o = encontrarOpcaoMenu(wrap, oppositeTestId);
          if (o) return { tipo: 'oposto', el: o };
          return null;
        }, 3500, 100);
        if (!(await aguardarPausaSeNecessario())) {
          await fecharMenuTicket(wrap, alvo);
          return 'parado';
        }
        if (acaoEncontrada.tipo === 'alvo') {
          const innerBtn = acaoEncontrada.el.shadowRoot?.querySelector('button.menuaction__button, button') || acaoEncontrada.el;
          await sleep(150);
          clickUnico(innerBtn);
          log(`✅ Ticket ${labelId} ${verboPassado}! (${totalAtual + 1})`);
          await sleep(550);
          await fecharAvisosPendentes();
          return 'alterado';
        }
        log(`⏭️ Ticket ${labelId} já estava ${verboPassado}.`);
        await fecharMenuTicket(wrap, alvo);
        return 'pulado';
      },
      aoErro: async (alvo) => {
        const wrap = alvo.closest('.ticket-menu') || alvo.parentElement;
        await fecharMenuTicket(wrap, alvo);
      }
    });
  }

  async function executarEscreverParaTodos(texto) {
    if (rodando) return;
    const mensagem = (texto || msgEl.value).trim();
    if (!mensagem) {
      log('⚠️ Digite uma mensagem antes de iniciar.');
      msgEl.focus();
      return;
    }
    CONFIG.mensagem = mensagem;
    await percorrerItensFila({
      modo: 'escrever',
      seletor: 'article.chat-list-item',
      tituloInicio: 'Escrevendo para todos os clientes',
      tituloBarra: 'Enviando mensagem...',
      verboPassado: 'enviado',
      processarItem: async (card, chave, totalAtual, scrollContainer) => {
        const nome = card.getAttribute('aria-label') || chave;
        rolarCardNoContainer(card, scrollContainer);
        await sleep(120);
        clickUnico(card);
        log(`👤 [${totalAtual + 1}] ${nome}`);
        await sleep(Math.max(800, CONFIG.delayTrocaTicket));
        if (!(await aguardarPausaSeNecessario())) return 'parado';
        await enviarTextoNoChat(mensagem);
        return 'alterado';
      }
    });
  }

  async function loop() {
    rodando = true;
    pausado = false;
    modoAtual = 'atender';
    atualizarBotoesEstado(true, 'Atendendo e finalizando...');
    while (rodando) {
      if (!(await aguardarPausaSeNecessario())) break;
      log(`━━━ Ticket #${tickets + 1} ━━━`);
      try {
        await passo1_mensagem();
        if (!rodando) break;
        await passo2_tag();
        if (!rodando) break;
        await passo3_finalizar();
        if (!rodando) break;
        await passo4_confirmarModal();
        if (!rodando) break;
        tickets++;
        cntEl.textContent = tickets;
        log(`🎉 Ticket #${tickets} finalizado com sucesso!`);
        const temMais = await passo5_proximoFila();
        if (!temMais) break;
      } catch (err) {
        log(`❌ Erro: ${err.message}`);
        await fecharAvisosPendentes();
        log("⏳ Aguardando 5s para tentar novamente...");
        await sleep(5000);
      }
    }
    rodando = false;
    pausado = false;
    modoAtual = null;
    await liberarWakeLock();
    atualizarBotoesEstado(false);
    log("⏹ Automação parada.");
  }

  function obterCamposPainel(exigirTag = true) {
    const mensagem = msgEl.value.trim();
    if (!mensagem) {
      log("⚠️ Digite uma mensagem na caixa antes de iniciar.");
      msgEl.focus();
      return null;
    }
    CONFIG.mensagem = mensagem;
    let tag = tagEl.value.trim();
    if (exigirTag) {
      if (!tag) {
        log("⚠️ Digite o nome da tag na caixa antes de iniciar.");
        tagEl.focus();
        return null;
      }
      CONFIG.tagBusca = tag;
    }
    return { mensagem, tag };
  }

  btnModeEnviar.onclick = () => definirModoChave('enviar');
  btnModeFinalizar.onclick = () => definirModoChave('finalizar');
  btnFillDefault.onclick = () => {
    if (rodando) return;
    msgEl.value = MENSAGEM_PADRAO;
    CONFIG.mensagem = MENSAGEM_PADRAO;
    msgEl.focus();
    log("📋 Mensagem padrão preenchida.");
  };

  btnMoveFolder.onclick = () => {
    if (rodando || autoBloqueiaOutras()) return;
    executarMoverParaPastaTodos(folderEl.value);
  };

  btnPlay.onclick = () => {
    if (rodando || autoBloqueiaOutras()) return;
    const ehFinalizar = modoChave === 'finalizar';
    const campos = obterCamposPainel(ehFinalizar);
    if (!campos) return;
    if (ehFinalizar) {
      const ok = confirm(
        `⚠️ MODO ENVIAR + FINALIZAR\n\nIsso vai enviar a mensagem, aplicar a tag "${campos.tag}" e FINALIZAR todos os tickets da fila.\n\nDeseja iniciar agora?`
      );
      if (!ok) {
        log("⚠️ Ação cancelada pelo usuário.");
        return;
      }
      ativarWakeLock();
      log("▶ Iniciando envio + finalização...");
      loop();
    } else {
      executarEscreverParaTodos(campos.mensagem);
    }
  };

  function alternarPausa() {
    if (!rodando) return;
    if (!pausado) {
      pausado = true;
      btnPause.textContent = '▶ Retomar';
      log("⏸ Automação pausada.");
    } else {
      ativarWakeLock();
      pausado = false;
      btnPause.textContent = '⏸ Pausar';
      log("▶ Automação retomada.");
    }
  }
  function pararExecucao() {
    rodando = false;
    pausado = false;
    liberarWakeLock();
    log("⏹ Interrompendo...");
  }
  // Pausar/Parar também são tratados na fase de captura da window: modais do Blip (focus trap /
  // "clique fora") podem interromper a propagação no document e o onclick do painel nunca rodaria.
  const eventosControleTratados = new WeakSet();
  function onCapturaControles(e) {
    const caminho = typeof e.composedPath === 'function' ? e.composedPath() : [];
    const acao = caminho.includes(btnStop) ? pararExecucao : caminho.includes(btnPause) ? alternarPausa : null;
    if (!acao) return;
    eventosControleTratados.add(e);
    acao();
  }
  window.addEventListener('click', onCapturaControles, true);
  btnPause.onclick = e => { if (!eventosControleTratados.has(e)) alternarPausa(); };
  btnStop.onclick = e => { if (!eventosControleTratados.has(e)) pararExecucao(); };

  function obterContagemFila() {
    const el = document.querySelector('#waiting-tickets-count');
    if (!el) return null;
    const raw = (el.shadowRoot?.textContent || el.textContent || el.innerText || '').trim();
    const m = raw.match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  }
  function atualizarBadgeFila() {
    if (queueCountEl) {
      const c = obterContagemFila();
      queueCountEl.textContent = c !== null ? c : '--';
    }
  }
  const queueTimer = setInterval(atualizarBadgeFila, 1000);

  function obterBotaoAtender() {
    const host = document.querySelector('#claim-ticket-button');
    if (!host) return null;
    const isHostDisabled = host.hasAttribute('disabled') || host.getAttribute('aria-disabled') === 'true';
    const inner = host.shadowRoot?.querySelector('button') || host;
    const isInnerDisabled = inner.hasAttribute('disabled') || inner.getAttribute('aria-disabled') === 'true';
    return { host, inner, disabled: isHostDisabled || isInnerDisabled };
  }

  async function executarAtendimentoAutomatico() {
    if (rodando) return;
    rodando = true;
    pausado = false;
    modoAtual = 'claim';
    ativarWakeLock();
    atualizarBotoesEstado(true, 'Atendendo fila (0.5s)...');
    cntEl.textContent = '0';
    let solicitados = 0;

    const countInicial = obterContagemFila();
    log(`🚀 Iniciando atendimento automático a cada 0.5s (Fila atual: ${countInicial !== null ? countInicial : 'lendo...'})`);

    try {
      while (rodando) {
        if (!(await aguardarPausaSeNecessario())) break;

        const countAtual = obterContagemFila();
        atualizarBadgeFila();

        if (countAtual !== null && countAtual <= 0) {
          log('🎉 A contagem da fila chegou a 0! Finalizado.');
          break;
        }

        const btnInfo = obterBotaoAtender();
        if (!btnInfo || !btnInfo.host) {
          log('⚠️ Botão "Atender" (#claim-ticket-button) não encontrado na tela.');
          break;
        }

        if (btnInfo.disabled) {
          if (countAtual !== null && countAtual <= 0) {
            log('🎉 Fila zerada!');
            break;
          }
          await sleep(250);
          continue;
        }

        const clickTarget = btnInfo.inner || btnInfo.host;
        dispararCliqueReal(clickTarget);
        if (btnInfo.host !== clickTarget) {
          dispararCliqueReal(btnInfo.host);
        }

        solicitados++;
        cntEl.textContent = solicitados;
        const countRest = obterContagemFila();
        const infoRest = countRest !== null ? ` | Fila: ${countRest}` : '';
        log(`📥 [${solicitados}] Atender clicado${infoRest}`);

        if (countRest !== null && countRest <= 0) {
          log('🎉 A contagem da fila chegou a 0! Finalizado.');
          break;
        }

        await sleep(500);
      }
    } catch (err) {
      log(`❌ Erro no atendimento automático: ${err.message}`);
    } finally {
      rodando = false;
      pausado = false;
      modoAtual = null;
      await liberarWakeLock();
      atualizarBotoesEstado(false);
      atualizarBadgeFila();
      log(`🏁 Atendimento automático finalizado. Total solicitados: ${solicitados}.`);
    }
  }

