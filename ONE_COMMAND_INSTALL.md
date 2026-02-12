# One-Command Installation

Multiple ways to install DeCharge Scout with a single command.

## 🚀 Option 1: Clone + Setup (Recommended)

**One-liner:**

```bash
git clone -b claude/solana-energy-scout-cli-d7vYT https://github.com/sentinelcore/agentone.git decharge-scout && cd decharge-scout && node setup.js
```

This will:
1. Clone the repository
2. Enter the directory
3. Run the interactive setup

After completion, run: `decharge-scout`

---

## 🌐 Option 2: Remote Installer Script

If the repository is publicly accessible, you can install directly from the web:

```bash
curl -fsSL https://raw.githubusercontent.com/sentinelcore/agentone/claude/solana-energy-scout-cli-d7vYT/install.sh | bash
```

Or with `wget`:

```bash
wget -qO- https://raw.githubusercontent.com/sentinelcore/agentone/claude/solana-energy-scout-cli-d7vYT/install.sh | bash
```

This will:
1. Clone the repository to `~/decharge-scout`
2. Run the interactive setup automatically
3. Guide you through configuration

After completion, run: `cd ~/decharge-scout && decharge-scout`

---

## 📦 Option 3: NPM Install (Shortest - After Publishing)

**After publishing to npm**, users can install with:

```bash
npm install -g decharge-scout
```

Or run directly without installing:

```bash
npx decharge-scout
```

**To publish to npm**, run:

```bash
./publish-npm.sh
```

This will guide you through:
1. Logging in to npm
2. Bumping version
3. Publishing package
4. Creating git tags

After publishing, users can use the shortest install commands!

---

## 🔧 Option 4: Direct Git Install (No Clone)

Using npm's git install capability:

```bash
npm install -g git+https://github.com/sentinelcore/agentone.git#claude/solana-energy-scout-cli-d7vYT
```

Then create wallet and config manually:

```bash
cd $(npm root -g)/decharge-scout
solana-keygen new --outfile ./wallet.json
# Add EIA_API_KEY to .env
decharge-scout
```

**Note:** This skips the interactive setup, so you'll need to configure manually.

---

## 🎯 Recommended for Different Scenarios

### For Quick Testing:
```bash
git clone -b claude/solana-energy-scout-cli-d7vYT https://github.com/sentinelcore/agentone.git decharge-scout && cd decharge-scout && node setup.js
```

### For Production/Server:
```bash
cd /opt
git clone -b claude/solana-energy-scout-cli-d7vYT https://github.com/sentinelcore/agentone.git decharge-scout
cd decharge-scout
node setup.js
```

### For Multiple Instances:
```bash
# Instance 1
git clone -b claude/solana-energy-scout-cli-d7vYT https://github.com/sentinelcore/agentone.git scout-1
cd scout-1 && node setup.js

# Instance 2
git clone -b claude/solana-energy-scout-cli-d7vYT https://github.com/sentinelcore/agentone.git scout-2
cd scout-2 && node setup.js
```

---

## 🐳 Docker One-Liner (Future)

Future enhancement - run in Docker without any setup:

```bash
docker run -it decharge/scout:latest
```

*(Not yet implemented)*

---

## 📋 What Happens During Install?

All one-command options will:

1. ✅ Clone the repository
2. ✅ Install Node.js dependencies
3. ✅ Prompt for wallet creation
4. ✅ Request devnet SOL airdrop
5. ✅ Ask for EIA API key
6. ✅ Configure environment
7. ✅ Optionally install globally

Total time: **~3-5 minutes** (including user input)

---

## 🔑 Prerequisites

Only one requirement:
- **Node.js v20+** installed

Everything else is automated!

---

## 💡 Pro Tips

### Custom Installation Directory:
```bash
git clone -b claude/solana-energy-scout-cli-d7vYT https://github.com/sentinelcore/agentone.git ~/my-custom-dir && cd ~/my-custom-dir && node setup.js
```

### Silent Install (Non-Interactive):
```bash
# Coming soon - for CI/CD environments
SILENT=1 EIA_API_KEY=xxx WALLET_PATH=/path/to/wallet.json node setup.js
```

### Update Existing Installation:
```bash
cd decharge-scout
git pull origin claude/solana-energy-scout-cli-d7vYT
npm install
```

---

## ❓ Troubleshooting

### "Command not found: git"
Install git first:
```bash
# Ubuntu/Debian
sudo apt-get install git

# macOS
brew install git

# Windows
# Download from https://git-scm.com/
```

### "Permission denied"
Use sudo for global install:
```bash
sudo npm install -g .
```

Or install to user directory:
```bash
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
```

### Repository is private
If the repository requires authentication:
```bash
git clone -b claude/solana-energy-scout-cli-d7vYT https://YOUR_TOKEN@github.com/sentinelcore/agentone.git decharge-scout
```

---

## 🎊 After Installation

Once installed, you can run from anywhere:

```bash
decharge-scout --agent-name="MyAgent"
```

Or run locally:

```bash
cd decharge-scout
node index.js
```

Enjoy scouting! 🔋⚡
