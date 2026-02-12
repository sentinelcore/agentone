/**
 * Vercel API Endpoint - Agent Statistics
 *
 * GET /api/stats
 * Returns real-time statistics about active agents from Supabase
 */

import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers }
    );
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Calculate time thresholds
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Get active agents (last seen within 30 minutes)
    const { data: activeAgents, error: activeError } = await supabase
      .from('agent_heartbeat')
      .select('agent_name', { count: 'exact', head: false })
      .gt('last_seen', thirtyMinutesAgo);

    if (activeError) throw activeError;

    // Get total submissions in last 24 hours
    const { count: submissionCount, error: submissionError } = await supabase
      .from('agent_submissions')
      .select('*', { count: 'exact', head: true })
      .gt('created_at', twentyFourHoursAgo);

    if (submissionError) throw submissionError;

    // Get unique locations with submission counts
    const { data: locationsData, error: locationsError } = await supabase
      .from('agent_submissions')
      .select('location')
      .gt('created_at', twentyFourHoursAgo);

    if (locationsError) throw locationsError;

    // Aggregate locations manually
    const locationMap = {};
    locationsData.forEach(row => {
      locationMap[row.location] = (locationMap[row.location] || 0) + 1;
    });
    const locations = Object.entries(locationMap)
      .map(([location, submissions]) => ({ location, submissions }))
      .sort((a, b) => b.submissions - a.submissions);

    // Get recent submissions
    const { data: recentSubmissions, error: recentError } = await supabase
      .from('agent_submissions')
      .select('agent_name, location, timestamp, cheapest_window, price, savings, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    if (recentError) throw recentError;

    return new Response(
      JSON.stringify({
        activeAgents: new Set(activeAgents.map(a => a.agent_name)).size,
        totalSubmissions: submissionCount || 0,
        locations: locations,
        recentSubmissions: recentSubmissions,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Stats error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }),
      { status: 500, headers }
    );
  }
}
