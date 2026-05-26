#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUD_SRC="$SCRIPT_DIR/hud.js"
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
HUD_DST="$CLAUDE_DIR/hud.js"
SETTINGS="$CLAUDE_DIR/settings.json"

if [ ! -f "$SETTINGS" ]; then
  echo "Error: $SETTINGS not found. Run 'claude' once to create it."
  exit 1
fi

# Copy hud.js to ~/.claude/
cp "$HUD_SRC" "$HUD_DST"
echo "Copied hud.js -> $HUD_DST"

# Use forward slashes for cross-platform path in JSON
HUD_DST_FWD=$(echo "$HUD_DST" | sed 's|\\|/|g')

node -e "
  const fs = require('fs');
  const s = JSON.parse(fs.readFileSync('$SETTINGS','utf8'));
  s.statusLine = { type: 'command', command: 'node \"$HUD_DST_FWD\"' };
  fs.writeFileSync('$SETTINGS', JSON.stringify(s, null, 2) + '\n');
  console.log('Updated statusLine in $SETTINGS');
"

echo "Done! Restart Claude Code to see the HUD."
