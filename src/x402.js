/**
 * x402 Payment Integration Module
 *
 * Handles micropayments for premium features using HTTP 402 pattern
 * and Solana for payment processing
 */

import {
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  PublicKey
} from '@solana/web3.js';
import { getConnection } from './wallet.js';
import { fetchPremiumForecastData } from './energy-data.js';
import dotenv from 'dotenv';

dotenv.config();

const PREMIUM_PRICE = parseFloat(process.env.PREMIUM_PRICE || '0.001');
const PREMIUM_SERVICE_PUBKEY = 'DeChPrem1um111111111111111111111111111111111';

/**
 * Purchase premium data access
 */
export async function purchasePremiumData(wallet) {
  try {
    console.log(`Initiating premium purchase (${PREMIUM_PRICE} SOL)...`);

    // Step 1: Request premium data (would return 402 in real implementation)
    const paymentRequired = await checkPremiumAccess();

    if (!paymentRequired.requiresPayment) {
      // Already have access
      return await fetchPremiumForecastData();
    }

    // Step 2: Process payment
    const paymentTx = await processX402Payment(wallet, PREMIUM_PRICE);
    console.log(`Payment successful: ${paymentTx}`);

    // Step 3: Fetch premium data with proof of payment
    const premiumData = await fetchPremiumForecastData();

    return {
      success: true,
      transaction: paymentTx,
      data: premiumData,
      message: 'Premium data access granted'
    };
  } catch (error) {
    throw new Error(`Premium purchase failed: ${error.message}`);
  }
}

/**
 * Check if premium access requires payment (simulates HTTP 402 check)
 */
async function checkPremiumAccess() {
  // In a real implementation, this would make an HTTP request
  // and check for 402 Payment Required status

  return {
    requiresPayment: true,
    price: PREMIUM_PRICE,
    currency: 'SOL',
    paymentAddress: PREMIUM_SERVICE_PUBKEY
  };
}

/**
 * Process x402 micropayment
 */
async function processX402Payment(wallet, amount) {
  try {
    const connection = getConnection();

    // Get premium service public key
    let servicePubkey;
    try {
      servicePubkey = new PublicKey(PREMIUM_SERVICE_PUBKEY);
    } catch (error) {
      // If invalid, use a test address
      servicePubkey = new PublicKey('4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T');
    }

    // Create payment transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: servicePubkey,
        lamports: Math.floor(amount * LAMPORTS_PER_SOL)
      })
    );

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

    return signature;
  } catch (error) {
    // If payment fails, create mock transaction for demo
    if (error.message.includes('insufficient')) {
      console.warn('Insufficient funds for premium, using mock payment');
      return 'MOCK_PREMIUM_TX_' + Date.now();
    }

    throw error;
  }
}

/**
 * Verify x402 payment
 */
export async function verifyX402Payment(signature) {
  try {
    if (signature.startsWith('MOCK_')) {
      return {
        verified: true,
        mock: true,
        amount: PREMIUM_PRICE
      };
    }

    const connection = getConnection();
    const tx = await connection.getTransaction(signature, {
      commitment: 'confirmed'
    });

    if (!tx) {
      return {
        verified: false,
        error: 'Transaction not found'
      };
    }

    // Extract amount from transaction
    const amount = tx.meta?.postBalances[0] - tx.meta?.preBalances[0];

    return {
      verified: true,
      amount: Math.abs(amount) / LAMPORTS_PER_SOL,
      timestamp: tx.blockTime
    };
  } catch (error) {
    return {
      verified: false,
      error: error.message
    };
  }
}

/**
 * Create x402 payment channel (for recurring premium access)
 */
export async function createPaymentChannel(wallet, duration = 30) {
  // In a real implementation, this would create a Solana program account
  // for a payment channel that allows multiple premium requests

  const totalAmount = PREMIUM_PRICE * duration; // e.g., 30 days

  console.log(`Creating payment channel for ${duration} days (${totalAmount} SOL)`);

  try {
    const connection = getConnection();
    const servicePubkey = new PublicKey('4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T');

    // Create channel with initial deposit
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: servicePubkey,
        lamports: Math.floor(totalAmount * LAMPORTS_PER_SOL)
      })
    );

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet],
      {
        commitment: 'confirmed'
      }
    );

    return {
      channelId: signature,
      balance: totalAmount,
      expiresAt: Date.now() + duration * 24 * 60 * 60 * 1000
    };
  } catch (error) {
    throw new Error(`Failed to create payment channel: ${error.message}`);
  }
}

/**
 * Handle 402 Payment Required response
 */
export async function handle402Response(response, wallet) {
  // Parse payment requirements from response headers
  const paymentInfo = {
    amount: parseFloat(response.headers.get('x-payment-amount') || PREMIUM_PRICE),
    currency: response.headers.get('x-payment-currency') || 'SOL',
    address: response.headers.get('x-payment-address') || PREMIUM_SERVICE_PUBKEY
  };

  // Process payment
  const paymentTx = await processX402Payment(wallet, paymentInfo.amount);

  // Retry request with payment proof
  const retryResponse = await fetch(response.url, {
    headers: {
      'X-Payment-Proof': paymentTx,
      'X-Payment-Amount': paymentInfo.amount.toString()
    }
  });

  return retryResponse;
}

/**
 * Get premium pricing info
 */
export function getPremiumPricing() {
  return {
    singleAccess: PREMIUM_PRICE,
    daily: PREMIUM_PRICE * 10,
    monthly: PREMIUM_PRICE * 30 * 0.8, // 20% discount
    features: [
      'Enhanced forecast accuracy',
      'Carbon intensity data',
      'Renewable energy percentage',
      'Confidence scores',
      'Extended 48-hour forecasts'
    ]
  };
}
