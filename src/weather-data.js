/**
 * Weather Data Module - Open-Meteo API Integration
 *
 * Fetches real-time weather forecasts to simulate energy grid pricing.
 * Uses FREE Open-Meteo API (no key needed!)
 *
 * API Docs: https://open-meteo.com/en/docs
 */

import fetch from 'node-fetch';

/**
 * Get coordinates from location string
 * Simple geocoding using Open-Meteo's geocoding API (also free!)
 * Tries multiple search strategies for better success rate
 */
export async function getCoordinatesFromLocation(location) {
  // Try multiple search strategies
  const searchTerms = [
    location, // Original: "Hyderabad, TS, IN"
    location.split(',')[0].trim(), // Just city: "Hyderabad"
    location.replace(/,\s*[A-Z]{2}\s*,/, ','), // Remove state: "Hyderabad, IN"
  ];

  // Remove duplicates
  const uniqueSearchTerms = [...new Set(searchTerms)];

  let lastError = null;

  for (const searchTerm of uniqueSearchTerms) {
    try {
      const locationEncoded = encodeURIComponent(searchTerm);
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${locationEncoded}&count=5&language=en&format=json`;

      const response = await fetch(url);
      if (!response.ok) {
        lastError = new Error(`Geocoding failed: ${response.status}`);
        continue;
      }

      const data = await response.json();

      if (!data.results || data.results.length === 0) {
        lastError = new Error(`Location "${searchTerm}" not found`);
        continue;
      }

      // Use first result
      const result = data.results[0];
      console.log(`✓ Geocoded "${searchTerm}" → ${result.name}, ${result.country} (${result.latitude}, ${result.longitude})`);

      return {
        latitude: result.latitude,
        longitude: result.longitude,
        name: result.name,
        country: result.country,
        timezone: result.timezone || 'auto'
      };
    } catch (error) {
      lastError = error;
      continue;
    }
  }

  throw new Error(`Failed to geocode location after trying: ${uniqueSearchTerms.join(', ')}. Last error: ${lastError?.message}`);
}

/**
 * Fetch weather forecast from Open-Meteo API (FREE!)
 * Returns 24-hour forecast with temperature, wind, humidity, and solar radiation
 */
export async function fetchWeatherForecast(latitude, longitude, timezone = 'auto') {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?` +
      `latitude=${latitude}` +
      `&longitude=${longitude}` +
      `&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,shortwave_radiation` +
      `&timezone=${timezone}` +
      `&forecast_days=2`; // Get 2 days for full 24h coverage

    console.log(`🌤️  Fetching weather from Open-Meteo API (FREE!)...`);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Open-Meteo API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.hourly) {
      throw new Error('No hourly forecast data available');
    }

    // Parse hourly data
    const hourlyData = [];
    const currentHour = new Date().getHours();

    for (let i = 0; i < Math.min(48, data.hourly.time.length); i++) {
      const timestamp = data.hourly.time[i];
      const hour = new Date(timestamp).getHours();

      hourlyData.push({
        timestamp,
        hour,
        temperature: data.hourly.temperature_2m[i] || 20, // Celsius
        humidity: data.hourly.relative_humidity_2m[i] || 50, // %
        windSpeed: data.hourly.wind_speed_10m[i] || 0, // m/s
        solarRadiation: data.hourly.shortwave_radiation[i] || 0, // W/m²
      });
    }

    console.log(`✓ Fetched ${hourlyData.length} hours of weather forecast`);
    return hourlyData;

  } catch (error) {
    throw new Error(`Failed to fetch weather data: ${error.message}`);
  }
}

/**
 * Known coordinates for common cities (fallback)
 */
const KNOWN_CITIES = {
  'hyderabad': { latitude: 17.385, longitude: 78.487, name: 'Hyderabad', country: 'India', timezone: 'Asia/Kolkata' },
  'mumbai': { latitude: 19.076, longitude: 72.877, name: 'Mumbai', country: 'India', timezone: 'Asia/Kolkata' },
  'delhi': { latitude: 28.704, longitude: 77.102, name: 'Delhi', country: 'India', timezone: 'Asia/Kolkata' },
  'bangalore': { latitude: 12.972, longitude: 77.594, name: 'Bangalore', country: 'India', timezone: 'Asia/Kolkata' },
  'chennai': { latitude: 13.083, longitude: 80.270, name: 'Chennai', country: 'India', timezone: 'Asia/Kolkata' },
  'lagos': { latitude: 6.524, longitude: 3.379, name: 'Lagos', country: 'Nigeria', timezone: 'Africa/Lagos' },
  'london': { latitude: 51.509, longitude: -0.118, name: 'London', country: 'United Kingdom', timezone: 'Europe/London' },
  'new york': { latitude: 40.713, longitude: -74.006, name: 'New York', country: 'United States', timezone: 'America/New_York' },
  'los angeles': { latitude: 34.052, longitude: -118.244, name: 'Los Angeles', country: 'United States', timezone: 'America/Los_Angeles' },
  'chicago': { latitude: 41.878, longitude: -87.630, name: 'Chicago', country: 'United States', timezone: 'America/Chicago' },
  'houston': { latitude: 29.760, longitude: -95.369, name: 'Houston', country: 'United States', timezone: 'America/Chicago' },
  'dallas': { latitude: 32.776, longitude: -96.797, name: 'Dallas', country: 'United States', timezone: 'America/Chicago' },
};

/**
 * Get weather data for a location
 * Throws error if geocoding fails - caller should handle user interaction
 */
export async function getWeatherForLocation(location) {
  // Try geocoding - throw error if fails
  const coords = await getCoordinatesFromLocation(location);
  console.log(`📍 Location: ${coords.name}, ${coords.country} (${coords.latitude}, ${coords.longitude})`);

  // Get weather forecast
  const forecast = await fetchWeatherForecast(coords.latitude, coords.longitude, coords.timezone);

  return {
    location: coords,
    forecast
  };
}

/**
 * Get fallback coordinates for known cities
 * Returns null if city not in database
 */
export function getFallbackCoordinates(location) {
  const cityKey = location.split(',')[0].trim().toLowerCase();
  return KNOWN_CITIES[cityKey] || null;
}
