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
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

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

// Global state
let isRunning = true;
let totalRuns = 0;
let stakeTransactionSignature = null;

/**
 * Generate random agent name
 */
function generateAgentName() {
  const randomId = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `Agent-${randomId}`;
}

/**
 * Main CLI function
 */
async function main(options) {
  console.log(chalk.cyan.bold('\n🔋 DeCharge Scout - Energy Grid Data Scout\n'));

  // Validate wallet path
  if (!options.wallet) {
    console.error(chalk.red('❌ Error: --wallet path is required'));
    process.exit(1);
  }

  if (!existsSync(options.wallet)) {
    console.error(chalk.red(`❌ Error: Wallet file not found at ${options.wallet}`));
    process.exit(1);
  }

  // Validate EIA API key
  if (!process.env.EIA_API_KEY || process.env.EIA_API_KEY === 'your_eia_api_key_here') {
    console.error(chalk.red('❌ Error: EIA_API_KEY not set in .env file'));
    console.log(chalk.yellow('Get your API key from: https://www.eia.gov/opendata/register.php'));
    process.exit(1);
  }

  try {
    // Load wallet
    const spinner = ora('Loading wallet...').start();
    const wallet = await loadWallet(options.wallet);
    spinner.succeed(chalk.green(`Wallet loaded: ${wallet.publicKey.toBase58()}`));

    // Set agent name
    const agentName = options.agentName || generateAgentName();
    console.log(chalk.blue(`🤖 Agent Name: ${agentName}`));

    // Get location
    const locationSpinner = ora('Detecting location...').start();
    let location = options.location;
    if (!location) {
      location = await getLocation();
    }
    locationSpinner.succeed(chalk.green(`📍 Location: ${location}`));

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

      process.exit(0);
    });

    // Main query cycle
    await runQueryCycle(wallet, agentName, location, options);

  } catch (error) {
    console.error(chalk.red(`\n❌ Error: ${error.message}`));
    console.error(chalk.gray(error.stack));
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
        energyData = await fetchEnergyData();
        dataSpinner.succeed(chalk.green(`Fetched ${energyData.length} data points from EIA (ERCOT)`));
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

      // Optional: Submit to mock dashboard API
      if (process.env.DASHBOARD_API_URL) {
        try {
          const dashboardSpinner = ora('Submitting to dashboard API...').start();
          const response = await fetch(process.env.DASHBOARD_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(submissionData)
          });

          if (response.ok) {
            dashboardSpinner.succeed(chalk.green('Dashboard submission successful'));
          } else {
            dashboardSpinner.warn(chalk.yellow(`Dashboard API returned: ${response.status}`));
          }
        } catch (error) {
          // Silent fail for dashboard - it's optional
          console.log(chalk.gray(`ℹ️  Dashboard API not available (${error.message})`));
        }
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
  .requiredOption('-w, --wallet <path>', 'Path to Solana wallet JSON keypair file')
  .option('-a, --agent-name <name>', 'Custom agent name (default: auto-generated)')
  .option('-l, --location <location>', 'Manual location override (default: auto-detect via IP)')
  .option('-p, --premium', 'Enable premium features (x402 micropayments)')
  .action(main);

program.parse();
