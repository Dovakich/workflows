/* ═══════════════════════════════════════════════════
   Y-CRAFT LAUNCHER — Dark Fantasy Theme
   ═══════════════════════════════════════════════════ */

:root {
  --bg:         #0d0f14;
  --bg2:        #13161e;
  --bg3:        #1a1e28;
  --border:     #252a38;
  --border2:    #2e3547;
  --gold:       #c9a84c;
  --gold2:      #e8c96a;
  --gold-dim:   #8a6e2a;
  --green:      #4ecb7a;
  --green-dim:  #2a7a48;
  --red:        #e05252;
  --text:       #d8dce8;
  --text-dim:   #9ba3bb;
  --text-muted: #6a7490;
  --accent:     #5b8dee;
  --sidebar-w:  82px;
  --titlebar-h: 36px;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  width: 100%; height: 100%; overflow: hidden;
  background: var(--bg);
  color: var(--text);
  font-family: 'Nunito', sans-serif;
  font-size: 14px;
  user-select: none;
}

/* ── Scrollbar ──────────────────────────────────────── */
::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: var(--bg); }
::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }

/* ══════════════════════════════════════════════════════
   TITLEBAR
══════════════════════════════════════════════════════ */
#titlebar {
  position: fixed; top: 0; left: 0; right: 0;
  height: var(--titlebar-h);
  background: #090b10;
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
  z-index: 1000;
  -webkit-app-region: drag;
}

.titlebar-drag {
  display: flex; align-items: center; gap: 8px;
  padding: 0 14px;
}

.logo-icon { font-size: 16px; color: var(--gold); }

.logo-text {
  font-family: 'Cinzel', serif;
  font-size: 13px; font-weight: 700;
  letter-spacing: 3px;
  color: var(--gold);
  text-shadow: 0 0 12px rgba(201,168,76,0.4);
}

.version-badge {
  background: var(--bg3);
  border: 1px solid var(--border2);
  border-radius: 3px;
  padding: 1px 7px;
  font-size: 10px;
  color: var(--text-dim);
  letter-spacing: 0.5px;
}

.titlebar-controls {
  display: flex;
  -webkit-app-region: no-drag;
}

.titlebar-controls button {
  width: 44px; height: 36px;
  background: none; border: none; cursor: pointer;
  color: var(--text-dim); font-size: 13px;
  transition: background 0.15s, color 0.15s;
}

.titlebar-controls button:hover { background: rgba(255,255,255,0.06); color: var(--text); }
.titlebar-controls .close-btn:hover { background: #c0392b; color: #fff; }

/* ══════════════════════════════════════════════════════
   SIDEBAR
══════════════════════════════════════════════════════ */
#sidebar {
  position: fixed;
  top: var(--titlebar-h); left: 0; bottom: 0;
  width: var(--sidebar-w);
  background: #090b10;
  border-right: 1px solid var(--border);
  display: flex; flex-direction: column;
  z-index: 100;
}

#sidebar nav {
  flex: 1;
  display: flex; flex-direction: column;
  padding: 12px 0;
  gap: 4px;
}

.nav-item {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 3px;
  height: 56px;
  text-decoration: none;
  color: var(--text-muted);
  border-left: 2px solid transparent;
  transition: all 0.2s;
  position: relative;
}

.nav-item:hover {
  color: var(--text);
  background: rgba(255,255,255,0.04);
}

.nav-item.active {
  color: var(--gold);
  border-left-color: var(--gold);
  background: rgba(201,168,76,0.06);
}

.nav-icon { font-size: 18px; }
.nav-label { font-size: 10px; letter-spacing: 0.5px; text-transform: uppercase; font-weight: 600; color: inherit; }

.sidebar-footer {
  padding: 12px 0;
  display: flex; flex-direction: column; align-items: center;
}

#server-status {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
}

.status-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--text-muted);
  transition: background 0.3s;
}
.status-dot.online  { background: var(--green);  box-shadow: 0 0 6px var(--green); }
.status-dot.offline { background: var(--red); }

