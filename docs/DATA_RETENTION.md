# Data Retention & Storage Optimization

This document outlines the background infrastructure strategies implemented to keep the Hotel Rate Sentinel lightweight and cost-effective.

## Overview
Because the application utilizes a Serverless Cron approach that wakes up every 15 minutes, the system generates over 35,000 log events per year. Furthermore, when the AI Agents execute a scan, they save their complete "Thought Traces" and raw JSON scraping results to the database for debugging purposes.

To prevent the server's hard drive from filling up with text logs and to prevent Supabase database storage costs from escalating due to heavy JSON data, we employ an automated pruning strategy.

## 1. Server Log Rotation (`logrotate`)
All background scheduler activity and errors are logged to text files in the project root (`scheduler.log`, `scheduler_errors.log`, `cron_trigger.log`, `logs.json`).

We use the industry-standard Linux utility `logrotate` to manage these files securely.
- **Configuration Location:** `/etc/logrotate.d/tripzy-hotel` (on the production VM)
- **Policy:** 
  - Logs are rotated **weekly**.
  - Old logs are compressed into `.gz` files to drastically reduce file size.
  - The system keeps a maximum of **4 weeks of history**; older logs are permanently deleted.

## 2. Database Session Pruning 
The `scan_sessions` table in Supabase acts as a temporary state machine for the fast execution of agents. Once a scan successfully finishes and pushes its final, summarized metrics to the permanent data tables (e.g. `market_table`), the raw trace data is no longer necessary.

We keep this data for debugging, but delete it once it becomes stale.

- **Script:** `backend/scripts/prune_db_sessions.py`
- **Policy:** The script connects to Supabase and permanently deletes any row in the `scan_sessions` table where `created_at` is older than **30 days**.
- **Automation:** A system-level cron job executes this script every day at 3:00 AM server time.

### How to Monitor
You can verify the results of the daily database pruning by viewing the cron trigger logs on the deployment server:
```bash
tail -n 50 /home/tripzydevops/hotel/cron_trigger.log
```
