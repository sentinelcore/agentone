/**
 * Local Alpha Contribution System
 *
 * Allows users to contribute local knowledge about energy pricing patterns.
 * This creates a community-driven database of peak/off-peak times globally.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import path from 'path';

const ALPHA_DIR = path.join(homedir(), '.decharge-scout');
const ALPHA_FILE = path.join(ALPHA_DIR, 'local-alpha.json');

/**
 * Initialize local alpha storage
 */
function ensureAlphaStorage() {
  if (!existsSync(ALPHA_DIR)) {
    mkdirSync(ALPHA_DIR, { recursive: true });
  }

  if (!existsSync(ALPHA_FILE)) {
    const initialData = {
      contributions: [],
      hasAsked: false,
      lastAsked: null
    };
    writeFileSync(ALPHA_FILE, JSON.stringify(initialData, null, 2));
  }
}

/**
 * Load local alpha data
 */
function loadAlphaData() {
  ensureAlphaStorage();
  const data = readFileSync(ALPHA_FILE, 'utf-8');
  return JSON.parse(data);
}

/**
 * Save local alpha data
 */
function saveAlphaData(data) {
  ensureAlphaStorage();
  writeFileSync(ALPHA_FILE, JSON.stringify(data, null, 2));
}

/**
 * Check if user has been asked to contribute
 */
export function hasBeenAskedForAlpha() {
  const data = loadAlphaData();
  return data.hasAsked;
}

/**
 * Mark that user has been asked
 */
export function markAskedForAlpha() {
  const data = loadAlphaData();
  data.hasAsked = true;
  data.lastAsked = new Date().toISOString();
  saveAlphaData(data);
}

/**
 * Parse local alpha contribution
 * Examples:
 * - "7-9PM in Lagos"
 * - "5-8PM peak in Mumbai"
 * - "1-5AM cheap in Berlin"
 * - "Noon-3PM solar peak in California"
 */
export function parseAlphaContribution(input, location) {
  const patterns = [
    // "7-9PM in Lagos" or "7-9PM Lagos"
    /(\d+)\s*-\s*(\d+)\s*(AM|PM|am|pm)?\s*(?:in\s+)?(.+)/i,
    // "5PM-8PM in Mumbai"
    /(\d+)\s*(AM|PM|am|pm)?\s*-\s*(\d+)\s*(AM|PM|am|pm)?\s*(?:in\s+)?(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      let startHour, endHour, location;

      if (pattern === patterns[0]) {
        // "7-9PM in Lagos"
        startHour = parseInt(match[1]);
        endHour = parseInt(match[2]);
        const meridiem = match[3];
        location = match[4].trim();

        // Convert to 24-hour format
        if (meridiem && meridiem.toLowerCase() === 'pm' && startHour < 12) {
          startHour += 12;
          endHour += 12;
        }
      } else if (pattern === patterns[1]) {
        // "5PM-8PM in Mumbai"
        startHour = parseInt(match[1]);
        const startMeridiem = match[2];
        endHour = parseInt(match[3]);
        const endMeridiem = match[4];
        location = match[5].trim();

        if (startMeridiem && startMeridiem.toLowerCase() === 'pm' && startHour < 12) {
          startHour += 12;
        }
        if (endMeridiem && endMeridiem.toLowerCase() === 'pm' && endHour < 12) {
          endHour += 12;
        }
      }

      return {
        startHour,
        endHour,
        location: location || 'Unknown',
        type: input.toLowerCase().includes('cheap') ? 'cheap' : 'peak',
        rawInput: input
      };
    }
  }

  return null;
}

/**
 * Save local alpha contribution
 */
export function saveAlphaContribution(contribution, agentId, location) {
  const data = loadAlphaData();

  const alphaEntry = {
    agentId,
    location,
    contribution,
    timestamp: new Date().toISOString(),
    verified: false // Could be verified by comparing with actual data later
  };

  data.contributions.push(alphaEntry);
  saveAlphaData(data);

  return alphaEntry;
}

/**
 * Get all alpha contributions for a location
 */
export function getAlphaForLocation(location) {
  const data = loadAlphaData();

  return data.contributions.filter(contrib => {
    const locLower = location.toLowerCase();
    const contribLocLower = contrib.location.toLowerCase();
    return contribLocLower.includes(locLower) || locLower.includes(contribLocLower);
  });
}

/**
 * Get alpha insights (most common peak times for a location)
 */
export function getAlphaInsights(location) {
  const alphaData = getAlphaForLocation(location);

  if (alphaData.length === 0) {
    return null;
  }

  // Aggregate peak hours
  const peakHours = {};
  alphaData.forEach(alpha => {
    if (alpha.contribution.type === 'peak') {
      for (let h = alpha.contribution.startHour; h <= alpha.contribution.endHour; h++) {
        peakHours[h] = (peakHours[h] || 0) + 1;
      }
    }
  });

  // Find most common peak period
  const sortedPeaks = Object.entries(peakHours)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return {
    contributions: alphaData.length,
    commonPeakHours: sortedPeaks.map(([hour, count]) => ({ hour: parseInt(hour), count })),
    latestContribution: alphaData[alphaData.length - 1]
  };
}

/**
 * Calculate bonus points for alpha contribution
 */
export function calculateAlphaBonus(contribution) {
  // Base bonus
  let bonus = 5;

  // Bonus for detailed information
  if (contribution.type === 'peak' || contribution.type === 'cheap') {
    bonus += 2;
  }

  // Bonus for specific location
  if (contribution.location && contribution.location !== 'Unknown') {
    bonus += 3;
  }

  return bonus;
}