#statusText { font-size: 9px; color: #8a94aa; letter-spacing: 0.5px; writing-mode: horizontal-tb; }

/* ══════════════════════════════════════════════════════
   MAIN CONTENT
══════════════════════════════════════════════════════ */
#content {
  position: fixed;
  top: var(--titlebar-h);
  left: var(--sidebar-w);
  right: 0; bottom: 0;
  overflow: hidden;
}

.tab { display: none; width: 100%; height: 100%; position: relative; }
.tab.active { display: flex; flex-direction: column; }

/* ══════════════════════════════════════════════════════
   PLAY TAB
══════════════════════════════════════════════════════ */
#tab-play { overflow: hidden; }

.play-bg {
  position: absolute; inset: 0;
  background: linear-gradient(160deg, #0c0e15 0%, #0d1018 50%, #0a0c13 100%);
}

.play-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, transparent 50%, rgba(13,15,20,0.7) 100%);
}

#particleCanvas { display: none; }

.play-content {
  position: relative; z-index: 10;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 100%; padding: 20px;
  gap: 24px;
}

.server-title { text-align: center; }

.server-title h1 {
  font-family: 'Cinzel', serif;
  font-size: 52px; font-weight: 900;
  letter-spacing: 12px;
  color: var(--gold);
  text-shadow:
    0 0 20px rgba(201,168,76,0.5),
    0 0 60px rgba(201,168,76,0.2),
    0 2px 4px rgba(0,0,0,0.8);
  line-height: 1;
  /* no animation - removed flicker */
}


  50%       { text-shadow: 0 0 30px rgba(201,168,76,0.7), 0 0 80px rgba(201,168,76,0.35), 0 2px 4px rgba(0,0,0,0.8); }
}

.server-subtitle {
  margin-top: 6px;
  font-size: 12px; letter-spacing: 4px;
  color: #b0b8cc; text-transform: uppercase;
}

.play-card {
  width: 100%; max-width: 420px;
  background: rgba(19,22,30,0.9);
  border: 1px solid var(--border2);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04);
  display: flex; flex-direction: column; gap: 16px;
}

.nick-field label {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 600; letter-spacing: 1px;
  text-transform: uppercase; color: var(--text-dim);
  margin-bottom: 6px;
}

.nick-field input {
  width: 100%; padding: 10px 14px;
  background: var(--bg3);
  border: 1px solid var(--border2);
  border-radius: 7px;
  color: var(--text); font-family: 'Nunito', sans-serif; font-size: 15px;
  outline: none; transition: border 0.2s, box-shadow 0.2s;
}

.nick-field input:focus {
  border-color: var(--gold-dim);
  box-shadow: 0 0 0 2px rgba(201,168,76,0.12);
}

.nick-field input.invalid { border-color: var(--red); }
.nick-field input.valid   { border-color: var(--green-dim); }

.nick-hint { font-size: 11px; color: var(--red); margin-top: 3px; min-height: 14px; display: block; }

.quick-options { display: flex; gap: 16px; align-items: center; }

/* Progress */
.progress-wrap { display: flex; flex-direction: column; gap: 6px; }
.progress-label { font-size: 12px; color: var(--text-dim); font-weight: 600; }
.progress-track {
  height: 5px; background: var(--bg3); border-radius: 3px; overflow: hidden;
  border: 1px solid var(--border);
}
.progress-fill {
  height: 100%; width: 0%; border-radius: 3px;
  background: linear-gradient(90deg, var(--gold-dim), var(--gold));
  transition: width 0.3s ease;
  box-shadow: 0 0 8px rgba(201,168,76,0.4);
}
.progress-sub { font-size: 10px; color: var(--text-muted); }

/* Play buttons */
.play-buttons { display: flex; gap: 10px; }

.btn-launch {
  flex: 1; height: 48px;
  background: linear-gradient(135deg, #8a6e2a, #c9a84c, #e8c96a, #c9a84c);
  background-size: 200% 100%; background-position: 100% 0;
  border: none; border-radius: 8px; cursor: pointer;
  font-family: 'Cinzel', serif; font-size: 15px; font-weight: 700;
  letter-spacing: 3px; color: #1a1200;
  display: flex; align-items: center; justify-content: center; gap: 10px;
  transition: all 0.3s; position: relative; overflow: hidden;
}

.btn-launch::before {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.1), transparent);
  opacity: 0; transition: opacity 0.2s;
}

