/**
 * Smart Pricing Simulation Engine
 *
 * Simulates realistic energy grid pricing based on:
 * - Real weather data (temperature, wind, solar radiation)
 * - Regional base pricing
 * - Time-of-day patterns
 * - Seasonal adjustments
 * - Local grid characteristics
 */

/**
 * Regional Base Pricing Map (USD/kWh)
 * Commercial DC fast charging rates for fleet operators (2025)
 * These reflect commercial-tier pricing at dedicated fleet charging facilities,
 * distinct from lower residential home-charging rates (~$0.12–0.17/kWh).
 */
const REGIONAL_BASE_PRICES = {
  // North America
  US: { base: 0.42, currency: 'USD', name: 'United States' },
  CA: { base: 0.38, currency: 'CAD', name: 'Canada' },
  MX: { base: 0.28, currency: 'MXN', name: 'Mexico' },

  // Europe
  DE: { base: 0.72, currency: 'EUR', name: 'Germany' },
  FR: { base: 0.58, currency: 'EUR', name: 'France' },
  GB: { base: 0.72, currency: 'GBP', name: 'United Kingdom' },
  ES: { base: 0.62, currency: 'EUR', name: 'Spain' },
  IT: { base: 0.68, currency: 'EUR', name: 'Italy' },
  PL: { base: 0.45, currency: 'EUR', name: 'Poland' },
  NL: { base: 0.68, currency: 'EUR', name: 'Netherlands' },

  // Asia
  IN: { base: 0.24, currency: 'INR', name: 'India' },
  CN: { base: 0.22, currency: 'CNY', name: 'China' },
  JP: { base: 0.62, currency: 'JPY', name: 'Japan' },
  KR: { base: 0.32, currency: 'KRW', name: 'South Korea' },
  SG: { base: 0.48, currency: 'SGD', name: 'Singapore' },

  // South America
  BR: { base: 0.30, currency: 'BRL', name: 'Brazil' },
  AR: { base: 0.22, currency: 'ARS', name: 'Argentina' },
  CL: { base: 0.35, currency: 'CLP', name: 'Chile' },

  // Oceania
  AU: { base: 0.52, currency: 'AUD', name: 'Australia' },
  NZ: { base: 0.48, currency: 'NZD', name: 'New Zealand' },

  // Africa
  ZA: { base: 0.28, currency: 'ZAR', name: 'South Africa' },
  NG: { base: 0.20, currency: 'NGN', name: 'Nigeria' },
  KE: { base: 0.32, currency: 'KES', name: 'Kenya' },

  // Regional commercial average (used only when country cannot be detected)
  DEFAULT: { base: 0.40, currency: 'USD', name: 'Commercial Average' }
};

/**
 * Regional Peak Hour Patterns
 * Different regions have different typical peak hours
 */
const REGIONAL_PEAK_PATTERNS = {
  US: { morning: [7, 9], evening: [17, 21], offPeak: [22, 6] },
  EU: { morning: [7, 9], evening: [18, 21], offPeak: [23, 6] },
  IN: { morning: [6, 9], evening: [19, 23], offPeak: [0, 5] }, // India peaks later due to heat
  BR: { morning: [7, 10], evening: [18, 22], offPeak: [23, 6] },
  JP: { morning: [8, 10], evening: [18, 20], offPeak: [22, 6] },
  DEFAULT: { morning: [7, 9], evening: [17, 21], offPeak: [22, 6] }
};

/**
 * Get regional pricing info from country code
 */
export function getRegionalPricing(countryCode) {
  const code = countryCode ? countryCode.toUpperCase() : 'DEFAULT';
  return REGIONAL_BASE_PRICES[code] || REGIONAL_BASE_PRICES.DEFAULT;
}

/**
 * Get regional peak pattern
 */
function getRegionalPeakPattern(countryCode) {
  // Map country code to region
  const regionMap = {
    US: 'US', CA: 'US', MX: 'US',
    DE: 'EU', FR: 'EU', GB: 'EU', ES: 'EU', IT: 'EU', PL: 'EU', NL: 'EU',
    IN: 'IN',
    BR: 'BR', AR: 'BR', CL: 'BR',
    JP: 'JP', KR: 'JP', CN: 'JP',
  };

  const region = regionMap[countryCode] || 'DEFAULT';
  return REGIONAL_PEAK_PATTERNS[region] || REGIONAL_PEAK_PATTERNS.DEFAULT;
}

/**
 * Check if hour is in peak period
 */
function isPeakHour(hour, pattern) {
  const morningPeak = hour >= pattern.morning[0] && hour <= pattern.morning[1];
  const eveningPeak = hour >= pattern.evening[0] && hour <= pattern.evening[1];
  return morningPeak || eveningPeak;
}

/**
 * Check if hour is off-peak
 */
function isOffPeakHour(hour, pattern) {
  if (pattern.offPeak[0] > pattern.offPeak[1]) {
    // Wraps around midnight (e.g., 22-6)
    return hour >= pattern.offPeak[0] || hour <= pattern.offPeak[1];
  }
  return hour >= pattern.offPeak[0] && hour <= pattern.offPeak[1];
}

/**
 * Calculate price multiplier based on weather conditions
 */
