# Fleet Submission Troubleshooting Guide

## Issue: `npx decharge-scout@latest fleet` not saving to Supabase

### Quick Checklist

Run through these steps to fix the issue:

### ✅ Step 1: Deploy to Vercel

The `fleet-submit.js` API endpoint was just created and needs to be deployed:

```bash
cd dashboard
vercel --prod
```

**Why?** The new API endpoint only exists locally, not on the live server yet.

### ✅ Step 2: Create Supabase Table

Run the SQL schema in your Supabase dashboard:

1. Go to Supabase Dashboard → SQL Editor
2. Run this SQL:

```sql
-- Table: fleet_submissions
-- Stores fleet optimization submissions
CREATE TABLE IF NOT EXISTS fleet_submissions (
  id SERIAL PRIMARY KEY,
  agent_name VARCHAR(255) NOT NULL,
  wallet VARCHAR(255),
  location VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  fleet_size INTEGER NOT NULL,
  total_distance_km INTEGER NOT NULL,
  total_cost_usd DECIMAL(10, 2) NOT NULL,
  savings_percent INTEGER NOT NULL,
  co2_saved_kg INTEGER NOT NULL,
  duration_hours INTEGER NOT NULL,
  route_geojson JSONB,
  stops JSONB,
  simulation_basis VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fleet queries
CREATE INDEX IF NOT EXISTS idx_fleet_created_at ON fleet_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fleet_agent ON fleet_submissions(agent_name);
CREATE INDEX IF NOT EXISTS idx_fleet_location ON fleet_submissions(location);

-- View: Fleet stats (last 24h)
CREATE OR REPLACE VIEW fleet_stats_daily AS
SELECT
  COUNT(*) as total_fleets,
  SUM(fleet_size) as total_vehicles,
  SUM(total_distance_km) as total_distance,
  AVG(savings_percent) as avg_savings,
  SUM(co2_saved_kg) as total_co2_saved
FROM fleet_submissions
WHERE created_at > NOW() - INTERVAL '24 hours';
```

**Why?** The table doesn't exist in your database yet.

### ✅ Step 3: Verify Vercel Environment Variables

Check that these are set in Vercel:

```bash
vercel env ls
```

Required variables:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

If missing, add them:

```bash
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
```

### ✅ Step 4: Test the Fleet Command

After deploying and creating the table:

```bash
npx decharge-scout@latest fleet --from="New York" --to="Boston" --evs=10
```

Watch for:
- ✅ "✓ Submitted to AgentOne dashboard" = SUCCESS
- ⚠️  "Dashboard API returned: 404" = Not deployed yet
- ⚠️  "Dashboard API returned: 500" = Table doesn't exist or env vars missing

### ✅ Step 5: Verify Data in Supabase

Check if data was saved:

1. Go to Supabase Dashboard → Table Editor
2. Open `fleet_submissions` table
3. Look for recent entries

## Common Errors & Solutions

### Error: "Dashboard API returned: 404"
**Cause:** API endpoint not deployed
**Fix:** Run `vercel --prod` in dashboard directory

### Error: "Dashboard API returned: 500"
**Cause:** Table doesn't exist or env vars missing
**Fix:**
1. Run the SQL schema in Supabase
2. Check `vercel env ls` for SUPABASE_URL and SUPABASE_ANON_KEY

### Error: "relation 'fleet_submissions' does not exist"
**Cause:** Table not created in Supabase
**Fix:** Run the SQL schema above

### Success Message but No Data
**Cause:** Wrong Supabase project or credentials
**Fix:** Verify SUPABASE_URL matches your project

## Debug Mode

To see detailed API responses, check Vercel logs:

```bash
vercel logs --follow
```

Run fleet command in another terminal and watch for errors.

## Data Structure Being Sent

The fleet command sends this JSON structure:

```json
{
  "type": "fleet",
  "agent_name": "YourAgent",
  "wallet": "YourWallet",
  "location": "New York → Boston",
  "timestamp": 1234567890,
  "fleet_size": 10,
  "route": {
    "type": "LineString",
    "coordinates": [[lng, lat], [lng, lat]]
  },
  "stops": [
    {
      "lat": 40.7128,
      "lon": -74.0060,
      "time": "3AM-4AM",
      "price": 0.025,
      "savings": 80,
      "location": "Location Name",
      "segmentId": 1
    }
  ],
  "summary": {
    "total_distance_km": 350,
    "total_cost_usd": 150.00,
    "savings_percent": 78,
    "co2_saved_kg": 45,
    "duration_hours": 4
  },
  "simulation_basis": "Task1 simulation + OSRM routing"
}
```

## API Endpoint Location

- **File:** `dashboard/api/agentone/fleet-submit.js`
- **URL:** `https://decharge-scout.vercel.app/api/agentone/fleet-submit`
- **Route Config:** `dashboard/vercel.json`

## Still Not Working?

1. Check Vercel deployment logs
2. Check Supabase table structure matches schema
3. Try the regular submit command to verify basic setup: `npm start`
4. Check browser console at https://decharge-scout.vercel.app/agentone for errors
