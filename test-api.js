#!/usr/bin/env node

/**
 * Test Script - Direct API Submission
 *
 * This script tests the dashboard API by submitting sample data
 * Use this to verify your Supabase database connection
 */

import fetch from 'node-fetch';
import chalk from 'chalk';

const DASHBOARD_API_URL = 'https://decharge-scout.vercel.app/api/submit';
const STATS_API_URL = 'https://decharge-scout.vercel.app/api/stats';

// Sample test data
const testData = {
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

console.log(chalk.cyan.bold('\n🧪 Testing DeCharge Dashboard API\n'));
console.log(chalk.gray('=' .repeat(50)));

async function testSubmission() {
  console.log(chalk.blue('\n1️⃣  Testing Submission Endpoint'));
  console.log(chalk.gray(`   URL: ${DASHBOARD_API_URL}`));
  console.log(chalk.gray(`   Data: ${JSON.stringify(testData, null, 2)}`));

  try {
    const response = await fetch(DASHBOARD_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    const responseText = await response.text();

    console.log(chalk.blue(`\n📥 Response Status: ${response.status}`));
    console.log(chalk.blue(`📥 Response Body:`));
    console.log(chalk.gray(responseText));

    if (response.ok) {
      console.log(chalk.green('\n✅ Submission successful!'));
      return true;
    } else {
      console.log(chalk.red('\n❌ Submission failed!'));
      return false;
    }
  } catch (error) {
    console.log(chalk.red(`\n❌ Error: ${error.message}`));
    console.log(chalk.gray(error.stack));
    return false;
  }
}

async function testStats() {
  console.log(chalk.blue('\n2️⃣  Testing Stats Endpoint'));
  console.log(chalk.gray(`   URL: ${STATS_API_URL}`));

  try {
    const response = await fetch(STATS_API_URL);
    const data = await response.json();

    console.log(chalk.blue(`\n📥 Response Status: ${response.status}`));
    console.log(chalk.blue(`📊 Stats Data:`));
    console.log(chalk.gray(JSON.stringify(data, null, 2)));

    if (response.ok) {
      console.log(chalk.green('\n✅ Stats endpoint working!'));
      console.log(chalk.magenta(`📊 Active Agents: ${data.activeAgents}`));
      console.log(chalk.magenta(`📊 Total Submissions: ${data.totalSubmissions}`));
      return true;
    } else {
      console.log(chalk.red('\n❌ Stats endpoint failed!'));
      return false;
    }
  } catch (error) {
    console.log(chalk.red(`\n❌ Error: ${error.message}`));
    console.log(chalk.gray(error.stack));
    return false;
  }
}

async function checkDatabase() {
  console.log(chalk.blue('\n3️⃣  Checking Database Connection'));

  console.log(chalk.yellow('\nPlease verify in Supabase:'));
  console.log(chalk.gray('   1. Go to https://supabase.com'));
  console.log(chalk.gray('   2. Open your project'));
  console.log(chalk.gray('   3. Go to Table Editor'));
  console.log(chalk.gray('   4. Check tables: agent_submissions, agent_heartbeat'));
  console.log(chalk.gray(`   5. Look for agent: ${testData.agent_name}`));
}

async function main() {
  console.log(chalk.yellow('🚀 Starting API tests...\n'));

  const submissionOk = await testSubmission();

  console.log(chalk.gray('\n' + '=' .repeat(50)));

  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

  const statsOk = await testStats();

  console.log(chalk.gray('\n' + '=' .repeat(50)));

  await checkDatabase();

  console.log(chalk.gray('\n' + '=' .repeat(50)));
  console.log(chalk.cyan.bold('\n📋 Test Summary:'));
  console.log(submissionOk
    ? chalk.green('✅ Submission endpoint: PASS')
    : chalk.red('❌ Submission endpoint: FAIL'));
  console.log(statsOk
    ? chalk.green('✅ Stats endpoint: PASS')
    : chalk.red('❌ Stats endpoint: FAIL'));

  if (submissionOk && statsOk) {
    console.log(chalk.green.bold('\n🎉 All tests passed! Your dashboard is working!'));
    console.log(chalk.blue(`\n🌐 View dashboard at: https://decharge-scout.vercel.app/agentone\n`));
  } else {
    console.log(chalk.red.bold('\n⚠️  Some tests failed. Check the errors above.'));
    console.log(chalk.yellow('\nTroubleshooting:'));
    console.log(chalk.gray('1. Make sure Supabase tables are created (run schema.sql)'));
    console.log(chalk.gray('2. Check Vercel environment variables:'));
    console.log(chalk.gray('   - SUPABASE_URL'));
    console.log(chalk.gray('   - SUPABASE_ANON_KEY'));
    console.log(chalk.gray('3. Redeploy Vercel after adding env vars'));
    console.log(chalk.gray('4. Check Vercel function logs: vercel logs\n'));
  }
}

main().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
