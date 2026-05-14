# 🚀 Deployment Guide - YC Company Explorer

This guide walks you through deploying your YC Company Explorer to Vercel with Supabase as the database.

## 📋 Prerequisites

- [ ] Supabase account and project created
- [ ] Resend account and API key ([get one here](https://resend.com/api-keys))
- [ ] Vercel account ([sign up here](https://vercel.com))
- [ ] Git repository initialized

## Step 1: Configure Supabase

### 1.1 Get Your Connection String

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Click **Settings** → **Database**
4. Scroll to **Connection string** section
5. Select **URI** tab
6. **Important:** Use the **Connection pooling** URI (port `6543`)
   ```
   postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   ```

### 1.2 Update Your Local `.env` File

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your credentials:
   ```env
   DATABASE_URL=postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   RESEND_API_KEY=re_your_actual_api_key
   FRONTEND_URL=http://localhost:5173
   ```

### 1.3 Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 1.4 Run Database Migration

From the project root:

```bash
python run_migration.py
```

You should see:
```
✅ Migration completed successfully!
📊 Created tables:
   ✓ company_snapshots
   ✓ email_subscriptions
   ✓ roadmap_votes
   ✓ roadmap_vote_counts (materialized view)
🎉 Database is ready to use!
```

### 1.5 Seed Companies (from SQLite)

If you have a SQLite database with scraped YC companies (e.g. from `scrape_all_companies.py`):

```bash
python seed_supabase.py
```

This bulk-inserts all companies into Supabase in batches of 500, with progress output. Expect ~2 minutes for ~5,700 companies.

## Step 2: Test Locally

### 2.1 Quick Start (Recommended)

From the project root:

```bash
./run_dev.sh
```

This script:
- Creates a Python venv if not present
- Installs backend + frontend dependencies
- Starts backend (http://localhost:8000) and frontend (http://localhost:5173) together
- Press Ctrl+C to stop both

### 2.2 Manual Start

**Backend** (terminal 1):
```bash
cd backend
source ../venv/bin/activate  # or: python -m venv ../venv && source ../venv/bin/activate
uvicorn main:app --reload --port 8000
```

**Frontend** (terminal 2):
```bash
cd frontend
npm install
npm run dev
```

### 2.3 Test the Application

1. Open http://localhost:5173
2. Navigate to the **Insights** section
3. Test email subscription:
   - Enter your email
   - Submit the form
   - Check your inbox for verification email

4. Test roadmap voting:
   - Scroll to **Product Roadmap**
   - Click the upvote button on any feature
   - Refresh the page - your vote should persist

## Step 3: Deploy to Vercel

### 3.1 Install Vercel CLI (optional)

```bash
npm i -g vercel
```

### 3.2 Initialize Git Repository

If you haven't already:

```bash
git init
git add .
git commit -m "Initial commit - YC Company Explorer"
```

### 3.3 Push to GitHub

1. Create a new repository on GitHub
2. Push your code:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/exploreyc.git
   git branch -M main
   git push -u origin main
   ```

### 3.4 Deploy on Vercel

#### Option A: Via Vercel Dashboard (Recommended)

1. Go to [Vercel Dashboard](https://vercel.com/new)
2. Click **Import Project**
3. Import your GitHub repository
4. Vercel will auto-detect the monorepo structure from `vercel.json`
5. Click **Deploy**

#### Option B: Via CLI

```bash
vercel
```

Follow the prompts to link your project.

### 3.5 Configure Environment Variables on Vercel

1. Go to your project on Vercel Dashboard
2. Click **Settings** → **Environment Variables**
3. Add the following variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `VITE_API_URL` | `https://your-backend.up.railway.app` | **Required.** Full backend API URL (Railway, Render, etc.). Must include `https://`. |
| `DATABASE_URL` | `postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@...` | Your Supabase connection string |
| `RESEND_API_KEY` | `re_...` | Your Resend API key |
| `FRONTEND_URL` | `https://your-app.vercel.app` | Your production URL (Vercel will show this after first deploy) |
| `RESEND_FROM_EMAIL` | `YC Explorer <digest@your-domain.com>` | (Optional) Custom from email |

4. Click **Save** for each variable

### 3.6 Add Vercel Cron Jobs (Automatic)

The `vercel.json` file already configures two cron jobs:

- **Daily Snapshot**: Runs at 2:00 AM UTC
  ```
  POST /api/cron/daily-snapshot
  ```

- **Send Email Digests**: Runs at 10:00 AM UTC
  ```
  POST /api/cron/send-digests
  ```

No additional configuration needed! Vercel automatically enables these.

### 3.7 Secure Cron Endpoints (Optional but Recommended)

Add a `CRON_SECRET` environment variable on Vercel:

1. Generate a random secret:
   ```bash
   openssl rand -hex 32
   ```

2. Add to Vercel environment variables:
   ```
   CRON_SECRET=your_random_secret_here
   ```

3. When Vercel Cron calls your endpoints, include this header:
   ```
   Authorization: Bearer your_random_secret_here
   ```

### 3.8 Redeploy After Adding Environment Variables

After adding environment variables:

1. Go to **Deployments** tab
2. Click **...** on the latest deployment
3. Click **Redeploy**

Or use CLI:
```bash
vercel --prod
```

## Step 4: Configure Resend Domain (For Production Emails)

### 4.1 Add Your Domain to Resend

1. Go to [Resend Dashboard](https://resend.com/domains)
2. Click **Add Domain**
3. Enter your domain (e.g., `yc-explorer.com`)
4. Add the DNS records to your domain provider

### 4.2 Verify Domain

Wait for DNS propagation (5-30 minutes), then click **Verify**

### 4.3 Update Environment Variable

Update `RESEND_FROM_EMAIL` on Vercel:
```
RESEND_FROM_EMAIL=YC Explorer <digest@yc-explorer.com>
```

## Step 5: Test Production Deployment

1. Visit your production URL: `https://your-app.vercel.app`
2. Test email subscription with a real email
3. Check that verification emails are received
4. Test roadmap voting
5. Monitor cron jobs:
   - Check Vercel logs for cron execution
   - Verify daily snapshots are created
   - Confirm emails are sent

## 🔍 Monitoring & Debugging

### View Vercel Logs

```bash
vercel logs
```

Or visit: Vercel Dashboard → Project → Logs

### View Cron Job Logs

Vercel Dashboard → Project → Cron → Click on a job

### Test Cron Endpoints Manually

```bash
# Create daily snapshot
curl -X POST https://your-app.vercel.app/api/cron/daily-snapshot \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Send digests
curl -X POST https://your-app.vercel.app/api/cron/send-digests \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Query Database Directly

Use Supabase SQL Editor:
1. Supabase Dashboard → SQL Editor
2. Run queries:
   ```sql
   -- Check subscriptions
   SELECT * FROM email_subscriptions;

   -- Check votes
   SELECT * FROM roadmap_vote_counts;

   -- Check snapshots
   SELECT snapshot_date, COUNT(*) as companies
   FROM company_snapshots
   GROUP BY snapshot_date
   ORDER BY snapshot_date DESC;
   ```

## 🎉 You're Done!

Your YC Company Explorer is now live with:

- ✅ Persistent PostgreSQL database (Supabase)
- ✅ Email notifications (Resend)
- ✅ Daily company snapshots
- ✅ Automated email digests
- ✅ Persistent roadmap voting
- ✅ Production hosting (Vercel)

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Resend Documentation](https://resend.com/docs)
- [FastAPI on Vercel](https://vercel.com/docs/frameworks/python)

## 🐛 Troubleshooting

### "Database connection failed"

- Verify `DATABASE_URL` is correct in Vercel environment variables
- Ensure you're using the **Connection pooling** URI (port 6543)
- Check Supabase project is active

### "Email not sending"

- Verify `RESEND_API_KEY` is correct
- Check Resend dashboard for send logs
- Verify domain is verified (if using custom domain)
- Check email isn't in spam folder

### "Cron jobs not running"

- Check Vercel logs for cron execution
- Verify `vercel.json` is in repository root
- Ensure cron paths match your API routes

### "Frontend not loading"

- Check build logs in Vercel dashboard
- Verify `frontend/package.json` has build script
- Check for TypeScript or build errors

---

Need help? Check the logs or reach out to the community! 🚀
