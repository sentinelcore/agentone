/**
 * Vercel API Endpoint - Alpha Contributions
 *
 * GET /api/alpha - Get verified alpha contributions
 * POST /api/alpha - Submit new alpha contribution
 */

import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  // Initialize Supabase client
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  // GET - Retrieve alpha contributions
  if (req.method === 'GET') {
    try {
      const url = new URL(req.url);
      const location = url.searchParams.get('location');
      const verified = url.searchParams.get('verified') === 'true';
      const minConfidence = parseFloat(url.searchParams.get('min_confidence') || '0');

      let query = supabase
        .from('alpha_contributions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      // Apply filters
      if (location) {
        query = query.ilike('location', `%${location}%`);
      }

      if (verified) {
        query = query.eq('verified', true);
      }

      if (minConfidence > 0) {
        query = query.gte('confidence', minConfidence);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Get statistics
      const { data: stats } = await supabase
        .from('alpha_by_location')
        .select('*')
        .order('verified_count', { ascending: false })
        .limit(10);

      return new Response(
        JSON.stringify({
          contributions: data || [],
          statistics: stats || [],
          total: data?.length || 0,
          timestamp: new Date().toISOString(),
        }),
        { status: 200, headers }
      );
    } catch (error) {
      console.error('Alpha GET error:', error);
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch alpha contributions',
          message: error.message,
        }),
        { status: 500, headers }
      );
    }
  }

  // POST - Submit alpha contribution
  if (req.method === 'POST') {
    try {
      const data = await req.json();

      // Validate required fields
      if (!data.agent_name || !data.location || !data.contribution) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields' }),
          { status: 400, headers }
        );
      }

      const { contribution } = data;

      // Validate contribution structure
      if (
        typeof contribution.startHour !== 'number' ||
        typeof contribution.endHour !== 'number' ||
        !contribution.type ||
        contribution.startHour < 0 ||
        contribution.startHour > 23 ||
        contribution.endHour < 0 ||
        contribution.endHour > 23
      ) {
        return new Response(
          JSON.stringify({ error: 'Invalid contribution data' }),
          { status: 400, headers }
        );
      }

      // Insert alpha contribution
      const { data: insertedData, error: insertError } = await supabase
        .from('alpha_contributions')
        .insert({
          agent_name: data.agent_name,
          location: data.location,
          contribution_type: contribution.type,
          start_hour: contribution.startHour,
          end_hour: contribution.endHour,
          verified: data.verified || false,
          confidence: data.confidence || 0.5,
          verification_reasons: data.verificationReasons || [],
          timestamp: new Date(data.timestamp || Date.now()).toISOString(),
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Alpha contribution submitted successfully',
          contribution: insertedData,
        }),
        { status: 200, headers }
      );
    } catch (error) {
      console.error('Alpha POST error:', error);
      return new Response(
        JSON.stringify({
          error: 'Failed to submit alpha contribution',
          message: error.message,
        }),
        { status: 500, headers }
      );
    }
  }

  return new Response(
    JSON.stringify({ error: 'Method not allowed' }),
    { status: 405, headers }
  );
}
