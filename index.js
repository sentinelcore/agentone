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
import { getWeatherForLocation, getFallbackCoordinates } from './src/weather-data.js';
import { generateSmartPricing, getPricingInsights, getRegionalPricing } from './src/smart-pricing.js';
import { findCheapestWindow, calculateSavings } from './src/optimizer.js';
import { submitToOracle } from './src/oracle.js';
import { initializePoints, awardPoints, getPoints, savePoints } from './src/points.js';
import { getLocation } from './src/geolocation.js';
import { purchasePremiumData } from './src/x402.js';
import { parseAlphaContribution, saveAlphaContribution, calculateAlphaBonus, getAlphaInsights, verifyContribution, getInformationSources } from './src/local-alpha.js';
import { runFleetOptimization } from './src/fleet.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const STAKE_AMOUNT = parseFloat(process.env.STAKE_AMOUNT || '0.01');
const CYCLE_INTERVAL_MINUTES = parseInt(process.env.CYCLE_INTERVAL_MINUTES || '15'); // Default: 15 minutes
const CYCLE_INTERVAL_MS = CYCLE_INTERVAL_MINUTES * 60 * 1000;

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
      let weatherData, energyData, countryCode, insights;

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
        insights = getPricingInsights(energyData, countryCode);
        console.log(chalk.blue(`\n💡 Smart Simulation Insights:`));
        console.log(chalk.gray(`   Region: ${insights.region}`));
        console.log(chalk.gray(`   Price range: $${insights.minPrice}-$${insights.maxPrice}/kWh (${insights.priceRange}% variation)`));
        console.log(chalk.gray(`   Savings potential: ${insights.savingsPotential}% by timing your charge`));

      } catch (error) {
        weatherSpinner.fail(chalk.red('Failed to fetch weather data'));

        // Check if we have fallback coordinates available
        const fallbackCoords = getFallbackCoordinates(location);

        console.log(chalk.yellow(`\n⚠️  Could not geocode location: "${location}"`));
        console.log(chalk.yellow(`   Error: ${error.message}`));

        if (fallbackCoords) {
          console.log(chalk.blue(`\n💡 We have fallback coordinates for: ${fallbackCoords.name}, ${fallbackCoords.country}`));
        }

        console.log(chalk.blue(`\nOptions:`));
        console.log(chalk.gray(`   1. Try a different location (e.g., just "Hyderabad" or "Hyderabad, India")`));
        if (fallbackCoords) {
          console.log(chalk.gray(`   2. Use fallback coordinates for ${fallbackCoords.name}`));
        }
        console.log(chalk.gray(`   3. Exit and restart\n`));

        const userChoice = await question(chalk.blue('Enter new location (or press Enter to exit): '));

        if (!userChoice.trim()) {
          console.log(chalk.yellow('Exiting...'));
          throw new Error('User chose to exit');
        }

        // Update location and retry this cycle
        location = userChoice.trim();
        console.log(chalk.green(`✓ Updated location to: ${location}`));
        console.log(chalk.gray('Retrying...\n'));

        // Retry with new location - this will loop back and try again
        continue;
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

      // Ask for special notes before submission (with 10s timeout)
      console.log(chalk.cyan('\n💬 Add special notes to this submission? (optional)'));
      console.log(chalk.gray('   Examples: "High AC usage today", "Local festival", "Grid maintenance"\n'));
      console.log(chalk.gray('   (Will auto-submit in 10 seconds if no input)\n'));

      const specialNotes = await Promise.race([
        question(chalk.blue('Special notes (or press Enter to skip): ')),
        new Promise((resolve) => {
          setTimeout(() => {
            console.log(chalk.yellow('\n⏱️  Timeout - submitting without notes'));
            resolve('');
          }, 10000); // 10 second timeout
        })
      ]);

      // Local Alpha Contribution - Ask BEFORE every submission for bonus points
      console.log(chalk.cyan('\n💡 Bonus Points: Share Local Peak Time Knowledge!'));
      console.log(chalk.gray('   Help improve global energy data by sharing when electricity is expensive/cheap in your area.\n'));

      console.log(chalk.blue('💬 Examples:'));
      console.log(chalk.gray('   • "7-9PM peak in Lagos" (evening peak)'));
      console.log(chalk.gray('   • "1-5AM cheap in Berlin" (off-peak)'));
      console.log(chalk.gray('   • "5-8PM peak in Mumbai" (dinner time surge)'));
      console.log(chalk.gray('   • "2-6AM cheap in Texas" (wind energy overnight)'));
      console.log(chalk.gray('   (Will auto-skip in 15 seconds if no input)\n'));

      const alphaInput = await Promise.race([
        question(chalk.blue('Share local peak times (or press Enter to skip): ')),
        new Promise((resolve) => {
          setTimeout(() => {
            console.log(chalk.yellow('\n⏱️  Timeout - skipping bonus contribution'));
            resolve('');
          }, 15000); // 15 second timeout
        })
      ]);

      // Process alpha contribution if provided
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

      // Prepare comprehensive submission data
      const submissionData = {
        agent_name: agentName,
        location: location,
        timestamp: Date.now(),

        // Summary results (for quick display)
        results: {
          cheapest_window: cheapestWindow.timeWindow,
          price: cheapestWindow.price,
          savings: savings,
          data_points: energyData.length
        },

        // Full weather data
        weather: {
          location: weatherData.location,
          forecast_summary: {
            hours: weatherData.forecast.length,
            temp_range: {
              min: Math.min(...weatherData.forecast.map(f => f.temperature)),
              max: Math.max(...weatherData.forecast.map(f => f.temperature))
            },
            avg_wind: weatherData.forecast.reduce((sum, f) => sum + f.windSpeed, 0) / weatherData.forecast.length,
            avg_solar: weatherData.forecast.reduce((sum, f) => sum + f.solarRadiation, 0) / weatherData.forecast.length
          },
          optimal_hour_conditions: cheapestHourData?.weather || null
        },

        // Pricing insights
        pricing: {
          region: insights.region,
          base_price: insights.basePrice,
          price_range: {
            min: insights.minPrice,
            max: insights.maxPrice,
            variation_percent: insights.priceRange
          },
          savings_potential: insights.savingsPotential,
          country_code: countryCode
        },

        // Optimization details
        optimization: {
          cheapest_hour: cheapestWindow.hour,
          time_window: cheapestWindow.timeWindow,
          price: cheapestWindow.price,
          savings_percent: savings,
          reasons: cheapestHourData?.reasons || []
        },

        // User contributions
        notes: specialNotes.trim() || null,
        alpha_contribution: pendingAlphaContribution || null
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
        const apiUrl = 'https://decharge-scout.vercel.app/api/submit';

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

/**
 * Fleet optimization command handler
 */
async function fleetCommand(options) {
  console.log(chalk.cyan.bold('\n🚛 Virtual Fleet Optimizer\n'));

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

    // Verify sufficient balance for fleet creation fee (0.005 SOL + fees)
    const FLEET_FEE = 0.005;
    try {
      await checkBalance(FLEET_FEE + 0.001);
    } catch (error) {
      console.log(chalk.red(`\n❌ ${error.message}`));
      console.log(chalk.yellow(`\nFleet creation requires ${FLEET_FEE} SOL + fees`));
      console.log(chalk.yellow(`Please fund your wallet and try again:`));
      console.log(chalk.blue(`https://faucet.solana.com/`));
      console.log(chalk.gray(`Wallet: ${walletAddress}\n`));
      process.exit(1);
    }

    // Set agent name (use provided or generate)
    const agentName = options.agentName || generateAgentName();

    // Initialize points system
    initializePoints(walletAddress);

    // Validate required options
    if (!options.from || !options.to) {
      console.log(chalk.red('\n❌ Missing required parameters: --from and --to'));
      console.log(chalk.yellow('\nUsage:'));
      console.log(chalk.gray('  decharge-scout fleet --from="New York" --to="Boston" --evs=10 --agent-name="MyFleet"'));
      console.log(chalk.gray('\nExample:'));
      console.log(chalk.gray('  decharge-scout fleet --from="San Francisco" --to="Los Angeles" --evs=5\n'));
      process.exit(1);
    }

    // Default EVs to 1 if not provided
    const evs = parseInt(options.evs) || 1;

    if (evs < 1 || evs > 1000) {
      console.log(chalk.red('\n❌ Invalid number of EVs. Must be between 1 and 1000\n'));
      process.exit(1);
    }

    // Run fleet optimization
    await runFleetOptimization({
      agentName,
      from: options.from,
      to: options.to,
      evs
    });

    rl.close();
    process.exit(0);

  } catch (error) {
    console.error(chalk.red(`\n❌ Error: ${error.message}`));
    console.error(chalk.gray(error.stack));
    rl.close();
    process.exit(1);
  }
}

// CLI Setup
const program = new Command();

program
  .name('decharge-scout')
  .description('AI-powered energy grid data scout with Solana integration')
  .version('0.3.0')
  .option('-w, --wallet <path>', 'Path to Solana wallet JSON keypair file (default: ./wallet.json)')
  .option('-a, --agent-name <name>', 'Custom agent name (default: auto-generated)')
  .option('-l, --location <location>', 'Manual location override (default: auto-detect via IP)')
  .option('-p, --premium', 'Enable premium features (x402 micropayments)')
  .action(main);

// Add fleet subcommand
program
  .command('fleet')
  .description('Optimize EV fleet charging across a route')
  .requiredOption('--from <city>', 'Starting city (e.g., "New York")')
  .requiredOption('--to <city>', 'Destination city (e.g., "Boston")')
  .option('--evs <number>', 'Number of electric vehicles in fleet', '1')
  .option('-a, --agent-name <name>', 'Custom agent name (default: auto-generated)')
  .action(fleetCommand);

program.parse();
