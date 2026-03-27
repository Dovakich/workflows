<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Y-Craft Лаунчер</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Nunito:wght@300;400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css" />
</head>
<body>

<!-- ══════════════ ЗАГОЛОВОК ══════════════ -->
<div id="titlebar">
  <div class="titlebar-drag">
    <span class="logo-text">Y-CRAFT</span>
    <span class="version-badge">Forge 1.20.1 — 47.4.10</span>
  </div>
  <div class="titlebar-controls">
    <button onclick="launcher.minimize()" title="Згорнути">─</button>
    <button onclick="launcher.maximize()" title="Розгорнути">□</button>
    <button onclick="launcher.close()" class="close-btn" title="Закрити">✕</button>
  </div>
</div>

<!-- ══════════════ БІЧНА ПАНЕЛЬ ══════════════ -->
<aside id="sidebar">
  <nav>
    <a href="#" class="nav-item active" data-tab="play" title="Грати">
      <span class="nav-icon">▶</span>
      <span class="nav-label">Грати</span>
    </a>
    <a href="#" class="nav-item" data-tab="mods" title="Моди">
      <span class="nav-icon">⬡</span>
      <span class="nav-label">Моди</span>
    </a>
    <a href="#" class="nav-item" data-tab="console" title="Консоль">
      <span class="nav-icon">⌨</span>
      <span class="nav-label">Лог</span>
    </a>
    <a href="#" class="nav-item" data-tab="settings" title="Налаштування">
      <span class="nav-icon">⚙</span>
      <span class="nav-label">Налаш.</span>
    </a>
  </nav>
  <div class="sidebar-footer">
    <div id="server-status">
      <span class="status-dot" id="statusDot"></span>
      <span id="statusText">Перевірка…</span>
    </div>
  </div>
</aside>

