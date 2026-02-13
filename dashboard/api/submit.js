/**
 * Vercel API Endpoint - Agent Data Submission
 *
 * POST /api/submit
 * Receives agent data submissions and stores them in Supabase
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

    // Validate required fields
    if (!data.agent_name || !data.location || !data.timestamp || !data.results) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Insert submission
    const { error: submissionError } = await supabase
      .from('agent_submissions')
      .insert({
        agent_name: data.agent_name,
        location: data.location,
        timestamp: new Date(data.timestamp).toISOString(),
        cheapest_window: data.results.cheapest_window,
        price: data.results.price,
        savings: data.results.savings,
        data_points: data.results.data_points,
      });

    if (submissionError) throw submissionError;

    // Handle alpha contribution if present
    if (data.alpha_contribution) {
      const alpha = data.alpha_contribution;
      const { error: alphaError } = await supabase
        .from('alpha_contributions')
        .insert({
          agent_name: data.agent_name,
          location: data.location,
          contribution_type: alpha.type,
          start_hour: alpha.startHour,
          end_hour: alpha.endHour,
          verified: alpha.verified || false,
          confidence: alpha.confidence || 0.5,
          verification_reasons: alpha.verificationReasons || [],
          timestamp: new Date(data.timestamp).toISOString(),
        });

      // Don't fail the entire request if alpha submission fails
      if (alphaError) {
        console.warn('Alpha contribution failed:', alphaError);
      }
    }

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
