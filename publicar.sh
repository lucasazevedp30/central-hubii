#!/usr/bin/env bash
# Publica a versão atual de hubii-pacote/ como release no GitHub.
# Uso: ./publicar.sh notas.md      (notas.md = texto "O que mudou", em português)
set -euo pipefail
cd "$(dirname "$0")"
REPO=lucasazevedp30/central-hubii
NOTAS=${1:?Informe o arquivo com as novidades}
V=$(python3 -c "import json;print(json.load(open('hubii-pacote/extensao-central-hubii/manifest.json'))['version'])")
grep -q "versão $V'" hubii-pacote/central-hubii.ps1 || { echo "Rótulo de central-hubii.ps1 não é $V"; exit 1; }
[ "$(cat hubii-pacote/atualizacao-online.txt)" = "$REPO" ] || { echo "atualizacao-online.txt errado"; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "Há mudanças sem commit"; exit 1; }
mkdir -p dist
ZIP=dist/hubii-central-$V.zip
rm -f "$ZIP" "$ZIP.sha256"
zip -qr "$ZIP" hubii-pacote -x 'hubii-pacote/*\\*'
(cd dist && sha256sum "hubii-central-$V.zip" > "hubii-central-$V.zip.sha256")
git tag -a "v$V" -m "Central Hubii $V" 2>/dev/null || true
git push origin HEAD "v$V"
gh release create "v$V" "$ZIP" "$ZIP.sha256" --repo "$REPO" --title "Central Hubii $V" --notes-file "$NOTAS"
echo "Publicado: v$V"
