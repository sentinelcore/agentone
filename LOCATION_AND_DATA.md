# Location Detection & Energy Data Sources

This document explains how DeCharge Scout determines location and fetches energy data.

## 📍 How Location Detection Works

### Automatic Detection (Default)

When you run `npx decharge-scout`, the CLI automatically detects your location using IP-based geolocation:

1. **Primary Service**: [ipapi.co](https://ipapi.co)
   - Free API, no key needed
   - Provides city, region, and country
   - Timeout: 5 seconds

2. **Fallback Service**: [ip-api.com](http://ip-api.com)
   - Used if ipapi.co fails
   - Also free, no authentication required

3. **Format**: Location is formatted as: `City, State/Region, Country`
   - Example: `Austin, TX, US`
   - Example: `London, England, UK`

### Manual Override

You can override automatic detection:

```bash
npx decharge-scout --location "San Francisco, CA, US"
```

This is useful for:
- Testing different locations
- Running from a VPN or cloud server
- Specifying exact location when IP detection is inaccurate

### Code Reference

See `src/geolocation.js`:
- `getLocation()` - Main function for IP-based detection (lines 12-59)
- `getLocationFallback()` - Backup using ip-api.com (lines 64-92)
- `parseLocation()` - Parses location string into components (lines 109-117)

## ⚡ How Energy Data is Fetched

### Current Implementation

**Important Note**: Currently, EIA data is hardcoded to **ERCOT (Texas)** regardless of your detected location.

### EIA API (Primary Source)

The CLI fetches real-time energy grid data from the [U.S. Energy Information Administration (EIA)](https://www.eia.gov/opendata/).

**Configuration Required**:
```bash
# In .env file
EIA_API_KEY=your_eia_api_key_here
```

**Data Retrieved**:
- Region: ERCOT (Electric Reliability Council of Texas)
- Type: Demand data (hourly)
- Time Range: Last 24 hours to forecast next 24 hours
- Endpoint: `/electricity/rto/region-data/data/`

**Code**: See `src/energy-data.js:18-83`

**Query Parameters**:
```javascript
frequency=hourly
data[0]=value
facets[respondent][]=ERCT  // ← ERCOT region
facets[type][]=D            // ← Demand type
start=${startDate}
end=${endDate}
```

**Why ERCOT?**
- Texas has a deregulated energy market
- Wholesale prices vary significantly by hour
- Real-time demand data publicly available
- Good demonstration of price optimization

### Electricity Maps (Fallback)

If EIA fails, the CLI tries [Electricity Maps](https://www.electricitymaps.com/):

**Endpoint**: `https://api.electricitymaps.com/v3/power-breakdown/latest?zone=US-TEX-ERCO`

**Note**: This also queries ERCOT specifically.

**Code**: See `src/energy-data.js:88-140`

### Mock Data (Last Resort)

If both APIs fail, mock forecast data is generated with realistic patterns:

- **Off-Peak Hours** (10 PM - 6 AM): $0.03-0.05/kWh
- **Peak Hours** (4 PM - 8 PM): $0.09-0.12/kWh
- **Normal Hours**: $0.05-0.07/kWh

**Code**: See `src/energy-data.js:145-180`

## 🔄 Flow Diagram

```
┌─────────────────┐
│  Start CLI      │
└────────┬────────┘
         ↓
┌─────────────────┐
│ Detect Location │ ← ipapi.co / ip-api.com
│ (Auto or Manual)│
└────────┬────────┘
         ↓
┌─────────────────┐
│ Fetch Energy    │
│ Data            │
└────────┬────────┘
         ↓
    ┌────┴────┐
    ↓         ↓         ↓
 [EIA]   [ElecMaps]  [Mock]
    ↓         ↓         ↓
    └────┬────┘
         ↓
┌─────────────────┐
│ Find Cheapest   │
│ Charging Window │
└────────┬────────┘
         ↓
┌─────────────────┐
│ Submit to       │
│ Oracle          │
└─────────────────┘
```

## ❓ Why Doesn't Location Affect Data Source?

### Current Limitation

The current implementation is **U.S.-centric** and specifically targets the **Texas ERCOT** grid:

1. **Location Detection**: Uses IP to get your city/state/country
2. **Data Source**: Always queries ERCOT regardless of location
3. **Oracle Submission**: Includes your actual location in metadata

### Why This Matters

- **If you're in Texas**: Perfect! You get real data for your region
- **If you're elsewhere**: You still get real ERCOT data, but it doesn't match your local grid prices

### Future Enhancement Ideas

To make it truly location-aware:

1. **Map Location to Grid Region**:
   ```javascript
   const REGION_MAPPING = {
     'TX': 'ERCT',  // ERCOT
     'CA': 'CISO',  // California ISO
     'NY': 'NYIS',  // New York ISO
     'PJM': ['PA', 'NJ', 'MD', 'DE', 'OH', 'IL', ...],
     // etc.
   };
   ```

2. **Update EIA Query**:
   ```javascript
   // In src/energy-data.js
   const location = parseLocation(userLocation);
   const region = mapStateToGridRegion(location.region);

   const url = `${EIA_BASE_URL}/electricity/rto/region-data/data/?` +
     `facets[respondent][]=${region}` +  // ← Dynamic region
     // ... rest of params
   ```

3. **International Support**:
   - Add APIs for EU grids (ENTSO-E)
   - UK grids (National Grid ESO)
   - Australia (AEMO)

## 🛠️ How to Get EIA API Key

1. Visit: https://www.eia.gov/opendata/register.php
2. Fill out registration form (free)
3. Check your email for API key
4. Add to `.env` file:
   ```bash
   EIA_API_KEY=your_key_here
   ```

## 🌍 Supported Regions (Current)

| Region | ISO | Supported | Data Source |
|--------|-----|-----------|-------------|
| Texas (ERCOT) | ERCT | ✅ Yes | EIA API |
| California (CAISO) | CISO | ❌ No | Future |
| New York (NYISO) | NYIS | ❌ No | Future |
| PJM Interconnection | PJM | ❌ No | Future |
| International | - | ❌ No | Future |

## 📝 Summary

**Question**: *How does the CLI know the address/city to get EIA data from?*

**Answer**:
1. **Location Detection**: CLI detects your location via IP geolocation (ipapi.co)
2. **Data Source**: Currently **ignores** your location and always queries ERCOT (Texas)
3. **Location Usage**: Your detected location is only used for:
   - Display in CLI output
   - Metadata in oracle submissions
   - Dashboard analytics (showing where agents are running)

The EIA data query is hardcoded to ERCOT. To make it location-aware, you'd need to:
- Map detected location → grid region
- Update `src/energy-data.js` to use dynamic region selection
- Handle regions not supported by EIA (use different APIs)

## 🔮 Next Steps

If you want to make this truly location-aware:

1. Create region mapping in `src/geolocation.js`
2. Update `fetchEnergyData()` to accept location parameter
3. Add support for multiple grid regions
4. Consider international energy APIs for non-U.S. locations

Would you like help implementing location-aware energy data fetching?
