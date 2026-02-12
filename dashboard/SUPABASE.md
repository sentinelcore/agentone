# Supabase Setup for DeCharge Scout

Quick reference for setting up Supabase database for the dashboard.

## 🚀 Quick Setup (5 minutes)

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign in/up (free tier available)
3. Click **"New Project"**
4. Fill in:
   - **Organization**: Select or create one
   - **Name**: `dechargescout`
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to you
   - **Pricing Plan**: Free tier is perfect
5. Click **"Create new project"**
6. Wait ~2 minutes for provisioning ☕

### 2. Run Database Schema

1. In Supabase dashboard, click **"SQL Editor"** (left sidebar)
2. Click **"+ New Query"**
3. Copy entire contents of `lib/schema.sql`
4. Paste into editor
5. Click **"Run"** or press `Ctrl+Enter`
6. Should see: ✅ **"Success. No rows returned"**

### 3. Get API Credentials

1. Click **"Project Settings"** (gear icon, bottom left)
2. Click **"API"** in left menu
3. Copy these two values:

```
Project URL: https://xxxxxxxxxxxxx.supabase.co
anon public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4. Add to Vercel

**Option A: Via CLI** (fastest)
```bash
cd dashboard
vercel env add SUPABASE_URL
# Paste: https://xxxxxxxxxxxxx.supabase.co

vercel env add SUPABASE_ANON_KEY
# Paste: eyJhbGci...

# Redeploy
vercel --prod
```

**Option B: Via Vercel Dashboard**
1. Go to your Vercel project
2. **Settings** → **Environment Variables**
3. Add two variables:
   - `SUPABASE_URL` = `https://xxxxxxxxxxxxx.supabase.co`
   - `SUPABASE_ANON_KEY` = `eyJhbGci...`
4. Select **all environments** (Production, Preview, Development)
5. Click **Save**
6. Redeploy your project

### 5. Test It! 🎉

```bash
# Test the stats API
curl https://your-domain.vercel.app/api/stats

# Should return:
# {"activeAgents":0,"totalSubmissions":0,"locations":[],...}

# Visit dashboard
# https://your-domain.vercel.app
```

## 📊 Verify Setup

### Check Tables Created

1. Go to **Table Editor** in Supabase dashboard
2. Should see two tables:
   - ✅ `agent_heartbeat`
   - ✅ `agent_submissions`

### Check Data Flowing

1. Run your CLI: `npx decharge-scout`
2. Check Supabase **Table Editor** → `agent_submissions`
3. Should see new rows appearing!

## 🔒 Security Notes

- The `anon` key is safe to use in frontend/edge functions
- It respects Row Level Security (RLS) policies
- For this dashboard, RLS is optional (data isn't sensitive)
- If you want to add RLS later, go to **Authentication** → **Policies**

## 💰 Free Tier Limits

Supabase free tier includes:
- ✅ 500 MB database space (plenty for agent data)
- ✅ 2 GB file storage
- ✅ 50,000 monthly active users
- ✅ Unlimited API requests
- ✅ Up to 500 MB egress

**Perfect for this use case!** Unless you're running thousands of agents 24/7, you'll never hit the limits.

## 🐛 Troubleshooting

### API returns "No data"
- Check Supabase credentials in Vercel env vars
- Redeploy after adding env vars
- Check Vercel logs: `vercel logs`

### Tables missing
- Re-run `schema.sql` in SQL Editor
- Check for errors in SQL output

### Connection errors
- Verify `SUPABASE_URL` starts with `https://`
- Verify `SUPABASE_ANON_KEY` is the **anon public** key (not service_role!)
- Check project is active in Supabase dashboard

## 🎯 One-Line Setup

```bash
# After creating Supabase project and running schema.sql:
vercel env add SUPABASE_URL && vercel env add SUPABASE_ANON_KEY && vercel --prod
```

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase JS Client](https://supabase.com/docs/reference/javascript/introduction)
- [Postgres on Supabase](https://supabase.com/docs/guides/database)

---

**That's it!** Your dashboard is now powered by Supabase 🚀
