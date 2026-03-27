# ════════════════════════════════════════════════════════════
#  Y-Craft — Генератор manifest.json для ZIP-архівів
#  Запуск: ./generate-manifest.ps1
# ════════════════════════════════════════════════════════════

param(
    [string]$Version    = "1.0.0",
    [string]$GithubUser = "ВАШ_НІК",
    [string]$GithubRepo = "ycraft-modpack"
)

$BaseUrl = "https://github.com/$GithubUser/$GithubRepo/releases/download/v$Version"

Write-Host ""
Write-Host "  Y-Craft Manifest Generator" -ForegroundColor Cyan
Write-Host "  Версія: $Version" -ForegroundColor Gray
Write-Host "  URL:    $BaseUrl" -ForegroundColor Gray
Write-Host ""

# ── Перевіряємо наявність папок ──────────────────────────────────────────────
$archives = @()

foreach ($folder in @("mods", "config", "resourcepacks", "shaderpacks")) {
    if (Test-Path $folder) {
        Write-Host "  Обробка папки: $folder..." -ForegroundColor Yellow

        $zipName = "$folder.zip"
        $zipPath = Join-Path $PWD $zipName

        # Пакуємо в ZIP
        if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
        Compress-Archive -Path "$folder\*" -DestinationPath $zipPath -Force

        # Рахуємо SHA1
        $hash = (Get-FileHash $zipPath -Algorithm SHA1).Hash.ToLower()
        $size = (Get-Item $zipPath).Length

        $archives += @{
            name      = $folder
            url       = "$BaseUrl/$zipName"
            extractTo = $folder
            sha1      = $hash
            version   = $Version
            size      = $size
        }

        $sizeMB = [math]::Round($size / 1MB, 1)
        Write-Host "    OK: $zipName ($sizeMB МБ), sha1: $($hash.Substring(0,12))..." -ForegroundColor Green
    }
}

if ($archives.Count -eq 0) {
    Write-Host "  Помилка: не знайдено жодної папки (mods, config тощо)" -ForegroundColor Red
    Write-Host "  Запустіть скрипт з папки де знаходяться mods/ та config/" -ForegroundColor Red
    exit 1
}

# ── Генеруємо manifest.json ───────────────────────────────────────────────────
$manifest = [ordered]@{
    version      = $Version
    mcVersion    = "1.20.1"
    forgeVersion = "47.4.10"
    updatedAt    = (Get-Date -Format "yyyy-MM-dd HH:mm")
    archives     = $archives
}

$json = $manifest | ConvertTo-Json -Depth 5
Set-Content -Path "manifest.json" -Value $json -Encoding UTF8

Write-Host ""
Write-Host "  manifest.json створено!" -ForegroundColor Green
Write-Host ""
Write-Host "  Наступні кроки:" -ForegroundColor Cyan
Write-Host "  1. Завантажте ZIP-архіви на GitHub Releases v$Version"
Write-Host "     gh release create v$Version --title 'Modpack v$Version' --notes ''"

foreach ($arc in $archives) {
    Write-Host "     gh release upload v$Version $($arc.name).zip --repo $GithubUser/$GithubRepo"
}

Write-Host "     gh release upload v$Version manifest.json --repo $GithubUser/$GithubRepo"
Write-Host ""
Write-Host "  2. Покладіть manifest.json у корінь репозиторію:"
Write-Host "     git add manifest.json && git commit -m 'v$Version' && git push"
Write-Host ""
Write-Host "  3. У лаунчері (src/main/main.js) вкажіть URL маніфесту:"
Write-Host "     https://raw.githubusercontent.com/$GithubUser/$GithubRepo/main/manifest.json"
Write-Host ""