function calculateWeatherMultiplier(weather) {
  let multiplier = 1.0;
  const reasons = [];

  // Temperature impact (AC/heating demand)
  if (weather.temperature > 28) {
    const tempImpact = 1 + ((weather.temperature - 28) * 0.03); // +3% per degree above 28°C
    multiplier *= tempImpact;
    reasons.push(`🌡️ High temp (${weather.temperature.toFixed(1)}°C) +${((tempImpact - 1) * 100).toFixed(0)}% AC demand`);
  } else if (weather.temperature < 5) {
    const tempImpact = 1 + ((5 - weather.temperature) * 0.02); // +2% per degree below 5°C
    multiplier *= tempImpact;
    reasons.push(`❄️ Low temp (${weather.temperature.toFixed(1)}°C) +${((tempImpact - 1) * 100).toFixed(0)}% heating demand`);
  }

  // Wind impact (wind energy generation)
  if (weather.windSpeed > 8) {
    const windImpact = 0.75; // -25% when windy
    multiplier *= windImpact;
    reasons.push(`💨 High wind (${weather.windSpeed.toFixed(1)} m/s) -25% renewable energy`);
  }

  // Solar radiation impact (solar energy generation)
  // Only during daytime hours (6-18)
  if (weather.hour >= 6 && weather.hour <= 18 && weather.solarRadiation > 200) {
    const solarImpact = Math.max(0.8, 1 - (weather.solarRadiation / 1000) * 0.2); // Up to -20%
    multiplier *= solarImpact;
    reasons.push(`☀️ High solar (${weather.solarRadiation.toFixed(0)} W/m²) -${((1 - solarImpact) * 100).toFixed(0)}% solar energy`);
  }

  return { multiplier, reasons };
}

/**
 * Calculate time-of-day multiplier
 */
function calculateTimeMultiplier(hour, pattern) {
  const reasons = [];
  let multiplier = 1.0;

  if (isPeakHour(hour, pattern)) {
    multiplier = 1.4; // +40% during peak
    const peakType = hour >= pattern.morning[0] && hour <= pattern.morning[1] ? 'morning' : 'evening';
    reasons.push(`⚡ ${peakType.charAt(0).toUpperCase() + peakType.slice(1)} peak hours +40%`);
  } else if (isOffPeakHour(hour, pattern)) {
    multiplier = 0.7; // -30% during off-peak
    reasons.push(`🌙 Off-peak hours -30%`);
  } else {
    reasons.push(`📊 Standard hours`);
  }

  return { multiplier, reasons };
}

/**
 * Generate smart pricing data based on weather forecast
 */
export function generateSmartPricing(weatherData, countryCode = 'DEFAULT') {
  const regionalPricing = getRegionalPricing(countryCode);
  const peakPattern = getRegionalPeakPattern(countryCode);
  const basePrice = regionalPricing.base;

  console.log(`💰 Base price: $${basePrice.toFixed(4)}/kWh (${regionalPricing.name})`);

  const pricingData = [];

  for (const weather of weatherData.forecast) {
    // Calculate multipliers
    const weatherMultiplier = calculateWeatherMultiplier(weather);
    const timeMultiplier = calculateTimeMultiplier(weather.hour, peakPattern);

    // Calculate final price
    const finalMultiplier = weatherMultiplier.multiplier * timeMultiplier.multiplier;
    const price = basePrice * finalMultiplier;

    // Calculate simulated demand (inversely related to price for renewable-heavy grids)
    const baseDemand = 40000;
    const demandMultiplier = 1 + (finalMultiplier - 1) * 0.5; // Demand follows price but not as strongly
    const demand = baseDemand * demandMultiplier;

    pricingData.push({
      timestamp: weather.timestamp,
      hour: weather.hour,
      price: Math.max(basePrice * 0.5, Math.min(basePrice * 2.0, price)), // Cap at 50%-200% of base
      demand,
      weather: {
        temperature: weather.temperature,
        windSpeed: weather.windSpeed,
        solarRadiation: weather.solarRadiation,
        humidity: weather.humidity
      },
      reasons: [...timeMultiplier.reasons, ...weatherMultiplier.reasons],
      source: 'Smart-Simulation-Weather'
    });
  }

  return pricingData;
}

/**
 * Get insights about pricing patterns
 */
export function getPricingInsights(pricingData, countryCode) {
  const prices = pricingData.map(d => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

  const cheapestHour = pricingData.find(d => d.price === minPrice);
  const expensiveHour = pricingData.find(d => d.price === maxPrice);

  const regionalPricing = getRegionalPricing(countryCode);

  return {
    region: regionalPricing.name,
    baseCurrency: regionalPricing.currency,
    avgPrice: avgPrice.toFixed(4),
    minPrice: minPrice.toFixed(4),
    maxPrice: maxPrice.toFixed(4),
    priceRange: ((maxPrice - minPrice) / avgPrice * 100).toFixed(1),
    cheapestTime: {
      hour: cheapestHour.hour,
      timestamp: cheapestHour.timestamp,
      price: cheapestHour.price.toFixed(4),
      reasons: cheapestHour.reasons
    },
    expensiveTime: {
      hour: expensiveHour.hour,
      timestamp: expensiveHour.timestamp,
      price: expensiveHour.price.toFixed(4),
      reasons: expensiveHour.reasons
    },
    savingsPotential: (((maxPrice - minPrice) / maxPrice) * 100).toFixed(1)
  };
}
