#!/usr/bin/env node

/**
 * DeCharge Scout - Interactive Setup Script
 *
 * Automates the complete setup process:
 * - Install dependencies
 * - Generate wallet
 * - Request devnet airdrop
 * - Configure .env with prompts
 * - Global installation
 *
 * Usage: node setup.js
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { createInterface } from 'readline';
import { Keypair, Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const execAsync = promisify(exec);

// ANSI color codes (avoiding external dependencies)
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset}  ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset}  ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset}  ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset}  ${msg}`),
  title: (msg) => console.log(`\n${colors.cyan}${colors.bright}${msg}${colors.reset}\n`)
};

// Create readline interface for prompts
const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

/**
 * Main setup function
 */
async function main() {
  console.clear();
  log.title('🔋 DeCharge Scout - Interactive Setup');
  console.log('This will set up everything you need to run DeCharge Scout.\n');

  try {
    // Step 1: Check Node.js version
    await checkNodeVersion();

    // Step 2: Install dependencies
    await installDependencies();

    // Step 3: Configure environment
    await configureEnvironment();

    // Step 4: Setup wallet
    const walletPath = await setupWallet();

    // Step 5: Fund wallet
    await fundWallet(walletPath);

    // Step 6: Global installation
    await globalInstallation();

    // Step 7: Final summary
    showFinalSummary(walletPath);

    rl.close();
    process.exit(0);
  } catch (error) {
    log.error(`Setup failed: ${error.message}`);
    rl.close();
    process.exit(1);
  }
}

/**
 * Check Node.js version
 */
async function checkNodeVersion() {
  log.info('Checking Node.js version...');

  const version = process.version;
  const majorVersion = parseInt(version.slice(1).split('.')[0]);

  if (majorVersion < 20) {
    throw new Error(`Node.js v20 or higher required. Current: ${version}`);
  }

  log.success(`Node.js ${version} detected`);
}

/**
 * Install npm dependencies
 */
async function installDependencies() {
  log.info('Installing dependencies...');

  // Check if node_modules exists
  if (existsSync(path.join(__dirname, 'node_modules'))) {
    const answer = await question('Dependencies already installed. Reinstall? (y/N): ');
    if (answer.toLowerCase() !== 'y') {
      log.info('Skipping dependency installation');
      return;
    }
  }

  return new Promise((resolve, reject) => {
    const npm = spawn('npm', ['install'], {
      cwd: __dirname,
      stdio: 'inherit'
    });

    npm.on('close', (code) => {
      if (code !== 0) {
        reject(new Error('npm install failed'));
      } else {
        log.success('Dependencies installed');
        resolve();
      }
    });
  });
}

/**
 * Configure .env file
 */
async function configureEnvironment() {
  log.info('Configuring environment variables...');

  const envPath = path.join(__dirname, '.env');
  let envContent = {};

  // Load existing .env if it exists
  if (existsSync(envPath)) {
    const answer = await question('.env file exists. Reconfigure? (y/N): ');
    if (answer.toLowerCase() !== 'y') {
      log.info('Keeping existing .env configuration');
      return;
    }

    // Parse existing .env
    const existing = readFileSync(envPath, 'utf-8');
    existing.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        envContent[key.trim()] = value.trim();
      }
    });
  }

  console.log('\n--- Environment Configuration ---\n');

  // EIA API Key (required)
  console.log('EIA API Key (required for energy data)');
  console.log('Get yours at: https://www.eia.gov/opendata/register.php');
  const eiaKey = await question(`EIA_API_KEY [${envContent.EIA_API_KEY || 'none'}]: `);
  if (eiaKey) envContent.EIA_API_KEY = eiaKey;

  if (!envContent.EIA_API_KEY || envContent.EIA_API_KEY === 'your_eia_api_key_here') {
    log.warn('No EIA API key provided. You can add it later to .env');
    envContent.EIA_API_KEY = 'your_eia_api_key_here';
  }

  // Solana configuration
  const network = await question('Solana network [devnet]: ') || 'devnet';
  envContent.SOLANA_NETWORK = network;

  const rpcUrl = await question('Solana RPC URL [https://api.devnet.solana.com]: ') || 'https://api.devnet.solana.com';
  envContent.SOLANA_RPC_URL = rpcUrl;

  // Optional: Dashboard API
  const dashboardUrl = await question('Dashboard API URL (optional, press Enter to skip): ');
  if (dashboardUrl) {
    envContent.DASHBOARD_API_URL = dashboardUrl;
  }

  // Escrow address (use default)
  envContent.ORACLE_ESCROW_ADDRESS = envContent.ORACLE_ESCROW_ADDRESS || '4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T';
  envContent.STAKE_AMOUNT = envContent.STAKE_AMOUNT || '0.01';
  envContent.PREMIUM_PRICE = envContent.PREMIUM_PRICE || '0.001';

  // Write .env file
  const envLines = Object.entries(envContent).map(([key, value]) => `${key}=${value}`);
  writeFileSync(envPath, envLines.join('\n') + '\n');

  log.success('.env file configured');
}

/**
 * Setup wallet
 */
