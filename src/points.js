/**
 * Points Tracking Module
 *
 * Manages user points locally and optionally via SPL token
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import path from 'path';

// Points storage file location
const POINTS_DIR = path.join(homedir(), '.decharge-scout');
const POINTS_FILE = path.join(POINTS_DIR, 'points.json');

// In-memory points store
let pointsStore = {};

/**
 * Initialize points system
 */
export function initializePoints(walletAddress) {
  // Load existing points from file
  loadPoints();

  // Initialize wallet if not exists
  if (!pointsStore[walletAddress]) {
    pointsStore[walletAddress] = {
      total: 0,
      history: [],
      created: Date.now()
    };
  }
}

/**
 * Award points to a wallet
 */
export function awardPoints(walletAddress, points) {
  if (!pointsStore[walletAddress]) {
    initializePoints(walletAddress);
  }

  pointsStore[walletAddress].total += points;
  pointsStore[walletAddress].history.push({
    amount: points,
    timestamp: Date.now(),
    type: 'earned'
  });

  // Auto-save after awarding
  savePoints();
}

/**
 * Get current points for a wallet
 */
export function getPoints(walletAddress) {
  if (!pointsStore[walletAddress]) {
    return 0;
  }

  return pointsStore[walletAddress].total;
}

/**
 * Get points history for a wallet
 */
export function getPointsHistory(walletAddress) {
  if (!pointsStore[walletAddress]) {
    return [];
  }

  return pointsStore[walletAddress].history;
}

/**
 * Load points from persistent storage
 */
function loadPoints() {
  try {
    // Ensure directory exists
    if (!existsSync(POINTS_DIR)) {
      const fs = await import('fs');
      fs.mkdirSync(POINTS_DIR, { recursive: true });
    }

    // Load points file if exists
    if (existsSync(POINTS_FILE)) {
      const data = readFileSync(POINTS_FILE, 'utf-8');
      pointsStore = JSON.parse(data);
    } else {
      pointsStore = {};
    }
  } catch (error) {
    console.warn(`Warning: Could not load points file: ${error.message}`);
    pointsStore = {};
  }
}

/**
 * Save points to persistent storage
 */
export function savePoints() {
  try {
    // Ensure directory exists
    const fs = await import('fs');
    if (!existsSync(POINTS_DIR)) {
      fs.mkdirSync(POINTS_DIR, { recursive: true });
    }

    // Write points to file
    writeFileSync(POINTS_FILE, JSON.stringify(pointsStore, null, 2), 'utf-8');
  } catch (error) {
    console.warn(`Warning: Could not save points file: ${error.message}`);
  }
}

/**
 * Get leaderboard (top wallets by points)
 */
export function getLeaderboard(limit = 10) {
  const wallets = Object.entries(pointsStore)
    .map(([address, data]) => ({
      address: address.slice(0, 8) + '...' + address.slice(-8), // Abbreviated
      points: data.total,
      created: data.created
    }))
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);

  return wallets;
}

/**
 * Reset points for a wallet (for testing)
 */
export function resetPoints(walletAddress) {
  if (pointsStore[walletAddress]) {
    pointsStore[walletAddress].total = 0;
    pointsStore[walletAddress].history = [];
    savePoints();
  }
}

/**
 * Export points data for dashboard
 */
export function exportPointsForDashboard() {
  return Object.entries(pointsStore).map(([address, data]) => ({
    wallet: address.slice(0, 8) + '...' + address.slice(-8),
    points: data.total,
    lastActivity: data.history.length > 0
      ? data.history[data.history.length - 1].timestamp
      : data.created
  }));
}

// Auto-load on module import
loadPoints();
