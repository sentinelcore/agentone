/**
 * Wallet Operations Module
 *
 * Handles Solana wallet loading, staking, and refund operations
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Solana connection
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const connection = new Connection(RPC_URL, 'confirmed');

/**
 * Load wallet from JSON keypair file
 */
export async function loadWallet(walletPath) {
  try {
    const keypairData = JSON.parse(readFileSync(walletPath, 'utf-8'));
    const secretKey = Uint8Array.from(keypairData);
    const keypair = Keypair.fromSecretKey(secretKey);

    // Check balance
    const balance = await connection.getBalance(keypair.publicKey);
    const balanceSOL = balance / LAMPORTS_PER_SOL;

    if (balanceSOL < 0.02) {
      throw new Error(`Insufficient balance: ${balanceSOL} SOL. Need at least 0.02 SOL for stake + fees.`);
    }

    return keypair;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Wallet file not found: ${walletPath}`);
    }
    throw error;
  }
}

/**
 * Get Solana connection
 */
export function getConnection() {
  return connection;
}

/**
 * Stake SOL to escrow account
 */
export async function stakeSOL(wallet, amount) {
  try {
    const escrowPubkey = getEscrowAddress();

    // Create transfer transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: escrowPubkey,
        lamports: Math.floor(amount * LAMPORTS_PER_SOL)
      })
    );

    // Send and confirm
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
    throw new Error(`Stake failed: ${error.message}`);
  }
}

/**
 * Refund stake from escrow
 */
export async function refundStake(wallet, amount) {
  try {
    // In a real implementation, this would call a program to refund from escrow
    // For this demo, we'll simulate a refund by noting it was successful
    console.log(`Refund of ${amount} SOL would be processed from escrow`);

    // Mock refund transaction
    // In production, this would transfer from escrow back to user
    return 'MOCK_REFUND_TX_' + Date.now();
  } catch (error) {
    throw new Error(`Refund failed: ${error.message}`);
  }
}

/**
 * Get escrow address from env or use default
 */
function getEscrowAddress() {
  const escrowAddress = process.env.ORACLE_ESCROW_ADDRESS;

  if (!escrowAddress || escrowAddress === 'YourDevWalletPublicKeyHere') {
    // Use a valid devnet address for demo (Solana's devnet faucet)
    return new PublicKey('4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T');
  }

  try {
    return new PublicKey(escrowAddress);
  } catch (error) {
    throw new Error(`Invalid ORACLE_ESCROW_ADDRESS in .env: ${error.message}`);
  }
}

/**
 * Get wallet balance
 */
export async function getBalance(publicKey) {
  const balance = await connection.getBalance(publicKey);
  return balance / LAMPORTS_PER_SOL;
}
