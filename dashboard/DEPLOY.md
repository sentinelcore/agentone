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

## 🗄️ Database Setup with Supabase (Required!)

After deploying, set up Supabase:

### Step 1: Create Supabase Project

```bash
# 1. Go to https://supabase.com
# 2. Click "New Project"
# 3. Fill in:
#    - Name: dechargescout
#    - Database Password: [generate a strong password]
#    - Region: Choose closest to you
# 4. Click "Create project"
# 5. Wait ~2 minutes for provisioning
```

### Step 2: Run Database Schema

```bash
# 1. In Supabase dashboard, go to:
#    SQL Editor (left sidebar)

# 2. Click "+ New Query"

# 3. Copy contents of dashboard/lib/schema.sql

# 4. Paste and click "Run" (or Ctrl+Enter)

# You should see: "Success. No rows returned"
```

### Step 3: Get API Credentials

```bash
# In Supabase dashboard, go to:
# Project Settings (gear icon) → API

# Copy these values:
# - Project URL (e.g., https://xxxxx.supabase.co)
# - anon/public key (starts with "eyJ...")
```

### Step 4: Add to Vercel Environment Variables

```bash
# Option A: Via Vercel CLI
vercel env add SUPABASE_URL
# Paste your Project URL

vercel env add SUPABASE_ANON_KEY
# Paste your anon/public key

# Option B: Via Vercel Dashboard
# 1. Go to your project settings
# 2. Environment Variables
# 3. Add:
#    SUPABASE_URL = https://xxxxx.supabase.co
#    SUPABASE_ANON_KEY = eyJ...
# 4. Select all environments (Production, Preview, Development)
# 5. Save
```

### Step 5: Redeploy

```bash
# After adding env vars, redeploy:
vercel --prod

# Or push a commit to trigger auto-deploy
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

# Should show:
# SUPABASE_URL
# SUPABASE_ANON_KEY

# Pull to local
vercel env pull

# Should create .env.local with both variables
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
#    Go to Supabase → Table Editor
#    Should see: agent_submissions, agent_heartbeat

# 2. If tables missing, run schema.sql again in SQL Editor

# 3. Check CLI is configured:
#    .env should have DASHBOARD_API_URL

# 4. Check CLI is sending data:
#    npx decharge-scout
#    Look for: "Dashboard submission successful"

# 5. Check Vercel has env vars:
#    vercel env ls
#    Should show SUPABASE_URL and SUPABASE_ANON_KEY
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

# Then:
# 1. Create Supabase project
# 2. Run schema.sql in Supabase SQL Editor
# 3. Add SUPABASE_URL and SUPABASE_ANON_KEY to Vercel env vars
# 4. Redeploy: vercel --prod
# 5. Done!
```

That's it! Your dashboard will be live on your existing Vercel deployment! 🚀
