#!/bin/bash

# DeCharge Scout - Remote Installer
# Usage: curl -fsSL <URL_TO_THIS_FILE> | bash
# Or: wget -qO- <URL_TO_THIS_FILE> | bash

set -e

REPO_URL="https://github.com/sentinelcore/agentone.git"
BRANCH="claude/solana-energy-scout-cli-d7vYT"
INSTALL_DIR="$HOME/decharge-scout"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}${BOLD}🔋 DeCharge Scout - One-Command Installer${NC}\n"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not found${NC}"
    echo "Please install Node.js v20+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${RED}✗ Node.js v20 or higher required. Current: $(node --version)${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Node.js $(node --version) detected"

# Check if directory exists
if [ -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}⚠${NC}  Directory $INSTALL_DIR already exists"
    read -p "Remove and reinstall? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$INSTALL_DIR"
    else
        echo "Installation cancelled"
        exit 0
    fi
fi

# Clone repository
echo -e "${BLUE}ℹ${NC}  Cloning repository..."
git clone -b "$BRANCH" "$REPO_URL" "$INSTALL_DIR"

# Change to directory
cd "$INSTALL_DIR"

echo -e "${GREEN}✓${NC} Repository cloned to $INSTALL_DIR"

# Run setup
echo -e "\n${CYAN}Running interactive setup...${NC}\n"
node setup.js

# Done
echo -e "\n${GREEN}${BOLD}✅ Installation complete!${NC}\n"
echo -e "${CYAN}To start the scout:${NC}"
echo -e "  cd $INSTALL_DIR"
echo -e "  decharge-scout"
echo -e "\n${CYAN}Or if not installed globally:${NC}"
echo -e "  cd $INSTALL_DIR"
echo -e "  node index.js"
echo ""
