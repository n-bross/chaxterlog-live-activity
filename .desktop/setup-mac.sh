#!/usr/bin/env bash
set -euo pipefail

# Run on the Mac that should host the desktop-to-iPhone development service.
# This installs the official sync CLI and prepares a VS Code workspace; it never runs ChaxterLog.
if [[ "$(uname -s)" != Darwin ]]; then
  echo "Bitte dieses Setup auf deinem Mac ausführen." >&2
  exit 1
fi
for program in node npm git; do
  if ! command -v "$program" >/dev/null 2>&1; then
    echo "Fehlt: $program. Bitte zuerst installieren." >&2
    exit 1
  fi
done
if ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)'; then
  echo "Node.js 20 oder neuer wird benötigt." >&2
  exit 1
fi

chaxter_workspace="${1:-$HOME/Developer/chaxterlog-scripting}"
mkdir -p "$chaxter_workspace/scripts" "$chaxter_workspace/.vscode"
cd "$chaxter_workspace"

# Only create missing configuration; preserve a previously configured workspace.
node <<'JS'
const fs = require('node:fs')
function create(path, value) {
  if (!fs.existsSync(path)) fs.writeFileSync(path, JSON.stringify(value, null, 2) + '\n')
}
create('package.json', {
  name: 'chaxterlog-scripting-desktop', private: true,
  scripts: { remote: 'scripting-cli start --bonjour' },
  dependencies: { 'scripting-cli': '1.5.0' },
})
create('scripting.config.json', {
  editor: 'vscode', port: 4000, autoOpen: true, generateTsConfig: true,
  logLevel: 'info', ignore: ['tests', 'README.md', '*.log'],
})
create('.vscode/tasks.json', {
  version: '2.0.0', tasks: [{ label: 'Scripting: iPhone verbinden', type: 'shell',
    command: 'npm run remote', problemMatcher: [],
    presentation: { reveal: 'always', panel: 'dedicated' } }],
})
JS

npm install --no-audit --no-fund --save-exact scripting-cli@1.5.0

if [[ ! -e scripts/ChaxterLog ]]; then
  git clone https://github.com/n-bross/chaxterlog-live-activity.git scripts/ChaxterLog
elif [[ ! -d scripts/ChaxterLog/.git ]]; then
  echo "scripts/ChaxterLog existiert bereits. Der vorhandene Ordner wird nicht überschrieben." >&2
  exit 1
fi

if command -v code >/dev/null 2>&1; then
  code --new-window "$chaxter_workspace"
fi
printf 'Vorbereitet: %s\n' "$chaxter_workspace"
printf '%s\n' 'Zum Verbinden im VS-Code-Terminal: npm run remote'
printf '%s\n' 'Dann in Scripting auf dem iPhone Remote Coding öffnen und diesen Mac auf Port 4000 auswählen.'
