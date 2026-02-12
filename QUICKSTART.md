# DeCharge Scout - Quick Start Guide

Get started in **less than 5 minutes**! 🚀

## Prerequisites

- Node.js v20+ installed
- Internet connection

## One-Command Installation

```bash
cd decharge-scout
node setup.js
```

The interactive setup will guide you through:

1. **Install dependencies** → Automatic
2. **Generate wallet** → Creates `./wallet.json`
3. **Request devnet SOL** → Free airdrop
4. **Configure .env** → Prompts for EIA API key
5. **Global install** → Optional

## Get EIA API Key

While setup is running, get your free API key:

1. Visit: https://www.eia.gov/opendata/register.php
2. Fill out the form (takes 1 minute)
3. Check your email for the API key
4. Paste it when setup prompts

## Run the Scout

After setup completes:

```bash
decharge-scout
```

Or with options:

```bash
decharge-scout --agent-name="MyAgent" --premium
```

## What Happens Next?

The scout will:

1. ✅ Connect to your wallet
2. ✅ Stake 0.01 SOL (refunded on exit)
3. ✅ Detect your location
4. ✅ Fetch real-time energy data
5. ✅ Find cheapest charging window
6. ✅ Submit to Solana oracle
7. ✅ Earn points
8. ✅ Repeat every 15 minutes

## Example Output

```
🔋 DeCharge Scout - Energy Grid Data Scout

✓ Wallet loaded: 8kF3...Ab9c
🤖 Agent Name: Agent-A1B2C3
✓ Location: Austin, TX
⭐ Current Points: 0

💰 Staking 0.01 SOL for anti-spam/gas...
✓ Stake successful!

🔄 Starting query cycle (runs every 15 minutes)...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 Run #1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Fetched 24 data points from EIA (ERCOT)
✓ Optimization complete

✨ Optimization Results:
   Cheapest charge window: 2AM-3AM
   Price: $0.0485/kWh
   Savings: 23.5%

✓ Submitted to oracle!

⭐ Earned 7 points! (5 base + 2 bonus)
⭐ Total Points: 7

⏳ Next run in 15 minutes...
```

## Stopping the Scout

Press `Ctrl+C` to stop gracefully. Your stake will be refunded automatically.

## Troubleshooting

### No EIA API key?

Don't worry! The scout will use fallback data sources (Electricity Maps or mock data).

### Airdrop failed?

Try these alternatives:

```bash
# Manual airdrop
solana airdrop 1 <YOUR_WALLET_ADDRESS> --url devnet

# Or use web faucet
# Visit: https://faucet.solana.com/
```

### Running without global install?

```bash
node index.js
```

## Next Steps

- **Customize**: Use `--agent-name` for personalization
- **Premium**: Try `--premium` for enhanced forecasts
- **Dashboard**: Check your points in `~/.decharge-scout/points.json`
- **Documentation**: Read `README.md` for full details

## Support

- 📖 Full docs: `cat README.md`
- 🔧 Detailed setup: `cat INSTALLATION.md`
- 💻 Technical overview: `cat PROJECT_SUMMARY.md`

---

**That's it!** You're now scouting energy data and earning points on Solana. 🎉
