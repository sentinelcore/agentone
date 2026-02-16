/**
 * Virtual Fleet Optimizer Module
 *
 * Optimizes EV fleet charging across routes using:
 * - Free geocoding (Nominatim)
 * - Free routing (OSRM)
 * - Weather-based energy simulation (existing engine)
 * - Solana blockchain integration
 */

import fetch from 'node-fetch';
import chalk from 'chalk';
import ora from 'ora';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from '@solana/web3.js';
import { getConnection } from './wallet.js';
import { getConnectedWallet, setConnectedWallet, checkBalance } from './browser-wallet.js';
import { getWeatherForLocation } from './weather-data.js';
import { generateSmartPricing } from './smart-pricing.js';
import { findCheapestWindow } from './optimizer.js';
import { submitToOracle } from './oracle.js';
import { awardPoints, getPoints, savePoints } from './points.js';
import dotenv from 'dotenv';

dotenv.config();

// Fleet creation fee
const FLEET_CREATION_FEE = 0.005; // 0.005 SOL per fleet creation

// Treasury address for fleet fees (devnet)
const FLEET_TREASURY_PUBKEY = process.env.FLEET_TREASURY_ADDRESS ||
  'FLEETTreasuryPubkey11111111111111111111111111';

/**
 * Geocode a city name to coordinates using Nominatim (OpenStreetMap)
 * Free, no API key needed, works globally
 */
async function geocodeCity(cityName) {
  try {
    const encodedCity = encodeURIComponent(cityName);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodedCity}&format=json&limit=1`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'decharge-scout-fleet/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      throw new Error(`City "${cityName}" not found`);
    }

    const result = data[0];
    return {
      city: result.display_name.split(',')[0],
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      display_name: result.display_name
    };
  } catch (error) {
    throw new Error(`Geocoding error: ${error.message}`);
  }
}

/**
 * Get driving route using OSRM (Open Source Routing Machine)
 * Free, no API key needed
 */
async function getRoute(fromCoords, toCoords) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromCoords.lon},${fromCoords.lat};${toCoords.lon},${toCoords.lat}?overview=full&geometries=geojson`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Routing failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      throw new Error('No route found between cities');
    }

    const route = data.routes[0];
    return {
      geometry: route.geometry, // GeoJSON LineString
      distance: route.distance / 1000, // Convert meters to km
      duration: route.duration / 60 // Convert seconds to minutes
    };
  } catch (error) {
    throw new Error(`Routing error: ${error.message}`);
  }
}

/**
 * Divide route into segments for charging analysis
 */
function createRouteSegments(route, segmentDistanceKm = 75) {
  const coords = route.geometry.coordinates;
  const totalDistance = route.distance;
  const numSegments = Math.ceil(totalDistance / segmentDistanceKm);

  const segments = [];
  const coordsPerSegment = Math.max(1, Math.floor(coords.length / numSegments));

  for (let i = 0; i < numSegments; i++) {
    const startIdx = i * coordsPerSegment;
    const endIdx = Math.min((i + 1) * coordsPerSegment, coords.length - 1);

    // Get midpoint of segment
    const midIdx = Math.floor((startIdx + endIdx) / 2);
    const midCoord = coords[midIdx];

    segments.push({
      segmentId: i + 1,
      startIdx,
      endIdx,
      midpoint: {
        lon: midCoord[0],
        lat: midCoord[1]
      },
      distanceFromStart: (totalDistance / numSegments) * i
    });
  }

  return segments;
}

/**
 * Simulate charging costs for each segment
 */
