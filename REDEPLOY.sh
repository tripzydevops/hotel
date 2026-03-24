#!/bin/bash
# Hotel Rate Monitor - High-Speed Production Sync
# Use this to restore the live site after fixes.

echo "🚀 Syncing fixes to Production..."
npx vercel --prod --yes \
  -e NEXT_PUBLIC_SUPABASE_URL="https://pa5riyqv.insforge.site" \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwODIwNDB9.H4Unbw_QgpvcAV-qytM9WUkk0s74So1Dnj318lt_2ZQ" \
  -e SUPABASE_SERVICE_ROLE_KEY="ik_4697b4a8df7380fb98a348d2d8c6d163" \
  -e DATAFORSEO_LOGIN="successofmentors@gmail.com" \
  -e DATAFORSEO_PASSWORD="d276748f9354ec68"

echo "✅ Deployment complete. Check https://pa5riyqv.insforge.site"
