#!/usr/bin/env node

/**
 * DeCharge Scout - Energy Grid Data Scout CLI
 *
 * Main entry point for the CLI application that scouts energy grid data,
 * performs optimizations, and submits results to Solana blockchain.
 *
 * Installation:
 *   npm install -g .
 *
 * Usage:
 *   decharge-scout --wallet=<path> [--agent-name=<name>] [--location=<location>]
 *
 * Example:
 *   decharge-scout --wallet=./wallet.json --agent-name="MyAgent"
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import dotenv from 'dotenv';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { createInterface } from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Keypair } from '@solana/web3.js';
import os from 'os';

// Load environment variables
dotenv.config();

// Import modules
import { loadWallet, stakeSOL, refundStake } from './src/wallet.js';
import { fetchEnergyData, fetchElectricityMapsData } from './src/energy-data.js';
import { findCheapestWindow, calculateSavings } from './src/optimizer.js';
import { submitToOracle } from './src/oracle.js';
import { initializePoints, awardPoints, getPoints, savePoints } from './src/points.js';
import { getLocation } from './src/geolocation.js';
import { purchasePremiumData } from './src/x402.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const STAKE_AMOUNT = parseFloat(process.env.STAKE_AMOUNT || '0.01');
const CYCLE_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_WALLET_PATH = path.join(__dirname, 'wallet.json');

// Global state
let isRunning = true;
let totalRuns = 0;
let stakeTransactionSignature = null;

// Readline interface for prompts
const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

/**
 * Generate random agent name
 */
function generateAgentName() {
  const randomId = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `Agent-${randomId}`;
}

/**
 * Search for existing Solana wallets in common locations
 */
function findExistingWallets() {
  const wallets = [];
  const searchPaths = [
    // Current directory
    path.join(process.cwd(), 'wallet.json'),
    path.join(process.cwd(), 'id.json'),
    // Home directory
    path.join(os.homedir(), '.solana', 'id.json'),
    path.join(os.homedir(), 'wallet.json'),
    // Common wallet names in current dir
    path.join(process.cwd(), 'solana-wallet.json'),
    path.join(process.cwd(), 'keypair.json'),
  ];

  for (const walletPath of searchPaths) {
    if (existsSync(walletPath)) {
      try {
        const keyData = JSON.parse(readFileSync(walletPath, 'utf-8'));
        if (Array.isArray(keyData) && keyData.length === 64) {
          const keypair = Keypair.fromSecretKey(Uint8Array.from(keyData));
          wallets.push({
            path: walletPath,
            publicKey: keypair.publicKey.toBase58(),
            name: path.basename(walletPath),
            location: path.dirname(walletPath)
          });
        }
      } catch (error) {
        // Skip invalid wallets
      }
    }
  }

  return wallets;
}

/**
 * Auto-create wallet if missing
 */
