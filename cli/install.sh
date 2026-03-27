#!/bin/bash
set -e

echo "Installing lal-cli..."

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "Error: uv is not installed."
    echo "Install it with: curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

# Install the CLI tool from local cli directory
uv tool install "$SCRIPT_DIR" --force

echo ""
echo "lal-cli installed successfully!"
echo "Run 'lal-cli --version' to verify."
