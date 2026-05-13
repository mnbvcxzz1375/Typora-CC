#!/bin/bash
# Typora-CC Plugin Installer — macOS
# Double-click this file in Finder to install.
set -euo pipefail

# ── Color palette (Typora-CC graphite/green) ──────────────────
ESC=$'\033'
RST="${ESC}[0m"
BOLD="${ESC}[1m"
DIM="${ESC}[2m"
GREEN="${ESC}[32m"
MINT="${ESC}[38;5;48m"
TEAL="${ESC}[38;5;35m"
RED="${ESC}[31m"
YELLOW="${ESC}[33m"
WHITE="${ESC}[97m"
GRAY="${ESC}[90m"
ACCENT="${ESC}[38;5;48m"

# ── Banner ────────────────────────────────────────────────────
clear
echo ""
echo "  ${MINT}${BOLD}  ████████╗██╗   ██╗██████╗  ██████╗ ██████╗  █████╗       ██████╗ ██████╗${RST}"
echo "  ${MINT}${BOLD}  ╚══██╔══╝╚██╗ ██╔╝██╔══██╗██╔═══██╗██╔══██╗██╔══██╗     ██╔════╝██╔════╝${RST}"
echo "  ${TEAL}${BOLD}     ██║    ╚████╔╝ ██████╔╝██║   ██║██████╔╝███████║     ██║     ██║     ${RST}"
echo "  ${TEAL}${BOLD}     ██║     ╚██╔╝  ██╔═══╝ ██║   ██║██╔══██╗██╔══██║     ██║     ██║     ${RST}"
echo "  ${GREEN}${BOLD}     ██║      ██║   ██║     ╚██████╔╝██║  ██║██║  ██║     ╚██████╗╚██████╗${RST}"
echo "  ${GREEN}${BOLD}     ╚═╝      ╚═╝   ╚═╝      ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝      ╚═════╝ ╚═════╝${RST}"
echo ""
echo "  ${DIM}  ┌──────────────────────────────────────────────────┐${RST}"
echo "  ${DIM}  │${RST}  ${WHITE}Typora-CC Markdown AI Assistant${RST}                  ${DIM}│${RST}"
echo "  ${DIM}  │${RST}  ${GRAY}Local tools  ${DIM}·${RST}  ${GRAY}Skills  ${DIM}·${RST}  ${GRAY}MCP  ${DIM}·${RST}  ${GRAY}Multi-model${RST}       ${DIM}│${RST}"
echo "  ${DIM}  └──────────────────────────────────────────────────┘${RST}"
echo ""
echo "  ${DIM}  by ${MINT}mnbvcxzz1375${RST} ${DIM}(${RST} ${GRAY}https://github.com/mnbvcxzz1375${RST} ${DIM})${RST}"
echo ""
echo "  ${DIM}──────────────────────────────────────────────────────${RST}"
echo ""

# ── Configuration ─────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TYPORA_RES="${TYPORA_RES:-/Applications/Typora.app/Contents/Resources}"
TYPORA_HTML="$TYPORA_RES/window.html"
TARGET="$TYPORA_RES/typora-gpt"
SUDO=()
if [[ ! -w "$TYPORA_RES" ]]; then
    SUDO=(sudo)
fi

# ── Verify ────────────────────────────────────────────────────
if [[ ! -f "$TYPORA_HTML" ]]; then
    echo "  ${RED}  [x] Typora not found at:${RST} ${WHITE}$TYPORA_RES${RST}"
    echo ""
    echo "  ${YELLOW}  [!] Set TYPORA_RES to your Typora resources path:${RST}"
    echo "  ${GRAY}      TYPORA_RES=/path/to/resources ./install.command${RST}"
    echo ""
    read -n 1 -s -r -p "  Press any key to close..."
    echo ""
    exit 1
fi

