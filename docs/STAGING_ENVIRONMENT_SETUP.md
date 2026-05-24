# Staging Environment Setup

To ensure safe deployment of the HotelPlus Autonomous Agent Recommendation Engine, a staging environment must be utilized before deploying to production.

## 1. InsForge Database
1. Create a new InsForge project designated for staging (e.g., `hotelplus-staging`).
2. Run all SQL migrations (`scripts/*.sql`) against this new InsForge project.
3. Obtain the connection string and service role keys.

## 2. Antigravity-Cloud VM (Backend)
1. Provision a new VM instance (`Antigravity-Cloud-Staging`).
2. Clone the `main` branch into `/home/tripzydevops/hotel`.
3. Set the environment variables in `.env`:
   - `INSFORGE_URL` -> Pointing to the staging InsForge instance.
   - `INSFORGE_SERVICE_ROLE_KEY` -> Staging key.
   - `GEMINI_API_KEY` -> Dedicated staging key (or shared, if allowed by limits).

## 3. Vercel (Frontend)
1. In the Vercel dashboard, navigate to the HotelPlus project.
2. Go to **Settings > Environment Variables**.
3. Create environment variables specifically for the **Preview** environment:
   - `NEXT_PUBLIC_SUPABASE_URL` -> Staging InsForge URL.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` -> Staging InsForge Anon Key.
4. Push to a branch (e.g., `staging`) to trigger a Preview deployment. Vercel will automatically inject the staging environment variables.

## 4. End-to-End Testing
1. Once the Vercel Preview URL is generated, execute the Playwright test suite against it:
   ```bash
   PLAYWRIGHT_TEST_BASE_URL=<VERCEL_PREVIEW_URL> npx playwright test
   ```
2. Run the Locust load test against the staging backend VM.
