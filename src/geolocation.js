/**
 * Geolocation Module
 *
 * Detects user location via IP address using free geolocation API
 */

import fetch from 'node-fetch';

/**
 * Get user location from IP address
 */
export async function getLocation() {
  try {
    // Try ipapi.co first (no API key needed for basic usage)
    const response = await fetch('https://ipapi.co/json/', {
      headers: {
        'User-Agent': 'decharge-scout/1.0'
      },
      timeout: 5000
    });

    if (!response.ok) {
      throw new Error(`ipapi.co returned ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.reason || 'IP geolocation failed');
    }

    // Format location string
    const city = data.city || 'Unknown';
    const region = data.region_code || data.region || '';
    const country = data.country_code || data.country || 'US';

    let location = city;
    if (region) {
      location += `, ${region}`;
    }
    if (country && country !== 'US') {
      location += `, ${country}`;
    } else if (!region) {
      location += ', US';
    }

    return location;
  } catch (error) {
    console.warn(`IP geolocation failed: ${error.message}, trying fallback...`);

    // Fallback to ip-api.com
    try {
      return await getLocationFallback();
    } catch (fallbackError) {
      console.warn(`Fallback geolocation failed: ${fallbackError.message}`);
      return 'Unknown Location, US';
    }
  }
}

/**
 * Fallback geolocation using ip-api.com
 */
async function getLocationFallback() {
  const response = await fetch('http://ip-api.com/json/', {
    timeout: 5000
  });

  if (!response.ok) {
    throw new Error(`ip-api.com returned ${response.status}`);
  }

  const data = await response.json();

  if (data.status !== 'success') {
    throw new Error(data.message || 'Geolocation failed');
  }

  const city = data.city || 'Unknown';
  const region = data.regionName || data.region || '';
  const country = data.countryCode || 'US';

  let location = city;
  if (region) {
    location += `, ${region}`;
  }
  if (country !== 'US') {
    location += `, ${country}`;
  }

  return location;
}

/**
 * Validate location string format
 */
export function validateLocation(location) {
  if (!location || typeof location !== 'string') {
    return false;
  }

  // Basic validation: should have at least one comma or be a single word
  return location.length > 0 && location.length < 100;
}

/**
 * Parse location into components
 */
export function parseLocation(location) {
  const parts = location.split(',').map(s => s.trim());

  return {
    city: parts[0] || 'Unknown',
    region: parts[1] || '',
    country: parts[2] || parts[1] || 'US'
  };
}

/**
 * Get timezone from location (simplified)
 */
export async function getTimezoneForLocation(location) {
  try {
    // For US locations, map common states to timezones
    const stateTimezones = {
      'TX': 'America/Chicago',
      'CA': 'America/Los_Angeles',
      'NY': 'America/New_York',
      'FL': 'America/New_York',
      'IL': 'America/Chicago',
      'PA': 'America/New_York',
      'OH': 'America/New_York',
      'GA': 'America/New_York',
      'NC': 'America/New_York',
      'MI': 'America/Detroit'
    };

    const parsed = parseLocation(location);
    const stateCode = parsed.region;

    if (stateTimezones[stateCode]) {
      return stateTimezones[stateCode];
    }

    // Default to UTC if unknown
    return 'UTC';
  } catch (error) {
    return 'UTC';
  }
}
