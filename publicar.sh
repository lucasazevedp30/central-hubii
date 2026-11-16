#!/usr/bin/env bash
# Publica a versão atual de hubii-pacote/ para as lojas.
# Uso: ./publicar.sh notas.md      (notas.md = texto "O que mudou", em português)
# Cria versoes/hubii-central-X.Y.Z.zip e versao.json (versão, arquivo, SHA-256, novidades), faz commit e envia.
# A Central na loja lê https://raw.githubusercontent.com/<repo>/main/versao.json
set -euo pipefail
cd "$(dirname "$0")"
REPO=lucasazevedp30/central-hubii
NOTAS=${1:?Informe o arquivo com as novidades}
V=$(python3 -c "import json;print(json.load(open('hubii-pacote/extensao-central-hubii/manifest.json'))['version'])")
grep -q "versão $V'" hubii-pacote/central-hubii.ps1 || { echo "Rótulo de central-hubii.ps1 não é $V"; exit 1; }
[ "$(cat hubii-pacote/atualizacao-online.txt)" = "$REPO" ] || { echo "atualizacao-online.txt errado"; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "Há mudanças sem commit"; exit 1; }
mkdir -p versoes
ZIP=versoes/hubii-central-$V.zip
[ ! -e "$ZIP" ] || { echo "$ZIP já existe: aumente a versão"; exit 1; }
zip -qrX "$ZIP" hubii-pacote -x 'hubii-pacote/*\\*'
python3 - "$V" "$ZIP" "$NOTAS" <<'PY'
import json, hashlib, os, sys, datetime
v, z, n = sys.argv[1:]
json.dump({"versao": v, "arquivo": z, "sha256": hashlib.sha256(open(z, 'rb').read()).hexdigest(),
           "tamanho": os.path.getsize(z), "data": datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
           "novidades": open(n, encoding='utf-8').read().strip()},
          open('versao.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
PY
# guarda só os 3 últimos pacotes na pasta (os antigos continuam no histórico do git)
ls -1t versoes/hubii-central-*.zip | tail -n +4 | xargs -r git rm -q
git add versao.json "$ZIP"
git commit -q -m "Publica a versão $V"
git push origin HEAD:main
echo "Publicado: $V"
