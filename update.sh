#!/bin/bash
# PowerLobster Plugin Update Script
# Updates existing installation to latest version

set -e

PLUGIN_DIR="${OPENCLAW_EXTENSIONS:-$HOME/.openclaw/extensions}/powerlobster"

echo "🦞 PowerLobster Plugin Updater"
echo "==============================="

# Check if plugin exists
if [ ! -d "$PLUGIN_DIR" ]; then
  echo "❌ Plugin not found at $PLUGIN_DIR"
  echo "   Run the install script first:"
  echo "   curl -fsSL https://raw.githubusercontent.com/shadstoneofficial/openclaw-powerlobster/main/install.sh | bash"
  exit 1
fi

# Get current version
CURRENT_VERSION=$(cat "$PLUGIN_DIR/package.json" 2>/dev/null | grep '"version"' | head -1 | sed 's/.*: "\(.*\)".*/\1/')
echo "📦 Current version: ${CURRENT_VERSION:-unknown}"

# Pull latest
echo "📥 Pulling latest changes..."
cd "$PLUGIN_DIR"
git fetch origin main
git reset --hard origin/main

# Get new version
NEW_VERSION=$(cat "$PLUGIN_DIR/package.json" | grep '"version"' | head -1 | sed 's/.*: "\(.*\)".*/\1/')
echo "📦 New version: $NEW_VERSION"

# Rebuild
echo "🔨 Building..."
npm run build

echo ""
echo "✅ Plugin updated to v$NEW_VERSION!"
echo ""
echo "🔄 Now restart your gateway:"
echo "   openclaw gateway restart"
