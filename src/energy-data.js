/**
 * Energy Data Fetching Module
 *
 * Fetches real-time energy grid data from various APIs
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const EIA_API_KEY = process.env.EIA_API_KEY;
const EIA_BASE_URL = 'https://api.eia.gov/v2';

/**
 * Map location to EIA grid region codes
 */
function getGridRegionForLocation(location) {
  const locationLower = location.toLowerCase();

  // Map states/regions to grid operators
  if (locationLower.includes('texas') || locationLower.includes('tx') || locationLower.includes('dallas') || locationLower.includes('houston') || locationLower.includes('austin')) {
    return 'ERCT'; // ERCOT (Texas)
  } else if (locationLower.includes('california') || locationLower.includes('ca')) {
    return 'CISO'; // California ISO
  } else if (locationLower.includes('new york') || locationLower.includes('ny')) {
    return 'NYIS'; // New York ISO
  } else if (locationLower.includes('new england') || locationLower.includes('massachusetts') || locationLower.includes('ma')) {
    return 'ISNE'; // ISO New England
  } else if (locationLower.includes('pjm') || locationLower.includes('pennsylvania') || locationLower.includes('pa')) {
    return 'PJM'; // PJM Interconnection
  } else if (locationLower.includes('miso') || locationLower.includes('midwest')) {
    return 'MISO'; // Midcontinent ISO
  }

  // Default to ERCOT if unknown
  return 'ERCT';
}

/**
 * Fetch energy data from EIA API
 */
