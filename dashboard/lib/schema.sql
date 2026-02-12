-- DeCharge Scout Dashboard Database Schema
-- Use this to initialize your Supabase Postgres database

-- Table: agent_heartbeat
-- Tracks which agents are currently active
CREATE TABLE IF NOT EXISTS agent_heartbeat (
  agent_name VARCHAR(255) PRIMARY KEY,
  location VARCHAR(255) NOT NULL,
  last_seen TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for querying active agents
CREATE INDEX idx_heartbeat_last_seen ON agent_heartbeat(last_seen DESC);

-- Table: agent_submissions
-- Stores all data submissions from agents
CREATE TABLE IF NOT EXISTS agent_submissions (
  id SERIAL PRIMARY KEY,
  agent_name VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  cheapest_window VARCHAR(50) NOT NULL,
  price DECIMAL(10, 6) NOT NULL,
  savings DECIMAL(5, 2) NOT NULL,
  data_points INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX idx_submissions_created_at ON agent_submissions(created_at DESC);
CREATE INDEX idx_submissions_agent ON agent_submissions(agent_name);
CREATE INDEX idx_submissions_location ON agent_submissions(location);

-- View: Active agents in the last hour
CREATE OR REPLACE VIEW active_agents_hourly AS
SELECT
  agent_name,
  location,
  last_seen,
  EXTRACT(EPOCH FROM (NOW() - last_seen)) / 60 as minutes_ago
FROM agent_heartbeat
WHERE last_seen > NOW() - INTERVAL '1 hour'
ORDER BY last_seen DESC;

-- View: Submissions summary by location (last 24h)
CREATE OR REPLACE VIEW submissions_by_location AS
SELECT
  location,
  COUNT(*) as total_submissions,
  AVG(price) as avg_price,
  AVG(savings) as avg_savings,
  MAX(created_at) as latest_submission
FROM agent_submissions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY location
ORDER BY total_submissions DESC;

-- View: Hourly submission counts (last 24h)
CREATE OR REPLACE VIEW hourly_submission_counts AS
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as submissions
FROM agent_submissions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;
