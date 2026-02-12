# DeCharge Scout Dashboard

Real-time analytics dashboard for tracking DeCharge Scout agents worldwide.

## Features

- **Real-time Agent Tracking** - See how many agents are currently running
- **Location Analytics** - View agent distribution across different locations
- **Submission History** - Track all oracle submissions with prices and savings
- **Live Updates** - Dashboard auto-refreshes every 30 seconds

## Deployment to Vercel

### Prerequisites

1. [Vercel Account](https://vercel.com/signup)
2. [Vercel CLI](https://vercel.com/cli) installed: `npm i -g vercel`

### Step 1: Set Up Vercel Postgres Database

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Create a new project or select existing one
3. Go to "Storage" tab
4. Click "Create Database" → Select "Postgres"
5. Name it (e.g., `decharge-scout-db`)
6. Wait for provisioning to complete

### Step 2: Initialize Database Schema

1. In your Vercel Postgres dashboard, click "Query" tab
2. Copy and paste the contents of `lib/schema.sql`
3. Click "Run Query" to create tables and views

### Step 3: Deploy Dashboard

```bash
cd dashboard
npm install
vercel
```

Follow the prompts:
- **Set up and deploy?** → Yes
- **Which scope?** → Your account
- **Link to existing project?** → No (unless you already created one)
- **What's your project's name?** → `decharge-scout-dashboard`
- **In which directory is your code located?** → `./`

### Step 4: Link Postgres to Project

```bash
vercel env pull
```

This will create a `.env.local` file with your `POSTGRES_URL` automatically.

### Step 5: Deploy to Production

```bash
vercel --prod
```

Your dashboard will be live at: `https://decharge-scout-dashboard.vercel.app`

## Update CLI to Use Dashboard

After deploying, update your `.env` file in the CLI project:

```bash
DASHBOARD_API_URL=https://your-dashboard-url.vercel.app/api/submit
```

## API Endpoints

### POST `/api/submit`

Submit agent data to the dashboard.

**Request Body:**
```json
{
  "agent_name": "Agent-ABC123",
  "location": "Austin, TX, US",
  "timestamp": 1234567890000,
  "results": {
    "cheapest_window": "5AM-6AM",
    "price": 0.0338,
    "savings": 71.7,
    "data_points": 24
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Data submitted successfully"
}
```

### GET `/api/stats`

Get real-time statistics about agents.

**Response:**
```json
{
  "activeAgents": 5,
  "totalSubmissions": 127,
  "locations": [
    {
      "location": "Austin, TX, US",
      "submissions": 45
    }
  ],
  "recentSubmissions": [...],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Local Development

```bash
npm install
npm run dev
```

Visit http://localhost:3000 to see the dashboard.

## Database Schema

### Tables

- **agent_heartbeat** - Tracks active agents (updated every submission)
- **agent_submissions** - Stores all oracle submissions with full data

### Views

- **active_agents_hourly** - Agents active in the last hour
- **submissions_by_location** - Aggregated stats by location
- **hourly_submission_counts** - Time series of submissions

## Troubleshooting

**Error: "Internal server error"**
- Check that `POSTGRES_URL` is configured in Vercel environment variables
- Verify database tables are created using `lib/schema.sql`

**No data showing**
- Ensure CLI is configured with `DASHBOARD_API_URL` in `.env`
- Check API endpoint is accessible: `curl https://your-url.vercel.app/api/stats`
- Verify agents are running and submitting data

**CORS errors**
- API endpoints include `Access-Control-Allow-Origin: *` headers
- If issues persist, check Vercel logs: `vercel logs`

## Architecture

```
┌─────────────┐
│ CLI Agents  │ → POST /api/submit → ┌──────────────┐
│  (Multiple) │                      │  Vercel Edge │
└─────────────┘                      │   Functions  │
                                     └───────┬──────┘
                                             ↓
┌─────────────┐                      ┌──────────────┐
│  Dashboard  │ ← GET /api/stats ←   │   Postgres   │
│   (Admin)   │                      │   Database   │
└─────────────┘                      └──────────────┘
```

## License

MIT