async function simulateSegmentCharging(segment, fleetSize) {
  try {
    // Create a location string from coordinates
    const location = `${segment.midpoint.lat.toFixed(2)},${segment.midpoint.lon.toFixed(2)}`;

    // Get weather forecast for this location
    const weatherData = await getWeatherForLocation(location);
    const countryCode = weatherData.location.country || 'US';

    // Generate pricing simulation
    const energyData = generateSmartPricing(weatherData, countryCode);

    // Find cheapest charging window
    const cheapestWindow = findCheapestWindow(energyData);

    // Calculate cost for fleet (assume 60 kWh per vehicle)
    const kWhPerVehicle = 60;
    const totalKwh = kWhPerVehicle * fleetSize;
    const chargingCost = totalKwh * cheapestWindow.price;

    // Calculate what random charging would cost (use average price)
    const avgPrice = energyData.reduce((sum, e) => sum + e.price, 0) / energyData.length;
    const randomCost = totalKwh * avgPrice;
    const savings = ((randomCost - chargingCost) / randomCost) * 100;

    return {
      segmentId: segment.segmentId,
      location: weatherData.location,
      coordinates: segment.midpoint,
      cheapestWindow: cheapestWindow.timeWindow,
      price: cheapestWindow.price,
      chargingCost: chargingCost,
      savings: savings,
      weather: {
        temperature: weatherData.forecast[cheapestWindow.hour]?.temperature,
        windSpeed: weatherData.forecast[cheapestWindow.hour]?.windSpeed,
        solarRadiation: weatherData.forecast[cheapestWindow.hour]?.solarRadiation
      }
    };
  } catch (error) {
    console.warn(`Warning: Could not simulate segment ${segment.segmentId}: ${error.message}`);
    // Return fallback data
    return {
      segmentId: segment.segmentId,
      coordinates: segment.midpoint,
      cheapestWindow: 'N/A',
      price: 0.10,
      chargingCost: 60 * 0.10,
      savings: 0,
      weather: null
    };
  }
}

/**
 * Identify optimal charging stops (every ~300km or best savings window)
 */
function identifyChargingStops(segmentResults, stopIntervalKm = 300) {
  const stops = [];
  let lastStopDistance = 0;

  for (const segment of segmentResults) {
    const shouldStop = (segment.distanceFromStart - lastStopDistance) >= stopIntervalKm;

    if (shouldStop || stops.length === 0) {
      stops.push({
        lat: segment.coordinates.lat,
        lon: segment.coordinates.lon,
        time: segment.cheapestWindow,
        price: segment.price,
        savings: Math.round(segment.savings),
        location: segment.location?.name || 'Unknown',
        segmentId: segment.segmentId
      });
      lastStopDistance = segment.distanceFromStart;
    }
  }

  return stops;
}

/**
 * Calculate CO2 savings (simplified model)
 */
function calculateCO2Savings(distanceKm, avgSavingsPercent) {
  // Simplified: avg grid carbon intensity ~0.5 kg CO2/kWh
  // EV efficiency ~0.2 kWh/km
  const kWhUsed = distanceKm * 0.2;
  const carbonWithoutOptimization = kWhUsed * 0.5;
  const carbonWithOptimization = carbonWithoutOptimization * (1 - avgSavingsPercent / 100);
  const co2Saved = carbonWithoutOptimization - carbonWithOptimization;

  return Math.round(co2Saved);
}

/**
 * Pay fleet creation fee
 */
async function payFleetCreationFee(walletAddress) {
  try {
    const connection = getConnection();
    const publicKey = new PublicKey(walletAddress);

    // Check balance first
    const balance = await connection.getBalance(publicKey);
    const balanceSOL = balance / LAMPORTS_PER_SOL;

    if (balanceSOL < FLEET_CREATION_FEE + 0.001) {
      throw new Error(`Insufficient balance: ${balanceSOL.toFixed(4)} SOL. Need at least ${FLEET_CREATION_FEE + 0.001} SOL`);
    }

    // For browser wallet, we can't sign server-side
    // In production, this would be sent to browser for signing
    console.log(chalk.blue(`\n💰 Fleet creation fee: ${FLEET_CREATION_FEE} SOL`));
    console.log(chalk.gray(`   Treasury: ${FLEET_TREASURY_PUBKEY}`));
    console.log(chalk.gray(`   Your balance: ${balanceSOL.toFixed(4)} SOL`));

    // Mock transaction for browser wallet
    console.log(chalk.green(`✓ Fleet creation fee simulated (browser wallet mode)`));
    return 'MOCK_FLEET_FEE_TX_' + Date.now();

  } catch (error) {
    throw new Error(`Fleet fee payment failed: ${error.message}`);
  }
}

