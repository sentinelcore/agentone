# DeCharge Scout

AI-powered energy grid data scout with Solana blockchain integration. This CLI tool scouts public energy grid data, performs optimizations to find the cheapest EV charging windows, and submits anonymized results to a mock DeCharge oracle on Solana.

## 🚀 Quick Install

**One-liner installation:**

```bash
git clone -b claude/solana-energy-scout-cli-d7vYT https://github.com/sentinelcore/agentone.git decharge-scout && cd decharge-scout && node setup.js
```

Then run: `decharge-scout`

[See more installation options →](ONE_COMMAND_INSTALL.md)

## Features

- **Real-time Energy Data**: Fetches live energy pricing and demand data from EIA and Electricity Maps APIs
- **Smart Optimization**: Finds the cheapest charging windows in the next 24 hours
- **Blockchain Integration**: Submits results to Solana devnet with anti-spam staking
- **Points System**: Earn points for successful submissions and good optimizations
- **Location Tracking**: Auto-detects location via IP for global dashboard visualization
- **Premium Features**: x402 micropayments for enhanced forecast data
- **Dashboard Ready**: Structured data output for global visualization

## Prerequisites

- Node.js v20 or higher
- A Solana wallet keypair file (JSON format)
- **Energy Data API Key** (choose FREE option based on your location):
  - 🇺🇸 **EIA API** (FREE, US-only): https://www.eia.gov/opendata/register.php
  - 🇪🇺 **ENTSO-E** (FREE, Europe): https://transparency.entsoe.eu/
  - 🇬🇧 **UK Carbon Intensity** (FREE, no key needed!): Works automatically for UK
  - 🌍 **Electricity Maps** (PAID, Global): https://www.electricitymaps.com/ (only if you need paid features)
  - 📊 **Mock Data** (FREE, testing): Press Enter to skip API setup - works everywhere!
- At least 0.02 SOL in your devnet wallet for staking + fees

## Installation

### One-Command Setup (Recommended)

The easiest way to get started:

```bash
cd decharge-scout
node setup.js
```

This interactive script will:
- ✅ Install all dependencies
- ✅ Generate a wallet (or use existing)
- ✅ Request devnet SOL airdrop
- ✅ Configure your .env file
- ✅ Install globally (optional)

**That's it!** After setup completes, just run:

```bash
decharge-scout
```

### Manual Installation (Alternative)

If you prefer manual setup:

#### 1. Install dependencies

```bash
npm install
```

#### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and add your EIA_API_KEY from https://www.eia.gov/opendata/register.php
```

#### 3. Create wallet

```bash
solana-keygen new --outfile ./wallet.json
```

#### 4. Fund wallet

```bash
solana airdrop 1 $(solana-keygen pubkey ./wallet.json) --url devnet
```

#### 5. Install globally (optional)

```bash
npm install -g .
```

## Usage

### Basic Usage (Auto-configuration)

After running `node setup.js`, simply:

```bash
decharge-scout
```

The CLI will automatically:
- Use `./wallet.json` if no wallet specified
- Create a new wallet if none exists
- Prompt for EIA API key if missing
- Auto-detect your location

### With Custom Options

```bash
decharge-scout --wallet=./my-wallet.json --agent-name="MyEnergyAgent"
```

### With Manual Location

```bash
decharge-scout --agent-name="MyAgent" --location="Austin, TX"
```

### With Premium Features

```bash
decharge-scout --premium
```

### All Options

```bash
decharge-scout --help

Options:
  -w, --wallet <path>       Path to Solana wallet JSON keypair file (default: ./wallet.json)
  -a, --agent-name <name>   Custom agent name (default: auto-generated)
  -l, --location <location> Manual location override (default: auto-detect via IP)
  -p, --premium            Enable premium features (x402 micropayments)
  -h, --help               Display help for command
  -V, --version            Output the version number
```

## How It Works

### 1. Onboarding (1-2 mins)

- Loads your Solana wallet
- Stakes 0.01 SOL to escrow (refunded on exit)
- Detects your location via IP
- Initializes points tracking

### 2. Query Cycle (Every 15 mins)

- Fetches energy pricing data from EIA (ERCOT) or Electricity Maps
- Analyzes data to find cheapest charging window
- Calculates savings vs average and peak prices

### 3. Optimization & Submit

- Displays results (e.g., "Cheapest charge: 2AM-3AM at $0.05/kWh, 20% savings")
- Anonymizes data (hashes agent name, generalizes location)
- Submits to Solana devnet oracle with transaction proof
- Logs dashboard-ready JSON structure
- Optionally POSTs to dashboard API if configured

### 4. Earn & Loop

- Awards 1-5 base points per submission
- Bonus +2 points for >15% savings
- Saves points locally to `~/.decharge-scout/points.json`
- Continues running every 15 minutes

### 5. Exit

- Press Ctrl+C to stop
- Refunds stake if runs > 0
- Displays final points and stats

## Dashboard Integration

Each submission creates a structured JSON payload for dashboard visualization:

```json
{
  "agent_name": "MyAgent",
  "location": "Austin, TX",
  "timestamp": 1234567890,
  "results": {
    "cheapest_window": "2AM-3AM",
    "price": 0.05,
    "savings": 23.5,
    "data_points": 24
  }
}
```

To enable dashboard API submission, set in `.env`:

```env
DASHBOARD_API_URL=http://localhost:3000/submit
```

The CLI will POST this data to your dashboard backend (optional).

## Premium Features (x402)

Premium access provides:
- Enhanced forecast accuracy
- Carbon intensity data
- Renewable energy percentages
- Confidence scores
- Extended 48-hour forecasts

Cost: 0.001 SOL per access

Enable with `--premium` flag. Payment is processed via x402 micropayment every 3rd run.

## Project Structure

```
decharge-scout/
├── index.js                 # Main CLI entry point
├── package.json             # Dependencies and metadata
├── .env.example             # Environment variables template
├── README.md               # This file
├── src/
│   ├── wallet.js           # Solana wallet operations
│   ├── energy-data.js      # Energy API integrations
│   ├── optimizer.js        # Optimization algorithms
│   ├── oracle.js           # Solana oracle submission
│   ├── points.js           # Points tracking system
│   ├── geolocation.js      # IP-based location detection
│   └── x402.js             # x402 micropayment handling
```

## API Data Sources

The CLI uses **smart routing** to automatically choose the best FREE API based on your location!

### 🆓 FREE APIs (Recommended!)

#### 🇺🇸 EIA API (US-only, FREE)
- **Coverage**: United States only (ERCOT, CAISO, NYISO, PJM, MISO, ISNE)
- **Endpoint**: `https://api.eia.gov/v2/electricity/rto/region-data/data/`
- **Provides**: Real-time demand and pricing for US grid regions
- **Get Key**: FREE at https://www.eia.gov/opendata/register.php
- **Auto-used for**: Texas, California, New York, etc.

