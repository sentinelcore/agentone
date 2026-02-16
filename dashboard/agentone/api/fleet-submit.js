/**
 * Vercel API Endpoint - Fleet Data Submission
 *
 * POST /agentone/api/fleet-submit
 * Receives fleet optimization data and stores it in Supabase
 */

import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers }
    );
  }

  try {
    const data = await req.json();

    // Validate required fields for fleet submissions
    if (!data.type || data.type !== 'fleet') {
      return new Response(
        JSON.stringify({ error: 'Invalid submission type. Expected "fleet"' }),
        { status: 400, headers }
      );
    }

    if (!data.agent_name || !data.location || !data.timestamp || !data.fleet_size || !data.summary) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields for fleet submission' }),
        { status: 400, headers }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Insert fleet submission
    const { error: fleetError } = await supabase
      .from('fleet_submissions')
      .insert({
        agent_name: data.agent_name,
        wallet: data.wallet,
        location: data.location,
        timestamp: new Date(data.timestamp).toISOString(),
        fleet_size: data.fleet_size,
        total_distance_km: data.summary.total_distance_km,
        total_cost_usd: data.summary.total_cost_usd,
        savings_percent: data.summary.savings_percent,
        co2_saved_kg: data.summary.co2_saved_kg,
        duration_hours: data.summary.duration_hours,
        route_geojson: data.route,
        stops: data.stops,
        simulation_basis: data.simulation_basis || 'weather-based simulation',
      });

    if (fleetError) throw fleetError;

    // Update agent heartbeat (upsert)
    const { error: heartbeatError } = await supabase
      .from('agent_heartbeat')
      .upsert(
        {
          agent_name: data.agent_name,
          location: data.location,
          last_seen: new Date().toISOString(),
        },
        { onConflict: 'agent_name' }
      );

    if (heartbeatError) throw heartbeatError;

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Fleet data submitted successfully',
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Fleet submission error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }),
      { status: 500, headers }
    );
  }
}
