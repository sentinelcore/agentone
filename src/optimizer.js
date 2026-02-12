/**
 * Optimization Logic Module
 *
 * Analyzes energy data to find optimal charging windows and calculate savings
 */

/**
 * Find the cheapest charging window in the next 24 hours
 */
export function findCheapestWindow(energyData) {
  if (!energyData || energyData.length === 0) {
    throw new Error('No energy data available for optimization');
  }

  // Find the entry with minimum price
  let cheapest = energyData[0];

  for (const entry of energyData) {
    if (entry.price < cheapest.price) {
      cheapest = entry;
    }
  }

  // Format time window
  const timestamp = new Date(cheapest.timestamp);
  const startHour = timestamp.getHours();
  const endHour = (startHour + 1) % 24;

  const formatHour = (hour) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}${period}`;
  };

  return {
    timestamp: cheapest.timestamp,
    hour: startHour,
    price: cheapest.price,
    demand: cheapest.demand,
    timeWindow: `${formatHour(startHour)}-${formatHour(endHour)}`,
    source: cheapest.source
  };
}

/**
 * Calculate savings percentage compared to average price
 */
export function calculateSavings(energyData, cheapestWindow) {
  if (!energyData || energyData.length === 0) {
    return 0;
  }

  // Calculate average price
  const totalPrice = energyData.reduce((sum, entry) => sum + entry.price, 0);
  const averagePrice = totalPrice / energyData.length;

  // Calculate peak price (highest price in the dataset)
  const peakPrice = Math.max(...energyData.map(e => e.price));

  // Calculate savings vs average
  const savingsVsAverage = ((averagePrice - cheapestWindow.price) / averagePrice) * 100;

  // Calculate savings vs peak
  const savingsVsPeak = ((peakPrice - cheapestWindow.price) / peakPrice) * 100;

  // Return the more impressive number (vs peak) but at least vs average
  return Math.max(savingsVsAverage, savingsVsPeak);
}

/**
 * Find multiple cheap windows (e.g., top 3)
 */
export function findTopCheapWindows(energyData, count = 3) {
  if (!energyData || energyData.length === 0) {
    return [];
  }

  // Sort by price (ascending)
  const sorted = [...energyData].sort((a, b) => a.price - b.price);

  // Take top N
  return sorted.slice(0, count).map(entry => {
    const timestamp = new Date(entry.timestamp);
    const startHour = timestamp.getHours();
    const endHour = (startHour + 1) % 24;

    const formatHour = (hour) => {
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return `${displayHour}${period}`;
    };

    return {
      timestamp: entry.timestamp,
      hour: startHour,
      price: entry.price,
      demand: entry.demand,
      timeWindow: `${formatHour(startHour)}-${formatHour(endHour)}`,
      source: entry.source
    };
  });
}

/**
 * Analyze demand patterns
 */
export function analyzeDemandPatterns(energyData) {
  if (!energyData || energyData.length === 0) {
    return null;
  }

  const hourlyDemand = {};

  // Group by hour
  for (const entry of energyData) {
    const hour = entry.hour;
    if (!hourlyDemand[hour]) {
      hourlyDemand[hour] = [];
    }
    hourlyDemand[hour].push(entry.demand);
  }

  // Calculate averages
  const patterns = {};
  for (const [hour, demands] of Object.entries(hourlyDemand)) {
    const avg = demands.reduce((sum, d) => sum + d, 0) / demands.length;
    patterns[hour] = avg;
  }

  return patterns;
}

/**
 * Predict optimal charging time based on historical patterns
 */
export function predictOptimalChargingTime(energyData) {
  // Simple prediction: find the hour with consistently low prices
  const hourlyPrices = {};

  for (const entry of energyData) {
    const hour = entry.hour;
    if (!hourlyPrices[hour]) {
      hourlyPrices[hour] = [];
    }
    hourlyPrices[hour].push(entry.price);
  }

  // Find hour with lowest average price
  let bestHour = 0;
  let lowestAvg = Infinity;

  for (const [hour, prices] of Object.entries(hourlyPrices)) {
    const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    if (avg < lowestAvg) {
      lowestAvg = avg;
      bestHour = parseInt(hour);
    }
  }

  return {
    recommendedHour: bestHour,
    averagePrice: lowestAvg,
    confidence: hourlyPrices[bestHour].length / energyData.length
  };
}
