#!/usr/bin/env bash
# ==============================================================================
# Kyrandia 2: Hand of Fate - Asset Studio Launcher (Linux / macOS)
# ==============================================================================
set -e

cd "$(dirname "$0")"

# 1. Check Python 3
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: Python 3 is not installed or not in your PATH."
    echo "   Please install Python 3.8 or higher from https://python.org or via your package manager."
    exit 1
fi

# 2. Check Pillow dependency
if ! python3 -c "import PIL" &> /dev/null; then
    echo "📦 Notice: The 'Pillow' image library is required to render and export game graphics."
    echo "   Installing Pillow via pip..."
    python3 -m pip install -q -r requirements.txt || {
        echo "⚠️  Failed to automatically install Pillow."
        echo "   Please run: pip install -r requirements.txt"
        exit 1
    }
fi

# 3. Launch Desktop Studio
echo "🚀 Starting Kyrandia 2: Hand of Fate - Asset Studio..."
exec python3 app.py "$@"
