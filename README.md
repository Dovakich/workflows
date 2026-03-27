# ⚔ Y-Craft Лаунчер

Офіційний лаунчер для Y-Craft • Forge 1.20.1-47.4.10

---

## 🚀 Швидкий старт (розробка)

```bash
npm install
npm start
```

### Збірка
```bash
npm run build:win    # .exe для Windows
npm run build:linux  # AppImage для Linux
npm run build:mac    # .dmg для macOS
```

---

## 📦 Як розмістити модпак та конфіги

### Варіант 1 — Власний HTTP-сервер (рекомендовано)

**Структура сервера:**
```
https://cdn.y-craft.net/modpack/
├── manifest.json          ← список файлів
├── mods/
│   ├── Create-0.5.1f.jar
│   ├── JEI-1.20.1-15.2.0.jar
│   └── ...
└── config/
    ├── create/
    └── ...
```

**manifest.json:**
```json
{
  "version": "2.1.0",
  "mcVersion": "1.20.1",
  "forgeVersion": "47.4.10",
  "files": [
    {
      "name": "Create",
      "path": "mods/Create-0.5.1f.jar",
      "url": "https://cdn.y-craft.net/modpack/mods/Create-0.5.1f.jar",
      "sha1": "abc123..."
    },
    {
      "name": "create-config",
      "path": "config/create/config.json",
      "url": "https://cdn.y-craft.net/modpack/config/create/config.json",
      "sha1": "def456..."
    }
  ]
}
```

**Генерація SHA1 хешів:**
```bash
# Linux/macOS
find mods/ config/ -type f | while read f; do
  echo "$(sha1sum "$f" | cut -d' ' -f1)  $f"
done

# Windows PowerShell
Get-ChildItem -Recurse mods,config | ForEach-Object {
  $hash = (Get-FileHash $_.FullName -Algorithm SHA1).Hash.ToLower()
  "$hash  $($_.FullName)"
}
```

**В `src/main/main.js` вкажіть URL:**
```js
const MODPACK_MANIFEST_URL = 'https://cdn.y-craft.net/modpack/manifest.json';
```

---

### Варіант 2 — GitHub Releases (безкоштовно)

1. Створіть репозиторій `ycraft-modpack`
2. Запакуйте моди: `mods.zip`, конфіги: `config.zip`
3. Зробіть Release з тегом `v2.1.0`
4. В manifest.json використовуйте URL виду:
   `https://github.com/YourOrg/ycraft-modpack/releases/download/v2.1.0/Create.jar`

---

### Варіант 3 — Google Drive / Яндекс.Диск

Для кожного файлу отримайте пряме посилання на завантаження:
- Google Drive: `https://drive.google.com/uc?export=download&id=FILE_ID`
- Яндекс.Диск: пряме посилання з кнопки "Скачати"

**Увага:** великі файли з Google Drive можуть не завантажитись через підтвердження антивірусу.

---

## ⚙ Налаштування лаунчера

Всі константи в `src/main/main.js`:

```js
const FORGE_VERSION        = '47.4.10';          // версія Forge
const MC_VERSION           = '1.20.1';           // версія Minecraft
const MODPACK_MANIFEST_URL = 'https://...';      // URL маніфесту
const UPDATE_FEED_URL      = 'https://...';      // URL оновлень лаунчера
```

Дефолтний IP сервера:
```js
defaults: { serverIP: 'play.y-craft.net', ... }
```

---

## 📁 Структура проєкту

```
ycraft-launcher/
├── src/
│   ├── main/
│   │   ├── main.js            ← Electron main + IPC
│   │   ├── preload.js         ← Context bridge
│   │   ├── game-launcher.js   ← Запуск Minecraft
│   │   ├── forge-installer.js ← Встановлення Forge
│   │   └── modpack-manager.js ← Оновлення модпаку
│   └── renderer/
│       ├── index.html
│       ├── style.css
│       └── renderer.js
├── assets/                    ← Іконки (додайте icon.png)
└── package.json
```

---

## 🔧 Вимоги до системи гравця

| Компонент | Мінімум |
|---|---|
| Java | 17+ (рекомендовано 21) |
| RAM (ОС) | 4 ГБ |
| RAM (гра) | 2–4 ГБ (налаштовується) |
| ОС | Windows 10+, Ubuntu 20.04+, macOS 11+ |

**Де скачати Java 21:**
- https://adoptium.net/temurin/releases/?version=21
- https://www.azul.com/downloads/?version=java-21

---

## ⚖ Ліцензія

MIT
