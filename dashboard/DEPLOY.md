# Deploy Dashboard to Existing Vercel Project

## 📦 What to Deploy

Deploy these files from the `dashboard/` folder:

```
dashboard/
├── api/
│   ├── submit.js          # Agent data submission endpoint
│   └── stats.js           # Analytics endpoint
├── lib/
│   └── schema.sql         # Database schema (for setup)
├── public/
│   └── index.html         # Admin dashboard UI
├── package.json           # Dependencies
└── vercel.json            # Vercel configuration
```

## 🚀 Deployment Steps

### Option 1: Deploy via Vercel CLI (Recommended)

```bash
# 1. Install Vercel CLI if you haven't
npm install -g vercel

# 2. Navigate to dashboard folder
cd dashboard

# 3. Link to your existing Vercel project
vercel link

# Follow prompts:
# - Select your Vercel account
# - Link to existing project? → YES
# - What's the name of your existing project? → [your-project-name]

# 4. Deploy to production
vercel --prod

# That's it! Your dashboard will be live at your existing domain
```

### Option 2: Deploy via Vercel Dashboard (Web UI)

```bash
# 1. Push these files to your GitHub repo (already done!)

# 2. Go to https://vercel.com/dashboard

# 3. Select your existing project

# 4. Go to Settings → Git → Root Directory
#    Set to: dashboard/

# 5. Go to Deployments → Redeploy
#    Or push to your main branch to trigger auto-deploy
```

### Option 3: Manual Upload

```bash
# 1. Create a zip of dashboard folder
cd ..
zip -r dashboard.zip dashboard/

# 2. Go to https://vercel.com/dashboard
# 3. Select your project → Deployments → Upload
# 4. Upload dashboard.zip
```

## 🗄️ Database Setup (Required!)

After deploying, set up the database:

### Step 1: Create Postgres Database

```bash
# Go to your Vercel project:
https://vercel.com/dashboard → Your Project

# Click "Storage" tab → "Create Database"
# Select "Postgres"
# Name: dechargescout-db
# Region: Choose closest to you
# Click "Create"
```

### Step 2: Run Database Schema

```bash
# Option A: Via Vercel Dashboard
# 1. In Postgres dashboard, click "Query" tab
# 2. Copy contents of dashboard/lib/schema.sql
# 3. Paste and click "Run Query"

# Option B: Via Vercel CLI
vercel env pull .env.local
# Then use any Postgres client with the POSTGRES_URL
```

### Step 3: Verify Environment Variables

```bash
# Check that POSTGRES_URL is set:
vercel env ls

# Should show:
# POSTGRES_URL (Production, Preview, Development)

# If not, it will be auto-linked when you create the database
```

## 🔧 Configuration

### Update CLI to Use Dashboard

After deploying, update your CLI `.env` file:

```bash
# In agentone/.env
DASHBOARD_API_URL=https://your-vercel-domain.vercel.app/api/submit
```

Replace `your-vercel-domain.vercel.app` with your actual Vercel domain.

## ✅ Test Your Deployment

### Test 1: Check API Endpoints

```bash
# Test stats endpoint
curl https://your-domain.vercel.app/api/stats

# Should return JSON with:
# {"activeAgents":0,"totalSubmissions":0,...}
```

### Test 2: View Dashboard

```bash
# Open in browser:
https://your-domain.vercel.app

# Should see:
# - Beautiful dashboard UI
# - Stats cards (will be 0 until agents submit data)
```

### Test 3: Submit Data

```bash
# Run the CLI with dashboard configured
cd ..
npx decharge-scout

# Check dashboard - should see your agent!
```

## 📁 File Structure After Deployment

Your Vercel project will have:

```
your-vercel-project/
├── api/
│   ├── submit.js          → /api/submit
│   └── stats.js           → /api/stats
└── public/
    └── index.html         → / (root)
```

**Routes**:
- `/` → Dashboard UI
- `/api/submit` → POST endpoint for agents
- `/api/stats` → GET endpoint for analytics

## 🐛 Troubleshooting

### "No database connection"

```bash
# Check environment variables
vercel env ls

# Pull to local
vercel env pull

# Should create .env.local with POSTGRES_URL
```

### "Module not found"

```bash
# Make sure package.json is deployed
# Vercel auto-installs dependencies from package.json

# Check deployment logs:
vercel logs
```

### "CORS errors"

```bash
# APIs already include CORS headers
# If still seeing errors, check:
# - Browser console for actual error
# - Vercel function logs: vercel logs
```

### "No data showing"

```bash
# 1. Check database has tables:
#    Run schema.sql in Vercel Postgres query tab

# 2. Check CLI is configured:
#    .env should have DASHBOARD_API_URL

# 3. Check CLI is sending data:
#    npx decharge-scout
#    Look for: "Dashboard submission successful"
```

## 🔄 Update Existing Deployment

To update after making changes:

```bash
cd dashboard
git add .
git commit -m "Update dashboard"
git push

# Vercel will auto-deploy
# Or manually trigger:
vercel --prod
```

## 🌐 Custom Domain (Optional)

To use a custom domain:

```bash
# Via CLI:
vercel domains add yourdomain.com

# Or via dashboard:
# Project Settings → Domains → Add Domain
```

## 📊 Monitor Your Deployment

```bash
# View logs
vercel logs

# View deployments
vercel ls

# View project details
vercel inspect
```

## ✨ Your Deployment URLs

After deployment, you'll have:

| URL | Purpose |
|-----|---------|
| `https://your-domain.vercel.app` | Dashboard UI |
| `https://your-domain.vercel.app/api/submit` | Agent submission endpoint |
| `https://your-domain.vercel.app/api/stats` | Analytics API |

## 🎯 Quick Deploy Commands

```bash
# Full deployment flow:
cd dashboard
vercel link              # Link to existing project
vercel --prod           # Deploy to production

# Then in Vercel dashboard:
# 1. Create Postgres database
# 2. Run schema.sql
# 3. Done!
```

That's it! Your dashboard will be live on your existing Vercel deployment! 🚀
