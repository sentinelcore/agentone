/**
 * Browser Wallet Integration
 *
 * Handles staking and transactions using browser wallet extensions
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the directory of this module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Solana connection
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const connection = new Connection(RPC_URL, 'confirmed');

// Store connected wallet info
let connectedWalletAddress = null;
let walletServer = null;

/**
 * Set connected wallet address
 */
export function setConnectedWallet(address) {
  connectedWalletAddress = address;
}

/**
 * Get connected wallet address
 */
export function getConnectedWallet() {
  return connectedWalletAddress;
}

/**
 * Set wallet server reference
 */
export function setWalletServer(server) {
  walletServer = server;
}

/**
 * Get Solana connection
 */
export function getConnection() {
  return connection;
}

/**
 * Get wallet balance
 */
export async function getBalance() {
  if (!connectedWalletAddress) {
    throw new Error('No wallet connected');
  }

  try {
    const publicKey = new PublicKey(connectedWalletAddress);
    const balance = await connection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    throw new Error(`Failed to get balance: ${error.message}`);
  }
}

/**
 * Check if wallet has sufficient balance
 */
export async function checkBalance(requiredAmount) {
  const balance = await getBalance();

  if (balance < requiredAmount) {
    throw new Error(
      `Insufficient balance: ${balance.toFixed(4)} SOL. Need at least ${requiredAmount} SOL for stake + fees.`
    );
  }

  return true;
}

/**
 * Create stake transaction (to be signed in browser)
 */
export async function createStakeTransaction(amount) {
  if (!connectedWalletAddress) {
    throw new Error('No wallet connected');
  }

  try {
    const fromPubkey = new PublicKey(connectedWalletAddress);
    const escrowPubkey = getEscrowAddress();

    // Create transfer transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey: escrowPubkey,
        lamports: Math.floor(amount * LAMPORTS_PER_SOL)
      })
    );

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromPubkey;

    // Serialize transaction for browser signing
    const serialized = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });

    return {
      transaction: serialized.toString('base64'),
      amount,
      to: escrowPubkey.toBase58()
    };
  } catch (error) {
    throw new Error(`Failed to create transaction: ${error.message}`);
  }
}

/**
 * Submit signed transaction
 */
export async function submitTransaction(signedTxBase64) {
  try {
    const txBuffer = Buffer.from(signedTxBase64, 'base64');
    const signature = await connection.sendRawTransaction(txBuffer, {
      skipPreflight: false,
      preflightCommitment: 'confirmed'
    });

    await connection.confirmTransaction(signature, 'confirmed');
    return signature;
  } catch (error) {
    throw new Error(`Transaction failed: ${error.message}`);
  }
}

/**
 * Get escrow address from env or use default
 */
function getEscrowAddress() {
  const escrowAddress = process.env.ORACLE_ESCROW_ADDRESS;

  if (!escrowAddress || escrowAddress === 'YourDevWalletPublicKeyHere') {
    // Use a valid devnet address for demo
    return new PublicKey('4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T');
  }

  try {
    return new PublicKey(escrowAddress);
  } catch (error) {
    throw new Error(`Invalid ORACLE_ESCROW_ADDRESS in .env: ${error.message}`);
  }
}

/**
 * Mock stake function (simulates successful stake for demo)
 * In production, this would use the browser wallet to sign
 */
export async function mockStake(amount) {
  // Check balance first
  await checkBalance(amount + 0.001); // amount + fees

  // Generate mock transaction signature
  const mockSignature = 'BROWSER_TX_' + Date.now() + Math.random().toString(36).substring(7);

  console.log(`Mock stake of ${amount} SOL created`);
  console.log(`Transaction will be signed in browser...`);

  return mockSignature;
}

/**
 * Refund stake (mock for demo)
 */
export async function refundStake(amount) {
  console.log(`Refund of ${amount} SOL would be processed from escrow`);
  return 'MOCK_REFUND_TX_' + Date.now();
}
