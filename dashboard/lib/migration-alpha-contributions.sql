-- DeCharge Scout Dashboard - Alpha Contributions Migration
-- Add this to your Supabase database to support verified local alpha contributions

-- ============================================================================
-- TABLE: alpha_contributions
-- Stores verified local knowledge contributions from agents
-- ============================================================================
CREATE TABLE IF NOT EXISTS alpha_contributions (
  id SERIAL PRIMARY KEY,
  agent_name VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  contribution_type VARCHAR(20) NOT NULL CHECK (contribution_type IN ('peak', 'cheap', 'general')),
  start_hour INTEGER NOT NULL CHECK (start_hour >= 0 AND start_hour <= 23),
  end_hour INTEGER NOT NULL CHECK (end_hour >= 0 AND end_hour <= 23),

  -- Verification fields
  verified BOOLEAN DEFAULT FALSE,
  confidence DECIMAL(4, 3) CHECK (confidence >= 0 AND confidence <= 1),
  verification_reasons TEXT[],

  -- Metadata
  timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),

  -- Indexes for performance
  CONSTRAINT valid_hour_range CHECK (start_hour <= end_hour)
);

-- Indexes for efficient querying
CREATE INDEX idx_alpha_location ON alpha_contributions(location);
CREATE INDEX idx_alpha_verified ON alpha_contributions(verified);
CREATE INDEX idx_alpha_confidence ON alpha_contributions(confidence DESC);
CREATE INDEX idx_alpha_created_at ON alpha_contributions(created_at DESC);
CREATE INDEX idx_alpha_type ON alpha_contributions(contribution_type);

-- ============================================================================
-- VIEW: Verified Alpha Contributions (high confidence only)
-- ============================================================================
CREATE OR REPLACE VIEW verified_alpha_contributions AS
SELECT
  id,
  agent_name,
  location,
  contribution_type,
  start_hour,
  end_hour,
  confidence,
  verification_reasons,
  timestamp,
  created_at
FROM alpha_contributions
WHERE verified = TRUE AND confidence >= 0.6
ORDER BY confidence DESC, created_at DESC;

-- ============================================================================
-- VIEW: Alpha Contributions Summary by Location
-- ============================================================================
CREATE OR REPLACE VIEW alpha_by_location AS
SELECT
  location,
  COUNT(*) as total_contributions,
  COUNT(CASE WHEN verified = TRUE THEN 1 END) as verified_count,
  AVG(confidence) as avg_confidence,
  MAX(created_at) as latest_contribution
FROM alpha_contributions
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY location
ORDER BY verified_count DESC, total_contributions DESC;

-- ============================================================================
-- VIEW: Peak Hours Analysis (most commonly reported)
-- ============================================================================
CREATE OR REPLACE VIEW peak_hours_analysis AS
WITH hour_counts AS (
  SELECT
    location,
    generate_series(start_hour, end_hour) as hour,
    confidence,
    contribution_type
  FROM alpha_contributions
  WHERE contribution_type = 'peak'
    AND verified = TRUE
    AND created_at > NOW() - INTERVAL '30 days'
)
SELECT
  location,
  hour,
  COUNT(*) as report_count,
  AVG(confidence) as avg_confidence,
  COUNT(*) * AVG(confidence) as weighted_score
FROM hour_counts
GROUP BY location, hour
HAVING COUNT(*) >= 2  -- At least 2 reports
ORDER BY location, weighted_score DESC;

-- ============================================================================
-- FUNCTION: Get Alpha Insights for Location
-- ============================================================================
CREATE OR REPLACE FUNCTION get_alpha_insights(
  p_location VARCHAR(255),
  p_min_confidence DECIMAL DEFAULT 0.6
)
RETURNS TABLE (
  contribution_type VARCHAR(20),
  start_hour INTEGER,
  end_hour INTEGER,
  confidence DECIMAL(4, 3),
  report_count BIGINT,
  latest_report TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ac.contribution_type,
    ac.start_hour,
    ac.end_hour,
    AVG(ac.confidence)::DECIMAL(4, 3) as confidence,
    COUNT(*) as report_count,
    MAX(ac.created_at) as latest_report
  FROM alpha_contributions ac
  WHERE ac.location ILIKE '%' || p_location || '%'
    AND ac.verified = TRUE
    AND ac.confidence >= p_min_confidence
    AND ac.created_at > NOW() - INTERVAL '30 days'
  GROUP BY ac.contribution_type, ac.start_hour, ac.end_hour
  ORDER BY report_count DESC, confidence DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Calculate Contribution Quality Score
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_contribution_quality(
  p_agent_name VARCHAR(255)
)
RETURNS TABLE (
  agent_name VARCHAR(255),
  total_contributions BIGINT,
  verified_contributions BIGINT,
  avg_confidence DECIMAL(4, 3),
  quality_score DECIMAL(6, 2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p_agent_name::VARCHAR(255),
    COUNT(*)::BIGINT as total_contributions,
    COUNT(CASE WHEN verified = TRUE THEN 1 END)::BIGINT as verified_contributions,
    AVG(confidence)::DECIMAL(4, 3) as avg_confidence,
    (
      (COUNT(CASE WHEN verified = TRUE THEN 1 END)::DECIMAL / NULLIF(COUNT(*), 0)) * 100 +
      (AVG(confidence) * 100)
    )::DECIMAL(6, 2) as quality_score
  FROM alpha_contributions
  WHERE agent_name = p_agent_name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS for documentation
-- ============================================================================
COMMENT ON TABLE alpha_contributions IS 'Stores verified local energy pricing knowledge from agents';
COMMENT ON COLUMN alpha_contributions.verified IS 'TRUE if contribution matches actual pricing data';
COMMENT ON COLUMN alpha_contributions.confidence IS 'Confidence score 0-1, higher means better match with actual data';
COMMENT ON COLUMN alpha_contributions.verification_reasons IS 'Array of reasons explaining verification result';

-- ============================================================================
-- Sample queries for testing
-- ============================================================================

-- Get all verified contributions for a location
-- SELECT * FROM verified_alpha_contributions WHERE location ILIKE '%mumbai%';

-- Get alpha insights for a specific location
-- SELECT * FROM get_alpha_insights('Mumbai', 0.7);

-- Get contribution quality for an agent
-- SELECT * FROM calculate_contribution_quality('Agent-X8DOAO');

-- Get peak hours analysis
-- SELECT * FROM peak_hours_analysis WHERE location ILIKE '%india%';

-- Get alpha summary by location
-- SELECT * FROM alpha_by_location ORDER BY verified_count DESC LIMIT 10;
