#!/bin/bash
set -e

INSTALL_DIR="${HOME}/LAL"

echo "Installing lal-cli..."

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "Error: uv is not installed."
    echo "Install it with: curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

# Clone repo if not exists
if [ ! -d "$INSTALL_DIR" ]; then
    echo "Cloning repository to ${INSTALL_DIR}..."
    git clone https://github.com/SaulLockYip/LAL.git "$INSTALL_DIR"
else
    echo "Repository already exists at ${INSTALL_DIR}"
fi

cd "$INSTALL_DIR"

# Install CLI
if uv tool list 2>/dev/null | grep -q "lal-cli"; then
    echo "Updating lal-cli..."
    uv tool install ./cli --force
else
    echo "Installing lal-cli..."
    uv tool install ./cli
fi

# Initialize project
echo ""
echo "Initializing project..."
lal-cli init

echo ""
echo "lal-cli installed successfully!"
echo "Run 'lal-cli start' to start the server."
