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
    const connection = getConnection();

    // Check wallet balance first
    const balance = await connection.getBalance(wallet.publicKey);
    const balanceSOL = balance / 1000000000; // Convert lamports to SOL

    // Minimum balance needed: 0.01 SOL for transaction + fees
    const minRequired = 0.01;

    if (balanceSOL < minRequired) {
      console.warn(`Insufficient funds for oracle submission (${balanceSOL.toFixed(4)} SOL < ${minRequired} SOL), creating mock signature`);
      return 'MOCK_ORACLE_TX_' + Date.now() + '_' + crypto.randomBytes(16).toString('hex');
    }

    // Anonymize data
    const anonymizedData = anonymizeData(submissionData);

    // Create instruction data (serialize as JSON then to buffer)
    const dataJSON = JSON.stringify(anonymizedData);
    const dataBuffer = Buffer.from(dataJSON);

    // For demo, we'll send just a memo transaction (no transfer needed)
    // In production, this would call a custom Solana program

    // Create transaction with memo containing our data
    const transaction = new Transaction();

    // Add memo instruction with our data (truncate if needed for tx size limits)
    const MAX_MEMO_SIZE = 566; // Solana memo size limit
    const memoData = dataBuffer.length > MAX_MEMO_SIZE
      ? dataBuffer.slice(0, MAX_MEMO_SIZE)
      : dataBuffer;

    // Create simple memo instruction
    const memoInstruction = new TransactionInstruction({
      keys: [],
      programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'), // Memo program
      data: memoData
    });

    transaction.add(memoInstruction);

    // Send transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet],
      {
        commitment: 'confirmed',
        preflightCommitment: 'confirmed'
      }
    );

    // Log for verification
    console.log(`Oracle submission data: ${dataJSON.slice(0, 200)}...`);

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