async function ensureWallet(walletPath) {
  if (existsSync(walletPath)) {
    return walletPath;
  }

  console.log(chalk.yellow(`\n⚠️  No wallet found at ${walletPath}`));

  // Search for existing wallets
  const existingWallets = findExistingWallets();

  if (existingWallets.length > 0) {
    console.log(chalk.green(`\n🔍 Found ${existingWallets.length} existing wallet(s):\n`));

    existingWallets.forEach((wallet, index) => {
      console.log(chalk.cyan(`  ${index + 1}. ${wallet.name}`));
      console.log(chalk.gray(`     Path: ${wallet.path}`));
      console.log(chalk.gray(`     Public Key: ${wallet.publicKey}\n`));
    });

    const useExisting = await question('Use an existing wallet? (Enter number, or press Enter to create new): ');

    if (useExisting.trim() && !isNaN(useExisting)) {
      const index = parseInt(useExisting.trim()) - 1;
      if (index >= 0 && index < existingWallets.length) {
        const selectedWallet = existingWallets[index];
        console.log(chalk.green(`✓ Using wallet: ${selectedWallet.publicKey}`));
        return selectedWallet.path;
      } else {
        console.log(chalk.yellow('Invalid selection, creating new wallet...'));
      }
    }
  }

  const answer = await question('Create a new wallet? (Y/n): ');

  if (answer.toLowerCase() === 'n') {
    console.log(chalk.blue('\n📥 Import existing wallet'));
    const importAnswer = await question('Do you want to import an existing wallet private key? (Y/n): ');

    if (importAnswer.toLowerCase() === 'n') {
      console.log(chalk.blue('\nYou can create a wallet manually:'));
      console.log(chalk.gray('  solana-keygen new --outfile ./wallet.json'));
      console.log(chalk.gray('  Or run: node setup.js\n'));
      process.exit(1);
    }

    console.log(chalk.yellow('\n⚠️  Enter your Solana wallet private key'));
    console.log(chalk.gray('Format: [1,2,3,...] (array of 64 numbers)'));
    const privateKeyInput = await question('Private key: ');

    try {
      // Parse the private key
      const privateKey = JSON.parse(privateKeyInput.trim());

      // Validate it's an array of numbers
      if (!Array.isArray(privateKey) || privateKey.length !== 64) {
        throw new Error('Invalid private key format');
      }

      // Create keypair to validate
      const keypair = Keypair.fromSecretKey(Uint8Array.from(privateKey));

      // Save to file
      writeFileSync(walletPath, JSON.stringify(privateKey));

      console.log(chalk.green(`✓ Wallet imported: ${keypair.publicKey.toBase58()}`));
      return walletPath;
    } catch (error) {
      console.log(chalk.red(`\n❌ Invalid private key: ${error.message}`));
      console.log(chalk.gray('Expected format: [1,2,3,...] (array of 64 numbers)\n'));
      process.exit(1);
    }
  }

  console.log(chalk.blue('Generating new wallet...'));

  const keypair = Keypair.generate();
  const secretKey = Array.from(keypair.secretKey);

  writeFileSync(walletPath, JSON.stringify(secretKey));

  console.log(chalk.green(`✓ Wallet created: ${keypair.publicKey.toBase58()}`));
  console.log(chalk.yellow('⚠️  IMPORTANT: Backup this wallet file!'));
  console.log(chalk.blue(`\nYou need devnet SOL. Get it from:`));
  console.log(chalk.gray('  solana airdrop 1 ' + keypair.publicKey.toBase58() + ' --url devnet'));
  console.log(chalk.gray('  Or visit: https://faucet.solana.com/\n'));

  await question('Press Enter after funding your wallet...');

  return walletPath;
}

/**
 * Auto-configure .env if needed
 */
async function ensureEnvironment() {
  const envPath = path.join(__dirname, '.env');

  // Create .env from example if missing
  if (!existsSync(envPath)) {
    const examplePath = path.join(__dirname, '.env.example');
    if (existsSync(examplePath)) {
      console.log(chalk.yellow('⚠️  .env file not found, creating from template...'));
      const example = readFileSync(examplePath, 'utf-8');
      writeFileSync(envPath, example);
      console.log(chalk.green('✓ .env file created'));
    }
  }

  // Check for EIA API key
  if (!process.env.EIA_API_KEY || process.env.EIA_API_KEY === 'your_eia_api_key_here') {
    console.log(chalk.yellow('\n⚠️  EIA_API_KEY not configured'));
    console.log(chalk.blue('\n📝 How to get a FREE EIA API key:'));
    console.log(chalk.gray('  1. Visit: https://www.eia.gov/opendata/register.php'));
    console.log(chalk.gray('  2. Fill out the registration form'));
    console.log(chalk.gray('  3. Check your email and verify your email address'));
    console.log(chalk.gray('  4. Your API key will be sent to your email'));
    console.log(chalk.gray('  5. Copy the API key and paste it below\n'));

    const answer = await question('Enter your EIA API key (or press Enter to skip): ');

    if (answer.trim()) {
      // Update .env file
      let envContent = readFileSync(envPath, 'utf-8');
      envContent = envContent.replace(/EIA_API_KEY=.*/g, `EIA_API_KEY=${answer.trim()}`);
      writeFileSync(envPath, envContent);

      // Update process.env
      process.env.EIA_API_KEY = answer.trim();

      console.log(chalk.green('✓ API key saved to .env'));
    } else {
      console.log(chalk.yellow('⚠️  Running without EIA API key (will use fallback data sources)'));
    }
  }
}

/**
 * Main CLI function
 */
