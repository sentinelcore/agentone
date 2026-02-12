/**
 * Vercel API Endpoint - Agent Data Submission
 *
 * POST /api/submit
 * Receives agent data submissions and stores them in the database
 */

import { createClient } from '@vercel/postgres';

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

    // Validate required fields
    if (!data.agent_name || !data.location || !data.timestamp || !data.results) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers }
      );
    }

    // Connect to database
    const client = createClient();
    await client.connect();

    // Insert submission
    await client.sql`
      INSERT INTO agent_submissions (
        agent_name,
        location,
        timestamp,
        cheapest_window,
        price,
        savings,
        data_points,
        created_at
      ) VALUES (
        ${data.agent_name},
        ${data.location},
        ${new Date(data.timestamp)},
        ${data.results.cheapest_window},
        ${data.results.price},
        ${data.results.savings},
        ${data.results.data_points},
        NOW()
      )
    `;

    // Update agent heartbeat
    await client.sql`
      INSERT INTO agent_heartbeat (agent_name, location, last_seen)
      VALUES (${data.agent_name}, ${data.location}, NOW())
      ON CONFLICT (agent_name)
      DO UPDATE SET location = ${data.location}, last_seen = NOW()
    `;

    await client.end();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Data submitted successfully',
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Submission error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }),
      { status: 500, headers }
    );
  }
}
