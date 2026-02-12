# Installation Guide - DeCharge Scout

Complete step-by-step installation and setup guide.

## Quick Start (5 minutes)

### Step 1: System Requirements

Verify you have Node.js v20 or higher:

```bash
node --version
# Should show v20.x.x or higher
```

If not installed, download from https://nodejs.org/

### Step 2: Install Solana CLI (Optional but recommended)

```bash
# macOS/Linux
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Windows (PowerShell)
# Download from https://github.com/solana-labs/solana/releases
```

Verify installation:

```bash
solana --version
```

### Step 3: Project Setup

```bash
# Navigate to project directory
cd decharge-scout

# Install all dependencies
npm install

# This will install:
# - @solana/web3.js (Solana blockchain)
# - @solana/spl-token (Token operations)
# - commander (CLI framework)
# - node-fetch (HTTP requests)
# - chalk (Colored terminal output)
# - ora (Loading spinners)
# - dotenv (Environment variables)
```

### Step 4: Get EIA API Key

1. Go to https://www.eia.gov/opendata/register.php
2. Fill out the registration form (takes 1 minute)
3. Check your email for the API key
4. Copy your API key (looks like: `abc123def456...`)

### Step 5: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env file
nano .env  # or use your preferred editor
```

Paste your EIA API key:

```env
EIA_API_KEY=your_actual_api_key_here

# Leave other settings as default
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
ORACLE_ESCROW_ADDRESS=4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T
STAKE_AMOUNT=0.01
PREMIUM_PRICE=0.001
```

### Step 6: Create Wallet

If you already have a Solana wallet JSON file, skip to Step 7.

```bash
# Create new wallet
solana-keygen new --outfile ./my-wallet.json

# You'll see output like:
# Generating a new keypair
# pubkey: 8kF3...Ab9c
# Save this passphrase: [24 words]

# IMPORTANT: Save the passphrase in a safe place!
```

### Step 7: Fund Wallet with Devnet SOL

```bash
# Get your wallet address
solana-keygen pubkey ./my-wallet.json

# Request airdrop (repeat if needed)
solana airdrop 1 $(solana-keygen pubkey ./my-wallet.json) --url devnet

# Check balance
solana balance $(solana-keygen pubkey ./my-wallet.json) --url devnet
# Should show: 1 SOL or more
```

**Note**: You need at least 0.02 SOL (0.01 for stake + 0.01 for fees)

### Step 8: First Run

```bash
# Make index.js executable (Unix/macOS/Linux)
chmod +x index.js

# Run the scout
node index.js --wallet=./my-wallet.json

# Or if installed globally:
npm install -g .
decharge-scout --wallet=./my-wallet.json
```

### Step 9: Verify It's Working

You should see:

```
🔋 DeCharge Scout - Energy Grid Data Scout

✓ Wallet loaded: 8kF3...Ab9c
🤖 Agent Name: Agent-A1B2C3
✓ Location: Austin, TX
⭐ Current Points: 0

💰 Staking 0.01 SOL for anti-spam/gas...
✓ Stake successful! TX: 5j7k...8h3f

🔄 Starting query cycle (runs every 15 minutes)...
Press Ctrl+C to stop and refund stake

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 Run #1 - [timestamp]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Fetched 24 data points from EIA (ERCOT)
✓ Optimization complete

✨ Optimization Results:
   Cheapest charge window: 2AM-3AM
   Price: $0.0485/kWh
   Savings: 23.5%
```

## Advanced Installation Options

### Global Installation

To use `decharge-scout` command anywhere:

```bash
npm install -g .

# Now you can run from any directory
decharge-scout --wallet=/path/to/wallet.json
```

### Development Setup

For development and testing:

```bash
# Install with dev dependencies
npm install

# Create test wallet
solana-keygen new --outfile ./test-wallet.json --no-bip39-passphrase

# Run with npm
npm start -- --wallet=./test-wallet.json --agent-name="DevAgent"
```

### Dashboard Integration Setup

To test dashboard integration:

1. Create a simple test server:

```bash
# Create server.js
cat > server.js << 'EOF'
const http = require('http');

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/submit') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      console.log('\n📊 Dashboard received:');
      console.log(JSON.stringify(JSON.parse(body), null, 2));
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end('OK');
    });
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(3000, () => console.log('Dashboard mock server running on :3000'));
EOF

# Run mock server
node server.js
```

2. Update `.env`:

```env
DASHBOARD_API_URL=http://localhost:3000/submit
```

3. Run scout in another terminal - it will POST data to your mock server

### Custom Escrow Address

To use your own escrow wallet:

1. Create escrow wallet:

```bash
solana-keygen new --outfile ./escrow-wallet.json
solana-keygen pubkey ./escrow-wallet.json
# Copy the public key
```

2. Update `.env`:

```env
ORACLE_ESCROW_ADDRESS=<your_escrow_pubkey>
```

## Verification Checklist

Before running, verify:

- [ ] Node.js v20+ installed (`node --version`)
- [ ] Dependencies installed (`ls node_modules` shows packages)
- [ ] `.env` file exists with EIA_API_KEY
- [ ] Wallet file exists (`.json` format)
- [ ] Wallet has at least 0.02 SOL on devnet
- [ ] Internet connection active

## Common Installation Issues

### "Cannot find module '@solana/web3.js'"

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### "Permission denied" when running

```bash
# Make executable
chmod +x index.js

# Or run with node
node index.js --wallet=./wallet.json
```

### "Network error" or "Connection refused"

- Check internet connection
- Verify Solana devnet is operational: https://status.solana.com/
- Try different RPC URL in `.env`:

```env
SOLANA_RPC_URL=https://api.devnet.solana.com
# Or try:
SOLANA_RPC_URL=https://rpc.ankr.com/solana_devnet
```

### "EIA API rate limit"

- Free tier allows 100 requests/day
- Wait an hour and try again
- Or the tool will fallback to Electricity Maps automatically

### "Insufficient funds"

```bash
# Request more SOL
solana airdrop 1 <YOUR_WALLET_PUBKEY> --url devnet

# If airdrop fails (rate limited), try:
# - Wait 10 minutes and try again
# - Use different RPC
# - Request from faucet: https://faucet.solana.com/
```

## Uninstallation

To remove DeCharge Scout:

```bash
# If installed globally
npm uninstall -g decharge-scout

# Remove points data
rm -rf ~/.decharge-scout/

# Remove project files
cd ..
rm -rf decharge-scout/
```

## Next Steps

After successful installation:

1. **Customize Agent Name**: Use `--agent-name` for personalization
2. **Enable Premium**: Try `--premium` flag (costs 0.001 SOL)
3. **Monitor Points**: Check `~/.decharge-scout/points.json`
4. **Let it Run**: Leave running to accumulate points
5. **Dashboard**: Set up visualization server for global map

## Support

If you encounter issues:

1. Check this installation guide
2. Review README.md troubleshooting section
3. Verify all prerequisites are met
4. Check Solana devnet status
5. Ensure EIA API key is valid

## Security Reminders

- **NEVER commit wallet files** to version control
- **Keep your passphrase safe** - it's your only recovery method
- **Use devnet only** - this is for testing
- **Don't share your .env file** - contains API keys
- **Backup your wallet** - copy to secure location

---

**Ready to scout!** Run: `decharge-scout --wallet=./my-wallet.json`
