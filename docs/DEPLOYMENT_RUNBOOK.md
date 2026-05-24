# HotelPlus Deployment Runbook

This runbook outlines the steps to deploy the HotelPlus platform (formerly HotelRateSentinel/HotelPlus) to production.

## 1. Architecture Overview
- **Frontend**: Next.js 15, React, Tailwind CSS, deployed on **Vercel**.
- **Backend**: Python FastAPI, deployed on **Antigravity-Cloud VM** (or equivalent cloud instance).
- **Database**: **InsForge** (Supabase clone/BaaS) running PostgreSQL with `pgvector` and `PostgREST`.

## 2. Pre-Deployment Checks
1. Ensure all tests pass:
   ```bash
   pytest backend/tests/
   npx playwright test
   ```
2. Ensure Vercel build succeeds:
   ```bash
   npm run build
   ```

## 3. Database Migration Deployment
Before deploying backend code, apply any new SQL migrations to InsForge.
1. Connect to the InsForge SQL Console.
2. Execute the migration scripts in the `scripts/` directory in sequential order.
   *E.g., `041_market_analysis_rpc.sql` -> `042_add_hotel_embeddings.sql`*

## 4. Backend Deployment
Deploying to the Python backend VM:
1. SSH into the production VM:
   ```bash
   ssh tripzydevops@Antigravity-Cloud
   ```
2. Pull latest code from `main`:
   ```bash
   cd /home/tripzydevops/hotel
   git pull origin main
   ```
3. Restart the FastAPI service:
   ```bash
   sudo systemctl restart tripzy-backend.service
   ```
4. Verify backend health:
   ```bash
   curl https://api.tripzy.travel/health
   ```

## 5. Frontend Deployment
Vercel handles continuous deployment from the `main` branch.
1. Ensure the `NEXT_PUBLIC_SUPABASE_URL` matches the InsForge project URL perfectly without a trailing slash.
2. The deployment is triggered automatically on `git push`.
3. To view logs or trigger a manual deploy, use the Vercel CLI:
   ```bash
   vercel --prod
   ```

## 6. Rollback Procedures
**If the frontend breaks:**
- Use the Vercel dashboard to instantly promote the previous successful deployment.

**If the backend breaks:**
- SSH into the VM, checkout the previous git hash, and restart the service:
   ```bash
   git checkout <PREVIOUS_COMMIT_HASH>
   sudo systemctl restart tripzy-backend.service
   ```

**If the database migration breaks:**
- Execute the `DOWN` migration script manually via the InsForge console, or restore from the latest point-in-time backup.