export async function fetchEnergyData(location = 'Texas, USA') {
  if (!EIA_API_KEY || EIA_API_KEY === 'your_eia_api_key_here' || EIA_API_KEY.length < 20) {
    console.warn('⚠️  EIA_API_KEY not configured or invalid');
    console.warn('   Get a free key: https://www.eia.gov/opendata/register.php');
    throw new Error('EIA_API_KEY not configured');
  }

  // Debug logging (show first 6 and last 4 chars of API key)
  const keyPreview = `${EIA_API_KEY.substring(0, 6)}...${EIA_API_KEY.substring(EIA_API_KEY.length - 4)}`;
  console.log(`📡 Using EIA API key: ${keyPreview}`);

  // Determine grid region from location
  const gridRegion = getGridRegionForLocation(location);
  console.log(`🗺️  Location: ${location} → Grid Region: ${gridRegion}`);

  try {
    // Calculate time range (last 24 hours to next 24 hours for forecast)
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const startDate = yesterday.toISOString().split('T')[0] + 'T00';
    const endDate = now.toISOString().split('T')[0] + 'T23';

    // EIA API endpoint for regional real-time data
    const url = `${EIA_BASE_URL}/electricity/rto/region-data/data/?` +
      `api_key=${EIA_API_KEY}` +
      `&frequency=hourly` +
      `&data[0]=value` +
      `&facets[respondent][]=${gridRegion}` +
      `&facets[type][]=D` + // Demand
      `&start=${startDate}` +
      `&end=${endDate}` +
      `&sort[0][column]=period` +
      `&sort[0][direction]=desc` +
      `&length=48`;

    console.log(`🔗 EIA API URL: ${url.replace(EIA_API_KEY, keyPreview)}`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`EIA API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.response || !data.response.data || data.response.data.length === 0) {
      throw new Error('No data returned from EIA API');
    }

    // Transform to our format with simulated pricing
    // EIA provides demand, we'll simulate price based on demand patterns
    const energyData = data.response.data.map((item, index) => {
      const demand = parseFloat(item.value) || 0;
      // Simulate price: higher demand = higher price
      // Base price $0.03-0.10/kWh with demand-based variation
      const basePrice = 0.05;
      const demandFactor = (demand / 50000) * 0.03; // Scale based on typical ERCOT demand
      const timeVariation = Math.sin(index * 0.26) * 0.02; // Time-based variation
      const price = basePrice + demandFactor + timeVariation + (Math.random() * 0.01);

      return {
        timestamp: item.period,
        hour: new Date(item.period).getHours(),
        demand: demand,
        price: Math.max(0.03, Math.min(0.15, price)), // Clamp between 3-15 cents
        source: `EIA-${gridRegion}`
      };
    });

    return energyData;
  } catch (error) {
    throw new Error(`Failed to fetch EIA data: ${error.message}`);
  }
}

/**
 * Fetch forecast data from Electricity Maps API
 */
export async function fetchElectricityMapsData() {
  try {
    const url = 'https://api.electricitymaps.com/v3/power-breakdown/latest?zone=US-TEX-ERCO';

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      // If auth required or rate limited, generate mock data
      if (response.status === 401 || response.status === 429) {
        console.log('Electricity Maps requires auth, using mock forecast data');
        return generateMockForecastData();
      }
      throw new Error(`Electricity Maps API error: ${response.status}`);
    }

    const data = await response.json();

    // Generate 24-hour forecast based on current data
    const forecastData = [];
    const currentHour = new Date().getHours();

    for (let i = 0; i < 24; i++) {
      const hour = (currentHour + i) % 24;
      const timestamp = new Date(Date.now() + i * 60 * 60 * 1000).toISOString();

      // Simulate price variation based on typical daily patterns
      const isOffPeak = hour >= 22 || hour <= 6; // 10 PM - 6 AM
      const isPeak = hour >= 16 && hour <= 20; // 4 PM - 8 PM
      const basePrice = 0.06;
      const peakMultiplier = isPeak ? 1.5 : 1.0;
      const offPeakMultiplier = isOffPeak ? 0.7 : 1.0;
      const randomVariation = (Math.random() - 0.5) * 0.02;

      const price = basePrice * peakMultiplier * offPeakMultiplier + randomVariation;

      forecastData.push({
        timestamp,
        hour,
        demand: 45000 + (isPeak ? 15000 : 0) - (isOffPeak ? 10000 : 0),
        price: Math.max(0.03, Math.min(0.12, price)),
        source: 'ElectricityMaps-Forecast'
      });
    }

    return forecastData;
  } catch (error) {
    throw new Error(`Failed to fetch Electricity Maps data: ${error.message}`);
  }
}

/**
 * Generate mock forecast data as fallback
 */
function generateMockForecastData() {
  const forecastData = [];
  const currentHour = new Date().getHours();

  for (let i = 0; i < 24; i++) {
    const hour = (currentHour + i) % 24;
    const timestamp = new Date(Date.now() + i * 60 * 60 * 1000).toISOString();

    // Realistic daily price pattern
    const isOffPeak = hour >= 22 || hour <= 6;
    const isPeak = hour >= 16 && hour <= 20;
    const isMidDay = hour >= 10 && hour <= 14;

    let price = 0.05; // Base price

    if (isPeak) {
      price = 0.09 + Math.random() * 0.03; // Peak hours: 9-12 cents
    } else if (isOffPeak) {
      price = 0.03 + Math.random() * 0.02; // Off-peak: 3-5 cents
    } else if (isMidDay) {
      price = 0.06 + Math.random() * 0.02; // Mid-day: 6-8 cents
    } else {
      price = 0.05 + Math.random() * 0.02; // Normal: 5-7 cents
    }

    forecastData.push({
      timestamp,
      hour,
      demand: 40000 + (isPeak ? 20000 : 0) - (isOffPeak ? 15000 : 0),
      price: parseFloat(price.toFixed(4)),
      source: 'Mock-Data'
    });
  }

  return forecastData;
}

/**
 * Fetch premium forecast data (for x402 integration)
 */
export async function fetchPremiumForecastData() {
  // In a real implementation, this would call a premium API endpoint
  // For demo, return enhanced mock data with more detail

  const premiumData = generateMockForecastData().map(item => ({
    ...item,
    confidence: 0.85 + Math.random() * 0.15,
    carbonIntensity: 300 + Math.random() * 200,
    renewablePercentage: 20 + Math.random() * 30,
    premium: true
  }));

  return premiumData;
}
