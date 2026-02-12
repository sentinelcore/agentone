#!/bin/bash

# DeCharge Scout - Quick Setup Script
# This script automates the initial setup process

set -e

echo "🔋 DeCharge Scout - Quick Setup"
echo "================================"
echo ""

# Check Node.js version
echo "Checking Node.js version..."
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)

if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Error: Node.js v20 or higher required. Current: $(node --version)"
    echo "Download from: https://nodejs.org/"
    exit 1
fi

echo "✓ Node.js $(node --version) detected"
echo ""

# Install dependencies
echo "Installing dependencies..."
npm install
echo "✓ Dependencies installed"
echo ""

# Create .env from example
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example .env
    echo "✓ .env file created"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env and add your EIA_API_KEY"
    echo "   Get your key from: https://www.eia.gov/opendata/register.php"
    echo ""
else
    echo "✓ .env file already exists"
    echo ""
fi

# Check if Solana CLI is installed
if command -v solana &> /dev/null; then
    echo "✓ Solana CLI detected: $(solana --version)"

    # Ask if user wants to create a wallet
    read -p "Create a new wallet? (y/n): " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        WALLET_PATH="./my-wallet.json"

        if [ -f "$WALLET_PATH" ]; then
            echo "⚠️  Wallet already exists at $WALLET_PATH"
        else
            echo "Creating new wallet..."
            solana-keygen new --outfile "$WALLET_PATH"

            WALLET_PUBKEY=$(solana-keygen pubkey "$WALLET_PATH")
            echo ""
            echo "✓ Wallet created!"
            echo "   Address: $WALLET_PUBKEY"
            echo ""

            # Ask if user wants to request airdrop
            read -p "Request devnet SOL airdrop? (y/n): " -n 1 -r
            echo ""

            if [[ $REPLY =~ ^[Yy]$ ]]; then
                echo "Requesting airdrop..."
                solana airdrop 1 "$WALLET_PUBKEY" --url devnet

                echo ""
                echo "Checking balance..."
                solana balance "$WALLET_PUBKEY" --url devnet
            fi
        fi
    fi
else
    echo "⚠️  Solana CLI not detected"
    echo "   Optional but recommended for wallet management"
    echo "   Install from: https://docs.solana.com/cli/install-solana-cli-tools"
    echo ""
fi

# Make index.js executable
chmod +x index.js
echo "✓ Made index.js executable"
echo ""

# Check .env configuration
if grep -q "your_eia_api_key_here" .env 2>/dev/null; then
    echo "⚠️  Configuration required:"
    echo "   1. Get EIA API key: https://www.eia.gov/opendata/register.php"
    echo "   2. Edit .env and replace 'your_eia_api_key_here' with your key"
    echo ""
fi

# Final instructions
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Ensure EIA_API_KEY is set in .env"
echo "  2. Ensure you have a wallet with at least 0.02 SOL on devnet"
echo "  3. Run: node index.js --wallet=./my-wallet.json"
echo ""
echo "For help: node index.js --help"
echo "Full docs: cat README.md"
echo ""
