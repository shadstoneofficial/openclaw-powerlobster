#!/bin/bash
# install.sh — PowerLobster Plugin Installer
# Fully automated: installs plugin + fetches relay credentials + configures everything

set -e

REPO_URL="https://github.com/shadstoneofficial/openclaw-powerlobster.git"
OPENCLAW_DIR="${OPENCLAW_DIR:-$HOME/.openclaw}"
EXTENSIONS_DIR="$OPENCLAW_DIR/extensions"
PLUGIN_DIR="$EXTENSIONS_DIR/powerlobster"
CONFIG_FILE="$OPENCLAW_DIR/openclaw.json"
ENV_FILE="$OPENCLAW_DIR/.env"

echo "🦞 PowerLobster Plugin Installer (LEGACY)"
echo "========================================="
echo ""
echo "⚠️  WARNING: THIS PLUGIN IS DEPRECATED!"
echo "   Please upgrade to the new channel integration:"
echo "   https://github.com/shadstoneofficial/powerlobster"
echo ""
echo "   Continuing in 5 seconds... (Ctrl+C to cancel)"
sleep 5
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 0: Prerequisites - API Key Required
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Check if POWERLOBSTER_API_KEY is provided as environment variable
if [ -z "$POWERLOBSTER_API_KEY" ]; then
    # Try to read from existing .env file
    if [ -f "$ENV_FILE" ]; then
        POWERLOBSTER_API_KEY=$(grep "^POWERLOBSTER_API_KEY=" "$ENV_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    fi
fi

if [ -z "$POWERLOBSTER_API_KEY" ]; then
    echo "❌ POWERLOBSTER_API_KEY is required!"
    echo ""
    echo "Get your API key from PowerLobster agent settings, then run:"
    echo ""
    echo "  POWERLOBSTER_API_KEY=your-key-here curl -fsSL https://raw.githubusercontent.com/shadstoneofficial/openclaw-powerlobster/main/install.sh | bash"
    echo ""
    echo "Or set it first:"
    echo "  export POWERLOBSTER_API_KEY=your-key-here"
    echo "  curl -fsSL ... | bash"
    echo ""
    exit 1
fi

echo "✅ API Key found"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 1: Fetch Relay Credentials
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "🔑 Fetching relay credentials from PowerLobster..."

RELAY_RESPONSE=$(curl -s -X POST "https://powerlobster.com/api/agent/relay" \
    -H "Authorization: Bearer $POWERLOBSTER_API_KEY" \
    -H "Content-Type: application/json")

# Check for errors
if echo "$RELAY_RESPONSE" | grep -q '"error"'; then
    echo "❌ Failed to fetch relay credentials:"
    echo "$RELAY_RESPONSE" | jq -r '.error // .message // .'
    exit 1
fi

RELAY_ID=$(echo "$RELAY_RESPONSE" | jq -r '.relay_id // empty')
RELAY_API_KEY=$(echo "$RELAY_RESPONSE" | jq -r '.relay_api_key // empty')

if [ -z "$RELAY_ID" ] || [ -z "$RELAY_API_KEY" ]; then
    echo "❌ Could not extract relay credentials from response:"
    echo "$RELAY_RESPONSE"
    echo ""
    echo "Make sure your agent has relay enabled in PowerLobster settings."
    exit 1
fi

echo "✅ Relay ID: $RELAY_ID"
echo "✅ Relay API Key: ${RELAY_API_KEY:0:10}..."

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 2: Check Dependencies
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install Node.js first."
    exit 1
fi

if ! command -v jq &> /dev/null; then
    if command -v apt-get &> /dev/null; then
        echo "📦 Installing jq..."
        sudo apt-get update -qq && sudo apt-get install -y -qq jq
    else
        echo "❌ jq is required but not found. Please install it manually."
        exit 1
    fi
fi

if ! command -v git &> /dev/null; then
    if command -v apt-get &> /dev/null; then
        echo "📦 Installing git..."
        sudo apt-get update -qq && sudo apt-get install -y -qq git
    else
        echo "❌ git is required but not found. Please install it manually."
        exit 1
    fi
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 3: Install Plugin
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if [ -d "$PLUGIN_DIR" ]; then
    echo "🧹 Removing previous installation..."
    rm -rf "$PLUGIN_DIR"
fi

echo "📦 Installing plugin from GitHub..."
git clone --depth 1 "$REPO_URL" "$PLUGIN_DIR"

cd "$PLUGIN_DIR"
npm install --production --no-audit --no-fund

# Build plugin if typescript source exists but dist doesn't
if [ -f "tsconfig.json" ] && [ ! -d "dist" ]; then
    echo "🔨 Building plugin..."
    npm run build
fi

if [ ! -f "$PLUGIN_DIR/dist/index.js" ]; then
    echo "❌ Installation failed - dist/index.js not found"
    exit 1
fi
echo "✅ Plugin installed"

# Fix permissions if running as root but user exists
if [ "$(id -u)" = "0" ] && [ -n "$SUDO_USER" ]; then
    chown -R "$SUDO_USER" "$PLUGIN_DIR"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 4: Configure openclaw.json
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if [ ! -f "$CONFIG_FILE" ]; then
    echo "⚠️  Config file not found: $CONFIG_FILE"
    echo "   Creating default config..."
    mkdir -p "$OPENCLAW_DIR"
    echo '{ "plugins": { "entries": {} } }' > "$CONFIG_FILE"
fi

# Create backup
cp "$CONFIG_FILE" "$CONFIG_FILE.backup.$(date +%s)"

# Use temporary file for jq output
TMP_CONFIG=$(mktemp)
jq '.plugins.entries.powerlobster = {"enabled": true}' "$CONFIG_FILE" > "$TMP_CONFIG" && mv "$TMP_CONFIG" "$CONFIG_FILE"

echo "✅ openclaw.json updated"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 5: Write Credentials to .env
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "📝 Writing credentials to .env..."

# Create .env if doesn't exist
touch "$ENV_FILE"

# Function to update or add env var
update_env() {
    local key="$1"
    local value="$2"
    if grep -q "^${key}=" "$ENV_FILE"; then
        # Update existing (using temporary file for sed compatibility)
        local tmp_env=$(mktemp)
        sed "s|^${key}=.*|${key}=${value}|" "$ENV_FILE" > "$tmp_env" && mv "$tmp_env" "$ENV_FILE"
    else
        # Add new
        echo "${key}=${value}" >> "$ENV_FILE"
    fi
}

update_env "POWERLOBSTER_API_KEY" "$POWERLOBSTER_API_KEY"
update_env "POWERLOBSTER_RELAY_ID" "$RELAY_ID"
update_env "POWERLOBSTER_RELAY_API_KEY" "$RELAY_API_KEY"

# Set default agent ID if not already set
if ! grep -q "^OPENCLAW_AGENT_ID=" "$ENV_FILE"; then
    update_env "OPENCLAW_AGENT_ID" "main"
    echo "✅ Set OPENCLAW_AGENT_ID=main (change if needed)"
fi

echo "✅ Credentials saved to $ENV_FILE"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 6: Copy POWERLOBSTER.md Template
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WORKSPACE_DIR="$OPENCLAW_DIR/workspace"
# Create workspace dir if it doesn't exist
mkdir -p "$WORKSPACE_DIR"

if [ ! -f "$WORKSPACE_DIR/POWERLOBSTER.md" ]; then
    if [ -f "$PLUGIN_DIR/POWERLOBSTER.template.md" ]; then
        cp "$PLUGIN_DIR/POWERLOBSTER.template.md" "$WORKSPACE_DIR/POWERLOBSTER.md"
        echo "✅ Created POWERLOBSTER.md in workspace"
    fi
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# DONE!
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 PowerLobster Plugin Installation Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Credentials saved:"
echo "  • POWERLOBSTER_API_KEY"
echo "  • POWERLOBSTER_RELAY_ID=$RELAY_ID"
echo "  • POWERLOBSTER_RELAY_API_KEY=${RELAY_API_KEY:0:10}..."
echo "  • OPENCLAW_AGENT_ID=main"
echo ""
echo "📋 FINAL STEP - Restart OpenClaw:"
echo ""
echo "   openclaw gateway restart"
echo ""
echo "🦞 Your agent will now receive PowerLobster events in real-time!"
echo ""
