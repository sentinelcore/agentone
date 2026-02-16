#!/usr/bin/env node

/**
 * Debug Fleet API Call
 *
 * This script simulates what fleet.js sends to help debug why data isn't saving
 */

import fetch from 'node-fetch';
import chalk from 'chalk';

const API_URL = 'https://decharge-scout.vercel.app/api/agentone/fleet-submit';

// Simulate the exact payload fleet.js sends
const testPayload = {
  type: 'fleet',
  agent_name: 'DebugAgent-' + Date.now(),
  wallet: 'TestWallet123',
  location: 'New York → Boston',
  timestamp: Date.now(),
  fleet_size: 10,
  route: {
    type: 'LineString',
    coordinates: [
      [-74.0060, 40.7128], // New York
      [-71.0589, 42.3601]  // Boston
    ]
  },
  stops: [
    {
      lat: 41.5,
      lon: -72.5,
      time: '3AM-4AM',
      price: 0.025,
      savings: 80,
      location: 'Hartford, CT',
      segmentId: 1
    }
  ],
  summary: {
    total_distance_km: 350,
    total_cost_usd: 150.00,
    savings_percent: 78,
    co2_saved_kg: 45,
    duration_hours: 4
  },
  simulation_basis: 'Task1 simulation + OSRM routing'
};

console.log(chalk.cyan('\n🔍 Fleet API Debug Tool\n'));
console.log(chalk.blue('Testing endpoint:', API_URL));
console.log(chalk.gray('\nPayload being sent:'));
console.log(chalk.gray(JSON.stringify(testPayload, null, 2)));
console.log(chalk.gray('\n' + '='.repeat(60) + '\n'));

async function testAPI() {
  try {
    console.log(chalk.yellow('⏳ Sending request...'));

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    });

    console.log(chalk.blue(`\n📡 Response Status: ${response.status} ${response.statusText}`));

    const responseText = await response.text();
    console.log(chalk.blue('📄 Response Body:'));

    try {
      const responseJson = JSON.parse(responseText);
      console.log(chalk.white(JSON.stringify(responseJson, null, 2)));
    } catch (e) {
      console.log(chalk.white(responseText));
    }

    if (response.ok) {
      console.log(chalk.green('\n✅ SUCCESS! Data should be in Supabase now.'));
      console.log(chalk.gray('Check the fleet_submissions table in Supabase.'));
    } else {
      console.log(chalk.red('\n❌ FAILED! API rejected the request.'));
      console.log(chalk.yellow('\nCommon issues:'));
      console.log(chalk.gray('- 404: API endpoint not deployed to Vercel'));
      console.log(chalk.gray('- 400: Validation error (check response body above)'));
      console.log(chalk.gray('- 500: Server error (table missing, env vars, etc.)'));
    }

    // Show headers for debugging
    console.log(chalk.gray('\n📋 Response Headers:'));
    response.headers.forEach((value, key) => {
      console.log(chalk.gray(`  ${key}: ${value}`));
    });

  } catch (error) {
    console.log(chalk.red('\n❌ Network Error!'));
    console.log(chalk.red('Error:', error.message));
    console.log(chalk.yellow('\nThis usually means:'));
    console.log(chalk.gray('- No internet connection'));
    console.log(chalk.gray('- DNS resolution failed'));
    console.log(chalk.gray('- Vercel deployment not accessible'));
  }
}

testAPI().then(() => {
  console.log(chalk.gray('\n' + '='.repeat(60) + '\n'));
});
