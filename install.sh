#!/bin/bash
# install.sh — PowerLobster Plugin Installer
# Fully automated: installs plugin + configures openclaw.json

set -e

REPO_URL="https://github.com/shadstoneofficial/openclaw-powerlobster"
OPENCLAW_DIR="${OPENCLAW_DIR:-$HOME/.openclaw}"
EXTENSIONS_DIR="$OPENCLAW_DIR/extensions"
PLUGIN_DIR="$EXTENSIONS_DIR/powerlobster"
CONFIG_FILE="$OPENCLAW_DIR/openclaw.json"

echo "🦞 PowerLobster Plugin Installer"
echo "================================"
echo "Source: $REPO_URL"
echo "Target: $PLUGIN_DIR"
echo ""

# Check dependencies
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install Node.js first."
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo "📦 Installing jq..."
    apt-get update -qq && apt-get install -y -qq jq || {
        echo "❌ Could not install jq. Please install it manually."
        exit 1
    }
fi

if ! command -v git &> /dev/null; then
    echo "📦 Installing git..."
    apt-get update -qq && apt-get install -y -qq git || {
        echo "❌ Could not install git. Please install it manually."
        exit 1
    }
fi

# Clean previous installation
if [ -d "$PLUGIN_DIR" ]; then
    echo "🧹 Removing previous installation..."
    rm -rf "$PLUGIN_DIR"
fi

# Clone and install
echo "📦 Installing plugin from GitHub..."
git clone --depth 1 "$REPO_URL.git" "$PLUGIN_DIR" 2>/dev/null

cd "$PLUGIN_DIR"
npm install --production 2>/dev/null

# Verify installation
if [ ! -f "$PLUGIN_DIR/dist/index.js" ]; then
    echo "❌ Installation failed - dist/index.js not found"
    exit 1
fi
echo "✅ Plugin installed"

# Fix permissions - match current user (root or container user)
CURRENT_UID=$(id -u)
CURRENT_GID=$(id -g)
chown -R "$CURRENT_UID:$CURRENT_GID" "$PLUGIN_DIR"
echo "✅ Permissions set (uid=$CURRENT_UID)"

# Auto-configure openclaw.json
echo ""
echo "🔧 Configuring openclaw.json..."

if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Config file not found: $CONFIG_FILE"
    echo "   Run 'openclaw configure' first."
    exit 1
fi

# Backup config
cp "$CONFIG_FILE" "$CONFIG_FILE.backup.$(date +%s)"

# Update config with jq - just enable plugin, no path needed (auto-discovered)
UPDATED_CONFIG=$(jq '
  # Enable plugin (auto-discovered from extensions folder)
  .plugins.entries.powerlobster = {
    "enabled": true
  }
' "$CONFIG_FILE")

echo "$UPDATED_CONFIG" > "$CONFIG_FILE"
echo "✅ Config updated"

# Copy POWERLOBSTER.md template to workspace if it doesn't exist
WORKSPACE_DIR="$OPENCLAW_DIR/workspace"
if [ ! -f "$WORKSPACE_DIR/POWERLOBSTER.md" ]; then
  if [ -f "$PLUGIN_DIR/POWERLOBSTER.template.md" ]; then
    cp "$PLUGIN_DIR/POWERLOBSTER.template.md" "$WORKSPACE_DIR/POWERLOBSTER.md"
    echo "✅ Created POWERLOBSTER.md in workspace"
  fi
fi

echo ""
echo "✅ PowerLobster plugin installed and configured!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 NEXT STEPS:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Set your API key:"
echo ""
echo "   echo \"POWERLOBSTER_API_KEY=<your-api-key>\" >> $OPENCLAW_DIR/.env"
echo "   echo \"OPENCLAW_AGENT_ID=<your-agent-id>\" >> $OPENCLAW_DIR/.env"
echo ""
echo "2. Restart OpenClaw:"
echo ""
echo "   openclaw gateway restart"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🦞 That's it! Your agent will receive PowerLobster events."
echo ""
