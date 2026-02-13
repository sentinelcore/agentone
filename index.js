#!/usr/bin/env node

/**
 * Global Energy Scout - Intelligent Energy Price Forecasting CLI
 * Powered by real-time weather data and smart simulation
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
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createInterface } from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load environment variables from current working directory (not package dir)
dotenv.config({ path: path.join(process.cwd(), '.env') });

// Import modules
import { startWalletServer, openWalletConnection, waitForWalletConnection, getConnectedWallet } from './src/wallet-server.js';
import { setConnectedWallet, getBalance, checkBalance, mockStake, refundStake } from './src/browser-wallet.js';
import { getWeatherForLocation } from './src/weather-data.js';
import { generateSmartPricing, getPricingInsights, getRegionalPricing } from './src/smart-pricing.js';
import { findCheapestWindow, calculateSavings } from './src/optimizer.js';
import { submitToOracle } from './src/oracle.js';
import { initializePoints, awardPoints, getPoints, savePoints } from './src/points.js';
import { getLocation } from './src/geolocation.js';
import { purchasePremiumData } from './src/x402.js';
import { hasBeenAskedForAlpha, markAskedForAlpha, parseAlphaContribution, saveAlphaContribution, calculateAlphaBonus, getAlphaInsights, verifyContribution, getInformationSources } from './src/local-alpha.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const STAKE_AMOUNT = parseFloat(process.env.STAKE_AMOUNT || '0.01');
const CYCLE_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

// Global state
let isRunning = true;
let totalRuns = 0;
let stakeTransactionSignature = null;
let pendingAlphaContribution = null; // Store alpha contribution for next submission

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
 * Auto-configure .env if needed
 */
async function ensureEnvironment() {
  // Use current working directory for .env (so npx works correctly)
  const envPath = path.join(process.cwd(), '.env');

  // Create .env from example if missing
  if (!existsSync(envPath)) {
    // Look for .env.example in package directory
    const examplePath = path.join(__dirname, '.env.example');
    if (existsSync(examplePath)) {
      console.log(chalk.yellow('⚠️  .env file not found, creating from template...'));
      const example = readFileSync(examplePath, 'utf-8');
      writeFileSync(envPath, example);
      console.log(chalk.green(`✓ .env file created at ${envPath}`));
    } else {
      // Create a basic .env file if no example exists
      const basicEnv = `# Energy Data API Keys
# Choose ONE based on your location:
# - EIA (FREE, US-only): Get from https://www.eia.gov/opendata/register.php
# - Electricity Maps (GLOBAL, paid): Get from https://www.electricitymaps.com/
EIA_API_KEY=your_eia_api_key_here
ELECTRICITY_MAPS_API_KEY=your_electricity_maps_api_key_here

# Solana Configuration
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com

# Stake Amount (in SOL)
STAKE_AMOUNT=0.01
`;
      writeFileSync(envPath, basicEnv);
      console.log(chalk.green(`✓ .env file created at ${envPath}`));
    }
  }

  // Info: No API keys needed for weather-based simulation!
  console.log(chalk.green('\n✅ Using FREE weather-based simulation (no API keys required!)'));
  console.log(chalk.gray('   • Real-time weather data from Open-Meteo'));
  console.log(chalk.gray('   • Smart pricing based on temperature, wind, solar radiation'));
  console.log(chalk.gray('   • Regional patterns for accurate predictions\n'));
}

/**
 * Main CLI function
 */
