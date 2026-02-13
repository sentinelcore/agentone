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
 */
export async function getCoordinatesFromLocation(location) {
  try {
    const locationEncoded = encodeURIComponent(location);
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${locationEncoded}&count=1&language=en&format=json`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      throw new Error('Location not found');
    }

    const result = data.results[0];
    return {
      latitude: result.latitude,
      longitude: result.longitude,
      name: result.name,
      country: result.country,
      timezone: result.timezone || 'UTC'
    };
  } catch (error) {
    throw new Error(`Failed to geocode location: ${error.message}`);
  }
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
 * Get weather data for a location
 */
export async function getWeatherForLocation(location) {
  try {
    // Get coordinates
    const coords = await getCoordinatesFromLocation(location);
    console.log(`📍 Location: ${coords.name}, ${coords.country} (${coords.latitude}, ${coords.longitude})`);

    // Get weather forecast
    const forecast = await fetchWeatherForecast(coords.latitude, coords.longitude, coords.timezone);

    return {
      location: coords,
      forecast
    };
  } catch (error) {
    throw new Error(`Failed to get weather for location: ${error.message}`);
  }
}
