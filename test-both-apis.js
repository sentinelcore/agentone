#!/usr/bin/env node

/**
 * Comprehensive API Test Script
 *
 * Tests both regular submit and fleet-submit endpoints
 */

import fetch from 'node-fetch';
import chalk from 'chalk';

const SUBMIT_API_URL = 'https://decharge-scout.vercel.app/api/submit';
const FLEET_SUBMIT_API_URL = 'https://decharge-scout.vercel.app/api/agentone/fleet-submit';
const STATS_API_URL = 'https://decharge-scout.vercel.app/api/stats';

// Sample regular submission data
const regularSubmissionData = {
  agent_name: `TestAgent-${Math.random().toString(36).substring(7).toUpperCase()}`,
  location: 'Test City, TX, US',
  timestamp: Date.now(),
  results: {
    cheapest_window: '2AM-3AM',
    price: 0.0299,
    savings: 75.5,
    data_points: 24
  }
};

// Sample fleet submission data
const fleetSubmissionData = {
  type: 'fleet',
  agent_name: `FleetAgent-${Math.random().toString(36).substring(7).toUpperCase()}`,
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
  simulation_basis: 'Test simulation'
};

console.log(chalk.cyan.bold('\n🧪 Comprehensive API Test Suite\n'));
console.log(chalk.gray('=' .repeat(60)));

/**
 * Test 1: Regular Submit Endpoint
 */
async function testRegularSubmit() {
  console.log(chalk.blue('\n📝 TEST 1: Regular Submit Endpoint'));
  console.log(chalk.gray(`   URL: ${SUBMIT_API_URL}`));
  console.log(chalk.gray(`   Agent: ${regularSubmissionData.agent_name}`));

  try {
    const response = await fetch(SUBMIT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(regularSubmissionData)
    });

    const responseText = await response.text();

    console.log(chalk.blue(`\n   📥 Status: ${response.status}`));
    console.log(chalk.blue(`   📥 Response: ${responseText}`));

    if (response.ok) {
      console.log(chalk.green('\n   ✅ Regular submit: PASS'));
      return { success: true, agent: regularSubmissionData.agent_name };
    } else {
      console.log(chalk.red('\n   ❌ Regular submit: FAIL'));
      return { success: false, error: responseText };
    }
  } catch (error) {
    console.log(chalk.red(`\n   ❌ Error: ${error.message}`));
    return { success: false, error: error.message };
  }
}

/**
 * Test 2: Fleet Submit Endpoint
 */
async function testFleetSubmit() {
  console.log(chalk.blue('\n\n🚛 TEST 2: Fleet Submit Endpoint'));
  console.log(chalk.gray(`   URL: ${FLEET_SUBMIT_API_URL}`));
  console.log(chalk.gray(`   Agent: ${fleetSubmissionData.agent_name}`));
  console.log(chalk.gray(`   Fleet size: ${fleetSubmissionData.fleet_size} EVs`));

  try {
    const response = await fetch(FLEET_SUBMIT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fleetSubmissionData)
    });

    const responseText = await response.text();

    console.log(chalk.blue(`\n   📥 Status: ${response.status}`));
    console.log(chalk.blue(`   📥 Response: ${responseText}`));

    if (response.ok) {
      console.log(chalk.green('\n   ✅ Fleet submit: PASS'));
      return { success: true, agent: fleetSubmissionData.agent_name };
    } else {
      console.log(chalk.red('\n   ❌ Fleet submit: FAIL'));
      return { success: false, error: responseText };
    }
  } catch (error) {
    console.log(chalk.red(`\n   ❌ Error: ${error.message}`));
    return { success: false, error: error.message };
  }
}

/**
 * Test 3: Stats Endpoint
 */
async function testStats() {
  console.log(chalk.blue('\n\n📊 TEST 3: Stats Endpoint'));
  console.log(chalk.gray(`   URL: ${STATS_API_URL}`));

  try {
    const response = await fetch(STATS_API_URL);
    const data = await response.json();

    console.log(chalk.blue(`\n   📥 Status: ${response.status}`));

    if (response.ok) {
      console.log(chalk.green('\n   ✅ Stats endpoint: PASS'));
      console.log(chalk.magenta(`   📊 Active Agents: ${data.activeAgents}`));
      console.log(chalk.magenta(`   📊 Total Submissions: ${data.totalSubmissions}`));
      console.log(chalk.magenta(`   📊 Locations tracked: ${data.locations?.length || 0}`));
      return { success: true, data };
    } else {
      console.log(chalk.red('\n   ❌ Stats endpoint: FAIL'));
      return { success: false, error: await response.text() };
    }
  } catch (error) {
    console.log(chalk.red(`\n   ❌ Error: ${error.message}`));
    return { success: false, error: error.message };
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log(chalk.yellow('\n🚀 Starting comprehensive API tests...\n'));

  // Run all tests
  const regularResult = await testRegularSubmit();
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

  const fleetResult = await testFleetSubmit();
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

  const statsResult = await testStats();

  // Summary
  console.log(chalk.gray('\n' + '=' .repeat(60)));
  console.log(chalk.cyan.bold('\n📋 Test Summary:\n'));

  console.log(regularResult.success
    ? chalk.green('   ✅ Regular submit endpoint: PASS')
    : chalk.red('   ❌ Regular submit endpoint: FAIL'));

  console.log(fleetResult.success
    ? chalk.green('   ✅ Fleet submit endpoint: PASS')
    : chalk.red('   ❌ Fleet submit endpoint: FAIL'));

  console.log(statsResult.success
    ? chalk.green('   ✅ Stats endpoint: PASS')
    : chalk.red('   ❌ Stats endpoint: FAIL'));

  const allPassed = regularResult.success && fleetResult.success && statsResult.success;

  if (allPassed) {
    console.log(chalk.green.bold('\n🎉 All tests passed! Both endpoints are working!\n'));
    console.log(chalk.blue('   🌐 View dashboard: https://decharge-scout.vercel.app/agentone\n'));
    console.log(chalk.yellow('   📝 Check Supabase for:'));
    console.log(chalk.gray(`      - Regular submission: ${regularResult.agent}`));
    console.log(chalk.gray(`      - Fleet submission: ${fleetResult.agent}\n`));
  } else {
    console.log(chalk.red.bold('\n⚠️  Some tests failed. Check errors above.\n'));

    if (!regularResult.success || !fleetResult.success) {
      console.log(chalk.yellow('   Common issues:'));
      console.log(chalk.gray('   1. Supabase tables not created (run schema.sql)'));
      console.log(chalk.gray('   2. Missing Vercel environment variables'));
      console.log(chalk.gray('   3. Need to redeploy Vercel after changes'));
      console.log(chalk.gray('   4. Check Vercel logs: vercel logs\n'));
    }
  }

  console.log(chalk.gray('=' .repeat(60) + '\n'));
}

main().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