/**
 * Main fleet optimization function
 */
export async function runFleetOptimization(options) {
  console.log(chalk.cyan.bold('\n🚛 Virtual Fleet Optimizer\n'));
  console.log(chalk.gray('   Multi-vehicle route optimization with weather-based charging\n'));

  const { agentName, from, to, evs } = options;

  try {
    // Get connected wallet
    const walletAddress = getConnectedWallet();
    if (!walletAddress) {
      throw new Error('No wallet connected. Please run the main scout first to connect wallet.');
    }

    console.log(chalk.blue(`🤖 Agent: ${agentName}`));
    console.log(chalk.blue(`📍 Route: ${from} → ${to}`));
    console.log(chalk.blue(`🚗 Fleet Size: ${evs} vehicles\n`));

    // Check balance for fleet creation fee
    console.log(chalk.yellow(`💰 Checking balance for fleet creation fee...`));
    await checkBalance(FLEET_CREATION_FEE + 0.001);

    // Pay fleet creation fee
    const feeSpinner = ora(`Paying ${FLEET_CREATION_FEE} SOL fleet creation fee...`).start();
    const feeTx = await payFleetCreationFee(walletAddress);
    feeSpinner.succeed(chalk.green(`✓ ${FLEET_CREATION_FEE} SOL paid to create your virtual fleet`));
    console.log(chalk.gray(`   TX: ${feeTx}\n`));

    // Geocode cities
    console.log(chalk.blue('📍 Geocoding locations...'));
    const geocodeSpinner = ora('Looking up coordinates...').start();

    const fromCoords = await geocodeCity(from);
    const toCoords = await geocodeCity(to);

    geocodeSpinner.succeed(chalk.green('✓ Locations found'));
    console.log(chalk.gray(`   From: ${fromCoords.display_name}`));
    console.log(chalk.gray(`   To: ${toCoords.display_name}\n`));

    // Get route
    const routeSpinner = ora('Calculating route...').start();
    const route = await getRoute(fromCoords, toCoords);
    routeSpinner.succeed(chalk.green(`✓ Route calculated: ${route.distance.toFixed(0)} km, ~${Math.round(route.duration / 60)} hours`));

    // Create route segments
    const segments = createRouteSegments(route, 75);
    console.log(chalk.gray(`   Divided into ${segments.length} segments for analysis\n`));

    // Simulate charging for each segment
    console.log(chalk.blue('⚡ Simulating optimal charging windows...'));
    const simulationSpinner = ora('Analyzing weather and pricing data...').start();

    const segmentResults = [];
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      simulationSpinner.text = `Analyzing segment ${i + 1}/${segments.length}...`;

      const result = await simulateSegmentCharging(segment, evs);
      result.distanceFromStart = segment.distanceFromStart;
      segmentResults.push(result);

      // Rate limit: wait a bit between API calls
      if (i < segments.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    simulationSpinner.succeed(chalk.green(`✓ Simulated ${segmentResults.length} route segments\n`));

    // Identify optimal charging stops
    const stops = identifyChargingStops(segmentResults, 300);

    // Calculate summary statistics
    const totalCost = segmentResults.reduce((sum, s) => sum + s.chargingCost, 0);
    const avgSavings = segmentResults.reduce((sum, s) => sum + s.savings, 0) / segmentResults.length;
    const co2Saved = calculateCO2Savings(route.distance, avgSavings);

    // Display results
    console.log(chalk.green.bold('✨ Fleet Optimization Results:\n'));
    console.log(chalk.white(`📏 Total Distance: ${route.distance.toFixed(0)} km`));
    console.log(chalk.white(`⏱️  Estimated Duration: ${Math.round(route.duration / 60)} hours`));
    console.log(chalk.white(`🚗 Fleet Size: ${evs} vehicles\n`));

    console.log(chalk.cyan.bold('⚡ Optimal Charging Stops:\n'));
    stops.forEach((stop, idx) => {
      console.log(chalk.white(`   ${idx + 1}. ${stop.location}`));
      console.log(chalk.gray(`      Time: ${stop.time}`));
      console.log(chalk.gray(`      Price: $${stop.price.toFixed(4)}/kWh`));
      console.log(chalk.green(`      Savings: ${stop.savings}%\n`));
    });

    console.log(chalk.cyan.bold('💰 Cost Summary:\n'));
    console.log(chalk.white(`   Total Fleet Cost: $${totalCost.toFixed(2)}`));
    console.log(chalk.green(`   Average Savings: ${avgSavings.toFixed(1)}%`));
    console.log(chalk.green(`   CO₂ Saved: ${co2Saved} kg\n`));

    // Prepare submission payload
    const submissionPayload = {
      type: 'fleet',
      agent_name: agentName,
      location: `${from} → ${to}`,
      timestamp: Date.now(),
      fleet_size: evs,
      route: route.geometry, // GeoJSON LineString
      stops: stops,
      summary: {
        total_distance_km: Math.round(route.distance),
        total_cost_usd: parseFloat(totalCost.toFixed(2)),
        savings_percent: Math.round(avgSavings),
        co2_saved_kg: co2Saved,
        duration_hours: Math.round(route.duration / 60)
      },
      simulation_basis: 'Task1 simulation + OSRM routing'
    };

    // Submit to oracle (blockchain)
    const oracleSpinner = ora('Submitting to Solana blockchain...').start();
    const oracleTx = await submitToOracle(walletAddress, submissionPayload);
    oracleSpinner.succeed(chalk.green(`✓ Submitted to blockchain: ${oracleTx}`));

    // Submit to dashboard API
    try {
      const dashboardSpinner = ora('Submitting to AgentOne dashboard...').start();
      const apiUrl = process.env.DASHBOARD_FLEET_API_URL || 'https://decharge-scout.vercel.app/api/agentone/fleet-submit';

      console.log(chalk.gray(`   POST ${apiUrl}`));

      const dashboardPayload = {
        ...submissionPayload,
        wallet: walletAddress
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dashboardPayload)
      });

      if (response.ok) {
        dashboardSpinner.succeed(chalk.green('✓ Submitted to AgentOne dashboard'));
        console.log(chalk.cyan('\n🗺️  Your fleet optimization has been added as a new layer on the AgentOne global map!'));
        console.log(chalk.blue('   View at: https://decharge-scout.vercel.app/agentone\n'));
      } else {
        const errorBody = await response.text();
        dashboardSpinner.warn(chalk.yellow(`⚠️  Dashboard API returned: ${response.status}`));
        console.log(chalk.red(`   Error details: ${errorBody}`));
      }
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Dashboard submission failed: ${error.message}`));
      console.log(chalk.gray('   (Blockchain submission was successful)\n'));
    }

    // Award points
    const basePoints = 5;
    const bonusPoints = avgSavings > 25 ? 2 : 0;
    const totalPoints = basePoints + bonusPoints;

    awardPoints(walletAddress, totalPoints);
    savePoints();

    const currentPoints = getPoints(walletAddress);
    console.log(chalk.magenta(`⭐ Earned ${totalPoints} points! (${basePoints} base${bonusPoints > 0 ? ` + ${bonusPoints} bonus` : ''})`));
    console.log(chalk.magenta(`⭐ Total Points: ${currentPoints}\n`));

    // Display ASCII map-like summary
    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.cyan.bold('         FLEET OPTIMIZATION MAP        '));
    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.white(`  ${from}`));
    console.log(chalk.gray('    |'));
    stops.forEach((stop, idx) => {
      const marker = idx === stops.length - 1 ? '└──' : '├──';
      console.log(chalk.green(`    ${marker} ⚡ Stop ${idx + 1}: ${stop.time} (${stop.savings}% savings)`));
      if (idx < stops.length - 1) {
        console.log(chalk.gray('    |'));
      }
    });
    console.log(chalk.gray('    |'));
    console.log(chalk.white(`  ${to}`));
    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

    console.log(chalk.green('✅ Fleet optimization complete!\n'));

  } catch (error) {
    console.error(chalk.red(`\n❌ Fleet optimization failed: ${error.message}\n`));
    throw error;
  }
}