.btn-launch:hover { background-position: 0 0; box-shadow: 0 4px 20px rgba(201,168,76,0.4); }
.btn-launch:hover::before { opacity: 1; }
.btn-launch:active { transform: translateY(1px); }

.btn-launch.running {
  background: linear-gradient(135deg, #2a4a2a, #3a7a3a);
  background-size: 100%; color: var(--green);
  box-shadow: 0 4px 20px rgba(78,203,122,0.2);
}

.btn-launch:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-icon { font-size: 12px; }

.btn-update {
  width: 48px; height: 48px;
  background: var(--bg3); border: 1px solid var(--border2);
  border-radius: 8px; cursor: pointer; color: var(--text-dim); font-size: 18px;
  transition: all 0.2s;
}
.btn-update:hover { border-color: var(--gold-dim); color: var(--gold); }

.news-strip {
  display: flex; align-items: center; gap: 8px;
  font-size: 11px; color: var(--text-muted);
  border-top: 1px solid var(--border);
  padding-top: 12px;
}

.news-tag {
  background: var(--gold-dim); color: #0d0f14;
  font-size: 9px; font-weight: 700; letter-spacing: 1px;
  padding: 2px 6px; border-radius: 3px; flex-shrink: 0;
}

/* ══════════════════════════════════════════════════════
   MODS TAB
══════════════════════════════════════════════════════ */
#tab-mods { padding: 20px; gap: 16px; overflow-y: auto; }

.tab-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 4px; flex-shrink: 0;
}

.tab-header h2 {
  font-family: 'Cinzel', serif; font-size: 20px; font-weight: 700; color: var(--text);
}

.accent { color: var(--gold); }

.mod-stats {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;
  flex-shrink: 0;
}

.stat-card {
  background: var(--bg3); border: 1px solid var(--border);
  border-radius: 8px; padding: 12px 14px;
  display: flex; flex-direction: column; gap: 3px;
}

.stat-num { font-family: 'Cinzel', serif; font-size: 20px; color: var(--gold); font-weight: 600; }
.stat-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; }

.search-row { flex-shrink: 0; }

.search-row input, #modSearch {
  width: 100%; padding: 9px 14px;
  background: var(--bg3); border: 1px solid var(--border2);
  border-radius: 7px; color: var(--text);
  font-family: 'Nunito', sans-serif; font-size: 13px; outline: none;
  transition: border 0.2s;
}
.search-row input:focus, #modSearch:focus { border-color: var(--gold-dim); }

.mod-list {
  flex: 1; overflow-y: auto;
  display: flex; flex-direction: column; gap: 6px;
}

.mod-item {
  background: var(--bg3); border: 1px solid var(--border);
  border-radius: 8px; padding: 11px 14px;
  display: flex; align-items: center; gap: 12px;
  transition: border 0.15s;
}
.mod-item:hover { border-color: var(--border2); }

