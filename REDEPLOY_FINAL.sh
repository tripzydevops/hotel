#!/bin/bash
# FINAL RESTORATION SCRIPT
# This script uses the InsForge CLI for production sync.

echo "🧹 Cleaning previous staging..."
rm -rf /tmp/hotel_clean_v2

echo "🏗️ Staging clean production files..."
mkdir -p /tmp/hotel_clean_v2
cp -r . /tmp/hotel_clean_v2/
# Remove massive directories to avoid Vercel 429
rm -rf /tmp/hotel_clean_v2/.git
rm -rf /tmp/hotel_clean_v2/node_modules
rm -rf /tmp/hotel_clean_v2/.next
rm -rf /tmp/hotel_clean_v2/api

echo "🚀 Syncing fixes to Production via InsForge CLI..."
npx -y @insforge/cli deployments deploy /tmp/hotel_clean_v2 \
  --project-id "c6db35ac-d7e6-43a4-956d-ad71853f0b3b" \
  --org-id "9703085f-6c6c-43aa-940e-4fcb5974e972" \
  --api-key "ik_4697b4a8df7380fb98a348d2d8c6d163" \
  -e NEXT_PUBLIC_SUPABASE_URL="https://pa5riyqv.eu-central.insforge.app" \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzODU2NzB9.QcH46u7_cx8epqDLq5pzroc0TTR9KGqziucnbcKOUDk" \
  -e SUPABASE_SERVICE_ROLE_KEY="ik_4697b4a8df7380fb98a348d2d8c6d163" \
  -e DATAFORSEO_LOGIN="successofmentors@gmail.com" \
  -e DATAFORSEO_PASSWORD="d276748f9354ec68"

echo "✅ Sync initiated. Please check https://insforge.site/ in 2-3 minutes."
