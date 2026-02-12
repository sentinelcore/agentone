/**
 * Vercel API Endpoint - Agent Statistics
 *
 * GET /api/stats
 * Returns real-time statistics about active agents
 */

import { createClient } from '@vercel/postgres';

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
    const client = createClient();
    await client.connect();

    // Get active agents (last seen within 30 minutes)
    const activeAgentsResult = await client.sql`
      SELECT COUNT(DISTINCT agent_name) as count
      FROM agent_heartbeat
      WHERE last_seen > NOW() - INTERVAL '30 minutes'
    `;

    // Get total submissions today
    const submissionsResult = await client.sql`
      SELECT COUNT(*) as count
      FROM agent_submissions
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `;

    // Get unique locations
    const locationsResult = await client.sql`
      SELECT DISTINCT location, COUNT(*) as submissions
      FROM agent_submissions
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY location
      ORDER BY submissions DESC
    `;

    // Get recent submissions
    const recentResult = await client.sql`
      SELECT
        agent_name,
        location,
        timestamp,
        cheapest_window,
        price,
        savings,
        created_at
      FROM agent_submissions
      ORDER BY created_at DESC
      LIMIT 20
    `;

    await client.end();

    return new Response(
      JSON.stringify({
        activeAgents: parseInt(activeAgentsResult.rows[0].count),
        totalSubmissions: parseInt(submissionsResult.rows[0].count),
        locations: locationsResult.rows,
        recentSubmissions: recentResult.rows,
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
