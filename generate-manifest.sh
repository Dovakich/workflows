#!/bin/bash
# ════════════════════════════════════════════════════════════
#  Y-Craft — Генератор manifest.json для ZIP-архівів
#  Запуск: bash generate-manifest.sh
# ════════════════════════════════════════════════════════════

VERSION="${1:-1.0.0}"
GITHUB_USER="${2:-ВАШ_НІК}"
GITHUB_REPO="${3:-ycraft-modpack}"
BASE_URL="https://github.com/$GITHUB_USER/$GITHUB_REPO/releases/download/v$VERSION"

echo ""
echo "  Y-Craft Manifest Generator"
echo "  Версія: $VERSION"
echo "  URL:    $BASE_URL"
echo ""

ARCHIVES_JSON=""
FIRST=true

for FOLDER in mods config resourcepacks shaderpacks; do
    if [ -d "$FOLDER" ]; then
        echo "  Обробка папки: $FOLDER..."

        ZIP_NAME="$FOLDER.zip"
        rm -f "$ZIP_NAME"
        (cd "$FOLDER" && zip -r -q "../$ZIP_NAME" .)

        HASH=$(sha1sum "$ZIP_NAME" | cut -d' ' -f1)
        SIZE=$(stat -c%s "$ZIP_NAME" 2>/dev/null || stat -f%z "$ZIP_NAME")
        SIZE_MB=$(echo "scale=1; $SIZE/1048576" | bc)

        echo "    OK: $ZIP_NAME ($SIZE_MB МБ), sha1: ${HASH:0:12}..."

        ENTRY=$(cat <<EOF
    {
      "name": "$FOLDER",
      "url": "$BASE_URL/$ZIP_NAME",
      "extractTo": "$FOLDER",
      "sha1": "$HASH",
      "version": "$VERSION",
      "size": $SIZE
    }
EOF
)
        if [ "$FIRST" = true ]; then
            ARCHIVES_JSON="$ENTRY"
            FIRST=false
        else
            ARCHIVES_JSON="$ARCHIVES_JSON,$ENTRY"
        fi
    fi
done

if [ -z "$ARCHIVES_JSON" ]; then
    echo "  Помилка: не знайдено жодної папки (mods, config тощо)"
    exit 1
fi

DATE=$(date '+%Y-%m-%d %H:%M')

cat > manifest.json <<EOF
{
  "version": "$VERSION",
  "mcVersion": "1.20.1",
  "forgeVersion": "47.4.10",
  "updatedAt": "$DATE",
  "archives": [
$ARCHIVES_JSON
  ]
}
EOF

echo ""
echo "  manifest.json створено!"
echo ""
echo "  Наступні кроки:"
echo "  1. Завантажте на GitHub Releases:"
echo "     gh release create v$VERSION --title 'Modpack v$VERSION' --notes ''"
for FOLDER in mods config resourcepacks shaderpacks; do
    if [ -f "$FOLDER.zip" ]; then
        echo "     gh release upload v$VERSION $FOLDER.zip --repo $GITHUB_USER/$GITHUB_REPO"
    fi
done
echo "     gh release upload v$VERSION manifest.json --repo $GITHUB_USER/$GITHUB_REPO"
echo ""
echo "  2. Покладіть manifest.json у репозиторій:"
echo "     git add manifest.json && git commit -m 'v$VERSION' && git push"
echo ""
echo "  3. URL маніфесту для лаунчера:"
echo "     https://raw.githubusercontent.com/$GITHUB_USER/$GITHUB_REPO/main/manifest.json"
echo ""