.mod-icon { font-size: 20px; flex-shrink: 0; }
.mod-info { flex: 1; min-width: 0; }
.mod-name { font-size: 13px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mod-version { font-size: 11px; color: var(--text-muted); }
.mod-badge {
  font-size: 9px; padding: 2px 8px; border-radius: 10px;
  font-weight: 700; letter-spacing: 0.5px;
  flex-shrink: 0;
}
.mod-badge.required { background: rgba(78,203,122,0.15); color: var(--green); border: 1px solid rgba(78,203,122,0.3); }
.mod-badge.optional { background: rgba(91,141,238,0.15); color: var(--accent); border: 1px solid rgba(91,141,238,0.3); }

.mod-right { display:flex; flex-direction:column; align-items:flex-end; gap:4px; flex-shrink:0; }
.mod-size  { font-size:9px; color:var(--text-muted); }
.mod-id    { font-size:9px; color:var(--text-muted); margin-left:4px; }
.mod-desc  { font-size:10px; color:var(--text-muted); margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:280px; }

.mods-dir-row  { display:flex; align-items:center; gap:6px; flex-shrink:0; padding:4px 0; }
.mods-dir-label { font-size:12px; flex-shrink:0; }
.mods-dir-path  { font-size:10px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-family:'Courier New',monospace; }

.loading-placeholder { color: var(--text-muted); text-align: center; padding: 40px; }

/* ══════════════════════════════════════════════════════
   CONSOLE TAB
══════════════════════════════════════════════════════ */
#tab-console { padding: 20px; }

.console-wrap {
  flex: 1; margin-top: 12px;
  background: #07090d; border: 1px solid var(--border);
  border-radius: 8px; padding: 12px;
  overflow-y: auto; font-family: 'Courier New', monospace;
}

#consoleOutput {
  font-size: 11px; line-height: 1.6; color: #a0b0a0;
  white-space: pre-wrap; word-break: break-all;
}

.console-status {
  margin-top: 8px; padding: 6px 12px;
  background: var(--bg3); border: 1px solid var(--border);
  border-radius: 6px; font-size: 11px; color: var(--text-muted);
  flex-shrink: 0;
}

/* ══════════════════════════════════════════════════════
   SETTINGS TAB
══════════════════════════════════════════════════════ */
#tab-settings { padding: 20px; overflow-y: auto; }

.settings-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 16px; margin-top: 16px;
}

.settings-section {
  background: var(--bg3); border: 1px solid var(--border);
  border-radius: 10px; padding: 16px;
  display: flex; flex-direction: column; gap: 12px;
}

.settings-section h3 {
  font-size: 12px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 1px; color: var(--text-dim);
  border-bottom: 1px solid var(--border); padding-bottom: 8px;
}

.setting-row {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  min-height: 30px;
}

.setting-row label:first-child { font-size: 12px; color: var(--text); flex-shrink: 0; }
.setting-info { font-size: 11px; color: var(--text-dim); }

.ram-control { display: flex; align-items: center; gap: 10px; flex: 1; justify-content: flex-end; }
.ram-control input[type=range] { width: 120px; accent-color: var(--gold); }
.ram-val { font-size: 11px; color: var(--gold); min-width: 60px; text-align: right; }

.input-pair { display: flex; align-items: center; gap: 6px; }
.input-pair span { color: var(--text-muted); }
.input-pair input {
  width: 70px; padding: 5px 8px;
  background: var(--bg); border: 1px solid var(--border2);
  border-radius: 5px; color: var(--text); text-align: center;
  font-family: 'Nunito', sans-serif; font-size: 12px; outline: none;
}

.setting-row input[type=text], .setting-row input[type=number]:not(.input-pair input) {
  padding: 6px 10px; background: var(--bg);
  border: 1px solid var(--border2); border-radius: 5px;
  color: var(--text); font-family: 'Nunito', sans-serif; font-size: 12px; outline: none;
  transition: border 0.2s;
}
.setting-row input[type=text]:focus { border-color: var(--gold-dim); }

#serverIP { width: 160px; }

.file-input-row { display: flex; gap: 6px; flex: 1; justify-content: flex-end; }
.file-input-row input { flex: 1; min-width: 0; font-size: 11px; }

.update-notice {
  padding: 8px 12px; border-radius: 6px; font-size: 12px; margin-top: 4px;
  background: rgba(78,203,122,0.1); border: 1px solid rgba(78,203,122,0.3);
  color: var(--green);
}
.update-notice.error { background: rgba(224,82,82,0.1); border-color: rgba(224,82,82,0.3); color: var(--red); }

/* ══════════════════════════════════════════════════════
   TOGGLES
══════════════════════════════════════════════════════ */
.toggle-wrap {
  display: flex; align-items: center; gap: 8px;
  cursor: pointer; font-size: 12px; color: var(--text);
}
.toggle-wrap input { display: none; }