<!-- ══════════════ ОСНОВНИЙ ВМІСТ ══════════════ -->
<main id="content">

  <!-- ── ВКЛАДКА ГРАТИ ── -->
  <div class="tab active" id="tab-play">
    <div class="play-bg">
      <div class="play-overlay"></div>
      <canvas id="particleCanvas"></canvas>
    </div>

    <div class="play-content">
      <div class="server-title">
        <h1>Y-CRAFT</h1>
        <p class="server-subtitle">Forge 1.20.1 — 47.4.10</p>
      </div>

      <div class="play-card">
        <div class="nick-field">
          <label for="nicknameInput">
            <span class="field-icon">👤</span> Нікнейм
          </label>
          <input type="text" id="nicknameInput" placeholder="Введіть ваш нікнейм…"
                 maxlength="16" autocomplete="off" spellcheck="false" />
          <span class="nick-hint" id="nickHint"></span>
        </div>

        <div class="quick-options">
          <label class="toggle-wrap">
            <input type="checkbox" id="autoConnectCheck" />
            <span class="toggle"></span>
            <span>Авто-підключення до сервера</span>
          </label>
        </div>

        <!-- Прогрес-бар (прихований до потреби) -->
        <div class="progress-wrap" id="progressWrap" style="display:none">
          <div class="progress-label" id="progressLabel">Підготовка…</div>
          <div class="progress-track">
            <div class="progress-fill" id="progressFill"></div>
          </div>
          <div class="progress-sub" id="progressSub"></div>
        </div>

        <div class="play-buttons">
          <button class="btn-launch" id="btnLaunch">
            <span class="btn-icon">▶</span>
            <span id="btnLaunchLabel">ГРАТИ</span>
          </button>
          <button class="btn-update" id="btnUpdate" title="Перевірити оновлення">
            <span>↻</span>
          </button>
        </div>

        <div class="news-strip" id="newsStrip">
          <span class="news-tag">НОВИНИ</span>
          <span id="newsText">Ласкаво просимо на Y-Craft! Завантаження новин сервера…</span>
        </div>
      </div>
    </div>
  </div>

  <!-- ── ВКЛАДКА МОДИ ── -->
  <div class="tab" id="tab-mods">
    <div class="tab-header">
      <h2>Вміст <span class="accent">Модпаку</span></h2>
      <div style="display:flex;gap:8px">
        <button class="btn-small" id="btnOpenModsDir">📂 Папка модів</button>
        <button class="btn-small" id="btnRefreshMods">↻ Оновити</button>
      </div>
    </div>
    <div class="mod-stats" id="modStats">
      <div class="stat-card">
        <span class="stat-num" id="statModCount">—</span>
        <span class="stat-label">Модів</span>
      </div>
      <div class="stat-card">
        <span class="stat-num" id="statPackVersion">—</span>
        <span class="stat-label">Версія паку</span>
      </div>
      <div class="stat-card">
        <span class="stat-num">1.20.1</span>
        <span class="stat-label">Версія MC</span>
      </div>
      <div class="stat-card">
        <span class="stat-num">47.4.10</span>
        <span class="stat-label">Forge</span>
      </div>
    </div>
    <div class="mods-dir-row">
      <span class="mods-dir-label">📁</span>
      <span id="modsDirPath" class="mods-dir-path">—</span>
    </div>
    <div class="search-row">
      <input type="text" id="modSearch" placeholder="🔍  Пошук за назвою, автором, ID…" />
    </div>
    <div class="mod-list" id="modList">
      <div class="loading-placeholder">Натисніть «Оновити» щоб завантажити список модів</div>
    </div>
  </div>

  <!-- ── ВКЛАДКА КОНСОЛЬ ── -->
  <div class="tab" id="tab-console">
    <div class="tab-header">
      <h2>Консоль <span class="accent">Гри</span></h2>
      <div style="display:flex;gap:8px">
        <button class="btn-small" id="btnClearConsole">🗑 Очистити</button>
        <button class="btn-small" id="btnCopyConsole">📋 Копіювати</button>
      </div>
    </div>
    <div class="console-wrap">
      <pre id="consoleOutput"></pre>
    </div>
    <div class="console-status" id="consoleStatus">Гра не запущена</div>
  </div>

  <!-- ── ВКЛАДКА НАЛАШТУВАННЯ ── -->
  <div class="tab" id="tab-settings">
    <div class="tab-header">
      <h2>Налаштування <span class="accent">Лаунчера</span></h2>
      <button class="btn-save" id="btnSaveSettings">💾 Зберегти</button>
    </div>

    <div class="settings-grid">

      <section class="settings-section">
        <h3>🎮 Гра</h3>

        <div class="setting-row">
          <label>Обсяг RAM</label>
          <div class="ram-control">
            <input type="range" id="ramSlider" min="512" max="16384" step="512" value="2048" />
            <span class="ram-val" id="ramVal">2048 МБ</span>
          </div>
        </div>

        <div class="setting-row">
          <label>Розмір вікна</label>
          <div class="input-pair">
            <input type="number" id="winWidth"  value="1280" min="800"  placeholder="Ширина"  />
            <span>×</span>
            <input type="number" id="winHeight" value="720"  min="600"  placeholder="Висота" />
          </div>
        </div>

        <div class="setting-row">
          <label>На весь екран при запуску</label>
          <label class="toggle-wrap">
            <input type="checkbox" id="fullscreenCheck" />
            <span class="toggle"></span>
          </label>
        </div>

        <div class="setting-row">
          <label>Закрити лаунчер при запуску</label>
          <label class="toggle-wrap">
            <input type="checkbox" id="closeOnLaunchCheck" />
            <span class="toggle"></span>
          </label>
        </div>
      </section>

      <section class="settings-section">
        <h3>☕ Java</h3>

        <div class="setting-row">
          <label>Шлях до Java</label>
          <div class="file-input-row">
            <input type="text" id="javaPath" placeholder="Авто-визначення" readonly />
            <button class="btn-browse" id="btnBrowseJava">Огляд</button>
          </div>
        </div>

        <div class="setting-row">
          <label>Визначена версія</label>
          <span class="setting-info" id="javaVersion">Перевірка…</span>
        </div>
      </section>

      <section class="settings-section">
        <h3>📁 Шляхи</h3>

        <div class="setting-row">
          <label>Тека гри</label>
          <div class="file-input-row">
            <input type="text" id="gameDir" placeholder=".ycraft" readonly />
            <button class="btn-browse" id="btnBrowseDir">Огляд</button>
          </div>
        </div>

        <div class="setting-row">
          <label>Відкрити теку</label>
          <button class="btn-small" id="btnOpenDir">📂 Відкрити теку гри</button>
        </div>
      </section>

      <section class="settings-section">
        <h3>🌐 Сервер</h3>

        <div class="setting-row">
          <label>IP сервера</label>
          <input type="text" id="serverIP" placeholder="play.y-craft.net" />
        </div>

        <div class="setting-row">
          <label>Авто-підключення при старті</label>
          <label class="toggle-wrap">
            <input type="checkbox" id="autoConnectSetting" />
            <span class="toggle"></span>
          </label>
        </div>
      </section>

      <section class="settings-section">
        <h3>🔄 Оновлення</h3>

        <div class="setting-row">
          <label>Версія лаунчера</label>
          <span class="setting-info" id="launcherVersion">—</span>
        </div>

        <div class="setting-row">
          <label>Перевірити оновлення лаунчера</label>
          <button class="btn-small" id="btnCheckUpdate">↻ Перевірити</button>
        </div>

        <div id="updateNotice" class="update-notice" style="display:none"></div>
      </section>

    </div>
  </div>

</main>

<!-- ══════════════ СПОВІЩЕННЯ ══════════════ -->
<div id="toastContainer"></div>

<!-- ══════════════ МОДАЛЬНЕ ВІКНО ══════════════ -->
<div id="modal" class="modal-overlay" style="display:none">
  <div class="modal-box">
    <h3 id="modalTitle">Повідомлення</h3>
    <p  id="modalBody"></p>
    <div class="modal-btns">
      <button class="btn-modal-cancel" id="modalCancel">Скасувати</button>
      <button class="btn-modal-ok"     id="modalOk">ОК</button>
    </div>
  </div>
</div>

<script src="renderer.js"></script>
</body>
</html>