# ── Step 1: Copy files ───────────────────────────────────────
echo -e "  ${ACCENT}  [1/3]${RST} ${WHITE}Copying plugin files${RST} ${DIM}...${RST}"
"${SUDO[@]}" rm -rf "$TARGET" 2>/dev/null || true
"${SUDO[@]}" mkdir -p "$TARGET/plugin/css"
"${SUDO[@]}" cp "$SCRIPT_DIR"/plugin/*.js "$TARGET/plugin/" 2>/dev/null || true
"${SUDO[@]}" cp "$SCRIPT_DIR/plugin/css/style.css" "$TARGET/plugin/css/" 2>/dev/null || true
"${SUDO[@]}" cp "$SCRIPT_DIR/loader-embedded.js" "$TARGET/loader.js"

if [[ ! -f "$TARGET/loader.js" ]]; then
    echo "  ${RED}  [x] Failed to copy loader.js${RST}"
    read -n 1 -s -r -p "  Press any key to close..."
    echo ""
    exit 1
fi
if [[ ! -f "$TARGET/plugin/ui.js" ]]; then
    echo "  ${RED}  [x] Failed to copy plugin files${RST}"
    read -n 1 -s -r -p "  Press any key to close..."
    echo ""
    exit 1
fi
echo -e "  ${GREEN}       Done${RST} ${DIM}- plugin files copied${RST}"

# ── Step 2: Backup ───────────────────────────────────────────
echo -e "  ${ACCENT}  [2/3]${RST} ${WHITE}Backing up window.html${RST} ${DIM}...${RST}"
if [[ ! -f "$TYPORA_HTML.backup" ]]; then
    "${SUDO[@]}" cp "$TYPORA_HTML" "$TYPORA_HTML.backup"
    echo -e "  ${GREEN}       Done${RST} ${DIM}- backup created${RST}"
else
    echo -e "  ${YELLOW}       Skipped${RST} ${DIM}- backup already exists${RST}"
fi

# ── Step 3: Inject loader ────────────────────────────────────
echo -e "  ${ACCENT}  [3/3]${RST} ${WHITE}Injecting loader into window.html${RST} ${DIM}...${RST}"

if grep -q 'typora-gpt/loader\.js' "$TYPORA_HTML"; then
    echo -e "  ${YELLOW}       Skipped${RST} ${DIM}- already injected${RST}"
else
    # macOS sed: requires '' after -i
    "${SUDO[@]}" sed -i '' "s|</body></html>|<!-- Typora-CC Plugin -->\\n<script src=\"./typora-gpt/loader.js\"></script>\\n</body></html>|" "$TYPORA_HTML"
    echo -e "  ${GREEN}       Done${RST} ${DIM}- loader injected${RST}"
fi

# ── Verify & Success ─────────────────────────────────────────
if grep -q 'typora-gpt/loader\.js' "$TYPORA_HTML"; then
    echo ""
    echo "  ${DIM}──────────────────────────────────────────────────────${RST}"
    echo ""
    echo -e "  ${GREEN}${BOLD}  Installation Successful!${RST}"
    echo ""
    echo -e "  ${WHITE}  Next Steps:${RST}"
    echo ""
    echo -e "  ${DIM}  1.${RST} ${GRAY}Restart Typora${RST}"
    echo -e "  ${DIM}  2.${RST} ${GRAY}Press ${WHITE}Ctrl+Shift+G${RST} ${GRAY}or click the Typora-CC button${RST}"
    echo -e "  ${DIM}  3.${RST} ${GRAY}Click the settings icon to configure your API${RST}"
    echo ""
    echo "  ${DIM}──────────────────────────────────────────────────────${RST}"
    echo ""
    echo -e "  ${DIM}  GitHub:${RST} ${MINT}https://github.com/mnbvcxzz1375${RST}"
    echo ""
else
    echo ""
    echo "  ${RED}  [x] Auto-injection failed.${RST}"
    echo "  ${YELLOW}  [!] Please manually add before </body> in:${RST}"
    echo "  ${WHITE}  $TYPORA_HTML${RST}"
    echo ""
    echo -e "  ${DIM}    <script src=\"./typora-gpt/loader.js\"></script>${RST}"
    echo ""
fi

read -n 1 -s -r -p "  Press any key to close..."
echo ""