.toggle {
  width: 34px; height: 18px; border-radius: 9px;
  background: var(--bg); border: 1px solid var(--border2);
  position: relative; transition: all 0.2s; flex-shrink: 0;
}
.toggle::after {
  content: '';
  position: absolute; top: 2px; left: 2px;
  width: 12px; height: 12px; border-radius: 50%;
  background: var(--text-muted); transition: all 0.2s;
}
.toggle-wrap input:checked + .toggle { background: var(--green-dim); border-color: var(--green); }
.toggle-wrap input:checked + .toggle::after { left: 18px; background: var(--green); }

/* ══════════════════════════════════════════════════════
   BUTTONS
══════════════════════════════════════════════════════ */
.btn-small {
  padding: 5px 12px; background: var(--bg3);
  border: 1px solid var(--border2); border-radius: 5px;
  color: var(--text-dim); font-size: 11px; cursor: pointer;
  transition: all 0.15s; font-family: 'Nunito', sans-serif;
}
.btn-small:hover { border-color: var(--gold-dim); color: var(--gold); }

.btn-browse {
  padding: 5px 10px; background: var(--bg3);
  border: 1px solid var(--border2); border-radius: 5px;
  color: var(--text-dim); font-size: 11px; cursor: pointer;
  transition: all 0.15s; flex-shrink: 0;
}
.btn-browse:hover { border-color: var(--accent); color: var(--accent); }

.btn-save {
  padding: 6px 14px;
  background: linear-gradient(135deg, var(--gold-dim), var(--gold));
  border: none; border-radius: 6px; cursor: pointer;
  font-family: 'Cinzel', serif; font-size: 11px; font-weight: 700;
  color: #0d0f14; letter-spacing: 1px;
  transition: all 0.2s;
}
.btn-save:hover { box-shadow: 0 2px 12px rgba(201,168,76,0.4); }

/* ══════════════════════════════════════════════════════
   TOASTS
══════════════════════════════════════════════════════ */
#toastContainer {
  position: fixed; bottom: 20px; right: 20px;
  display: flex; flex-direction: column-reverse; gap: 8px;
  z-index: 9999; pointer-events: none;
}

.toast {
  padding: 10px 16px; border-radius: 8px;
  font-size: 12px; font-weight: 600;
  display: flex; align-items: center; gap: 8px;
  animation: toastIn 0.3s ease;
  pointer-events: auto;
  max-width: 300px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
}

.toast.success { background: #1a2e1a; border: 1px solid var(--green-dim); color: var(--green); }
.toast.error   { background: #2e1a1a; border: 1px solid #7a3030;           color: var(--red);   }
.toast.info    { background: #1a1e2e; border: 1px solid #3a4a80;           color: var(--accent);}
.toast.warning { background: #2e2a1a; border: 1px solid var(--gold-dim);   color: var(--gold);  }

@keyframes toastIn {
  from { transform: translateX(40px); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}

/* ══════════════════════════════════════════════════════
   MODAL
══════════════════════════════════════════════════════ */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  z-index: 9000;
}

.modal-box {
  background: var(--bg2); border: 1px solid var(--border2);
  border-radius: 12px; padding: 28px; max-width: 360px; width: 90%;
  box-shadow: 0 20px 60px rgba(0,0,0,0.6);
}

.modal-box h3 {
  font-family: 'Cinzel', serif; font-size: 16px; color: var(--gold);
  margin-bottom: 12px;
}
.modal-box p { font-size: 13px; color: var(--text); line-height: 1.6; margin-bottom: 20px; }

.modal-btns { display: flex; justify-content: flex-end; gap: 10px; }
.btn-modal-cancel { padding: 8px 18px; background: var(--bg3); border: 1px solid var(--border2); border-radius: 6px; color: var(--text-dim); font-size: 12px; cursor: pointer; }
.btn-modal-ok { padding: 8px 18px; background: linear-gradient(135deg, var(--gold-dim), var(--gold)); border: none; border-radius: 6px; color: #0d0f14; font-family: 'Cinzel', serif; font-size: 12px; font-weight: 700; cursor: pointer; }