#### 🇪🇺 ENTSO-E (Europe, FREE)
- **Coverage**: All European countries
- **Endpoint**: `https://web-api.tp.entsoe.eu/api`
- **Provides**: Day-ahead electricity prices and demand forecasts
- **Get Key**: FREE at https://transparency.entsoe.eu/
- **Auto-used for**: Germany, France, Spain, Italy, Poland, Netherlands, Belgium, Austria
- **Registration**: Free account required, instant approval

#### 🇬🇧 UK Carbon Intensity (UK, FREE - No key needed!)
- **Coverage**: United Kingdom only
- **Endpoint**: `https://api.carbonintensity.org.uk`
- **Provides**: Real-time carbon intensity and price forecasts
- **Get Key**: No key needed! Completely open API
- **Auto-used for**: UK locations (works out of the box!)

### 💰 PAID API (Global fallback)

#### 🌍 Electricity Maps (GLOBAL, PAID)
- **Coverage**: Global (India, EU, UK, Australia, US, and more)
- **Endpoint**: `https://api.electricitymaps.com/v3/carbon-intensity/forecast`
- **Provides**: Carbon intensity forecasts and grid data for 200+ zones
- **Get Key**: Paid API at https://www.electricitymaps.com/
- **Auto-used for**: India, Australia, and regions not covered by free APIs
- **Pricing**: Expensive - use only if free options don't cover your region

### 📊 Mock Data (FREE - Always available!)
- **Coverage**: Worldwide
- **Generated**: Locally using realistic pricing patterns
- **Auto-used**: When no API keys are configured or all APIs fail
- **Perfect for**: Testing, demos, and development

## Points System

- **Base Points**: 1-5 per successful submission
- **Bonus Points**: +2 for >15% savings optimization
- **Storage**: Local file at `~/.decharge-scout/points.json`
- **Persistence**: Points carry across sessions

## Security & Privacy

- **No Hardcoded Keys**: All sensitive data in `.env` or prompts
- **Anonymization**: Agent names are hashed, locations generalized
- **Refundable Stake**: Your 0.01 SOL stake is refunded on exit
- **Local-First**: Points stored locally, not on-chain
- **Devnet Only**: Uses Solana devnet (test network)

## Troubleshooting

### "EIA_API_KEY not configured" or "No energy data API keys configured"
Choose an API based on your location:
- **US users**: Get FREE EIA API key from https://www.eia.gov/opendata/register.php
- **International users**: Get Electricity Maps API key from https://www.electricitymaps.com/
- **Testing**: Press Enter to skip and use mock data

Add your key to `.env`:
```
EIA_API_KEY=your_key_here                    # For US
ELECTRICITY_MAPS_API_KEY=your_key_here       # For global
```

### "Insufficient balance"
Fund your devnet wallet:
```bash
solana airdrop 1 <YOUR_WALLET_ADDRESS> --url devnet
```

### "All data sources failed"
- Check your internet connection
- Verify EIA API key is valid
- Try again (fallback mock data will be used)

### "Oracle submission failed"
- Ensure wallet has enough SOL for transaction fees
- Check Solana devnet status
- Mock transactions will be created as fallback

## Development

### Run in dev mode

```bash
npm start -- --wallet=./wallet.json
```

### Test with mock dashboard

Start a simple server to receive dashboard submissions:

```bash
# In another terminal
node -e "require('http').createServer((req,res)=>{let body='';req.on('data',d=>body+=d);req.on('end',()=>{console.log(JSON.parse(body));res.end('OK')})}).listen(3000)"
```

Then set in `.env`:
```env
DASHBOARD_API_URL=http://localhost:3000/submit
```

## Contributing

This is a proof-of-concept demo. For production use:
- Implement actual Solana program for oracle (not just memo transactions)
- Add SPL token minting for points instead of local storage
- Integrate with real x402 payment providers
- Add more energy grid APIs (GridStatus.io, etc.)
- Implement proper payment channel state management

## License

MIT

## Disclaimer

This is a demo application for educational purposes. Do not use with mainnet wallets or real funds. Energy data is for informational purposes only and should not be used as financial advice.
