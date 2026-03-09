#!/bin/bash
# install.sh — PowerLobster Plugin Installer
# Fully automated: installs plugin + fetches relay credentials + configures everything

set -e

REPO_URL="https://github.com/shadstoneofficial/openclaw-powerlobster"
OPENCLAW_DIR="${OPENCLAW_DIR:-$HOME/.openclaw}"
EXTENSIONS_DIR="$OPENCLAW_DIR/extensions"
PLUGIN_DIR="$EXTENSIONS_DIR/powerlobster"
CONFIG_FILE="$OPENCLAW_DIR/openclaw.json"
ENV_FILE="$OPENCLAW_DIR/.env"

echo "🦞 PowerLobster Plugin Installer v0.5.1"
echo "========================================"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 0: Prerequisites - API Key Required
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if [ -z "$POWERLOBSTER_API_KEY" ]; then
    # Check if already in .env
    if [ -f "$ENV_FILE" ]; then
        POWERLOBSTER_API_KEY=$(grep "^POWERLOBSTER_API_KEY=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'")
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

RELAY_RESPONSE=$(curl -s "https://powerlobster.com/api/agent/relay" \
    -H "Authorization: Bearer $POWERLOBSTER_API_KEY")

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
    echo "$RELAY_RESPONSE" | jq .
    echo ""
    echo "Make sure your agent has relay enabled in PowerLobster settings."
    exit 1
fi

echo "✅ Relay ID: $RELAY_ID"
echo "✅ Relay API Key: ${RELAY_API_KEY:0:20}..."

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 2: Check Dependencies
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install Node.js first."
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo "📦 Installing jq..."
    apt-get update -qq && apt-get install -y -qq jq 2>/dev/null || {
        echo "❌ Could not install jq. Please install it manually."
        exit 1
    }
fi

if ! command -v git &> /dev/null; then
    echo "📦 Installing git..."
    apt-get update -qq && apt-get install -y -qq git 2>/dev/null || {
        echo "❌ Could not install git. Please install it manually."
        exit 1
    }
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 3: Install Plugin
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if [ -d "$PLUGIN_DIR" ]; then
    echo "🧹 Removing previous installation..."
    rm -rf "$PLUGIN_DIR"
fi

echo "📦 Installing plugin from GitHub..."
git clone --depth 1 "$REPO_URL.git" "$PLUGIN_DIR" 2>/dev/null

cd "$PLUGIN_DIR"
npm install --production 2>/dev/null

if [ ! -f "$PLUGIN_DIR/dist/index.js" ]; then
    echo "❌ Installation failed - dist/index.js not found"
    exit 1
fi
echo "✅ Plugin installed"

# Fix permissions
CURRENT_UID=$(id -u)
CURRENT_GID=$(id -g)
chown -R "$CURRENT_UID:$CURRENT_GID" "$PLUGIN_DIR"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 4: Configure openclaw.json
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Config file not found: $CONFIG_FILE"
    echo "   Run 'openclaw configure' first."
    exit 1
fi

cp "$CONFIG_FILE" "$CONFIG_FILE.backup.$(date +%s)"

UPDATED_CONFIG=$(jq '
  .plugins.entries.powerlobster = {"enabled": true}
' "$CONFIG_FILE")

echo "$UPDATED_CONFIG" > "$CONFIG_FILE"
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
    if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
        # Update existing
        sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
    else
        # Add new
        echo "${key}=${value}" >> "$ENV_FILE"
    fi
}

update_env "POWERLOBSTER_API_KEY" "$POWERLOBSTER_API_KEY"
update_env "POWERLOBSTER_RELAY_ID" "$RELAY_ID"
update_env "POWERLOBSTER_RELAY_API_KEY" "$RELAY_API_KEY"

# Set default agent ID if not already set
if ! grep -q "^OPENCLAW_AGENT_ID=" "$ENV_FILE" 2>/dev/null; then
    update_env "OPENCLAW_AGENT_ID" "main"
    echo "✅ Set OPENCLAW_AGENT_ID=main (change if needed)"
fi

echo "✅ Credentials saved to $ENV_FILE"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 6: Copy POWERLOBSTER.md Template
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WORKSPACE_DIR="$OPENCLAW_DIR/workspace"
if [ -d "$WORKSPACE_DIR" ] && [ ! -f "$WORKSPACE_DIR/POWERLOBSTER.md" ]; then
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
echo "  • POWERLOBSTER_RELAY_API_KEY=sk_..."
echo "  • OPENCLAW_AGENT_ID=main"
echo ""
echo "📋 FINAL STEP - Restart OpenClaw:"
echo ""
echo "   openclaw gateway restart"
echo ""
echo "🦞 Your agent will now receive PowerLobster events in real-time!"
echo ""
