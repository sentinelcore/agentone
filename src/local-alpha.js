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
export function saveAlphaContribution(contribution, agentId, location, verificationResult = null) {
  const data = loadAlphaData();

  const alphaEntry = {
    agentId,
    location,
    contribution,
    timestamp: new Date().toISOString(),
    verified: verificationResult ? verificationResult.verified : false,
    confidence: verificationResult ? verificationResult.confidence : 0.5,
    verificationReasons: verificationResult ? verificationResult.reasons : []
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
 * Verify contribution against current pricing data
 * Returns confidence score (0-1) and reasons
 */
export function verifyContribution(contribution, pricingData) {
  let confidence = 0.5; // Start at neutral
  const reasons = [];

  if (!pricingData || pricingData.length === 0) {
    return { confidence, reasons: ['No pricing data to verify against'], verified: false };
  }

  // Check if reported peak hours align with actual high prices
  const reportedPeakHours = [];
  for (let h = contribution.startHour; h <= contribution.endHour; h++) {
    reportedPeakHours.push(h);
  }

  // Get actual expensive hours from pricing data
  const prices = pricingData.map(d => d.price);
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const expensiveHours = pricingData
    .filter(d => d.price > avgPrice * 1.1) // 10% above average
    .map(d => d.hour);

  // Calculate overlap
  const overlap = reportedPeakHours.filter(h => expensiveHours.includes(h));
  const overlapRatio = overlap.length / reportedPeakHours.length;

  // Adjust confidence based on overlap
  if (contribution.type === 'peak') {
    if (overlapRatio > 0.7) {
      confidence = 0.9;
      reasons.push(`✓ ${(overlapRatio * 100).toFixed(0)}% of reported peak hours match high prices`);
    } else if (overlapRatio > 0.4) {
      confidence = 0.6;
      reasons.push(`~ ${(overlapRatio * 100).toFixed(0)}% partial match with high prices`);
    } else {
      confidence = 0.3;
      reasons.push(`⚠ Only ${(overlapRatio * 100).toFixed(0)}% of reported peak hours match high prices`);
    }
  }

  // Check against community consensus
  const verified = confidence > 0.6;

  return { confidence, reasons, verified, overlapRatio };
}

/**
 * Calculate bonus points for alpha contribution (with verification)
 */
export function calculateAlphaBonus(contribution, verificationResult = null) {
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

  // Verification bonus
  if (verificationResult && verificationResult.verified) {
    if (verificationResult.confidence > 0.8) {
      bonus += 5; // High confidence = extra bonus
    } else if (verificationResult.confidence > 0.6) {
      bonus += 3; // Medium confidence = moderate bonus
    }
  }

  return bonus;
}

/**
 * Get information sources for finding local peak times
 */
export function getInformationSources(location) {
  const sources = {
    general: [
      '📱 Your electricity bill (look for "peak hours" or "time-of-use" rates)',
      '🌐 Local utility company website',
      '💬 Local energy forums or community groups',
      '📊 Your smart meter app or energy monitor',
    ],
    byRegion: {}
  };

  // Add region-specific sources
  const locationLower = location.toLowerCase();

  if (locationLower.includes('india') || locationLower.includes('hyderabad') || locationLower.includes('mumbai') || locationLower.includes('delhi')) {
    sources.byRegion.india = [
      '🇮🇳 Your DISCOM website (TSSPDCL, BESCOM, BSES, etc.)',
      '🇮🇳 POSOCO/Grid-India reports: https://posoco.in/',
      '🇮🇳 Your electricity bill "Time of Day" section',
    ];
  }

  if (locationLower.includes('us') || locationLower.includes('texas') || locationLower.includes('california')) {
    sources.byRegion.us = [
      '🇺🇸 Your utility dashboard (PG&E, ComEd, Duke Energy, etc.)',
      '🇺🇸 ERCOT website (Texas): https://www.ercot.com/',
      '🇺🇸 Your Time-of-Use (TOU) rate schedule',
    ];
  }

  if (locationLower.includes('uk') || locationLower.includes('britain') || locationLower.includes('london')) {
    sources.byRegion.uk = [
      '🇬🇧 Octopus Energy / British Gas / E.ON app',
      '🇬🇧 National Grid ESO: https://www.nationalgrideso.com/',
      '🇬🇧 Your Economy 7 or smart tariff schedule',
    ];
  }

  if (locationLower.includes('nigeria') || locationLower.includes('lagos')) {
    sources.byRegion.nigeria = [
      '🇳🇬 Your DISCO (EKEDC, IKEDC, etc.) website',
      '🇳🇬 Nigerian Electricity Regulatory Commission (NERC)',
      '🇳🇬 Local community knowledge',
    ];
  }

  return sources;
}