async function main(options) {
  console.log(chalk.cyan.bold('\n🔋 DeCharge Scout - Energy Grid Data Scout\n'));

  try {
    // Auto-configure environment
    await ensureEnvironment();

    // Auto-handle wallet
    const walletPath = options.wallet || DEFAULT_WALLET_PATH;
    const confirmedWalletPath = await ensureWallet(walletPath);

    // Load wallet
    const spinner = ora('Loading wallet...').start();
    const wallet = await loadWallet(confirmedWalletPath);
    spinner.succeed(chalk.green(`Wallet loaded: ${wallet.publicKey.toBase58()}`));

    // Set agent name
    const agentName = options.agentName || generateAgentName();
    console.log(chalk.blue(`🤖 Agent Name: ${agentName}`));

    // Get location
    let location = options.location;
    if (!location) {
      const locationSpinner = ora('Detecting location via IP...').start();
      const detectedLocation = await getLocation();
      locationSpinner.succeed(chalk.green(`📍 Detected Location: ${detectedLocation}`));

      // Ask user to confirm or override (with timeout)
      console.log(chalk.blue('\nYou can use this location or enter a custom one.'));
      console.log(chalk.gray('(Press Enter to use detected location, or type custom location)'));

      try {
        // Create a promise that auto-resolves after 10 seconds
        const timeoutPromise = new Promise((resolve) => {
          setTimeout(() => {
            console.log(chalk.yellow('\n⏱️  No input received, using detected location...'));
            resolve('');
          }, 10000);
        });

        const questionPromise = question('Enter custom location (or press Enter): ');

        const customLocation = await Promise.race([questionPromise, timeoutPromise]);
        location = customLocation.trim() || detectedLocation;

        if (customLocation.trim()) {
          console.log(chalk.green(`✓ Using custom location: ${location}`));
        } else {
          console.log(chalk.green(`✓ Using detected location: ${location}`));
        }
      } catch (error) {
        console.log(chalk.yellow(`\n⚠️  Prompt error, using detected location: ${detectedLocation}`));
        location = detectedLocation;
      }
    } else {
      console.log(chalk.green(`📍 Location: ${location}`));
    }

    // Initialize points system
    initializePoints(wallet.publicKey.toBase58());
    const currentPoints = getPoints(wallet.publicKey.toBase58());
    console.log(chalk.magenta(`⭐ Current Points: ${currentPoints}`));

    // Stake SOL
    console.log(chalk.yellow(`\n💰 Staking ${STAKE_AMOUNT} SOL for anti-spam/gas...`));
    const stakeSpinner = ora('Submitting stake transaction...').start();
    stakeTransactionSignature = await stakeSOL(wallet, STAKE_AMOUNT);
    stakeSpinner.succeed(chalk.green(`Stake successful! TX: ${stakeTransactionSignature}`));

    console.log(chalk.cyan('\n🔄 Starting query cycle (runs every 15 minutes)...'));
    console.log(chalk.gray('Press Ctrl+C to stop and refund stake\n'));

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n\n⏹️  Stopping scout...'));
      isRunning = false;

      if (totalRuns > 0) {
        console.log(chalk.blue('💸 Refunding stake...'));
        try {
          const refundTx = await refundStake(wallet, STAKE_AMOUNT);
          console.log(chalk.green(`Refund successful! TX: ${refundTx}`));
        } catch (error) {
          console.error(chalk.red(`Refund failed: ${error.message}`));
        }
      }

      const finalPoints = getPoints(wallet.publicKey.toBase58());
      console.log(chalk.magenta(`\n⭐ Final Points: ${finalPoints}`));
      console.log(chalk.cyan(`📊 Total Runs: ${totalRuns}\n`));

      rl.close();
      process.exit(0);
    });

    // Main query cycle
    await runQueryCycle(wallet, agentName, location, options);

  } catch (error) {
    console.error(chalk.red(`\n❌ Error: ${error.message}`));
    console.error(chalk.gray(error.stack));
    rl.close();
    process.exit(1);
  }
}

/**
 * Run the main query cycle
 */
