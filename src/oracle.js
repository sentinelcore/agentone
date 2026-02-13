/**
 * Solana Oracle Submission Module
 *
 * Handles submission of optimization results to the mock DeCharge oracle
 */

import {
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  TransactionInstruction,
  PublicKey
} from '@solana/web3.js';
import { getConnection } from './wallet.js';
import crypto from 'crypto';

/**
 * Submit data to DeCharge oracle
 */
export async function submitToOracle(wallet, submissionData) {
  try {
    console.log(`[DEBUG] submitToOracle called with wallet type: ${typeof wallet}, value: ${wallet}`);

    const connection = getConnection();

    // Handle both wallet object and wallet address string
    let publicKey;
    if (typeof wallet === 'string') {
      // wallet is a base58 address string
      console.log(`[DEBUG] Converting string address to PublicKey: ${wallet}`);
      publicKey = new PublicKey(wallet);
      console.log(`[DEBUG] PublicKey created successfully: ${publicKey ? publicKey.toBase58() : 'UNDEFINED'}`);
    } else if (wallet?.publicKey) {
      // wallet is a Keypair or wallet object
      publicKey = wallet.publicKey;
      console.log(`[DEBUG] Using wallet.publicKey: ${publicKey ? publicKey.toBase58() : 'UNDEFINED'}`);
    } else {
      throw new Error(`Invalid wallet parameter: expected string address or wallet object, got ${typeof wallet}`);
    }

    // Check wallet balance first
    const balance = await connection.getBalance(publicKey);
    const balanceSOL = balance / 1000000000; // Convert lamports to SOL

    // Minimum balance needed: 0.01 SOL for transaction + fees
    const minRequired = 0.01;

    if (balanceSOL < minRequired) {
      console.warn(`\n⚠️  Insufficient funds for oracle submission`);
      console.warn(`   Current balance: ${balanceSOL.toFixed(4)} SOL`);
      console.warn(`   Required: ${minRequired} SOL`);
      console.warn(`   Wallet: ${publicKey.toBase58()}`);
      console.warn(`\n💡 To get devnet SOL:`);
      console.warn(`   1. solana airdrop 1 ${publicKey.toBase58()} --url devnet`);
      console.warn(`   2. Or visit: https://faucet.solana.com/`);
      console.warn(`\n📝 Using mock signature for demo purposes...\n`);
      return 'MOCK_ORACLE_TX_' + Date.now() + '_' + crypto.randomBytes(16).toString('hex');
    }

    // Anonymize data
    const anonymizedData = anonymizeData(submissionData);

    // Create instruction data (serialize as JSON then to buffer)
    const dataJSON = JSON.stringify(anonymizedData);

    // Log for verification
    console.log(`Oracle submission data: ${dataJSON.slice(0, 200)}...`);

    // If using browser wallet (wallet is a string), we can't sign server-side
    // In production, this would be sent to browser for signing via WebSocket
    if (typeof wallet === 'string') {
      console.log(`\n📝 Browser wallet detected - creating mock submission...`);
      console.log(`   Wallet: ${publicKey.toBase58()}`);
      console.log(`   Data: ${dataJSON.length} bytes`);
      return 'MOCK_ORACLE_TX_' + Date.now() + '_' + crypto.randomBytes(16).toString('hex');
    }

    // For demo, we'll send just a memo transaction (no transfer needed)
    // In production, this would call a custom Solana program

    // Create transaction with memo containing our data
    const transaction = new Transaction();

    // Add memo instruction with our data (truncate if needed for tx size limits)
    const MAX_MEMO_SIZE = 566; // Solana memo size limit
    const memoData = Buffer.from(dataJSON).length > MAX_MEMO_SIZE
      ? Buffer.from(dataJSON).slice(0, MAX_MEMO_SIZE)
      : Buffer.from(dataJSON);

    // Create simple memo instruction
    const memoInstruction = new TransactionInstruction({
      keys: [],
      programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'), // Memo program
      data: memoData
    });

    transaction.add(memoInstruction);

    // Send transaction (only works with keypair wallet, not browser wallet)
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet],
      {
        commitment: 'confirmed',
        preflightCommitment: 'confirmed'
      }
    );

    return signature;
  } catch (error) {
    // If transaction fails (e.g., insufficient funds), create mock signature
    if (error.message.includes('insufficient') || error.message.includes('balance')) {
      console.warn('Insufficient funds for oracle submission, creating mock signature');
      return 'MOCK_ORACLE_TX_' + Date.now() + '_' + crypto.randomBytes(16).toString('hex');
    }

    throw new Error(`Oracle submission failed: ${error.message}`);
  }
}

/**
 * Anonymize submission data
 */
function anonymizeData(data) {
  // Create anonymized version
  const anonymized = {
    agent_id: hashString(data.agent_name), // Hash the agent name
    location_region: generalizeLocation(data.location), // Generalize location
    timestamp: data.timestamp,
    results: {
      ...data.results,
      // Round values to reduce precision
      price: parseFloat(data.results.price.toFixed(3)),
      savings: parseFloat(data.results.savings.toFixed(1))
    }
  };

  return anonymized;
}

/**
 * Hash a string for anonymization
 */
function hashString(str) {
  return crypto
    .createHash('sha256')
    .update(str)
    .digest('hex')
    .slice(0, 16); // Use first 16 chars
}

/**
 * Generalize location to region level
 */
function generalizeLocation(location) {
  // Extract region/state from location string
  // e.g., "Austin, TX" -> "Texas, US"
  // e.g., "New York, NY" -> "New York, US"

  if (!location) {
    return 'Unknown';
  }

  // Simple pattern matching
  const stateMatch = location.match(/,\s*([A-Z]{2})/);
  const countryMatch = location.match(/,\s*([A-Z]{2,3})$/);

  if (stateMatch) {
    const stateCode = stateMatch[1];
    const stateNames = {
      'TX': 'Texas',
      'CA': 'California',
      'NY': 'New York',
      'FL': 'Florida',
      'IL': 'Illinois',
      // Add more as needed
    };
    return `${stateNames[stateCode] || stateCode}, US`;
  }

  if (countryMatch) {
    return location;
  }

  // If can't parse, just return first part
  const parts = location.split(',');
  return parts[parts.length - 1].trim() || 'Unknown';
}

/**
 * Verify oracle submission (for testing)
 */
export async function verifyOracleSubmission(signature) {
  try {
    const connection = getConnection();

    if (signature.startsWith('MOCK_')) {
      return {
        verified: true,
        mock: true
      };
    }

    const tx = await connection.getTransaction(signature, {
      commitment: 'confirmed'
    });

    return {
      verified: tx !== null,
      timestamp: tx?.blockTime || null
    };
  } catch (error) {
    console.warn(`Verification warning: ${error.message}`);
    return {
      verified: false,
      error: error.message
    };
  }
}
