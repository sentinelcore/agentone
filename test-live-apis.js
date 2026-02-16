#!/usr/bin/env node

/**
 * Simple Live API Test - Hit both endpoints
 */

import https from 'https';

const SUBMIT_API = 'https://decharge-scout.vercel.app/api/submit';
const FLEET_API = 'https://decharge-scout.vercel.app/api/agentone/fleet-submit';

// Test data for regular submit
const regularData = {
  agent_name: `TestAgent-${Date.now()}`,
  location: 'Test City, TX, US',
  timestamp: Date.now(),
  results: {
    cheapest_window: '2AM-3AM',
    price: 0.0299,
    savings: 75.5,
    data_points: 24
  }
};

// Test data for fleet submit
const fleetData = {
  type: 'fleet',
  agent_name: `FleetAgent-${Date.now()}`,
  wallet: 'TestWallet123',
  location: 'New York → Boston',
  timestamp: Date.now(),
  fleet_size: 10,
  route: {
    type: 'LineString',
    coordinates: [[-74.0060, 40.7128], [-71.0589, 42.3601]]
  },
  stops: [{
    lat: 41.5,
    lon: -72.5,
    time: '3AM-4AM',
    price: 0.025,
    savings: 80,
    location: 'Hartford, CT',
    segmentId: 1
  }],
  summary: {
    total_distance_km: 350,
    total_cost_usd: 150.00,
    savings_percent: 78,
    co2_saved_kg: 45,
    duration_hours: 4
  },
  simulation_basis: 'Test simulation'
};

function hitAPI(url, data, name) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(data);

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log(`\n🔵 Testing ${name}...`);
    console.log(`   URL: ${url}`);
    console.log(`   Data: ${JSON.stringify(data, null, 2).substring(0, 200)}...`);

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        console.log(`\n   Status: ${res.statusCode}`);
        console.log(`   Response: ${body}`);

        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log(`   ✅ ${name} PASSED`);
          resolve({ success: true, status: res.statusCode, body });
        } else {
          console.log(`   ❌ ${name} FAILED`);
          resolve({ success: false, status: res.statusCode, body });
        }
      });
    });

    req.on('error', (error) => {
      console.log(`   ❌ ${name} ERROR: ${error.message}`);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('🧪 Testing Both APIs\n');
  console.log('='.repeat(60));

  try {
    // Test 1: Regular Submit
    const regularResult = await hitAPI(SUBMIT_API, regularData, 'Regular Submit API');

    // Wait 2 seconds
    await new Promise(r => setTimeout(r, 2000));

    // Test 2: Fleet Submit
    const fleetResult = await hitAPI(FLEET_API, fleetData, 'Fleet Submit API');

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 RESULTS:\n');
    console.log(regularResult.success ? '✅ Regular Submit: WORKING' : '❌ Regular Submit: FAILED');
    console.log(fleetResult.success ? '✅ Fleet Submit: WORKING' : '❌ Fleet Submit: FAILED');

    if (regularResult.success && fleetResult.success) {
      console.log('\n🎉 Both APIs are working correctly!\n');
    } else {
      console.log('\n⚠️  Some APIs failed - check errors above\n');
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
  }
}

main();