async function runQueryCycle(wallet, agentName, location, options) {
  while (isRunning) {
    try {
      totalRuns++;
      console.log(chalk.cyan(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
      console.log(chalk.cyan.bold(`🔍 Run #${totalRuns} - ${new Date().toLocaleString()}`));
      console.log(chalk.cyan(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`));

      // Fetch energy data
      const dataSpinner = ora('Fetching energy grid data...').start();
      let energyData;

      try {
        energyData = await fetchEnergyData(location);
        const gridRegion = energyData[0]?.source?.split('-')[1] || 'Unknown';
        dataSpinner.succeed(chalk.green(`Fetched ${energyData.length} data points from ${energyData[0]?.source || 'EIA'}`));
      } catch (error) {
        dataSpinner.warn(chalk.yellow(`EIA API failed, trying Electricity Maps...`));

        try {
          energyData = await fetchElectricityMapsData();
          dataSpinner.succeed(chalk.green(`Fetched forecast data from Electricity Maps`));
        } catch (fallbackError) {
          dataSpinner.fail(chalk.red('All data sources failed'));
          throw new Error('Unable to fetch energy data from any source');
        }
      }

      // Run optimization
      const optSpinner = ora('Running optimization...').start();
      const cheapestWindow = findCheapestWindow(energyData);
      const savings = calculateSavings(energyData, cheapestWindow);
      optSpinner.succeed(chalk.green('Optimization complete'));

      // Display results
      console.log(chalk.green.bold('\n✨ Optimization Results:'));
      console.log(chalk.white(`   Cheapest charge window: ${cheapestWindow.timeWindow}`));
      console.log(chalk.white(`   Price: $${cheapestWindow.price.toFixed(4)}/kWh`));
      console.log(chalk.white(`   Savings: ${savings.toFixed(1)}%`));

      // Prepare submission data
      const submissionData = {
        agent_name: agentName,
        location: location,
        timestamp: Date.now(),
        results: {
          cheapest_window: cheapestWindow.timeWindow,
          price: cheapestWindow.price,
          savings: savings,
          data_points: energyData.length
        }
      };

      // Submit to oracle
      const submitSpinner = ora('Submitting to DeCharge oracle...').start();
      const txSignature = await submitToOracle(wallet, submissionData);
      submitSpinner.succeed(chalk.green(`Submitted to oracle! TX: ${txSignature}`));

      // Log dashboard data structure
      console.log(chalk.blue('\n📊 Dashboard Data Structure:'));
      console.log(chalk.gray(JSON.stringify(submissionData, null, 2)));

      // Submit to DeCharge Scout dashboard
      try {
        const dashboardSpinner = ora('Submitting to DeCharge Scout dashboard...').start();
        const apiUrl = 'https://decharge-scout.vercel.app/api/agentone/submit';

        console.log(chalk.blue(`\n🌐 Dashboard API URL: ${apiUrl}`));
        console.log(chalk.gray(`📤 Submitting data...`));

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...submissionData,
            wallet: wallet.publicKey.toBase58(),
            run_number: totalRuns
          })
        });

        const responseText = await response.text();
        console.log(chalk.blue(`📥 API Response Status: ${response.status}`));

        if (response.ok) {
          dashboardSpinner.succeed(chalk.green('✅ Dashboard submission successful!'));
          console.log(chalk.green(`🎉 Data should now appear at: https://decharge-scout.vercel.app/agentone`));
          console.log(chalk.gray(`Response: ${responseText}`));
        } else {
          dashboardSpinner.warn(chalk.yellow(`⚠️  Dashboard API returned: ${response.status}`));
          console.log(chalk.yellow(`Response: ${responseText}`));
        }
      } catch (error) {
        console.log(chalk.red(`❌ Dashboard submission failed: ${error.message}`));
        console.log(chalk.gray(`This won't affect your oracle submission or points`));
      }

      // Award points
      const basePoints = Math.floor(Math.random() * 5) + 1; // 1-5 points
      const bonusPoints = savings > 15 ? 2 : 0; // Bonus for good savings
      const totalPointsEarned = basePoints + bonusPoints;

      awardPoints(wallet.publicKey.toBase58(), totalPointsEarned);
      const currentPoints = getPoints(wallet.publicKey.toBase58());

      console.log(chalk.magenta(`\n⭐ Earned ${totalPointsEarned} points! (${basePoints} base${bonusPoints > 0 ? ` + ${bonusPoints} bonus` : ''})`));
      console.log(chalk.magenta(`⭐ Total Points: ${currentPoints}`));

      // Premium upgrade option
      if (options.premium && totalRuns % 3 === 0) {
        console.log(chalk.yellow('\n🔒 Premium Feature Available!'));
        try {
          const premiumData = await purchasePremiumData(wallet);
          console.log(chalk.green(`Premium forecast data: ${JSON.stringify(premiumData)}`));
        } catch (error) {
          console.log(chalk.red(`Premium purchase failed: ${error.message}`));
        }
      }

      // Save points
      savePoints();

      // Wait for next cycle
      if (isRunning) {
        const waitMinutes = CYCLE_INTERVAL_MS / 60000;
        console.log(chalk.gray(`\n⏳ Next run in ${waitMinutes} minutes...\n`));
        await sleep(CYCLE_INTERVAL_MS);
      }

    } catch (error) {
      console.error(chalk.red(`\n❌ Cycle error: ${error.message}`));
      console.log(chalk.yellow('Retrying in 5 minutes...'));

      if (isRunning) {
        await sleep(5 * 60 * 1000);
      }
    }
  }
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// CLI Setup
const program = new Command();

program
  .name('decharge-scout')
  .description('AI-powered energy grid data scout with Solana integration')
  .version('1.0.0')
  .option('-w, --wallet <path>', 'Path to Solana wallet JSON keypair file (default: ./wallet.json)')
  .option('-a, --agent-name <name>', 'Custom agent name (default: auto-generated)')
  .option('-l, --location <location>', 'Manual location override (default: auto-detect via IP)')
  .option('-p, --premium', 'Enable premium features (x402 micropayments)')
  .action(main);

program.parse();