async function setupWallet() {
  log.info('Setting up Solana wallet...');

  const defaultWalletPath = path.join(__dirname, 'wallet.json');

  // Check for existing wallet
  if (existsSync(defaultWalletPath)) {
    const answer = await question(`Wallet exists at ${defaultWalletPath}. Use it? (Y/n): `);
    if (answer.toLowerCase() !== 'n') {
      log.success('Using existing wallet');
      return defaultWalletPath;
    }
  }

  // Ask if user wants to create new wallet or use existing
  console.log('\nWallet options:');
  console.log('1. Generate new wallet');
  console.log('2. Use existing wallet file');

  const choice = await question('Choose option (1 or 2): ');

  if (choice === '2') {
    const walletPath = await question('Enter path to existing wallet.json: ');
    if (!existsSync(walletPath)) {
      throw new Error(`Wallet file not found: ${walletPath}`);
    }
    log.success(`Using wallet at ${walletPath}`);
    return walletPath;
  }

  // Generate new wallet
  log.info('Generating new wallet...');

  const keypair = Keypair.generate();
  const secretKey = Array.from(keypair.secretKey);

  // Save wallet
  writeFileSync(defaultWalletPath, JSON.stringify(secretKey));

  console.log(`\n${colors.green}${colors.bright}Wallet created!${colors.reset}`);
  console.log(`Address: ${colors.cyan}${keypair.publicKey.toBase58()}${colors.reset}`);
  console.log(`Path: ${defaultWalletPath}`);

  log.warn('IMPORTANT: Backup this wallet file! It contains your private key.');

  const answer = await question('\nPress Enter to continue...');

  return defaultWalletPath;
}

/**
 * Fund wallet with devnet SOL
 */
async function fundWallet(walletPath) {
  log.info('Checking wallet balance...');

  // Load wallet
  const keypairData = JSON.parse(readFileSync(walletPath, 'utf-8'));
  const secretKey = Uint8Array.from(keypairData);
  const keypair = Keypair.fromSecretKey(secretKey);

  // Check balance
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const balance = await connection.getBalance(keypair.publicKey);
  const balanceSOL = balance / LAMPORTS_PER_SOL;

  console.log(`Current balance: ${balanceSOL} SOL`);

  if (balanceSOL >= 0.02) {
    log.success('Wallet has sufficient balance');
    return;
  }

  // Request airdrop
  const answer = await question('Request devnet SOL airdrop? (Y/n): ');
  if (answer.toLowerCase() === 'n') {
    log.warn('Skipping airdrop. Make sure you have at least 0.02 SOL to run.');
    return;
  }

  log.info('Requesting airdrop (this may take a moment)...');

  try {
    const signature = await connection.requestAirdrop(
      keypair.publicKey,
      LAMPORTS_PER_SOL
    );

    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');

    // Check new balance
    const newBalance = await connection.getBalance(keypair.publicKey);
    const newBalanceSOL = newBalance / LAMPORTS_PER_SOL;

    log.success(`Airdrop successful! New balance: ${newBalanceSOL} SOL`);
  } catch (error) {
    log.error(`Airdrop failed: ${error.message}`);
    log.info('You can request airdrop manually:');
    console.log(`  solana airdrop 1 ${keypair.publicKey.toBase58()} --url devnet`);
    console.log('Or use the faucet: https://faucet.solana.com/');
  }
}

/**
 * Global installation
 */
async function globalInstallation() {
  const answer = await question('\nInstall globally (allows "decharge-scout" command)? (Y/n): ');

  if (answer.toLowerCase() === 'n') {
    log.info('Skipping global installation');
    return;
  }

  log.info('Installing globally...');

  return new Promise((resolve, reject) => {
    const npm = spawn('npm', ['install', '-g', '.'], {
      cwd: __dirname,
      stdio: 'inherit'
    });

    npm.on('close', (code) => {
      if (code !== 0) {
        log.warn('Global installation failed (may need sudo)');
        log.info('Try manually: sudo npm install -g .');
        resolve(); // Don't fail setup
      } else {
        log.success('Installed globally');
        resolve();
      }
    });
  });
}

/**
 * Show final summary
 */
function showFinalSummary(walletPath) {
  console.log('\n' + '='.repeat(60));
  log.title('✅ Setup Complete!');

  console.log('Your DeCharge Scout is ready to run.\n');

  console.log(`${colors.bright}Quick Start:${colors.reset}`);
  console.log(`  ${colors.cyan}decharge-scout${colors.reset}  (if installed globally)`);
  console.log(`  ${colors.cyan}node index.js${colors.reset}  (run directly)\n`);

  console.log(`${colors.bright}With options:${colors.reset}`);
  console.log(`  decharge-scout --agent-name="MyAgent"`);
  console.log(`  decharge-scout --premium\n`);

  console.log(`${colors.bright}Configuration:${colors.reset}`);
  console.log(`  Wallet: ${walletPath}`);
  console.log(`  Config: ${path.join(__dirname, '.env')}\n`);

  console.log(`${colors.bright}Next steps:${colors.reset}`);
  console.log(`  1. ${colors.green}✓${colors.reset} Dependencies installed`);
  console.log(`  2. ${colors.green}✓${colors.reset} Wallet created and funded`);
  console.log(`  3. ${colors.green}✓${colors.reset} Environment configured`);
  console.log(`  4. ${colors.yellow}→${colors.reset} Run the scout!\n`);

  if (!existsSync(path.join(__dirname, '.env')) || readFileSync(path.join(__dirname, '.env'), 'utf-8').includes('your_eia_api_key_here')) {
    log.warn('Remember to add your EIA_API_KEY to .env');
    console.log('   Get it from: https://www.eia.gov/opendata/register.php\n');
  }

  console.log('='.repeat(60) + '\n');
}

// Run setup
main().catch(error => {
  log.error(`Fatal error: ${error.message}`);
  rl.close();
  process.exit(1);
});