async function main(options) {
  console.log(chalk.cyan.bold('\n🌍 Global Energy Scout - Intelligent Price Forecasting\n'));
  console.log(chalk.gray('   Powered by real-time weather data & smart simulation'));

  try {
    // Auto-configure environment
    await ensureEnvironment();

    // Start wallet server
    console.log(chalk.blue('🌐 Starting browser wallet connection...'));
    const server = await startWalletServer();

    if (!server) {
      console.log(chalk.red('❌ Failed to start wallet server'));
      process.exit(1);
    }

    // Open browser for wallet connection
    await openWalletConnection();

    // Wait for wallet connection
    const walletSpinner = ora('Waiting for wallet connection in browser...').start();
    const walletAddress = await waitForWalletConnection();
    walletSpinner.succeed(chalk.green(`✓ Wallet connected: ${walletAddress}`));

    // Set connected wallet
    setConnectedWallet(walletAddress);

    // Check wallet balance
    const balanceSpinner = ora('Checking wallet balance...').start();
    const balance = await getBalance();
    balanceSpinner.succeed(chalk.green(`💰 Wallet Balance: ${balance.toFixed(4)} SOL`));

    // Verify sufficient balance
    try {
      await checkBalance(STAKE_AMOUNT + 0.001); // stake + fees
    } catch (error) {
      console.log(chalk.red(`\n❌ ${error.message}`));
      console.log(chalk.yellow(`\nPlease fund your wallet and try again:`));
      console.log(chalk.blue(`https://faucet.solana.com/`));
      console.log(chalk.gray(`Wallet: ${walletAddress}\n`));
      process.exit(1);
    }

    // Set agent name
    const agentName = options.agentName || generateAgentName();
    console.log(chalk.blue(`🤖 Agent Name: ${agentName}`));

    // Get location
    let location = options.location;
    if (!location) {
      const locationSpinner = ora('Detecting location via IP...').start();
      const detectedLocation = await getLocation();
      locationSpinner.succeed(chalk.green(`📍 Detected Location: ${detectedLocation}`));

      // Ask user to confirm or override with 10 second timeout
      console.log(chalk.blue('\nYou can use this location or enter a custom one.'));
      console.log(chalk.gray('(Press Enter to use detected location, or type a custom location like "Dallas,TX,USA")'));
      console.log(chalk.gray('(Will auto-proceed in 10 seconds if no input)\n'));

      try {
        // Create a promise race between user input and timeout
        const customLocation = await Promise.race([
          question('Enter location (or press Enter for auto-detected): '),
          new Promise((resolve) => {
            setTimeout(() => {
              console.log(chalk.yellow('\n⏱️  Timeout - using detected location'));
              resolve('');
            }, 10000); // 10 second timeout
          })
        ]);

        // Use custom location if provided, otherwise use detected
        location = (customLocation || '').trim() || detectedLocation;
        if ((customLocation || '').trim()) {
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
    initializePoints(walletAddress);
    const currentPoints = getPoints(walletAddress);
    console.log(chalk.magenta(`⭐ Current Points: ${currentPoints}`));

    // Stake SOL (via browser wallet)
    console.log(chalk.yellow(`\n💰 Staking ${STAKE_AMOUNT} SOL for anti-spam/gas...`));
    const stakeSpinner = ora('Submitting stake transaction...').start();
    stakeTransactionSignature = await mockStake(STAKE_AMOUNT);
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
          const refundTx = await refundStake(STAKE_AMOUNT);
          console.log(chalk.green(`Refund successful! TX: ${refundTx}`));
        } catch (error) {
          console.error(chalk.red(`Refund failed: ${error.message}`));
        }
      }

      const finalPoints = getPoints(walletAddress);
      console.log(chalk.magenta(`\n⭐ Final Points: ${finalPoints}`));
      console.log(chalk.cyan(`📊 Total Runs: ${totalRuns}\n`));

      rl.close();
      process.exit(0);
    });

    // Main query cycle
    await runQueryCycle(walletAddress, agentName, location, options);

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

      // Fetch weather data and generate smart pricing simulation
      const weatherSpinner = ora('Fetching real-time weather forecast...').start();
      let weatherData, energyData, countryCode;

      try {
        // Get real weather forecast from Open-Meteo (FREE!)
        weatherData = await getWeatherForLocation(location);
        countryCode = weatherData.location.country || 'DEFAULT';
        weatherSpinner.succeed(chalk.green(`✓ Fetched ${weatherData.forecast.length}h weather forecast (FREE!)`));

        // Generate intelligent pricing based on weather + regional patterns
        const pricingSpinner = ora('Simulating energy grid pricing...').start();
        energyData = generateSmartPricing(weatherData, countryCode);
        pricingSpinner.succeed(chalk.green(`✓ Generated ${energyData.length} hours of smart pricing data`));

        // Show pricing insights
        const insights = getPricingInsights(energyData, countryCode);
        console.log(chalk.blue(`\n💡 Smart Simulation Insights:`));
        console.log(chalk.gray(`   Region: ${insights.region}`));
        console.log(chalk.gray(`   Price range: $${insights.minPrice}-$${insights.maxPrice}/kWh (${insights.priceRange}% variation)`));
        console.log(chalk.gray(`   Savings potential: ${insights.savingsPotential}% by timing your charge`));

      } catch (error) {
        weatherSpinner.fail(chalk.red('Failed to fetch weather data'));
        throw new Error(`Unable to generate pricing simulation: ${error.message}`);
      }

      // Run optimization
      const optSpinner = ora('Running optimization...').start();
      const cheapestWindow = findCheapestWindow(energyData);
      const savings = calculateSavings(energyData, cheapestWindow);
      optSpinner.succeed(chalk.green('Optimization complete'));

      // Display results with intelligent insights
      console.log(chalk.green.bold('\n✨ Optimization Results:'));
      console.log(chalk.white(`   Cheapest charge window: ${cheapestWindow.timeWindow}`));
      console.log(chalk.white(`   Price: $${cheapestWindow.price.toFixed(4)}/kWh`));
      console.log(chalk.white(`   Savings: ${savings.toFixed(1)}%`));

      // Show why this time is cheap (weather-based reasons)
      const cheapestHourData = energyData.find(d => d.hour === cheapestWindow.hour);
      if (cheapestHourData && cheapestHourData.reasons) {
        console.log(chalk.blue('\n🧠 Why this time is optimal:'));
        cheapestHourData.reasons.forEach(reason => {
          console.log(chalk.gray(`   • ${reason}`));
        });

        // Show weather conditions
        if (cheapestHourData.weather) {
          console.log(chalk.blue('\n🌤️  Weather conditions at optimal time:'));
          console.log(chalk.gray(`   Temperature: ${cheapestHourData.weather.temperature.toFixed(1)}°C`));
          console.log(chalk.gray(`   Wind: ${cheapestHourData.weather.windSpeed.toFixed(1)} m/s`));
          if (cheapestHourData.hour >= 6 && cheapestHourData.hour <= 18) {
            console.log(chalk.gray(`   Solar: ${cheapestHourData.weather.solarRadiation.toFixed(0)} W/m²`));
          }
        }
      }

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

        const dashboardPayload = {
          ...submissionData,
          wallet: wallet, // wallet parameter from runQueryCycle
          run_number: totalRuns
        };

        // Include alpha contribution if available
        if (pendingAlphaContribution) {
          dashboardPayload.alpha_contribution = pendingAlphaContribution;
          console.log(chalk.blue(`📊 Including verified alpha contribution (${(pendingAlphaContribution.confidence * 100).toFixed(0)}% confidence)`));
        }

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dashboardPayload)
        });

        const responseText = await response.text();
        console.log(chalk.blue(`📥 API Response Status: ${response.status}`));

        if (response.ok) {
          dashboardSpinner.succeed(chalk.green('✅ Dashboard submission successful!'));
          console.log(chalk.green(`🎉 Data should now appear at: https://decharge-scout.vercel.app/agentone`));
          console.log(chalk.gray(`Response: ${responseText}`));

          // Clear pending alpha contribution after successful submission
          if (pendingAlphaContribution) {
            console.log(chalk.green(`   ✓ Alpha contribution synced to dashboard`));
            pendingAlphaContribution = null;
          }
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

      awardPoints(wallet, totalPointsEarned);
      const currentPoints = getPoints(wallet);

      console.log(chalk.magenta(`\n⭐ Earned ${totalPointsEarned} points! (${basePoints} base${bonusPoints > 0 ? ` + ${bonusPoints} bonus` : ''})`));
      console.log(chalk.magenta(`⭐ Total Points: ${currentPoints}`));

      // Local Alpha Contribution (ask once after first run)
      if (totalRuns === 1 && !hasBeenAskedForAlpha()) {
        console.log(chalk.cyan('\n💡 Local Alpha Contribution - Help Improve Global Energy Data!'));
        console.log(chalk.gray('   Share your local electricity peak time knowledge for bonus points.\n'));

        // Show where to find this information
        console.log(chalk.blue('📚 Where to find peak time information:'));
        const sources = getInformationSources(location);

        // General sources
        sources.general.forEach(source => {
          console.log(chalk.gray(`   ${source}`));
        });

        // Region-specific sources
        const regionKeys = Object.keys(sources.byRegion);
        if (regionKeys.length > 0) {
          console.log(chalk.blue('\n📍 For your region:'));
          regionKeys.forEach(region => {
            sources.byRegion[region].forEach(source => {
              console.log(chalk.gray(`   ${source}`));
            });
          });
        }

        console.log(chalk.blue('\n💬 Examples of good contributions:'));
        console.log(chalk.gray('   • "7-9PM peak in Lagos" (evening peak)'));
        console.log(chalk.gray('   • "1-5AM cheap in Berlin" (off-peak)'));
        console.log(chalk.gray('   • "5-8PM peak in Mumbai" (dinner time surge)'));
        console.log(chalk.gray('   • "2-6AM cheap in Texas" (wind energy overnight)\n'));

        const alphaInput = await question(chalk.blue('Share local peak times (or press Enter to skip): '));

        if (alphaInput.trim()) {
          const parsed = parseAlphaContribution(alphaInput, location);
          if (parsed) {
            // Verify contribution against current pricing data
            const verification = verifyContribution(parsed, energyData);

            // Save contribution with verification status
            const contribution = saveAlphaContribution(parsed, agentName, location, verification);

            // Store for dashboard submission
            pendingAlphaContribution = {
              type: parsed.type,
              startHour: parsed.startHour,
              endHour: parsed.endHour,
              location: parsed.location,
              verified: verification.verified,
              confidence: verification.confidence,
              verificationReasons: verification.reasons
            };

            // Calculate bonus (higher for verified contributions)
            const alphaBonus = calculateAlphaBonus(parsed, verification);

            awardPoints(wallet, alphaBonus);

            console.log(chalk.green(`\n✅ Thanks for contributing! Earned ${alphaBonus} bonus points!`));
            console.log(chalk.gray(`   Contribution: ${parsed.type} hours ${parsed.startHour}-${parsed.endHour} in ${parsed.location}`));

            // Show verification results
            if (verification.verified) {
              console.log(chalk.green(`   🎯 Verified! Confidence: ${(verification.confidence * 100).toFixed(0)}%`));
              verification.reasons.forEach(reason => {
                console.log(chalk.gray(`   ${reason}`));
              });
              console.log(chalk.green(`   +${alphaBonus - 10} extra points for verified contribution!`));
            } else {
              console.log(chalk.yellow(`   ⚠️  Low confidence: ${(verification.confidence * 100).toFixed(0)}%`));
              verification.reasons.forEach(reason => {
                console.log(chalk.gray(`   ${reason}`));
              });
              console.log(chalk.gray(`   Tip: Contributions that match actual price patterns earn more points!`));
            }
          } else {
            console.log(chalk.yellow('⚠️  Could not parse contribution.'));
            console.log(chalk.gray('   Accepted formats:'));
            console.log(chalk.gray('   • "7-9PM peak in Lagos"'));
            console.log(chalk.gray('   • "1-5AM cheap in Berlin"'));
            console.log(chalk.gray('   • "19-21 peak Mumbai" (24-hour format also works)'));
          }
        }

        markAskedForAlpha();
      }

      // Show alpha insights if available
      if (totalRuns === 1) {
        const alphaInsights = getAlphaInsights(location);
        if (alphaInsights && alphaInsights.contributions > 0) {
          console.log(chalk.cyan(`\n🌍 Community Knowledge for ${location}:`));
          console.log(chalk.gray(`   ${alphaInsights.contributions} local contribution(s)`));
          if (alphaInsights.commonPeakHours.length > 0) {
            const topPeaks = alphaInsights.commonPeakHours.map(p => `${p.hour}:00`).join(', ');
            console.log(chalk.gray(`   Most reported peak hours: ${topPeaks}`));
          }
        }
      }

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
