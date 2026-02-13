/**
 * Wallet Connection Server
 *
 * Starts a local web server for browser-based wallet connection
 * Uses Phantom/Solflare/etc wallet extensions for signing
 */

import express from 'express';
import WebSocket from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import open from 'open';
import chalk from 'chalk';

// WebSocket.Server is the correct export for ws package
const WebSocketServer = WebSocket.Server;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3838;

// Store connected wallet info
let connectedWallet = null;
let walletResolve = null;
let txResolve = null;

/**
 * Start wallet connection server
 */
export async function startWalletServer() {
  return new Promise((resolve, reject) => {
    const server = app.listen(PORT, () => {
      console.log(chalk.blue(`🌐 Wallet server started on http://localhost:${PORT}`));
      resolve(server);
    }).on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(chalk.yellow(`⚠️  Port ${PORT} is already in use`));
        resolve(null);
      } else {
        reject(err);
      }
    });

    // WebSocket server for real-time communication
    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws) => {
      console.log(chalk.gray('WebSocket client connected'));

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          handleWalletMessage(data, ws);
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });
    });

    // Serve static files
    app.use(express.static(path.join(__dirname, '..', 'public')));
    app.use(express.json());

    // Health check endpoint
    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', connected: !!connectedWallet });
    });

    // Get connected wallet
    app.get('/api/wallet', (req, res) => {
      if (connectedWallet) {
        res.json({ connected: true, publicKey: connectedWallet });
      } else {
        res.json({ connected: false });
      }
    });
  });
}

/**
 * Handle wallet messages from browser
 */
function handleWalletMessage(data, ws) {
  switch (data.type) {
    case 'WALLET_CONNECTED':
      connectedWallet = data.publicKey;
      console.log(chalk.green(`✓ Wallet connected: ${data.publicKey}`));
      if (walletResolve) {
        walletResolve(data.publicKey);
        walletResolve = null;
      }
      ws.send(JSON.stringify({ type: 'ACK', message: 'Wallet connected successfully' }));
      break;

    case 'WALLET_DISCONNECTED':
      connectedWallet = null;
      console.log(chalk.yellow('Wallet disconnected'));
      ws.send(JSON.stringify({ type: 'ACK', message: 'Wallet disconnected' }));
      break;

    case 'TX_SIGNED':
      console.log(chalk.green('✓ Transaction signed'));
      if (txResolve) {
        txResolve(data.signature);
        txResolve = null;
      }
      ws.send(JSON.stringify({ type: 'ACK', message: 'Transaction received' }));
      break;

    case 'TX_REJECTED':
      console.log(chalk.red('✗ Transaction rejected by user'));
      if (txResolve) {
        txResolve(null);
        txResolve = null;
      }
      ws.send(JSON.stringify({ type: 'ACK', message: 'Transaction cancelled' }));
      break;

    case 'ERROR':
      console.log(chalk.red(`Error: ${data.message}`));
      ws.send(JSON.stringify({ type: 'ACK', message: 'Error received' }));
      break;

    default:
      console.log(chalk.gray(`Unknown message type: ${data.type}`));
  }
}

/**
 * Wait for wallet connection
 */
export async function waitForWalletConnection() {
  return new Promise((resolve) => {
    if (connectedWallet) {
      resolve(connectedWallet);
    } else {
      walletResolve = resolve;
    }
  });
}

/**
 * Request transaction signature from browser wallet
 */
export async function requestTransactionSignature(transaction) {
  return new Promise((resolve) => {
    txResolve = resolve;
    // Transaction will be sent via WebSocket
    // Browser will prompt user to sign
  });
}

/**
 * Open browser for wallet connection
 */
export async function openWalletConnection() {
  const url = `http://localhost:${PORT}`;
  console.log(chalk.blue(`\n🌐 Opening browser for wallet connection...`));
  console.log(chalk.gray(`URL: ${url}`));

  try {
    await open(url);
  } catch (error) {
    console.log(chalk.yellow(`\n⚠️  Could not auto-open browser`));
    console.log(chalk.blue(`Please open manually: ${url}`));
  }
}

/**
 * Get connected wallet public key
 */
export function getConnectedWallet() {
  return connectedWallet;
}

/**
 * Check if wallet is connected
 */
export function isWalletConnected() {
  return !!connectedWallet;
}
