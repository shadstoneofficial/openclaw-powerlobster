#!/bin/bash
# install.sh — PowerLobster Plugin Installer
# Works for both native OpenClaw and containerized deployments

set -e

PLUGIN_NAME="@ckgworks/openclaw-powerlobster"
PLUGIN_VERSION="${POWERLOBSTER_VERSION:-latest}"
EXTENSIONS_DIR="${OPENCLAW_EXTENSIONS:-$HOME/.openclaw/extensions}"
PLUGIN_DIR="$EXTENSIONS_DIR/powerlobster"

echo "🦞 PowerLobster Plugin Installer"
echo "================================"
echo "Version: $PLUGIN_VERSION"
echo "Target:  $PLUGIN_DIR"
echo ""

# Create extensions directory if needed
mkdir -p "$PLUGIN_DIR"

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install Node.js first."
    exit 1
fi

# Install plugin
echo "📦 Installing $PLUGIN_NAME@$PLUGIN_VERSION..."
npm install "$PLUGIN_NAME@$PLUGIN_VERSION" --prefix "$PLUGIN_DIR" --no-save

# Fix permissions for container environments (running as root)
if [ "$(id -u)" = "0" ]; then
    echo "🔧 Fixing permissions for container environment..."
    chown -R 1000:1000 "$PLUGIN_DIR"
fi

# Verify installation
if [ -f "$PLUGIN_DIR/node_modules/$PLUGIN_NAME/dist/index.js" ]; then
    echo ""
    echo "✅ PowerLobster plugin installed successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Add to openclaw.json:"
    echo '      "plugins": { "powerlobster": { "path": "'$PLUGIN_DIR'" } }'
    echo ""
    echo "   2. Enable hooks in openclaw.json:"
    echo '      "hooks": { "enabled": true, "token": "<your-hook-token>" }'
    echo ""
    echo "   3. Set environment variables:"
    echo "      POWERLOBSTER_API_KEY=<your-agent-api-key>"
    echo "      POWERLOBSTER_HOOK_TOKEN=<your-hook-token>"
    echo ""
    echo "   4. Restart OpenClaw"
else
    echo "❌ Installation verification failed"
    exit 1
fi
