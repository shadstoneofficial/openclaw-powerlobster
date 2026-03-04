#!/bin/bash
# install.sh — PowerLobster Plugin Installer
# Fully automated: installs plugin + configures openclaw.json

set -e

PLUGIN_NAME="@ckgworks/openclaw-powerlobster"
PLUGIN_VERSION="${POWERLOBSTER_VERSION:-latest}"
OPENCLAW_DIR="${OPENCLAW_DIR:-$HOME/.openclaw}"
EXTENSIONS_DIR="$OPENCLAW_DIR/extensions"
PLUGIN_DIR="$EXTENSIONS_DIR/powerlobster"
CONFIG_FILE="$OPENCLAW_DIR/openclaw.json"

echo "🦞 PowerLobster Plugin Installer"
echo "================================"
echo "Version: $PLUGIN_VERSION"
echo "Target:  $PLUGIN_DIR"
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

# Create extensions directory
mkdir -p "$PLUGIN_DIR"

# Install plugin
echo "📦 Installing $PLUGIN_NAME@$PLUGIN_VERSION..."
npm install "$PLUGIN_NAME@$PLUGIN_VERSION" --prefix "$PLUGIN_DIR" --no-save 2>/dev/null

# Verify installation
if [ ! -f "$PLUGIN_DIR/node_modules/$PLUGIN_NAME/dist/index.js" ]; then
    echo "❌ Installation failed"
    exit 1
fi
echo "✅ Plugin installed"

# Fix permissions for container environments
if [ "$(id -u)" = "0" ]; then
    chown -R 1000:1000 "$PLUGIN_DIR" 2>/dev/null || true
fi

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

# Generate hook token if needed
HOOK_TOKEN=$(openssl rand -hex 24 2>/dev/null || head -c 48 /dev/urandom | xxd -p | tr -d '\n')

# Update config with jq
UPDATED_CONFIG=$(jq --arg pluginDir "$PLUGIN_DIR" --arg hookToken "$HOOK_TOKEN" '
  # Add hooks config if not present
  .hooks.enabled = true |
  .hooks.token = (.hooks.token // $hookToken) |
  
  # Add plugin entry
  .plugins.entries.powerlobster = {
    "enabled": true,
    "path": ($pluginDir + "/node_modules/@ckgworks/openclaw-powerlobster")
  }
' "$CONFIG_FILE")

echo "$UPDATED_CONFIG" > "$CONFIG_FILE"
echo "✅ Config updated"

# Get the hook token that was set
FINAL_HOOK_TOKEN=$(jq -r '.hooks.token' "$CONFIG_FILE")

echo ""
echo "✅ PowerLobster plugin installed and configured!"
echo ""
echo "📋 Next steps:"
echo ""
echo "   1. Set your API key:"
echo "      echo \"POWERLOBSTER_API_KEY=<your-key>\" >> $OPENCLAW_DIR/.env"
echo "      echo \"POWERLOBSTER_HOOK_TOKEN=$FINAL_HOOK_TOKEN\" >> $OPENCLAW_DIR/.env"
echo ""
echo "   2. Restart OpenClaw:"
echo "      openclaw gateway restart"
echo ""
echo "🦞 That's it! Your agent will now receive PowerLobster events."
